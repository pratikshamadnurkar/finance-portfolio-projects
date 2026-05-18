rm(list = ls())
library(tidyverse)
library(scales)
library(readxl)
library(shiny)
library(plotly)
library(DT)
library(forecast)
library(eurostat)
library(caret)
library(ROCR)
library(quantmod)
library(PerformanceAnalytics)
library(quadprog)
###############
## DCF Model ##
###############

#1. Input
# scripts/dcf_model.R
library(tidyverse)

# === INPUTS — change these for any company ===
company     <- "Ferrari N.V. (RACE)"
revenue_base <- 5970    # last year revenue in €M
fcf_margin  <- 0.18    # free cash flow margin (18%)
growth_rate <- 0.12    # expected annual growth
wacc        <- 0.09    # weighted average cost of capital
terminal_g  <- 0.025   # terminal growth rate
years       <- 5       # projection horizon
net_debt    <- 550     # net debt in €M
shares_out  <- 182.8   # shares outstanding in millions

# === PROJECTION ===
proj <- tibble(
  year    = 1:years,
  revenue = revenue_base * (1 + growth_rate)^(1:years),
  fcf     = revenue * fcf_margin,
  pv_fcf  = fcf / (1 + wacc)^(1:years)
)

# === TERMINAL VALUE ===
terminal_fcf  <- tail(proj$fcf, 1) * (1 + terminal_g)
terminal_value <- terminal_fcf / (wacc - terminal_g)
pv_terminal   <- terminal_value / (1 + wacc)^years

# === ENTERPRISE & EQUITY VALUE ===
enterprise_value <- sum(proj$pv_fcf) + pv_terminal
equity_value     <- enterprise_value - net_debt
price_per_share  <- equity_value / shares_out

cat("Enterprise Value: €", round(enterprise_value,0), "M\n")
cat("Implied Share Price: €", round(price_per_share,2), "\n")

#2. sensitivity analysis table
# Sensitivity: WACC vs terminal growth rate
wacc_range <- seq(0.07, 0.11, by=0.01)
tg_range   <- seq(0.01, 0.04, by=0.01)

sens_matrix <- outer(wacc_range, tg_range, Vectorize(function(w, g) {
  tv  <- (tail(proj$fcf,1)*(1+g)) / (w-g)
  ev  <- sum(proj$pv_fcf) + tv/(1+w)^years
  round((ev - net_debt)/shares_out, 0)
}))

rownames(sens_matrix) <- paste0(wacc_range*100, "% WACC")
colnames(sens_matrix) <- paste0("TG=", tg_range*100, "%")

print(sens_matrix)  # paste this into your RMarkdown report
