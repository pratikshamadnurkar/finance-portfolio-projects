# Market data providers and coverage

This dashboard uses different sources by market. Provider support is not uniform, and the London company list is a curated subset rather than every London Stock Exchange listing.

## Sources used

| Market or feature | Source | Notes |
| --- | --- | --- |
| U.S. fundamentals | SEC Company Facts | Free public filing data. The server sends the configured `SEC_USER_AGENT` contact string. Coverage depends on SEC filings and available XBRL facts. |
| India fundamentals | IndianAPI | Requires `INDIANAPI_API_KEY`. The dashboard maps supported statement fields; missing or unrecognized values remain blank. |
| London fundamentals | SEC Company Facts | Free filings for the curated London issuers that also report to the SEC. It does not cover every LSE company. Values use the currency reported in the issuer's SEC filing. |
| Global symbol search | EODHD Search API (optional) | `EODHD_API_TOKEN` can expand name and ticker discovery. EODHD Fundamentals is not used. |
| Demo mode | Local sample data | Illustrative placeholders, labeled in the dashboard; they are not sourced company results. |

Companies House publishes downloadable accounts data for UK-registered companies. This project does not yet import or normalize those files, so Companies House data is not currently used for London company statements.

## Data handling

- Provider credentials belong in the server-side `.env` file. Keep `.env` out of Git and never put keys in frontend code.
- `/api/health` reports whether selected credentials are configured; it does not return credential values.
- The curated symbol list is a starting set, not a complete exchange directory.
- A listed company may not have the filings or facts needed for every ratio. Missing values are left blank rather than estimated.
- Compare calculated ratios with company filings before using them in analysis. The dashboard is a portfolio project, not investment advice.

## References

- [SEC EDGAR data access](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)
- [SEC Company Facts API](https://www.sec.gov/edgar/sec-api-documentation)
- [Companies House accounts data](https://download.companieshouse.gov.uk/en_accountsdata.html)
- [EODHD Search API](https://eodhd.com/financial-apis/search-api-for-stocks-etfs-mutual-funds)
- [EODHD Fundamentals API](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds)
