# MarketLens — Company Fundamentals Dashboard

A React + Vite dashboard with an Express API server. It has U.S., India, and London views. The starter symbol catalog is in `src/data/market-symbols.json`; searches check it first, then query the selected-market provider or EODHD's global symbol search when configured. Search accepts company names and ticker symbols and shows country, exchange, and currency before loading a listing.

## Run locally

Requires Node.js 22 or newer. Install a supported LTS release; Node.js 20 reached end-of-life in March 2026.

```sh
npm install
cp .env.example .env
```

Set `SEC_USER_AGENT` to the app name and a monitored contact email. Set `INDIANAPI_API_KEY` for India financials. `EODHD_API_TOKEN` can enable global symbol search; the London fundamentals path uses free SEC filings and does not call EODHD Fundamentals or Alpha Vantage. Keep all keys in the server `.env`, never in React source.

Start the React UI and API server:

```sh
npm run dev
```

Open the local URL Vite prints. The UI calls Express through Vite's `/api` proxy. SEC data is fetched server-side because the SEC data API is not available to browser code through CORS.

For production:

```sh
npm run build
npm start
```

## API examples

```sh
curl 'http://127.0.0.1:3002/api/health'
curl 'http://127.0.0.1:3002/api/markets/catalog'
curl 'http://127.0.0.1:3002/api/markets/search?query=AstraZeneca&market=uk'
curl 'http://127.0.0.1:3002/api/markets/search?query=Reliance&market=india'
curl 'http://127.0.0.1:3002/api/markets/search?query=Tesla&market=us'
curl 'http://127.0.0.1:3002/api/compare?symbols=AAPL,TSLA'
curl 'http://127.0.0.1:3002/api/india/compare?symbols=RELIANCE.BSE,TCS.BSE'
curl 'http://127.0.0.1:3002/api/uk/compare?symbols=AZN.LSE'
```

`/api/markets/search` returns `matches`, `sameMarketMatches`, and `otherMarketMatches`. If there are multiple listings, the UI asks the user to choose one. Without an EODHD token, U.S. searches can use the SEC ticker directory, India searches use IndianAPI, and all markets can use the curated JSON seeds; full cross-market discovery for symbols outside the seeds needs EODHD.

## Data modes and limits

- **U.S.:** SEC Company Facts; free and no API key, but requires the `SEC_USER_AGENT` contact string. Ratios are calculated from filing facts. SEC's ticker/exchange file is a helpful directory, not an exhaustive or guaranteed listing source.
- **India:** IndianAPI stock endpoint; `INDIANAPI_API_KEY` is sent server-side. Annual line items and ratios are mapped only when provider labels and units can be interpreted safely. Missing values stay blank.
- **London:** Free SEC EDGAR Company Facts for the curated London issuers that file annual reports with the SEC. Amounts use the currency reported in their IFRS facts. Other London listings may not file with the SEC and will not load through this route. Companies House publishes free electronic accounts files for UK-registered companies, but this app does not yet import or normalize them.
- **Demo:** U.S. sample figures are illustrative placeholders and are clearly labeled as such.

Read [`api-research.md`](./api-research.md) for provider coverage and current data limitations.
