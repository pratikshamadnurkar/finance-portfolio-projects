export const COMPANIES = {
  AAPL: {
    symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology hardware', exchange: 'NASDAQ', cik: '0000320193', color: '#4168be', peers: ['MSFT', 'NVDA', 'AMZN'],
    demo: {
      ratios: {
        2023: { revenueGrowth: 0.2, grossMargin: 44.1, operatingMargin: 29.8, netMargin: 25.3, roe: 156, currentRatio: 0.99, debtEquity: 1.81, netDebtEbitda: 0.43, pe: 29.6, fcfYield: 3.4 },
        2024: { revenueGrowth: 2.0, grossMargin: 46.2, operatingMargin: 31.5, netMargin: 24.0, roe: 152, currentRatio: 0.87, debtEquity: 1.51, netDebtEbitda: 0.34, pe: 32.8, fcfYield: 3.2 },
        2025: { revenueGrowth: 6.4, grossMargin: 46.8, operatingMargin: 32.1, netMargin: 25.7, roe: 148, currentRatio: 0.91, debtEquity: 1.42, netDebtEbitda: 0.28, pe: 31.4, fcfYield: 3.5 },
      }, history: { revenue: { 2022: 394.3, 2023: 383.3, 2024: 391.0, 2025: 416.2 }, operatingMargin: { 2022: 30.3, 2023: 29.8, 2024: 31.5, 2025: 32.1 }, freeCashFlow: { 2023: 99.6, 2024: 108.8, 2025: 112.4 } },
    },
  },
  MSFT: {
    symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Software & cloud', exchange: 'NASDAQ', cik: '0000789019', color: '#3876bf', peers: ['AAPL', 'NVDA', 'AMZN'],
    demo: {
      ratios: {
        2023: { revenueGrowth: 6.9, grossMargin: 68.9, operatingMargin: 41.8, netMargin: 34.1, roe: 38.8, currentRatio: 1.77, debtEquity: 0.47, netDebtEbitda: -0.28, pe: 33.2, fcfYield: 2.5 },
        2024: { revenueGrowth: 15.7, grossMargin: 69.8, operatingMargin: 44.6, netMargin: 36.0, roe: 37.1, currentRatio: 1.27, debtEquity: 0.42, netDebtEbitda: -0.21, pe: 35.4, fcfYield: 2.4 },
        2025: { revenueGrowth: 14.9, grossMargin: 68.8, operatingMargin: 45.2, netMargin: 35.4, roe: 34.6, currentRatio: 1.35, debtEquity: 0.39, netDebtEbitda: -0.17, pe: 34.1, fcfYield: 2.6 },
      }, history: { revenue: { 2022: 198.3, 2023: 211.9, 2024: 245.1, 2025: 281.7 }, operatingMargin: { 2022: 42.1, 2023: 41.8, 2024: 44.6, 2025: 45.2 }, freeCashFlow: { 2023: 59.5, 2024: 74.1, 2025: 82.3 } },
    },
  },
  NVDA: {
    symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Semiconductors', exchange: 'NASDAQ', cik: '0001045810', color: '#76a348', peers: ['MSFT', 'AAPL', 'AMZN'],
    demo: {
      ratios: {
        2023: { revenueGrowth: 0.2, grossMargin: 56.9, operatingMargin: 15.7, netMargin: 16.2, roe: 17.9, currentRatio: 3.52, debtEquity: 0.47, netDebtEbitda: -0.61, pe: 117.4, fcfYield: 0.5 },
        2024: { revenueGrowth: 125.9, grossMargin: 72.7, operatingMargin: 54.1, netMargin: 48.9, roe: 91.5, currentRatio: 4.17, debtEquity: 0.23, netDebtEbitda: -0.91, pe: 59.2, fcfYield: 1.1 },
        2025: { revenueGrowth: 114.2, grossMargin: 75.0, operatingMargin: 62.4, netMargin: 55.8, roe: 108.4, currentRatio: 4.21, debtEquity: 0.15, netDebtEbitda: -1.04, pe: 43.8, fcfYield: 1.9 },
      }, history: { revenue: { 2022: 26.9, 2023: 27.0, 2024: 60.9, 2025: 130.5 }, operatingMargin: { 2022: 37.3, 2023: 15.7, 2024: 54.1, 2025: 62.4 }, freeCashFlow: { 2023: 3.8, 2024: 27.0, 2025: 60.9 } },
    },
  },
  AMZN: {
    symbol: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Internet retail & cloud', exchange: 'NASDAQ', cik: '0001018724', color: '#bf8a3f', peers: ['MSFT', 'AAPL', 'NVDA'],
    demo: {
      ratios: {
        2023: { revenueGrowth: 11.8, grossMargin: 46.0, operatingMargin: 6.4, netMargin: 5.3, roe: 17.3, currentRatio: 1.05, debtEquity: 0.84, netDebtEbitda: 0.22, pe: 51.0, fcfYield: 1.8 },
        2024: { revenueGrowth: 11.0, grossMargin: 48.9, operatingMargin: 10.8, netMargin: 9.3, roe: 24.5, currentRatio: 1.06, debtEquity: 0.68, netDebtEbitda: 0.06, pe: 42.5, fcfYield: 2.1 },
        2025: { revenueGrowth: 8.4, grossMargin: 49.2, operatingMargin: 11.2, netMargin: 9.6, roe: 25.3, currentRatio: 1.08, debtEquity: 0.61, netDebtEbitda: -0.04, pe: 38.2, fcfYield: 2.7 },
      }, history: { revenue: { 2022: 514.0, 2023: 574.8, 2024: 638.0, 2025: 691.3 }, operatingMargin: { 2022: 2.4, 2023: 6.4, 2024: 10.8, 2025: 11.2 }, freeCashFlow: { 2023: 36.8, 2024: 48.5, 2025: 68.1 } },
    },
  },
  COST: {
    symbol: 'COST', name: 'Costco Wholesale Corp.', sector: 'Consumer staples retail', exchange: 'NASDAQ', cik: '0000909832', color: '#bd554e', peers: ['AMZN', 'MSFT', 'AAPL'],
    demo: {
      ratios: {
        2023: { revenueGrowth: 6.8, grossMargin: 10.6, operatingMargin: 3.4, netMargin: 2.6, roe: 27.8, currentRatio: 1.07, debtEquity: 0.34, netDebtEbitda: -0.57, pe: 39.8, fcfYield: 1.7 },
        2024: { revenueGrowth: 5.0, grossMargin: 10.9, operatingMargin: 3.7, netMargin: 2.9, roe: 30.1, currentRatio: 1.02, debtEquity: 0.31, netDebtEbitda: -0.65, pe: 51.2, fcfYield: 1.6 },
        2025: { revenueGrowth: 8.1, grossMargin: 11.0, operatingMargin: 3.8, netMargin: 2.9, roe: 31.0, currentRatio: 1.04, debtEquity: 0.28, netDebtEbitda: -0.71, pe: 49.2, fcfYield: 1.8 },
      }, history: { revenue: { 2022: 226.9, 2023: 242.3, 2024: 254.5, 2025: 275.2 }, operatingMargin: { 2022: 3.4, 2023: 3.4, 2024: 3.7, 2025: 3.8 }, freeCashFlow: { 2023: 6.7, 2024: 7.4, 2025: 8.3 } },
    },
  },
};

export const RATIO_ROWS = [
  { key: 'revenueGrowth', label: 'Revenue growth', group: 'Growth', category: 'profitability', unit: '%', description: 'Year-over-year percentage change in the reported top-line measure. A positive value means it increased; a negative value means it fell. The reported measure can differ for banks and other industries.' },
  { key: 'grossMargin', label: 'Gross margin', group: 'Profitability', category: 'profitability', unit: '%', description: 'Gross profit divided by revenue. It shows the share of revenue left after direct costs, before most operating expenses. Normal levels vary by industry.' },
  { key: 'operatingMargin', label: 'Operating margin', group: 'Profitability', category: 'profitability', unit: '%', description: 'Operating income divided by revenue. It shows the share of revenue left after operating expenses, before interest and tax.' },
  { key: 'netMargin', label: 'Net margin', group: 'Profitability', category: 'profitability', unit: '%', description: 'Net income divided by the reported top-line measure. For example, 10% means about 10 of net income for every 100 of that measure. Definitions and comparability can vary, especially for banks.' },
  { key: 'roe', label: 'Return on equity', group: 'Returns', category: 'profitability', unit: '%', description: 'Net income relative to shareholders’ equity. A high value can reflect strong returns, but can also be amplified by debt, buybacks, or a small equity base.' },
  { key: 'roa', label: 'Return on assets', group: 'Returns', category: 'profitability', unit: '%', description: 'Net income relative to total assets. It gives a view of earnings generated from the asset base; compare carefully across industries.' },
  { key: 'roce', label: 'Return on capital employed', group: 'Returns', category: 'profitability', unit: '%', description: 'Operating profit relative to the capital used in the business. The exact formula can vary with the facts available in each company’s filings.' },
  { key: 'currentRatio', label: 'Current ratio', group: 'Liquidity', category: 'liquidity', unit: 'x', description: 'Current assets divided by current liabilities. A value of 1.2× means 1.20 of current assets for each 1.00 of current liabilities at the reporting date. Seasonality and industry norms matter.' },
  { key: 'debtEquity', label: 'Debt / equity', group: 'Leverage', category: 'leverage', unit: 'x', description: 'Reported debt divided by shareholders’ equity. It describes balance-sheet leverage; small or negative equity can make the ratio unusually large or hard to interpret.' },
  { key: 'netDebtEbitda', label: 'Net debt / EBITDA', group: 'Leverage', category: 'leverage', unit: 'x', description: 'Net debt divided by EBITDA. A negative figure often means cash exceeds debt under the calculation used. EBITDA is not cash flow, and sector context matters.' },
  { key: 'pe', label: 'P / E', group: 'Valuation', category: 'valuation', unit: 'x', description: 'Share price divided by earnings per share. It relates market price to reported earnings. This app leaves it blank when it does not have suitable price data.' },
  { key: 'pb', label: 'P / B', group: 'Valuation', category: 'valuation', unit: 'x', description: 'Market value of equity divided by book value of equity. It can be less useful for companies whose value comes mainly from intangible assets.' },
  { key: 'evEbitda', label: 'EV / EBITDA', group: 'Valuation', category: 'valuation', unit: 'x', description: 'Enterprise value divided by EBITDA. It compares business value with operating earnings before interest, tax, depreciation, and amortization.' },
  { key: 'fcfYield', label: 'Free cash flow yield', group: 'Valuation', category: 'valuation', unit: '%', description: 'Free cash flow divided by market capitalization. It needs market-price data, so it may be blank in filing-only modes.' },
];

export const CATEGORIES = [
  { key: 'all', label: 'All ratios' },
  { key: 'profitability', label: 'Profitability' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'leverage', label: 'Leverage' },
  { key: 'valuation', label: 'Valuation' },
];
