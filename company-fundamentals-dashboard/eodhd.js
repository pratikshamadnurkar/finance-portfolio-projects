const BASE_URL = 'https://eodhd.com/api';
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map();
const inflight = new Map();

function apiToken() {
  return (process.env.EODHD_API_TOKEN || '').trim();
}

export function isEodhdConfigured() {
  return Boolean(apiToken() && apiToken() !== 'your-eodhd-api-token');
}

async function requestEodhd(path, params = {}) {
  const token = apiToken();
  if (!token || token === 'your-eodhd-api-token') {
    throw new Error('Set EODHD_API_TOKEN in the project .env to enable live global symbol search.');
  }

  const url = new URL(`${BASE_URL}/${path.replace(/^\//, '')}`);
  url.searchParams.set('api_token', token);
  url.searchParams.set('fmt', 'json');
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  }

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.value;
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  const pending = (async () => {
    let response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('EODHD took too long to respond. Try again in a moment.');
      throw new Error(`Could not reach EODHD: ${error.message}`);
    }

    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = text.trim(); }
    const providerError = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    if (!response.ok || providerError || (payload && !Array.isArray(payload) && typeof payload === 'object' && Object.keys(payload).length === 0)) {
      const details = providerError ? String(providerError) : `HTTP ${response.status}`;
      if (response.status === 401 || /invalid api key|invalid token|unauthorized|authentication failed/i.test(details)) {
        throw new Error('EODHD rejected EODHD_API_TOKEN. Check that the token is copied correctly and is active.');
      }
      if (response.status === 429) throw new Error('EODHD daily request limit reached. The free plan allows 20 API calls per day.');
      if (response.status === 404 || /no data|not found/i.test(details)) throw new Error('EODHD did not find data for that symbol. Try a company name or LSE ticker.');
      throw new Error(`EODHD request failed: ${details}`);
    }
    cache.set(cacheKey, { value: payload, cachedAt: Date.now() });
    return payload;
  })();

  inflight.set(cacheKey, pending);
  try { return await pending; }
  finally { inflight.delete(cacheKey); }
}

export async function searchEodhd(query, { exchange, limit = 15 } = {}) {
  const safeQuery = String(query || '').trim();
  if (!safeQuery) return [];
  const payload = await requestEodhd(`search/${encodeURIComponent(safeQuery)}`, { type: 'stock', exchange, limit });
  if (Array.isArray(payload)) return payload;
  if (payload?.Code || payload?.code) return [payload];
  return [];
}
