import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COMPANIES } from '../src/data/companies.js';
import { INDIA_COMPANIES } from '../src/data/indiaCompanies.js';
import { getIndianApiStock, indiaCompanyMetadata, isIndianApiConfigured, normalizeIndianApiCompany } from './indianapi.js';
import { isEodhdConfigured, searchEodhd } from './eodhd.js';

const app = express();
const port = Number(process.env.PORT || 3002);
const SEC_USER_AGENT = process.env.SEC_USER_AGENT?.trim();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const responseCache = new Map();
const dynamicCompanies = new Map();
const indiaResponseCache = new Map();
const dynamicIndiaCompanies = new Map();
const indiaStockPayloads = new Map();
const ukResponseCache = new Map();
const ukErrorCache = new Map();
const dynamicUkCompanies = new Map();
const MARKET_CATALOG = JSON.parse(readFileSync(new URL('../src/data/market-symbols.json', import.meta.url), 'utf8'));
let tickerMapCache = null;
let lastSecRequestAt = 0;

const USD_TAGS = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'SalesRevenueGoodsNet'],
  grossProfit: ['GrossProfit'],
  costOfRevenue: ['CostOfRevenue', 'CostOfGoodsAndServicesSold'],
  operatingIncome: ['OperatingIncomeLoss'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  currentAssets: ['AssetsCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  longDebt: ['LongTermDebtAndFinanceLeaseObligations', 'LongTermDebt', 'LongTermDebtNoncurrent'],
  currentDebt: ['LongTermDebtCurrent', 'ShortTermBorrowings', 'ShortTermDebtCurrent'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  depreciation: ['DepreciationDepletionAndAmortization', 'DepreciationDepletionAndAmortizationPropertyPlantAndEquipment', 'DepreciationAmortizationAndAccretionNet'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
};

function latestRows(usGaap, tags, instant = false) {
  for (const tag of tags) {
    const fact = usGaap?.[tag];
    if (!fact?.units) continue;
    const unitName = fact.units.USD ? 'USD' : Object.keys(fact.units)[0];
    const rows = (fact.units[unitName] || [])
      .filter((row) => row.form === '10-K' && row.end && row.filed && Number.isFinite(Number(row.val)))
      .filter((row) => instant ? !row.start : row.start && (new Date(row.end) - new Date(row.start)) / 86400000 >= 300)
      .sort((a, b) => a.end.localeCompare(b.end) || a.filed.localeCompare(b.filed));
    if (!rows.length) continue;

    const byEnd = new Map();
    for (const row of rows) byEnd.set(row.end, row);
    const unique = [...byEnd.values()].sort((a, b) => b.end.localeCompare(a.end));
    if (unique.length) return unique;
  }
  return [];
}

function num(row) {
  if (!row) return null;
  const value = Number(row.val);
  return Number.isFinite(value) ? value : null;
}

function ratio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function annualSeries(usGaap, tagNames) {
  const rows = latestRows(usGaap, tagNames, false);
  return rows.slice(0, 5).reverse();
}

function instantValue(usGaap, tagNames, periodEnd) {
  const rows = latestRows(usGaap, tagNames, true);
  return num(rows.find((row) => row.end === periodEnd) || rows[0]);
}

function normalizeCompany(symbol, companyFacts, companyMeta) {
  const usGaap = companyFacts?.facts?.['us-gaap'] || {};
  const revenueRows = annualSeries(usGaap, USD_TAGS.revenue);
  if (!revenueRows.length) throw new Error('No annual revenue fact was found in SEC Company Facts.');

  const revenueByEnd = new Map(revenueRows.map((row) => [row.end, row]));
  const annualRows = [...revenueByEnd.values()].sort((a, b) => b.end.localeCompare(a.end));
  const currentRevenueRow = annualRows[0];
  const priorRevenueRow = annualRows[1];
  const periodEnd = currentRevenueRow.end;

  const grossRows = annualSeries(usGaap, USD_TAGS.grossProfit);
  const operatingRows = annualSeries(usGaap, USD_TAGS.operatingIncome);
  const netIncomeRows = annualSeries(usGaap, USD_TAGS.netIncome);
  const grossByEnd = new Map(grossRows.map((row) => [row.end, row]));
  const operatingByEnd = new Map(operatingRows.map((row) => [row.end, row]));
  const netByEnd = new Map(netIncomeRows.map((row) => [row.end, row]));

  const revenue = num(currentRevenueRow);
  const priorRevenue = num(priorRevenueRow);
  let grossProfit = num(grossByEnd.get(periodEnd));
  if (grossProfit === null) {
    const costRows = annualSeries(usGaap, USD_TAGS.costOfRevenue);
    const cost = num(costRows.find((row) => row.end === periodEnd));
    if (cost !== null) grossProfit = revenue - cost;
  }
  const operatingIncome = num(operatingByEnd.get(periodEnd));
  const netIncome = num(netByEnd.get(periodEnd));
  const currentAssets = instantValue(usGaap, USD_TAGS.currentAssets, periodEnd);
  const currentLiabilities = instantValue(usGaap, USD_TAGS.currentLiabilities, periodEnd);
  const equity = instantValue(usGaap, USD_TAGS.equity, periodEnd);
  const priorEquity = annualRows[1] ? instantValue(usGaap, USD_TAGS.equity, annualRows[1].end) : null;
  const averageEquity = equity !== null && priorEquity !== null ? (equity + priorEquity) / 2 : equity;
  const longDebt = instantValue(usGaap, USD_TAGS.longDebt, periodEnd);
  const currentDebt = instantValue(usGaap, USD_TAGS.currentDebt, periodEnd);
  const cash = instantValue(usGaap, USD_TAGS.cash, periodEnd);
  const debt = longDebt === null && currentDebt === null ? null : (longDebt || 0) + (currentDebt || 0);
  const depreciationRows = annualSeries(usGaap, USD_TAGS.depreciation);
  const depreciation = num(depreciationRows.find((row) => row.end === periodEnd));
  const ebitda = operatingIncome !== null && depreciation !== null ? operatingIncome + depreciation : null;
  const cfoRows = annualSeries(usGaap, USD_TAGS.operatingCashFlow);
  const capexRows = annualSeries(usGaap, USD_TAGS.capex);
  const operatingCashFlow = num(cfoRows.find((row) => row.end === periodEnd));
  const capex = num(capexRows.find((row) => row.end === periodEnd));
  const fcf = operatingCashFlow !== null && capex !== null ? operatingCashFlow - capex : null;

  const ratios = {
    revenueGrowth: priorRevenue ? ((revenue / priorRevenue) - 1) * 100 : null,
    grossMargin: grossProfit === null ? null : ratio(grossProfit, revenue) * 100,
    operatingMargin: operatingIncome === null ? null : ratio(operatingIncome, revenue) * 100,
    netMargin: netIncome === null ? null : ratio(netIncome, revenue) * 100,
    roe: netIncome === null ? null : ratio(netIncome, averageEquity) * 100,
    currentRatio: ratio(currentAssets, currentLiabilities),
    debtEquity: ratio(debt, equity),
    netDebtEbitda: debt === null || cash === null ? null : ratio(debt - cash, ebitda),
    pe: null,
    fcfYield: null,
  };

  const operatingByEndMap = new Map(operatingRows.map((row) => [row.end, num(row)]));
  const history = {};
  for (const row of annualRows.slice(0, 4).reverse()) {
    const year = Number(row.end.slice(0, 4));
    const rowRevenue = num(row);
    history[year] = {
      revenue: rowRevenue === null ? null : rowRevenue / 1e9,
      operatingMargin: ratio(operatingByEndMap.get(row.end), rowRevenue) === null ? null : ratio(operatingByEndMap.get(row.end), rowRevenue) * 100,
    };
  }

  const filingDate = [currentRevenueRow, operatingByEnd.get(periodEnd), netByEnd.get(periodEnd)]
    .filter(Boolean).map((row) => row.filed).sort().at(-1) || currentRevenueRow.filed;
  const accession = currentRevenueRow.accn;
  const cikNoZero = String(Number(companyMeta.cik));
  const filingUrl = accession
    ? `https://www.sec.gov/Archives/edgar/data/${cikNoZero}/${accession.replaceAll('-', '')}/${accession}-index.htm`
    : `https://www.sec.gov/edgar/browse/?CIK=${cikNoZero}`;

  return {
    ...companyMeta,
    symbol,
    ratios,
    history,
    freeCashFlowBillions: fcf === null ? null : fcf / 1e9,
    revenueBillions: revenue / 1e9,
    periodEnd,
    fiscalYear: currentRevenueRow.fy || Number(periodEnd.slice(0, 4)),
    filed: filingDate,
    source: 'SEC EDGAR Company Facts',
    filingUrl,
  };
}

async function waitForSecSlot() {
  const waitMs = Math.max(0, 1250 - (Date.now() - lastSecRequestAt));
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastSecRequestAt = Date.now();
}

function requireSecUserAgent() {
  if (!SEC_USER_AGENT || SEC_USER_AGENT.includes('your-email@example.com')) {
    throw new Error('SEC_USER_AGENT is not configured. Copy .env.example to .env and add your app name and contact email.');
  }
}

function companyMetaForApi(company) {
  const { demo: _demo, ...metadata } = company;
  return metadata;
}

async function secJson(url) {
  requireSecUserAgent();
  await waitForSecSlot();
  const response = await fetch(url, {
    headers: { 'User-Agent': SEC_USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`SEC returned ${response.status}. Try again later.`);
  return response.json();
}

async function getTickerMap() {
  if (tickerMapCache && Date.now() - tickerMapCache.cachedAt < 24 * 60 * 60 * 1000) return tickerMapCache.value;
  const payload = await secJson('https://www.sec.gov/files/company_tickers_exchange.json');
  const fields = payload.fields || [];
  const rows = Array.isArray(payload.data) ? payload.data : Object.values(payload);
  const entries = rows.map((row) => {
    if (Array.isArray(row)) {
      const object = Object.fromEntries(fields.map((field, index) => [field, row[index]]));
      return { cik: object.cik, name: object.name, ticker: object.ticker, exchange: object.exchange };
    }
    return row;
  }).filter((row) => row && row.ticker && row.cik);
  tickerMapCache = { value: entries, cachedAt: Date.now() };
  return entries;
}

async function resolveCompany(symbol) {
  if (COMPANIES[symbol]) return companyMetaForApi(COMPANIES[symbol]);
  if (dynamicCompanies.has(symbol)) return dynamicCompanies.get(symbol);
  const entries = await getTickerMap();
  const match = entries.find((item) => String(item.ticker).toUpperCase() === symbol);
  if (!match) throw new Error(`${symbol} was not found in the SEC ticker list. Add a public SEC reporting company ticker.`);
  const colorPalette = ['#7658b7', '#408b83', '#c06c4e', '#4b75ba'];
  const companyMeta = {
    symbol,
    name: match.name,
    sector: 'SEC reporting company',
    exchange: match.exchange || 'SEC filer',
    cik: String(match.cik).padStart(10, '0'),
    color: colorPalette[dynamicCompanies.size % colorPalette.length],
    peers: ['AAPL', 'MSFT', 'NVDA'].filter((peer) => peer !== symbol),
  };
  dynamicCompanies.set(symbol, companyMeta);
  return companyMeta;
}

async function fetchCompany(symbol, companyMeta) {
  const meta = companyMeta || await resolveCompany(symbol);
  const cached = responseCache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.value;

  const cik = meta.cik;
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  let facts;
  try {
    facts = await secJson(url);
  } catch (error) {
    throw new Error(`${symbol}: ${error.message}`);
  }
  const value = normalizeCompany(symbol, facts, meta);
  responseCache.set(symbol, { value, cachedAt: Date.now() });
  return value;
}

function indiaQueryParts(input) {
  const raw = String(input || '').trim();
  const query = raw.toUpperCase();
  const suffix = query.match(/\.(BSE|NSE)$/)?.[1] || null;
  return { raw, query, symbol: query.replace(/\.(BSE|NSE)$/, ''), preferredExchange: suffix };
}

async function resolveIndiaCompany(input) {
  const { raw, query, symbol, preferredExchange } = indiaQueryParts(input);
  const knownCompanies = [...Object.values(INDIA_COMPANIES), ...dynamicIndiaCompanies.values()];
  const existing = knownCompanies.find((company) => company.symbol === query
    || company.symbol === `${symbol}.${preferredExchange}`
    || company.name.toUpperCase() === query);
  const lookupName = existing ? existing.symbol.split('.')[0] : (preferredExchange ? symbol : raw);
  const payload = await getIndianApiStock(lookupName);
  const colorPalette = ['#7658b7', '#408b83', '#c06c4e', '#4b75ba'];
  const exchangeSymbol = existing?.symbol || `${symbol}.${preferredExchange || 'NSE'}`;
  const fallback = existing || {
    color: colorPalette[dynamicIndiaCompanies.size % colorPalette.length],
    peers: ['RELIANCE.BSE', 'TCS.BSE', 'INFY.BSE'],
  };
  const company = indiaCompanyMetadata(exchangeSymbol, payload, fallback);
  company.peers = (company.peers || []).filter((peer) => peer !== company.symbol && (INDIA_COMPANIES[peer] || dynamicIndiaCompanies.has(peer))).slice(0, 3);
  if (!INDIA_COMPANIES[company.symbol]) dynamicIndiaCompanies.set(company.symbol, company);
  indiaStockPayloads.set(company.symbol, payload);
  return company;
}

async function fetchIndiaCompany(symbol, company) {
  const cached = indiaResponseCache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < 60 * 60 * 1000) return cached.value;
  const payload = indiaStockPayloads.get(symbol) || await getIndianApiStock(symbol.split('.')[0] || company.name);
  const metadata = indiaCompanyMetadata(symbol, payload, company);
  const value = normalizeIndianApiCompany(symbol, metadata, payload);
  indiaResponseCache.set(symbol, { value, cachedAt: Date.now() });
  return value;
}

function compactSearchText(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function marketCatalogCandidate(market, entry) {
  const details = MARKET_CATALOG.markets[market];
  return {
    market,
    country: details.name,
    countryCode: details.countryCode,
    currency: details.currency,
    provider: details.provider,
    symbol: entry.symbol,
    secTicker: entry.secTicker,
    name: entry.name,
    exchange: entry.exchange || details.exchange || details.name,
    aliases: entry.aliases || [],
    color: entry.color,
    peers: entry.peers || [],
    source: 'local-catalog',
  };
}

function searchLocalCatalog(query) {
  const queryText = compactSearchText(query);
  if (queryText.length < 2) return [];
  const matches = [];
  for (const [market, details] of Object.entries(MARKET_CATALOG.markets)) {
    for (const entry of details.symbols) {
      const labels = [entry.symbol, entry.symbol.split('.')[0], entry.name, ...(entry.aliases || [])].map(compactSearchText);
      let score = 0;
      if (labels.includes(queryText)) score = 100;
      else if (labels.some((label) => label.startsWith(queryText))) score = 75;
      else if (labels.some((label) => label.includes(queryText))) score = 50;
      if (score) matches.push({ ...marketCatalogCandidate(market, entry), score });
    }
  }
  return matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 20);
}

function searchSecTickerMap(query) {
  const term = compactSearchText(query);
  return (tickerMapCache?.value || []).map((entry) => {
    const ticker = String(entry.ticker || '').toUpperCase();
    const name = String(entry.name || '');
    const tickerText = compactSearchText(ticker);
    const nameText = compactSearchText(name);
    const score = tickerText === term ? 100 : nameText === term ? 95 : tickerText.startsWith(term) ? 80 : nameText.startsWith(term) ? 70 : nameText.includes(term) ? 55 : 0;
    if (!score) return null;
    return {
      market: 'us', country: 'United States', countryCode: 'US', currency: 'USD', provider: 'SEC EDGAR',
      symbol: ticker, name, exchange: entry.exchange || 'SEC filer', color: '#7658b7', peers: ['AAPL', 'MSFT', 'NVDA'], score, source: 'SEC company ticker directory',
    };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 12);
}

function eodhdMarket(entry) {
  const country = String(entry.Country || '').toLowerCase();
  const exchange = String(entry.Exchange || '').toUpperCase();
  if (/^(usa|united states|united states of america)$/.test(country) || ['US', 'NYSE', 'NASDAQ', 'NYSE ARCA', 'BATS', 'PINK', 'OTCQB', 'OTCQX', 'NMFQS'].includes(exchange)) return 'us';
  if (country.includes('india') || ['NSE', 'BSE', 'NSEI', 'BSEI'].includes(exchange)) return 'india';
  if (country.includes('uk') || country.includes('united kingdom') || country.includes('britain') || ['GB', 'LSE'].includes(exchange)) return 'uk';
  return null;
}

function eodhdSearchCandidate(entry) {
  const market = eodhdMarket(entry);
  const details = market && MARKET_CATALOG.markets[market];
  const providerSymbol = `${entry.Code}.${entry.Exchange}`;
  return {
    market,
    country: entry.Country || details?.name || 'Other market',
    countryCode: details?.countryCode || null,
    currency: entry.Currency || details?.currency || null,
    provider: details?.provider || 'EODHD global search',
    symbol: market === 'us' ? String(entry.Code).toUpperCase() : providerSymbol,
    providerSymbol,
    name: entry.Name || entry.Code,
    exchange: entry.Exchange,
    isin: entry.ISIN || entry.Isin || null,
    isPrimary: Boolean(entry.isPrimary),
    peers: [],
    score: entry.isPrimary ? 90 : 60,
    source: 'EODHD global symbol search',
  };
}

function mergeSearchMatches(matches, requestedMarket) {
  const unique = new Map();
  for (const item of matches) {
    if (!item?.symbol || !item?.market) continue;
    const key = `${item.market}:${item.symbol.toUpperCase()}`;
    const current = unique.get(key);
    if (!current || (item.score || 0) > (current.score || 0)) unique.set(key, item);
  }
  return [...unique.values()].sort((a, b) => Number(b.market === requestedMarket) - Number(a.market === requestedMarket)
    || (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name)).slice(0, 20);
}

function safeNumber(value) {
  const number = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(number) ? number : null;
}

function ifrsAnnualFact(namespace, tags, { unit, instant = false } = {}) {
  for (const tag of tags) {
    const units = namespace?.[tag]?.units || {};
    const candidates = (unit ? [[unit, units[unit] || []]] : Object.entries(units))
      .map(([unitName, entries]) => {
        const rows = (entries || [])
          .filter((row) => ['20-F', '40-F'].includes(row.form) && row.end && row.filed && Number.isFinite(Number(row.val)))
          .filter((row) => instant ? !row.start : row.start && (new Date(row.end) - new Date(row.start)) / 86400000 >= 300);
        return { unit: unitName, rows };
      })
      .filter((candidate) => candidate.rows.length)
      .sort((a, b) => String(b.rows.map((row) => row.end).sort().at(-1) || '').localeCompare(String(a.rows.map((row) => row.end).sort().at(-1) || ''))
        || b.rows.length - a.rows.length);
    if (!candidates.length) continue;
    const byEnd = new Map();
    for (const row of candidates[0].rows) {
      const existing = byEnd.get(row.end);
      if (!existing || String(row.filed).localeCompare(String(existing.filed)) > 0) byEnd.set(row.end, row);
    }
    return {
      tag,
      unit: candidates[0].unit,
      rows: [...byEnd.values()].sort((a, b) => b.end.localeCompare(a.end)),
    };
  }
  return { tag: null, unit: unit || null, rows: [] };
}

function normalizeSecUkCompany(symbol, facts, company, secMeta) {
  const ifrs = facts?.facts?.['ifrs-full'] || {};
  const bankIssuer = /bank/i.test(company.sector || '');
  const topLineTags = bankIssuer
    ? ['InterestRevenueExpense', 'Revenue', 'RevenueFromContractsWithCustomers']
    : ['Revenue', 'RevenueFromContractsWithCustomers', 'InterestRevenueExpense'];
  const topLine = ifrsAnnualFact(ifrs, topLineTags);
  const isRevenue = !['InterestRevenueExpense'].includes(topLine.tag);
  const financeTopLine = { ...topLine, label: isRevenue ? 'Revenue' : 'Interest revenue / expense', isRevenue };
  const topRows = financeTopLine.rows;
  const currency = financeTopLine.unit;
  const latestTopLine = topRows[0] || null;
  const operatingRows = ifrsAnnualFact(ifrs, ['ProfitLossFromOperatingActivities'], { unit: currency }).rows;
  const netIncomeRows = ifrsAnnualFact(ifrs, ['ProfitLoss', 'ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntity'], { unit: currency }).rows;
  const grossRows = ifrsAnnualFact(ifrs, ['GrossProfit'], { unit: currency }).rows;
  const currentAssetsRows = ifrsAnnualFact(ifrs, ['CurrentAssets'], { unit: currency, instant: true }).rows;
  const currentLiabilityRows = ifrsAnnualFact(ifrs, ['CurrentLiabilities'], { unit: currency, instant: true }).rows;
  const equityRows = ifrsAnnualFact(ifrs, ['Equity'], { unit: currency, instant: true }).rows;
  const debtRows = ifrsAnnualFact(ifrs, ['Borrowings'], { unit: currency, instant: true }).rows;
  const longDebtRows = ifrsAnnualFact(ifrs, ['LongtermBorrowings'], { unit: currency, instant: true }).rows;
  const currentDebtRows = ifrsAnnualFact(ifrs, ['CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings'], { unit: currency, instant: true }).rows;
  const cashRows = ifrsAnnualFact(ifrs, ['CashAndCashEquivalents'], { unit: currency, instant: true }).rows;
  const cfoRows = ifrsAnnualFact(ifrs, ['CashFlowsFromUsedInOperatingActivities'], { unit: currency }).rows;
  const capexRows = ifrsAnnualFact(ifrs, ['PurchaseOfPropertyPlantAndEquipment', 'PaymentsToAcquirePropertyPlantAndEquipment'], { unit: currency }).rows;
  const periodEnd = latestTopLine?.end || netIncomeRows[0]?.end || equityRows[0]?.end || null;
  const latest = (rows) => rows.find((row) => row.end === periodEnd) || null;
  const previousTopLine = topRows.find((row) => row.end !== periodEnd) || null;
  const topLineValue = safeNumber(latestTopLine?.val);
  const netIncome = safeNumber(latest(netIncomeRows)?.val);
  const operatingIncome = safeNumber(latest(operatingRows)?.val);
  const grossProfit = safeNumber(latest(grossRows)?.val);
  const equity = safeNumber(latest(equityRows)?.val);
  const priorEquity = safeNumber(equityRows.find((row) => row.end === previousTopLine?.end)?.val);
  const averageEquity = equity !== null && priorEquity !== null ? (equity + priorEquity) / 2 : equity;
  const longDebt = safeNumber(latest(longDebtRows)?.val);
  const currentDebt = safeNumber(latest(currentDebtRows)?.val);
  const totalDebt = safeNumber(latest(debtRows)?.val);
  const debt = totalDebt ?? (longDebt === null && currentDebt === null ? null : (longDebt || 0) + (currentDebt || 0));
  const cash = safeNumber(latest(cashRows)?.val);
  const currentAssets = safeNumber(latest(currentAssetsRows)?.val);
  const currentLiabilities = safeNumber(latest(currentLiabilityRows)?.val);
  const operatingCashFlow = safeNumber(latest(cfoRows)?.val);
  const capex = safeNumber(latest(capexRows)?.val);
  const freeCashFlow = operatingCashFlow !== null && capex !== null ? operatingCashFlow - Math.abs(capex) : null;
  const ratio = (numerator, denominator) => Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0 ? numerator / denominator : null;
  const revenueGrowth = financeTopLine.isRevenue && topLineValue !== null && safeNumber(previousTopLine?.val)
    ? ((topLineValue / safeNumber(previousTopLine.val)) - 1) * 100 : null;
  const ratios = {
    revenueGrowth,
    grossMargin: financeTopLine.isRevenue && grossProfit !== null ? ratio(grossProfit, topLineValue) * 100 : null,
    operatingMargin: financeTopLine.isRevenue && operatingIncome !== null ? ratio(operatingIncome, topLineValue) * 100 : null,
    netMargin: financeTopLine.isRevenue && netIncome !== null ? ratio(netIncome, topLineValue) * 100 : null,
    roe: netIncome === null ? null : ratio(netIncome, averageEquity) * 100,
    roa: null, roce: null,
    currentRatio: ratio(currentAssets, currentLiabilities),
    debtEquity: ratio(debt, equity),
    netDebtEbitda: null, pe: null, pb: null, evEbitda: null, fcfYield: null,
  };
  const operatingByEnd = new Map(operatingRows.map((row) => [row.end, safeNumber(row.val)]));
  const history = {};
  for (const row of topRows.slice(0, 4).reverse()) {
    const year = Number(row.end.slice(0, 4));
    const rowValue = safeNumber(row.val);
    if (!Number.isFinite(year) || rowValue === null) continue;
    history[year] = {
      revenue: rowValue / 1e9,
      operatingMargin: financeTopLine.isRevenue && operatingByEnd.get(row.end) !== null && operatingByEnd.get(row.end) !== undefined
        ? ratio(operatingByEnd.get(row.end), rowValue) * 100 : null,
    };
  }
  const filingRow = [latestTopLine, latest(operatingRows), latest(netIncomeRows)].filter(Boolean)
    .sort((a, b) => String(b.filed).localeCompare(String(a.filed)))[0] || latestTopLine;
  const cikNoZero = String(Number(secMeta.cik));
  const accession = filingRow?.accn;
  const filingUrl = accession
    ? `https://www.sec.gov/Archives/edgar/data/${cikNoZero}/${accession.replaceAll('-', '')}/${accession}-index.htm`
    : `https://www.sec.gov/edgar/browse/?CIK=${cikNoZero}`;
  if (!periodEnd && !netIncomeRows.length && !equityRows.length) throw new Error(`No annual IFRS facts were found for SEC filer ${secMeta.ticker}.`);
  return {
    ...company, symbol, secTicker: secMeta.ticker, currency: currency || company.currency || 'GBP',
    ratios, history, topLineLabel: financeTopLine.label,
    revenueBillions: topLineValue === null ? null : topLineValue / 1e9,
    freeCashFlowBillions: freeCashFlow === null ? null : freeCashFlow / 1e9,
    periodEnd: periodEnd || latest(netIncomeRows)?.end || latest(equityRows)?.end || null,
    fiscalYear: latestTopLine?.fy || Number((periodEnd || latest(netIncomeRows)?.end || '').slice(0, 4)) || null,
    filed: filingRow?.filed || null,
    source: 'SEC EDGAR Company Facts (IFRS annual filing)', filingUrl, unitKnown: Boolean(currency),
  };
}

async function fetchSecUkCompany(symbol, company) {
  const secTicker = String(company.secTicker || '').toUpperCase();
  if (!secTicker) throw new Error('No SEC filing ticker is mapped for this London listing.');
  const entries = await getTickerMap();
  const secMeta = entries.find((entry) => String(entry.ticker).toUpperCase() === secTicker);
  if (!secMeta) throw new Error(`SEC ticker ${secTicker} was not found in the current filer directory.`);
  const cik = String(secMeta.cik).padStart(10, '0');
  const facts = await secJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
  return normalizeSecUkCompany(symbol, facts, company, { ...secMeta, cik });
}

async function fetchUKCompany(symbol, providedCompany) {
  const cached = ukResponseCache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.value;
  const cachedError = ukErrorCache.get(symbol);
  if (cachedError && Date.now() - cachedError.cachedAt < cachedError.ttl) throw new Error(cachedError.message);
  const company = {
    ...(providedCompany || dynamicUkCompanies.get(symbol) || {}), symbol,
    color: providedCompany?.color || '#4d73b8', peers: providedCompany?.peers || [],
    name: providedCompany?.name || symbol.split('.')[0], sector: providedCompany?.sector || 'UK listed company',
    exchange: providedCompany?.exchange || 'LSE', currency: providedCompany?.currency || 'GBP', country: 'United Kingdom',
  };
  try {
    let value;
    if (!company.secTicker) {
      throw new Error(`No free SEC filing mapping is available for ${symbol}. London live fundamentals in this dashboard currently cover only the curated companies that file XBRL reports with the U.S. SEC. Companies House publishes free UK accounts, but those filings are not yet normalized into this dashboard.`);
    }
    if (!SEC_USER_AGENT || SEC_USER_AGENT.includes('your-email@example.com')) {
      throw new Error('Set a descriptive app name and contact email in SEC_USER_AGENT in the project .env file to load free SEC filings.');
    }
    try {
      value = await fetchSecUkCompany(symbol, company);
    } catch (error) {
      throw new Error(`Free SEC EDGAR data could not load annual facts for ${symbol}: ${error.message}. This London data path does not use paid fundamentals APIs.`);
    }
    ukResponseCache.set(symbol, { value, cachedAt: Date.now() });
    ukErrorCache.delete(symbol);
    if (!MARKET_CATALOG.markets.uk.symbols.some((item) => item.symbol === symbol)) dynamicUkCompanies.set(symbol, company);
    return value;
  } catch (error) {
    const message = error.message || 'Free SEC EDGAR data could not load this UK listing.';
    ukErrorCache.set(symbol, { message, cachedAt: Date.now(), ttl: /no annual statements/i.test(message) ? CACHE_TTL_MS : 60 * 1000 });
    throw error;
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', secConfigured: Boolean(SEC_USER_AGENT && !SEC_USER_AGENT.includes('your-email@example.com')), indianApiConfigured: isIndianApiConfigured(), eodhdConfigured: isEodhdConfigured() });
});

app.get('/api/markets/catalog', (_req, res) => {
  res.json(MARKET_CATALOG);
});

app.get('/api/markets/search', async (req, res) => {
  const query = String(req.query.query || '').trim();
  const requestedMarket = String(req.query.market || '').trim().toLowerCase();
  if (query.length < 2 || query.length > 80) return res.status(400).json({ error: 'Enter a company name or symbol between 2 and 80 characters.' });
  if (!MARKET_CATALOG.markets[requestedMarket]) return res.status(400).json({ error: 'Choose a supported market: us, india, or uk.' });

  const warnings = [];
  let matches = searchLocalCatalog(query);
  if (isEodhdConfigured()) {
    try {
      const results = await searchEodhd(query, { limit: 20 });
      matches.push(...results.filter((entry) => entry?.Code && entry?.Exchange && /common stock|equity|ordinary/i.test(String(entry.Type || 'common stock')))
        .map(eodhdSearchCandidate).filter((entry) => entry.market));
    } catch (error) {
      warnings.push(error.message);
    }
  }

  if (!matches.some((item) => item.market === requestedMarket) && requestedMarket === 'us') {
    try {
      await getTickerMap();
      matches.push(...searchSecTickerMap(query));
    } catch (error) {
      warnings.push(error.message);
    }
  } else if (!matches.some((item) => item.market === requestedMarket) && requestedMarket === 'india' && isIndianApiConfigured()) {
    try {
      const company = await resolveIndiaCompany(query);
      matches.push({ market: 'india', country: 'India', countryCode: 'IN', currency: 'INR', provider: 'IndianAPI', ...company, score: 90, source: 'IndianAPI company lookup' });
    } catch (error) {
      warnings.push(error.message);
    }
  }

  const uniqueMatches = mergeSearchMatches(matches, requestedMarket);
  const sameMarketMatches = uniqueMatches.filter((item) => item.market === requestedMarket);
  const otherMarketMatches = uniqueMatches.filter((item) => item.market !== requestedMarket);
  res.json({
    query,
    requestedMarket,
    source: isEodhdConfigured() ? 'Local symbol catalog, EODHD global search, and selected-market fallback' : 'Local symbol catalog and selected-market provider',
    exactInCatalog: matches.some((item) => item.source === 'local-catalog' && [item.symbol, item.name, ...(item.aliases || [])].some((value) => compactSearchText(value) === compactSearchText(query))),
    matches: uniqueMatches,
    sameMarketMatches,
    otherMarketMatches,
    warnings,
    eodhdRequiredForGlobalDiscovery: !isEodhdConfigured(),
  });
});

app.get('/api/companies', (_req, res) => {
  const companies = [...Object.values(COMPANIES), ...dynamicCompanies.values()];
  res.json(companies.map(({ symbol, name, sector, exchange, color, peers }) => ({ symbol, name, sector, exchange, color, peers })));
});

app.get('/api/lookup', async (req, res) => {
  const query = String(req.query.symbol || req.query.query || '').trim();
  if (!/^[A-Z0-9][A-Z0-9 .&'/-]{0,79}$/i.test(query)) return res.status(400).json({ error: 'Enter a valid U.S. ticker symbol or company name.' });
  try {
    if (!/^[A-Z0-9.-]{1,12}$/i.test(query) || !COMPANIES[query.toUpperCase()]) {
      await getTickerMap();
      const match = searchSecTickerMap(query)[0];
      if (!match) throw new Error(`${query} was not found in the SEC ticker directory.`);
      const company = await resolveCompany(match.symbol);
      return res.json({ company });
    }
    const symbol = query.toUpperCase();
    const company = await resolveCompany(symbol);
    res.json({ company });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/compare', async (req, res) => {
  const symbols = String(req.query.symbols || '').split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length || symbols.length > 4 || symbols.some((symbol) => !/^[A-Z0-9.-]{1,12}$/.test(symbol))) {
    return res.status(400).json({ error: 'Provide one to four valid ticker symbols.' });
  }
  const results = [];
  for (const symbol of [...new Set(symbols)]) {
    try {
      const company = await resolveCompany(symbol);
      results.push({ ...company, ...(await fetchCompany(symbol, company)), error: null });
    } catch (error) {
      const fallback = COMPANIES[symbol] ? companyMetaForApi(COMPANIES[symbol]) : dynamicCompanies.get(symbol) || { symbol, name: symbol, sector: 'SEC reporting company', exchange: 'Unknown', peers: [] };
      results.push({ ...fallback, error: error.message, source: 'SEC EDGAR Company Facts' });
    }
  }
  res.json({ data: results, asOf: new Date().toISOString(), source: 'SEC EDGAR Company Facts' });
});

app.get('/api/india/companies', (_req, res) => {
  res.json([...Object.values(INDIA_COMPANIES), ...dynamicIndiaCompanies.values()]);
});

// Raw provider probe used to validate IndianAPI's live response schema before mapping its metrics into the dashboard.
app.get('/api/india/provider-stock', async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name || name.length > 80) return res.status(400).json({ error: 'Provide a company name or ticker (up to 80 characters).' });
  try {
    const data = await getIndianApiStock(name);
    res.json({ data, source: 'IndianAPI /stock' });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/india/lookup', async (req, res) => {
  const symbol = String(req.query.symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 .&'/-]{0,49}$/.test(symbol)) return res.status(400).json({ error: 'Enter an Indian ticker or company name (up to 50 characters).' });
  try {
    const company = await resolveIndiaCompany(symbol);
    res.json({ company });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/india/compare', async (req, res) => {
  const symbols = String(req.query.symbols || '').split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length || symbols.length > 4 || symbols.some((symbol) => !/^[A-Z0-9.-]{1,24}$/.test(symbol))) {
    return res.status(400).json({ error: 'Provide one to four valid Indian ticker symbols.' });
  }
  const results = [];
  for (const symbol of [...new Set(symbols)]) {
    try {
      const company = await resolveIndiaCompany(symbol);
      results.push({ ...await fetchIndiaCompany(symbol, company), error: null });
    } catch (error) {
      const fallback = INDIA_COMPANIES[symbol] || dynamicIndiaCompanies.get(symbol) || { symbol, name: symbol, sector: 'Indian listed company', exchange: 'India', currency: 'INR', peers: [] };
      results.push({ ...fallback, error: error.message, source: 'IndianAPI stock API' });
    }
  }
  res.json({ data: results, asOf: new Date().toISOString(), source: 'IndianAPI stock API' });
});

app.get('/api/uk/companies', (_req, res) => {
  const seeds = MARKET_CATALOG.markets.uk.symbols.map((item) => marketCatalogCandidate('uk', item));
  res.json([...seeds, ...dynamicUkCompanies.values()]);
});

app.get('/api/uk/compare', async (req, res) => {
  const symbols = String(req.query.symbols || '').split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length || symbols.length > 4 || symbols.some((symbol) => !/^[A-Z0-9-]+\.[A-Z0-9]+$/.test(symbol))) {
    return res.status(400).json({ error: 'Provide one to four UK exchange symbols such as AZN.LSE.' });
  }
  const seeds = new Map(MARKET_CATALOG.markets.uk.symbols.map((item) => [item.symbol, marketCatalogCandidate('uk', item)]));
  const data = [];
  for (const symbol of [...new Set(symbols)]) {
    const company = seeds.get(symbol) || dynamicUkCompanies.get(symbol) || { symbol, name: symbol.split('.')[0], sector: 'UK listed company', exchange: symbol.split('.').at(-1), currency: 'GBP', peers: [] };
    try {
      data.push({ ...await fetchUKCompany(symbol, company), error: null });
    } catch (error) {
      data.push({ ...company, error: error.message, source: 'Free SEC EDGAR IFRS filings' });
    }
  }
  res.json({ data, asOf: new Date().toISOString(), source: 'SEC EDGAR IFRS annual filings' });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (_req, res, next) => {
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error) next();
  });
});

app.listen(port, () => {
  console.log(`MarketLens API server listening on http://127.0.0.1:${port}`);
  if (!SEC_USER_AGENT) console.warn('SEC_USER_AGENT is not configured. Add your app name and contact email to .env before using live SEC mode.');
  if (!isIndianApiConfigured()) console.warn('INDIANAPI_API_KEY is not available. Add it to the project .env file before using India live mode.');
  if (!isEodhdConfigured()) console.warn('EODHD_API_TOKEN is not set. Global discovery uses only the seed list and available country-specific directories.');
  if (!SEC_USER_AGENT) console.warn('London free SEC fundamentals need a descriptive SEC_USER_AGENT contact value in .env.');
});
