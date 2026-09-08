# Power BI – Financial Analysis Dashboard

## Overview

This project is an interactive Power BI dashboard analyzing seven years (FY2019–FY2025) of BlackRock Inc.'s financial statements. It consolidates the Income Statement, Balance Sheet, and Cash Flow Statement into a single data model and surfaces profitability, growth, and liquidity trends through KPI cards, trend charts, and financial ratios.

The project reflects the type of reporting and analysis work performed by FP&A analysts and financial reporting teams: taking raw multi-year financial statement data and turning it into a decision-ready dashboard.

---

## Business Problem

Finance teams need timely, centralized visibility into revenue, profitability, and balance sheet health across reporting periods. Reviewing separate spreadsheets for each financial statement and each year makes it difficult to spot trends, identify turning points, or communicate performance to stakeholders quickly.

---

## Objective

Build an interactive dashboard capable of:

- Consolidating multi-year Income Statement, Balance Sheet, and Cash Flow data into one model
- Calculating key profitability, growth, and liquidity metrics
- Visualizing multi-year trends alongside a current-year snapshot
- Supporting fast, self-service exploration without editing the underlying data

---

## Dataset

Historical financial statement data for BlackRock Inc., FY2019–FY2025, covering:

- Income Statement (Revenue, COGS, Operating Expenses, Operating Income, Net Income)
- Balance Sheet (Assets, Liabilities, Equity, and their components)
- Cash Flow Statement (Operating, Investing, and Financing activities)

---

## Data Modelling

### Power Query (ETL)

- Unpivoted each financial statement from wide format (years as columns) into a long, tidy format (`Item`, `Year`, `Value`)
- Appended all three statements into a single **Fact table** (`FinancialsFact`), tagged by source statement
- Built a **Year dimension table** and an **Account dimension table**, with each line item classified into a category (Revenue, COGS, Operating Expense, Asset, Liability, Equity, etc.) and flagged if it represents a subtotal

### Data Model

Implemented a star schema:

- `FinancialsFact` (fact table) related to `DimYear` and `DimAccount` (dimension tables)
- Single-direction relationships from each dimension into the fact table

---

## Methodology

### DAX Measures

**Profitability**
- Revenue, Operating Income, Net Income
- Operating Margin %, Net Margin %

**Growth**
- Revenue Prior Year, Revenue YoY %

**Balance Sheet & Liquidity**
- Total Assets, Total Liabilities, Total Equity
- Current Ratio
- Return on Assets (ROA)

### Visualization

- KPI card row (Revenue, Net Income, Net Margin %, Revenue YoY %, Total Assets, Total Liabilities, Total Equity) reflecting the selected year
- Multi-year trend charts: Revenue/Operating Income/Net Income, and Total Assets vs. Total Liabilities
- Ratio trend charts: Current Ratio, Operating Margin %, Net Margin %, ROA
- Year slicer configured so it filters only the KPI cards, while trend charts retain the full 7-year history for context

---

## Results

The dashboard identifies a clear margin compression in FY2021–FY2022, followed by a recovery through FY2024–FY2025, alongside a corresponding dip and rebound in total assets and liabilities over the same period. Consolidating all three statements into one model also removed the need to manually cross-reference separate spreadsheets to track these trends.

---

## Business Value

This project demonstrates how a self-service BI dashboard supports:

- Financial Planning & Analysis (FP&A) reporting
- Management and stakeholder reporting
- Trend and variance identification across reporting periods
- Faster, more consistent financial review cycles

---

## Skills Demonstrated

### Finance

- Financial Statement Analysis
- Profitability & Liquidity Ratio Analysis
- KPI Reporting
- Trend Analysis

### Technical

- Power BI
- Power Query (ETL, unpivoting, data shaping)
- Data Modelling (star schema, fact/dimension tables)
- DAX (CALCULATE, DIVIDE, time-based comparisons)

---

## Screenshots


<img width="1212" height="681" alt="Screenshot 2026-09-08 113308" src="https://github.com/user-attachments/assets/4071ab56-c4b7-4be5-a746-26975c0b3c73" />


---

## Future Improvements

- Add a drill-through page for account-level detail behind each KPI
- Row-level security (RLS) for multi-entity or multi-region reporting
- Publish to Power BI Service with a scheduled refresh
- Extend the model with a rolling forecast comparison against actuals


## Future Improvements

- Add a drill-through page for account-level detail behind each KPI
- Row-level security (RLS) for multi-entity or multi-region reporting
- Publish to Power BI Service with a scheduled refresh
- Extend the model with a rolling forecast comparison against actuals
