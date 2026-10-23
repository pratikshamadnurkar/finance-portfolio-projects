const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map();
const inflight = new Map();

function apiKey() {
  return (process.env.INDIANAPI_API_KEY || process.env.API_TOKEN || '').trim();
}

export function isIndianApiConfigured() {
  const key = apiKey();
  return Boolean(key && key !== 'your-indianapi-api-key');
}

export async function getIndianApiStock(name) {
  const key = apiKey();
  if (!key || key === 'your-indianapi-api-key') {
    throw new Error('IndianAPI key is not available to the server. Set INDIANAPI_API_KEY in the project .env file and restart the server.');
  }

  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('Provide a company name or ticker.');
  const url = new URL('https://stock.indianapi.in/stock');
  url.searchParams.set('name', normalizedName);
  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.value;
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  const request = (async () => {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'X-API-Key': key },
    });
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error(`IndianAPI returned an unreadable response (HTTP ${response.status}).`); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('IndianAPI rejected the key. Check the value saved as INDIANAPI_API_KEY in the project .env file.');
      if (response.status === 404) throw new Error(`${normalizedName} was not found by IndianAPI. Try the listed company name or NSE ticker.`);
      if (response.status === 429) throw new Error('IndianAPI rate limit reached. Wait briefly and retry.');
      const details = payload?.detail || payload?.message || payload?.error;
      throw new Error(`IndianAPI returned HTTP ${response.status}${details ? `: ${String(details)}` : '.'}`);
    }
    const value = payload?.data && !payload.companyName && !payload.tickerId ? payload.data : payload;
    cache.set(cacheKey, { value, cachedAt: Date.now() });
    return value;
  })();
  inflight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (inflight.get(cacheKey) === request) inflight.delete(cacheKey);
  }
}

function keyText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function numericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || /^(n\/a|na|null|none|-)$/i.test(text)) return null;
  const negative = /^\(.*\)$/.test(text);
  const parsed = Number(text.replace(/[₹$,]/g, '').replace(/\b(?:INR|Rs\.?|rupees?)\b/gi, '').replace(/%/g, '').replace(/[()\s]/g, ''));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function statementLine(record, section, aliases) {
  const wanted = new Set(aliases.map(keyText));
  const row = (record?.stockFinancialMap?.[section] || []).find((item) => wanted.has(keyText(item.key)) || wanted.has(keyText(item.displayName)));
  return numericValue(row?.value);
}

function keyMetric(keyMetrics, pattern) {
  for (const rows of Object.values(keyMetrics || {})) {
    if (!Array.isArray(rows)) continue;
    const row = rows.find((item) => pattern.test(String(item.displayName || '')));
    const value = numericValue(row?.value);
    if (value !== null) return value;
  }
  return null;
}

function ratio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

export function normalizeIndianApiCompany(symbol, company, payload) {
  const annual = (payload?.financials || payload?.stockFinancialData || [])
    .filter((item) => item?.stockFinancialMap && (!item.Type || String(item.Type).toLowerCase() === 'annual'))
    .sort((a, b) => Number(b.FiscalYear) - Number(a.FiscalYear));
  if (!annual.length) throw new Error('IndianAPI returned no annual financial statements for this company.');

  const readYear = (record) => {
    const income = {
      revenue: statementLine(record, 'INC', ['Revenue', 'TotalRevenue']),
      grossProfit: statementLine(record, 'INC', ['GrossProfit']),
      operatingIncome: statementLine(record, 'INC', ['OperatingIncome']),
      netIncome: statementLine(record, 'INC', ['NetIncome']),
      depreciation: statementLine(record, 'INC', ['Depreciation/Amortization', 'Depreciation/Depletion']),
    };
    const balance = {
      currentAssets: statementLine(record, 'BAL', ['TotalCurrentAssets']),
      currentLiabilities: statementLine(record, 'BAL', ['TotalCurrentLiabilities']),
      equity: statementLine(record, 'BAL', ['TotalEquity']),
      debt: statementLine(record, 'BAL', ['TotalDebt']),
      cash: statementLine(record, 'BAL', ['Cash']),
    };
    const cashFlow = {
      operatingCashFlow: statementLine(record, 'CAS', ['CashfromOperatingActivities']),
      capex: statementLine(record, 'CAS', ['CapitalExpenditures']),
    };
    return { ...income, ...balance, ...cashFlow };
  };

  const latestRecord = annual[0];
  const previousRecord = annual[1];
  const current = readYear(latestRecord);
  const previous = previousRecord ? readYear(previousRecord) : {};
  const keyMetrics = payload?.keyMetrics || {};
  const ebitda = current.operatingIncome !== null && current.depreciation !== null
    ? current.operatingIncome + current.depreciation
    : null;
  const freeCashFlow = current.operatingCashFlow !== null && current.capex !== null
    ? current.operatingCashFlow - Math.abs(current.capex)
    : null;
  const ratios = {
    revenueGrowth: current.revenue !== null && previous.revenue ? ((current.revenue / previous.revenue) - 1) * 100 : null,
    grossMargin: current.revenue && current.grossProfit !== null ? ratio(current.grossProfit, current.revenue) * 100 : null,
    operatingMargin: current.revenue && current.operatingIncome !== null ? ratio(current.operatingIncome, current.revenue) * 100 : null,
    netMargin: current.revenue && current.netIncome !== null ? ratio(current.netIncome, current.revenue) * 100 : null,
    roe: keyMetric(keyMetrics, /return on average equity\s*-\s*most recent fiscal year/i)
      ?? (current.netIncome !== null && current.equity !== null ? ratio(current.netIncome, current.equity) * 100 : null),
    roa: keyMetric(keyMetrics, /return on average assets\s*-\s*most recent fiscal year/i),
    roce: keyMetric(keyMetrics, /return on capital employed\s*-\s*most recent fiscal year/i),
    currentRatio: keyMetric(keyMetrics, /current ratio\s*-\s*most recent fiscal year/i)
      ?? ratio(current.currentAssets, current.currentLiabilities),
    debtEquity: keyMetric(keyMetrics, /total debt\/total equity\s*-\s*most recent fiscal year/i)
      ?? ratio(current.debt, current.equity),
    netDebtEbitda: current.debt !== null && current.cash !== null ? ratio(current.debt - current.cash, ebitda) : null,
    pe: keyMetric(keyMetrics, /P\/E excluding extraordinary items,\s*most recent fiscal year/i),
    pb: keyMetric(keyMetrics, /price to book\s*-\s*most recent fiscal year/i),
    evEbitda: keyMetric(keyMetrics, /EV\/EBITDA.*most recent fiscal year/i),
    fcfYield: null,
  };
  const history = {};
  for (const record of [...annual].reverse()) {
    const year = Number(record.FiscalYear);
    const values = readYear(record);
    if (!Number.isFinite(year) || values.revenue === null) continue;
    history[year] = {
      revenue: values.revenue,
      operatingMargin: values.operatingIncome !== null ? ratio(values.operatingIncome, values.revenue) * 100 : null,
    };
  }
  if (current.revenue === null && !Object.values(ratios).some((value) => value !== null)) {
    throw new Error('IndianAPI returned financial statements, but the revenue and ratio line items could not be mapped.');
  }

  return {
    ...company,
    symbol,
    ratios,
    history,
    revenueCrores: current.revenue,
    freeCashFlowCrores: freeCashFlow,
    periodEnd: latestRecord.EndDate || null,
    fiscalYear: Number(latestRecord.FiscalYear) || null,
    currency: 'INR',
    source: 'IndianAPI stock API',
    filingUrl: null,
    unitKnown: true,
  };
}

export function indiaCompanyMetadata(symbol, payload, previous = {}) {
  const profile = payload?.companyProfile || {};
  const ticker = String(payload?.tickerId || profile.exchangeCodeNse || symbol.split('.')[0])
    .trim().toUpperCase().replace(/\.(?:BSE|NSE|BO|NS)$/, '').replace(/[^A-Z0-9]/g, '');
  const preferredExchange = symbol.match(/\.(BSE|NSE)$/)?.[1] || 'NSE';
  return {
    ...previous,
    symbol: `${ticker}.${preferredExchange}`,
    name: payload?.companyName || previous.name || ticker,
    sector: payload?.industry || profile.mgIndustry || profile.industry || profile.sector || previous.sector || 'Indian listed company',
    exchange: preferredExchange,
    currency: 'INR',
  };
}
