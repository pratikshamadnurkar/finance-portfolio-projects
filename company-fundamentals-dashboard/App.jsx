import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, COMPANIES, RATIO_ROWS } from './data/companies.js';
import { INDIA_COMPANIES } from './data/indiaCompanies.js';
import MARKET_CATALOG from './data/market-symbols.json';

const years = [2023, 2024, 2025];
const MARKET_LABELS = { us: 'U.S.', india: 'India', uk: 'London' };
const MARKET_CURRENCIES = { us: 'USD', india: 'INR', uk: 'GBP' };
const MARKET_MODES = { us: 'sec', india: 'indianapi', uk: 'eodhd' };
const UK_COMPANIES = Object.fromEntries(MARKET_CATALOG.markets.uk.symbols.map((entry) => [entry.symbol, {
  ...entry,
  currency: MARKET_CURRENCIES.uk,
  country: 'United Kingdom',
  demo: null,
}]));

function formatRatio(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  return unit === '%' ? `${number.toFixed(1)}%` : `${number.toFixed(2)}x`;
}

function formatMoneyBillions(value, market = 'us', currency = null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  if (market === 'india') return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}Cr`;
  if (market === 'uk') {
    const symbols = { GBP: '£', USD: '$', EUR: '€' };
    const code = currency || 'GBP';
    const amount = Number(value).toLocaleString(code === 'GBP' ? 'en-GB' : 'en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    return `${symbols[code] || `${code} `}${amount}B`;
  }
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}B`;
}

function getRatio(company, mode, year) {
  if (!company) return null;
  return mode === 'demo' ? company.demo?.ratios?.[year] : company.ratios;
}

function SummaryCard({ label, value, note, tone = 'neutral', icon }) {
  return (
    <article className="summary-card">
      <div className="summary-top"><span>{label}</span><span className="summary-icon" aria-hidden="true">{icon}</span></div>
      <div className="summary-value tabular">{value}</div>
      <div className={`summary-foot ${tone}`}>{note}</div>
    </article>
  );
}

function ApiModal({ onClose }) {
  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="api-modal-title">
        <div className="modal-head">
          <div><h2 id="api-modal-title">Free data sources</h2><p>Options for taking this portfolio from a demo to sourced company data.</p></div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close API guide">×</button>
        </div>
        <div className="api-grid">
          <article className="api-card featured">
            <div className="api-name">SEC EDGAR <span className="free-tag">Free · no key</span></div>
            <p>Best fit for filing-backed U.S. fundamentals. The live mode in this app uses Company Facts through its Node server.</p>
            <ul><li>Calculate accounting ratios from reported XBRL facts.</li><li>Browser CORS is disabled, so use a server proxy.</li><li>Use a descriptive User-Agent and stay under 10 requests/second.</li></ul>
            <a href="https://www.sec.gov/search-filings/edgar-application-programming-interfaces" target="_blank" rel="noreferrer">Official API docs ↗</a>
          </article>
          <article className="api-card">
            <div className="api-name">IndianAPI Stock API <span className="free-tag">Free plan available</span></div>
            <p>India market search uses IndianAPI’s stock endpoint. Add your API key as `INDIANAPI_API_KEY` in the server `.env` file.</p>
            <ul><li>Search accepts a company name or ticker through `/stock?name=...`.</li><li>The provider response includes financials and key metrics; fields are shown only when their names and units can be mapped safely.</li><li>The key stays on the server. Confirm provider data against company filings before relying on ratios.</li></ul>
            <a href="https://indianapi.in/documentation/indian-stock-market" target="_blank" rel="noreferrer">IndianAPI stock endpoint docs ↗</a>
          </article>
          <article className="api-card">
            <div className="api-name">EODHD global search <span className="free-tag">Free token · 20 calls/day</span></div>
            <p>Common symbol directory for the U.S., India, UK, and other supported exchanges. Search returns company name, symbol, exchange, country, currency, and sometimes ISIN.</p>
            <ul><li>Register for a free token and set `EODHD_API_TOKEN` in the server `.env`.</li><li>Each search uses one daily API call.</li><li>This app uses EODHD only to discover names and symbols; it does not request paid fundamentals.</li></ul>
            <a href="https://eodhd.com/financial-apis/search-api-for-stocks-etfs-mutual-funds" target="_blank" rel="noreferrer">Search API documentation ↗</a>
          </article>
          <article className="api-card">
            <div className="api-name">London company filings <span className="free-tag">SEC EDGAR · free</span></div>
            <p>The curated London companies with SEC filings load annual IFRS facts from SEC EDGAR at no cost. This does not require an EODHD Fundamentals subscription.</p>
            <ul><li>Set a descriptive contact in `SEC_USER_AGENT` in the server `.env`.</li><li>Displayed amounts use each issuer’s reported currency (GBP, USD, or EUR).</li><li>Unavailable IFRS facts and ratios are left blank, and the source filing is linked.</li></ul>
            <a href="https://www.sec.gov/search-filings/edgar-application-programming-interfaces" target="_blank" rel="noreferrer">SEC API documentation ↗</a>
          </article>
          <article className="api-card">
            <div className="api-name">Companies House accounts <span className="free-tag">Free files</span></div>
            <p>Companies House publishes UK companies’ electronically filed accounts as free XBRL and iXBRL files. This is a possible route to broader UK coverage, but this dashboard does not yet parse those files.</p>
            <ul><li>Coverage is limited to electronically filed accounts and UK companies on the register.</li><li>Files need company-number mapping and XBRL normalization before they can populate the dashboard.</li></ul>
            <a href="https://download.companieshouse.gov.uk/en_accountsdata.html" target="_blank" rel="noreferrer">Free Accounts Data Product ↗</a>
          </article>
          <article className="api-card">
            <div className="api-name">Twelve Data <span className="free-tag">Basic plan · free</span></div>
            <p>The Basic plan is useful for limited market and reference data. Its income statement, balance sheet, and cash flow endpoints require Pro or higher, so it cannot provide free London company statements.</p>
            <ul><li>Free Basic has a limited daily quota and some global trial symbols.</li><li>International market and fundamentals access depends on the plan.</li></ul>
            <a href="https://twelvedata.com/pricing" target="_blank" rel="noreferrer">Plans and API access ↗</a>
          </article>
          <article className="api-card">
            <div className="api-name">FMP Basic <span className="free-tag">250 calls/day</span></div>
            <p>Useful for testing end-of-day market and reference data.</p>
            <ul><li>Basic lists EOD history and profile/reference data.</li><li>Annual fundamentals and ratios are listed under paid plans.</li><li>Check display rights before publishing.</li></ul>
            <a href="https://site.financialmodelingprep.com/pricing-plans" target="_blank" rel="noreferrer">Pricing and plan limits ↗</a>
          </article>
        </div>
        <div className="recommendation"><strong>Current setup:</strong> U.S. and mapped London annual filings → SEC Company Facts (free; requires a contact email in `SEC_USER_AGENT`). India fundamentals → IndianAPI (your configured server key). EODHD is used only for global name and symbol discovery. Broader UK filings are available free from Companies House, but need an importer before this app can display them. The JSON catalog is a starter list, not an exhaustive exchange directory.</div>
        <p className="modal-note">Provider plans and data display rights can change. Check each official provider page before publishing.</p>
      </section>
    </div>
  );
}

function AddSymbolModal({ onClose, onAdd, market }) {
  const [symbol, setSymbol] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape' && !busy) onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onAdd(symbol);
    } catch (cause) {
      setError(cause.message || 'Could not add this ticker.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="modal add-symbol-modal" role="dialog" aria-modal="true" aria-labelledby="add-symbol-title">
        <div className="modal-head">
          <div><h2 id="add-symbol-title">Add a company</h2><p>Search a name or symbol in the {MARKET_LABELS[market]} market. The search also flags matches in other supported markets.</p></div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close add company dialog" disabled={busy}>×</button>
        </div>
        <form onSubmit={submit}>
          <label className="symbol-field">Company name or ticker<input autoFocus value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder={market === 'uk' ? 'e.g. AstraZeneca or HSBC' : market === 'india' ? 'e.g. RELIANCE or Infosys' : 'e.g. TSLA or Tesla'} maxLength={80} required minLength={2} aria-describedby="symbol-help" /></label>
          <p id="symbol-help" className="modal-note">Global name and symbol discovery uses EODHD. Set `EODHD_API_TOKEN` in the project `.env` to search beyond the starter catalog. Fundamentals use SEC filings for U.S. and mapped London companies, and IndianAPI for India.</p>
          {error && <div className="symbol-error" role="alert">{error}</div>}
          <div className="symbol-actions"><button className="button" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={busy || !symbol.trim()}>{busy ? 'Checking data…' : 'Find and add ticker'}</button></div>
        </form>
      </section>
    </div>
  );
}

function Chart({ company, peers, mode, metric, market }) {
  const chartYears = useMemo(() => {
    if (mode === 'demo') return [2022, 2023, 2024, 2025];
    const found = [...Object.keys(company?.history || {}), ...peers.flatMap((peer) => Object.keys(peer?.history || {}))]
      .map(Number).filter(Number.isFinite);
    return [...new Set(found)].sort((a, b) => a - b).slice(-4);
  }, [company, peers, mode]);
  const key = metric === 'revenue' ? 'revenue' : 'operatingMargin';
  const companyValues = chartYears.map((year) => mode === 'demo' ? company?.demo?.history?.[key]?.[year] : company?.history?.[year]?.[key]);
  const comparablePeers = market === 'uk'
    ? peers.filter((peer) => peer.currency === company?.currency && peer.topLineLabel === company?.topLineLabel)
    : peers;
  const peerValues = chartYears.map((year) => {
    const values = comparablePeers.map((peer) => mode === 'demo' ? peer?.demo?.history?.[key]?.[year] : peer?.history?.[year]?.[key]).filter(Number.isFinite).sort((a, b) => a - b);
    if (!values.length) return null;
    return values[Math.floor(values.length / 2)];
  });
  const max = Math.max(1, ...companyValues.filter(Number.isFinite), ...peerValues.filter(Number.isFinite)) * 1.16;
  const barLabel = (value) => metric === 'revenue' ? formatMoneyBillions(value, market, company?.currency) : formatRatio(value, '%');

  return (
    <div className="chart-region" aria-label={`${metric === 'revenue' ? 'Revenue' : 'Operating margin'} comparison by fiscal year`}>
      {chartYears.map((year, index) => {
        const own = companyValues[index];
        const peer = peerValues[index];
        return (
          <div className="bar-group" key={year}>
            <div className="bar-wrap">
              <div className="bar bar-peer" style={{ height: Number.isFinite(peer) ? `${Math.max(5, peer / max * 100)}%` : '0%' }} aria-label={`Peer median ${year}: ${barLabel(peer)}`} />
              <div className="bar" style={{ height: Number.isFinite(own) ? `${Math.max(5, own / max * 100)}%` : '0%' }} aria-label={`${company?.symbol || 'Company'} ${year}: ${barLabel(own)}`} />
            </div>
            <span className="bar-year">FY {year}</span>
          </div>
        );
      })}
      {!chartYears.length && <div className="chart-empty">Annual history will appear when market data loads.</div>}
    </div>
  );
}

function RatioTable({ active, peers, company, companies, mode, year, category, market }) {
  const columns = [active, ...peers.map((company) => company.symbol)];
  const rows = RATIO_ROWS.filter((row) => category === 'all' || row.category === category);
  return (
    <div className="table-scroll">
      <table className="ratio-table">
        <thead><tr><th scope="col">Ratio</th>{columns.map((symbol) => {
          const metaCompany = companies[symbol];
          const record = symbol === active ? company : peers.find((item) => item.symbol === symbol);
          const fiscalYear = mode === 'demo' ? year : record?.fiscalYear;
          return <th scope="col" className={symbol === active ? 'focus-col' : ''} key={symbol}><span className="table-company"><span className="company-mini" style={{ backgroundColor: `${metaCompany.color}20`, color: metaCompany.color }}>{symbol.slice(0, 1)}</span>{symbol.split('.')[0]}</span><small>{mode === 'indianapi' && fiscalYear ? `FY ${fiscalYear} · key ratios current` : fiscalYear ? `FY ${fiscalYear}` : mode === 'sec' ? 'Latest 10-K' : mode === 'indianapi' || mode === 'eodhd' ? 'Latest annual' : ''}</small></th>;
        })}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.key}>
          <th scope="row" className="ratio-name">{row.label}<small>{row.group}</small></th>
          {columns.map((symbol) => {
            const liveRecord = symbol === active ? company : peers.find((item) => item.symbol === symbol);
            const ratio = mode === 'demo'
              ? companies[symbol]?.demo?.ratios?.[year]?.[row.key]
              : liveRecord?.ratios?.[row.key];
            return <td className={symbol === active ? 'focus-col tabular' : 'tabular'} key={`${row.key}-${symbol}`}>{formatRatio(ratio, row.unit)}</td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [customCompanies, setCustomCompanies] = useState(() => {
    try { return JSON.parse(localStorage.getItem('northstar.customCompanies') || '{}'); }
    catch { return {}; }
  });
  const [customIndiaCompanies, setCustomIndiaCompanies] = useState(() => {
    try { return JSON.parse(localStorage.getItem('northstar.customIndiaCompanies') || '{}'); }
    catch { return {}; }
  });
  const [customUkCompanies, setCustomUkCompanies] = useState(() => {
    try { return JSON.parse(localStorage.getItem('northstar.customUkCompanies') || '{}'); }
    catch { return {}; }
  });
  const [market, setMarket] = useState('us');
  const baseCompanies = market === 'india' ? INDIA_COMPANIES : market === 'uk' ? UK_COMPANIES : COMPANIES;
  const activeCustomCompanies = market === 'india' ? customIndiaCompanies : market === 'uk' ? customUkCompanies : customCompanies;
  const companies = useMemo(() => ({ ...baseCompanies, ...activeCustomCompanies }), [baseCompanies, activeCustomCompanies]);
  const symbols = Object.keys(companies);
  const [active, setActive] = useState('AAPL');
  const [mode, setMode] = useState('demo');
  const [year, setYear] = useState(2025);
  const [category, setCategory] = useState('all');
  const [chartMetric, setChartMetric] = useState('revenue');
  const [search, setSearch] = useState('');
  const [liveData, setLiveData] = useState({});
  const [liveState, setLiveState] = useState('idle');
  const [liveMessage, setLiveMessage] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchCandidates, setSearchCandidates] = useState([]);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [addSymbolOpen, setAddSymbolOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('northstar.customCompanies', JSON.stringify(customCompanies));
  }, [customCompanies]);

  useEffect(() => {
    localStorage.setItem('northstar.customIndiaCompanies', JSON.stringify(customIndiaCompanies));
  }, [customIndiaCompanies]);

  useEffect(() => {
    localStorage.setItem('northstar.customUkCompanies', JSON.stringify(customUkCompanies));
  }, [customUkCompanies]);

  const activeCompany = companies[active] || (market === 'india' ? INDIA_COMPANIES['RELIANCE.BSE'] : market === 'uk' ? UK_COMPANIES['AZN.LSE'] : COMPANIES.AAPL);
  const peerSymbols = (activeCompany.peers || []).filter((symbol) => companies[symbol]).slice(0, 3);
  const focusRecord = mode === 'demo' ? { ...activeCompany, ...activeCompany.demo } : liveData[active] || { ...activeCompany, ratios: null, history: {} };
  const peerRecords = peerSymbols.map((symbol) => mode === 'demo'
    ? { ...companies[symbol], ...companies[symbol].demo }
    : liveData[symbol] || { ...companies[symbol], ratios: null, history: {} });
  const selectedRatios = mode === 'demo' ? activeCompany.demo?.ratios?.[year] : focusRecord.ratios;
  const requestedSymbols = [active, ...peerSymbols].join(',');

  useEffect(() => {
    if (mode === 'demo') return undefined;
    let cancelled = false;
    setLiveState('loading');
    setLiveMessage(`Checking the ${MARKET_LABELS[market]} data connection…`);

    async function loadLiveData() {
      try {
        const healthResponse = await fetch('/api/health');
        if (!healthResponse.ok) throw new Error('Could not reach the project API server. Start it with `npm run dev`.');
        const health = await healthResponse.json();
        if (market === 'us' && !health.secConfigured) throw new Error('Add your contact email to SEC_USER_AGENT in .env, then restart the server to use SEC live mode.');
        if (market === 'india' && !health.indianApiConfigured) throw new Error('IndianAPI key is missing. Add INDIANAPI_API_KEY to the project .env file, then restart the server.');
        if (market === 'uk' && !health.secConfigured) throw new Error('Add an app name and contact email to SEC_USER_AGENT in the project .env, then restart the server to load free London SEC filings.');

        setLiveMessage(market === 'india'
          ? 'Loading annual statements and ratios from IndianAPI…'
          : market === 'uk'
            ? 'Loading London annual statements and ratios…'
            : 'Loading annual filing facts. The SEC rate limit is respected, so first load can take a few seconds.');
        const endpoint = market === 'india' ? '/api/india/compare' : market === 'uk' ? '/api/uk/compare' : '/api/compare';
        const response = await fetch(`${endpoint}?symbols=${encodeURIComponent(requestedSymbols)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'The market comparison request failed.');
        if (cancelled) return;
        const next = {};
        for (const record of result.data || []) next[record.symbol] = record;
        setLiveData((existing) => ({ ...existing, ...next }));
        const failures = (result.data || []).filter((record) => record.error);
        if (failures.length) {
          setLiveState('error');
          const uniqueErrors = [...new Set(failures.map((record) => record.error))];
          setLiveMessage(market === 'uk' && uniqueErrors.length === 1
            ? uniqueErrors[0]
            : failures.map((record) => `${record.symbol}: ${record.error}`).join(' · '));
        } else {
          setLiveState('ready');
          setLiveMessage(market === 'india'
            ? 'IndianAPI stock data loaded. Unmapped fields remain blank until their names and units are verified.'
            : market === 'uk'
              ? 'London annual filings loaded from SEC EDGAR. Metrics without a matching IFRS fact are left blank.'
              : 'SEC filing facts loaded. Latest filing dates vary by company; click a source link to inspect its 10-K.');
        }
      } catch (error) {
        if (cancelled) return;
        setLiveState('error');
        setLiveMessage(error.message || `Unable to load ${MARKET_LABELS[market]} data.`);
      }
    }

    loadLiveData();
    return () => { cancelled = true; };
  }, [active, mode, market, requestedSymbols]);

  const currentYear = mode === 'demo' ? year : focusRecord.fiscalYear;
  const summary = useMemo(() => {
    const record = mode === 'demo' ? activeCompany.demo : focusRecord;
    const ratio = mode === 'demo' ? activeCompany.demo.ratios[year] : focusRecord.ratios;
    const revenue = mode === 'demo'
      ? activeCompany.demo.history.revenue[year]
      : market === 'india' ? focusRecord.revenueCrores : focusRecord.revenueBillions;
    const fcf = mode === 'demo'
      ? activeCompany.demo.history.freeCashFlow?.[year]
      : market === 'india' ? focusRecord.freeCashFlowCrores : focusRecord.freeCashFlowBillions;
    return { record, ratio, revenue, fcf };
  }, [activeCompany, focusRecord, market, mode, year]);

  function selectCompany(symbol) {
    if (!companies[symbol]) return;
    setActive(symbol);
    if (market === 'india') setMode('indianapi');
    else if (market === 'uk') setMode('eodhd');
    else if (!COMPANIES[symbol]) setMode('sec');
    setSearch('');
    setSearchStatus('');
    setSearchCandidates([]);
  }

  async function addCompany(input) {
    const query = String(input || '').trim();
    if (query.length < 2 || query.length > 80) throw new Error('Enter a company name or symbol between 2 and 80 characters.');
    const response = await fetch(`/api/markets/search?query=${encodeURIComponent(query)}&market=${market}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not search the market directory.');
    const sameMarket = result.sameMarketMatches || [];
    const exact = (result.matches || []).filter((item) => item.score >= 95);
    const candidate = exact.length === 1 ? exact[0] : sameMarket.length === 1 ? sameMarket[0] : result.matches?.length === 1 ? result.matches[0] : null;
    if (!candidate) {
      if (!result.matches?.length) throw new Error(result.eodhdRequiredForGlobalDiscovery ? 'No starter-list match. Add EODHD_API_TOKEN in .env for global discovery, then restart the server.' : (result.warnings?.[0] || 'No company matched. Try a ticker or a longer company name.'));
      throw new Error('More than one listing matched. Use the main search box to review the market and exchange before choosing.');
    }
    await loadCandidate(candidate);
    setAddSymbolOpen(false);
  }

  async function loadCandidate(candidate) {
    if (!candidate?.market || !MARKET_LABELS[candidate.market]) throw new Error('This listing is outside the supported US, India, and UK markets.');
    const nextMarket = candidate.market;
    setSearchStatus(`Loading ${candidate.name} (${candidate.symbol}) from ${MARKET_LABELS[nextMarket]}…`);
    setSearchCandidates([]);
    try {
      if (nextMarket === 'us') {
        const healthResponse = await fetch('/api/health');
        if (!healthResponse.ok) throw new Error('Could not reach the project API server. Start it with `npm run dev`.');
        const health = await healthResponse.json();
        if (!health.secConfigured) throw new Error('SEC live access needs a contact email in SEC_USER_AGENT in .env; restart the server after saving it.');
        const response = await fetch(`/api/lookup?symbol=${encodeURIComponent(candidate.symbol)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `${candidate.symbol} was not found in the SEC filer directory.`);
        const company = { ...result.company, peers: (result.company.peers || []).filter((symbol) => COMPANIES[symbol]).slice(0, 3) };
        setCustomCompanies((current) => ({ ...current, [company.symbol]: company }));
        setActive(company.symbol);
        setMode('sec');
      } else if (nextMarket === 'india') {
        const healthResponse = await fetch('/api/health');
        if (!healthResponse.ok) throw new Error('Could not reach the project API server. Start it with `npm run dev`.');
        const health = await healthResponse.json();
        if (!health.indianApiConfigured) throw new Error('IndianAPI key is missing. Add INDIANAPI_API_KEY to the project .env file, then restart the server.');
        const response = await fetch(`/api/india/lookup?symbol=${encodeURIComponent(candidate.symbol)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `${candidate.symbol} was not found by IndianAPI.`);
        const company = { ...result.company, peers: (result.company.peers || []).filter((symbol) => INDIA_COMPANIES[symbol]).slice(0, 3) };
        setCustomIndiaCompanies((current) => ({ ...current, [company.symbol]: company }));
        setActive(company.symbol);
        setMode('indianapi');
      } else {
        const company = {
          ...UK_COMPANIES[candidate.symbol],
          ...candidate,
          symbol: candidate.symbol,
          peers: (candidate.peers || UK_COMPANIES[candidate.symbol]?.peers || []).filter((symbol) => UK_COMPANIES[symbol] || customUkCompanies[symbol]).slice(0, 3),
          color: candidate.color || UK_COMPANIES[candidate.symbol]?.color || '#4d73b8',
          sector: candidate.sector || UK_COMPANIES[candidate.symbol]?.sector || 'UK listed company',
          currency: candidate.currency || 'GBP',
        };
        setCustomUKCompanies((current) => ({ ...current, [company.symbol]: company }));
        setActive(company.symbol);
        setMode('eodhd');
      }
      setMarket(nextMarket);
      setLiveData({});
      setLiveState('loading');
      setSearch('');
      setSearchCandidates([]);
      setAddSymbolOpen(false);
      setSearchStatus(`${candidate.name} (${candidate.symbol}) selected from ${MARKET_LABELS[nextMarket]}.`);
    } catch (error) {
      setSearchStatus(error.message || `Could not load ${candidate.symbol}.`);
      throw error;
    }
  }

  async function submitSearch() {
    const query = search.trim();
    if (!query) return;
    setSearchCandidates([]);
    setSearchStatus(`Checking the symbol catalog, then searching ${MARKET_LABELS[market]}…`);
    try {
      const response = await fetch(`/api/markets/search?query=${encodeURIComponent(query)}&market=${market}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not search the market directory.');
      const matches = result.matches || [];
      const exact = matches.filter((item) => item.score >= 95);
      const candidate = exact.length === 1 ? exact[0] : matches.length === 1 ? matches[0] : null;
      if (candidate) {
        await loadCandidate(candidate);
        return;
      }
      setSearchCandidates(matches);
      if (!matches.length) {
        const reason = result.warnings?.[0];
        setSearchStatus(result.eodhdRequiredForGlobalDiscovery
          ? `No match in the starter catalog. Add a free EODHD_API_TOKEN to .env for global search (20 calls/day), then restart the server.${reason ? ` ${reason}` : ''}`
          : reason || `No match for “${query}”. Check spelling or try the ticker symbol.`);
      } else {
        const sameCount = (result.sameMarketMatches || []).length;
        const otherCount = (result.otherMarketMatches || []).length;
        setSearchStatus(`${matches.length} possible listing${matches.length === 1 ? '' : 's'} found${sameCount ? ` in ${MARKET_LABELS[market]}` : ''}${otherCount ? ` and ${otherCount} in other supported markets` : ''}. Choose the correct exchange.`);
      }
    } catch (error) {
      setSearchCandidates([]);
      setSearchStatus(error.message || 'Could not search for that company.');
    }
  }

  function returnToDemo() {
    if (market !== 'us') {
      setMarket('us');
      setActive('AAPL');
      setMode('demo');
      return;
    }
    if (!COMPANIES[active]) setActive('AAPL');
    setMode('demo');
  }

  function switchMarket(nextMarket) {
    if (nextMarket === market) return;
    setMarket(nextMarket);
    setActive(nextMarket === 'india' ? 'RELIANCE.BSE' : nextMarket === 'uk' ? 'AZN.LSE' : 'AAPL');
    setMode(nextMarket === 'india' ? 'indianapi' : nextMarket === 'uk' ? 'eodhd' : 'demo');
    setLiveData({});
    setLiveState('idle');
    setLiveMessage('');
    setSearch('');
    setSearchStatus('');
    setSearchCandidates([]);
  }

  const mainSource = mode === 'demo' ? 'Illustrative sample data' : focusRecord.source || (market === 'india' ? 'IndianAPI Fundamentals API' : market === 'uk' ? 'SEC EDGAR IFRS annual filings' : 'SEC EDGAR Company Facts');

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand"><div className="brand-mark">M</div><div className="brand-copy"><strong>MARKETLENS</strong><small>EQUITY WORKSPACE</small></div></div>
        <div><div className="nav-label">Workspace</div><nav className="nav-list"><a className="nav-item active" href="#overview"><span className="nav-icon">◫</span>Overview</a><a className="nav-item" href="#ratios"><span className="nav-icon">▤</span>Ratio analysis</a><a className="nav-item" href="#trend"><span className="nav-icon">⌁</span>Performance</a></nav></div>
        <div><div className="nav-label">Watchlist · {symbols.length}</div><div className="watchlist">{symbols.map((symbol) => <button className={`watch-row ${active === symbol ? 'selected' : ''}`} key={symbol} type="button" onClick={() => selectCompany(symbol)}><span className="ticker-dot" style={{ color: companies[symbol].color }}>{symbol.slice(0, 2)}</span><span className="watch-meta"><span className="watch-name">{companies[symbol].name.split(/[ ,]/)[0]}</span><span className="watch-ticker">{symbol}</span></span><span className="watch-mark">↗</span></button>)}</div><button className="watch-add" type="button" onClick={() => setAddSymbolOpen(true)}>＋ Add ticker</button></div>
        <div className="side-bottom"><div className="profile"><span className="avatar">AK</span><span><strong>Analyst portfolio</strong><small>Company fundamentals</small></span></div></div>
      </aside>

      <main className="main" id="overview">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{MARKET_LABELS[market]} company fundamentals</strong></div><div className="top-actions"><form className="search-form" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}><label className="search-wrap"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setSearchStatus(''); setSearchCandidates([]); }} list="company-options" placeholder={`Search ${MARKET_LABELS[market]} name or symbol`} aria-label={`Search ${MARKET_LABELS[market]} name or symbol`} /><datalist id="company-options">{symbols.map((symbol) => <option key={symbol} value={symbol} label={companies[symbol].name} />)}</datalist></label><button className="search-submit" type="submit" aria-label={`Search all supported markets for ${search || 'a company'}`} title="Search company names and ticker symbols">↵</button></form><button className="button button-add-top" type="button" onClick={() => setAddSymbolOpen(true)}>＋ Add ticker</button><button className="button button-source" type="button" onClick={() => setApiModalOpen(true)}><span className="source-dot" />Data sources</button></div></header>
        {searchStatus && <div className={`search-feedback ${searchStatus.startsWith('Checking') || searchStatus.startsWith('Loading') ? 'loading' : searchStatus.includes('selected from') ? 'success' : searchStatus.startsWith('No match') || searchStatus.includes('Could not') || searchStatus.includes('missing') || searchStatus.includes('Add EODHD') ? 'error' : 'loading'}`} role={searchStatus.startsWith('No match') || searchStatus.includes('Could not') || searchStatus.includes('missing') ? 'alert' : 'status'}>{searchStatus}</div>}
        {searchCandidates.length > 0 && <section className="search-results" aria-label="Search matches"><strong>Choose a listing</strong><div className="search-result-list">{searchCandidates.map((candidate) => <button type="button" className="search-result" key={`${candidate.market}:${candidate.symbol}`} onClick={() => loadCandidate(candidate).catch(() => {})}><span className="search-result-main"><b>{candidate.name}</b><small>{candidate.symbol} · {candidate.exchange || 'Exchange not listed'}</small></span><span className="search-result-market">{MARKET_LABELS[candidate.market]} · {candidate.currency || MARKET_CURRENCIES[candidate.market]}</span></button>)}</div></section>}

        <section className="page-heading"><div><div className="eyebrow">Fundamental research</div><h1>Company dashboard</h1></div><div className="heading-controls"><div className="market-tabs" role="group" aria-label="Market selection"><button className={market === 'us' ? 'active' : ''} type="button" onClick={() => switchMarket('us')}>US market</button><button className={market === 'india' ? 'active' : ''} type="button" onClick={() => switchMarket('india')}>India market</button><button className={market === 'uk' ? 'active' : ''} type="button" onClick={() => switchMarket('uk')}>London market</button></div><div className={`mode-badge ${mode !== 'demo' ? 'live' : ''}`}><span />{mode === 'sec' ? 'SEC live mode' : mode === 'indianapi' ? 'India · IndianAPI' : mode === 'eodhd' ? 'London · SEC / IFRS' : 'Demo mode'}</div></div></section>
        <section className="company-head"><div className="company-logo" style={{ backgroundColor: `${activeCompany.color}18`, color: activeCompany.color }}>{active.split('.')[0].slice(0, 1)}</div><div className="company-info"><div className="company-title"><h2>{activeCompany.name}</h2><span className="ticker-tag">{active} · {activeCompany.exchange}</span></div><p>{activeCompany.sector} <span>·</span> {focusRecord.currency || MARKET_CURRENCIES[market]} <span>·</span> {mode === 'demo' ? `FY ${year}` : currentYear ? `Latest FY ${currentYear}` : `${MARKET_LABELS[market]} annual statements not loaded`}</p></div><div className="company-status"><small>DATA SOURCE</small><span>{mainSource}</span>{mode !== 'demo' && focusRecord.filingUrl && <a href={focusRecord.filingUrl} target="_blank" rel="noreferrer">Open source filing ↗</a>}</div></section>

        {mode !== 'demo' && <div className={`connection-banner ${liveState}`} role={liveState === 'error' ? 'alert' : 'status'}><span className="banner-dot" /><span>{liveMessage || `Waiting for ${MARKET_LABELS[market]} data…`}</span></div>}

        <section className="summary-grid" aria-label="Company summary metrics">
          <SummaryCard label={mode !== 'demo' && market === 'uk' ? focusRecord.topLineLabel || 'Revenue' : 'Revenue'} value={formatMoneyBillions(summary.revenue, market, focusRecord.currency)} note={mode === 'demo' ? 'Illustrative annual revenue' : market === 'india' ? 'Latest annual statement · ₹ crore' : market === 'uk' ? `Latest annual statement · ${focusRecord.currency || 'GBP'} billions` : 'Latest 10-K · USD billions'} icon="▥" />
          <SummaryCard label="Free cash flow" value={formatMoneyBillions(summary.fcf, market, focusRecord.currency)} note={mode === 'demo' ? 'Illustrative cash flow' : market === 'india' ? 'Operating cash flow less capex · ₹ crore' : market === 'uk' ? `Operating cash flow less capex · ${focusRecord.currency || 'GBP'} billions` : 'Operating cash flow less capex'} icon="◌" />
          <SummaryCard label="Net margin" value={formatRatio(summary.ratio?.netMargin, '%')} note="Net income / revenue" tone="positive" icon="◉" />
          <SummaryCard label="Revenue growth" value={formatRatio(summary.ratio?.revenueGrowth, '%')} note="Year over year" tone="positive" icon="↗" />
        </section>

        <section className="content-grid" id="trend">
          <div className="panel chart-panel"><div className="panel-head"><div><h2>Operating trajectory</h2><p>{chartMetric === 'revenue' ? `${mode !== 'demo' && market === 'uk' ? focusRecord.topLineLabel || 'Annual revenue' : 'Annual revenue'} · ${market === 'india' ? '₹ crore' : market === 'uk' ? `${focusRecord.currency || 'GBP'} billions` : 'USD billions'}` : 'Operating margin · percent'}</p></div><div className="segmented" role="group" aria-label="Chart metric"><button className={chartMetric === 'revenue' ? 'active' : ''} type="button" onClick={() => setChartMetric('revenue')}>{mode !== 'demo' && market === 'uk' ? focusRecord.topLineLabel || 'Revenue' : 'Revenue'}</button><button className={chartMetric === 'margin' ? 'active' : ''} type="button" onClick={() => setChartMetric('margin')}>Operating margin</button></div></div><div className="chart-legend"><span><i className="legend-key" />{active.split('.')[0]}</span><span><i className="legend-key peer" />Peer median</span></div><Chart company={focusRecord} peers={peerRecords} mode={mode} metric={chartMetric} market={market} /><div className="chart-note">Peer medians are shown only when comparison companies report the same top-line measure and currency. Missing facts are left blank.</div></div>
          <aside className="panel capital-panel"><div className="panel-head"><div><h2>Capital structure</h2><p>Leverage and liquidity ratios</p></div><span className="year-pill">{currentYear ? `FY ${currentYear}` : mode === 'demo' ? `FY ${year}` : 'Latest'}</span></div><div className="capital-list">{[['Current ratio', 'currentRatio', 'x'], ['Debt / equity', 'debtEquity', 'x'], ['Net debt / EBITDA', 'netDebtEbitda', 'x'], ['Return on equity', 'roe', '%']].map(([label, key, unit]) => <div className="capital-row" key={key}><span>{label}</span><strong>{formatRatio(selectedRatios?.[key], unit)}</strong></div>)}</div><div className="capital-note">{mode === 'demo' ? 'Illustrative values; replace before presenting as analysis.' : market === 'india' ? 'IndianAPI ratios are mapped from named provider fields; verify definitions against company filings.' : market === 'uk' ? 'London IFRS filing facts; verify ratio definitions against the linked source filing.' : 'Calculated from SEC filing facts. Inspect the linked filing for context.'}</div></aside>
        </section>

        <section className="panel table-panel" id="ratios"><div className="panel-head table-heading"><div><h2>Ratio comparison</h2><p>Side-by-side fundamentals across selected companies</p></div><div className="table-controls"><div className="category-filters" aria-label="Filter ratio categories">{CATEGORIES.map((item) => <button className={category === item.key ? 'active' : ''} type="button" key={item.key} onClick={() => setCategory(item.key)}>{item.label}</button>)}</div><select value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="Fiscal year" disabled={mode !== 'demo'}><option value={2025}>FY 2025</option><option value={2024}>FY 2024</option><option value={2023}>FY 2023</option></select>{market === 'us' ? <button className={`mode-toggle ${mode === 'sec' ? 'is-live' : ''}`} type="button" onClick={() => { if (mode === 'demo') { setMode('sec'); setYear(2025); } else returnToDemo(); }}>{mode === 'demo' ? 'Load SEC data' : 'Return to demo'}</button> : <span className="mode-toggle is-live">{market === 'india' ? 'India · IndianAPI' : 'UK · SEC (free)'}</span>}</div></div>
          {mode === 'sec' && <div className="live-note">SEC mode uses each company’s latest annual filing. P/E and free cash flow yield need a market-price API and are intentionally blank.</div>}
          {mode === 'indianapi' && <div className="live-note">India mode uses the IndianAPI stock response. Financial amounts need an explicit unit; ratios are mapped only from recognized provider fields.</div>}
          {mode === 'eodhd' && <div className="live-note">London companies use SEC EDGAR annual IFRS facts where available. Amounts retain each issuer’s reported currency; unsupported inputs remain blank.</div>}
          <RatioTable active={active} peers={peerRecords} company={focusRecord} companies={companies} mode={mode} year={year} category={category} market={market} />
          <div className="table-foot"><span>{mode === 'demo' ? 'Figures are illustrative placeholders and are not sourced.' : `Source: ${market === 'india' ? 'IndianAPI Fundamentals API' : market === 'uk' ? focusRecord.source || 'SEC EDGAR IFRS annual filings' : 'SEC EDGAR Company Facts'}${focusRecord.filed ? ` · Filed ${focusRecord.filed}` : ''}. Periods can vary by company.`}</span><span>{mode === 'demo' ? 'Use SEC mode to request live filing data.' : liveState === 'loading' ? 'Loading company statements…' : market === 'india' ? 'Blank ratios mean the provider lacks the input or does not publish that ratio.' : market === 'uk' ? 'Blank ratios mean the filing does not provide a required input or comparable line item.' : 'Accounting ratios only; market valuation multiples require pricing data.'}</span></div>
        </section>
        <footer className="footer-line"><span>MarketLens · Finance portfolio project</span><button type="button" onClick={() => setApiModalOpen(true)}>API notes</button></footer>
      </main>
      {market === 'us' && <button className="floating-mode" type="button" onClick={() => { if (mode === 'demo') setMode('sec'); else returnToDemo(); }}>{mode === 'demo' ? '↗ Try SEC live' : '⌂ Demo mode'}</button>}
      {apiModalOpen && <ApiModal onClose={() => setApiModalOpen(false)} />}
      {addSymbolOpen && <AddSymbolModal onClose={() => setAddSymbolOpen(false)} onAdd={addCompany} market={market} />}
    </div>
  );
}
