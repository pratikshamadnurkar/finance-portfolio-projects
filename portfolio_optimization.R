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

###########################
## Potfolio Optimization ##
###########################

#1. stock prices
library(quantmod)
library(tidyverse)
library(PerformanceAnalytics)

# Pick 5 Italian/European blue chips
tickers <- c("ENI.MI",    # ENI (energy)
             "ENEL.MI",   # Enel (utilities)
             "ISP.MI",    # Intesa Sanpaolo (banking)
             "RACE.MI",   # Ferrari (luxury)
             "UCG.MI")    # UniCredit (banking)

getSymbols(tickers, src="yahoo", from="2020-01-01", auto.assign=TRUE)

# Extract adjusted close prices
prices <- merge(Ad(ENI.MI), Ad(ENEL.MI), Ad(ISP.MI), 
                Ad(RACE.MI), Ad(UCG.MI))
colnames(prices) <- c("ENI","Enel","Intesa","Ferrari","UniCredit")
prices <- na.omit(prices)

#2. Returns and build efficient frontier

# Daily returns
returns <- Return.calculate(prices, method="discrete") |> na.omit()

# Annualised stats
mu     <- colMeans(returns) * 252
sigma  <- apply(returns, 2, sd) * sqrt(252)
cov_mat <- cov(returns) * 252

# Simulate 5000 random portfolios
set.seed(42)
n_assets <- ncol(returns)
n_sim    <- 5000
results  <- matrix(NA, nrow=n_sim, ncol=3)

for (i in 1:n_sim) {
  w <- runif(n_assets)
  w <- w / sum(w)
  port_ret <- sum(w * mu)
  port_risk <- sqrt(t(w) %*% cov_mat %*% w)
  sharpe   <- port_ret / port_risk
  results[i,] <- c(port_risk, port_ret, sharpe)
}

results_df <- data.frame(risk=results[,1], ret=results[,2], sharpe=results[,3])

# Plot efficient frontier
ggplot(results_df, aes(x=risk*100, y=ret*100, color=sharpe)) +
  geom_point(alpha=0.3, size=0.8) +
  scale_color_gradient(low="#B5D4F4", high="#534AB7") +
  labs(title="Efficient Frontier — Italian Blue Chips Portfolio",
       subtitle="5,000 simulated portfolios | 2020–2024",
       x="Annualised Risk (%)", y="Annualised Return (%)",
       color="Sharpe ratio") +
  theme_minimal()


#3. Find the optimal portfolio (max Sharpe ratio)

# The portfolio with the highest Sharpe ratio
best_idx <- which.max(results_df$sharpe)

cat("Optimal portfolio:\n")
cat("  Expected return:", round(results_df$ret[best_idx]*100,1), "%\n")
cat("  Risk (volatility):", round(results_df$risk[best_idx]*100,1), "%\n")
cat("  Sharpe ratio:", round(results_df$sharpe[best_idx],3), "\n")

# Get the weights of the optimal portfolio
set.seed(42)  # same seed to reproduce
w_opt <- runif(n_assets); w_opt <- w_opt / sum(w_opt)
library(quadprog)

# Optimization inputs
Dmat <- 2 * cov_mat
dvec <- rep(0, n_assets)

# Constraints:
# weights sum to 1
# weights >= 0
Amat <- cbind(
  rep(1, n_assets),
  diag(n_assets)
)

bvec <- c(1, rep(0, n_assets))

# Solve minimum variance portfolio
opt <- solve.QP(
  Dmat = Dmat,
  dvec = dvec,
  Amat = Amat,
  bvec = bvec,
  meq = 1
)

# Optimal weights
opt_weights <- round(opt$solution, 3)

portfolio <- data.frame(
  Asset = colnames(returns),
  Weight = opt_weights
)

print(portfolio)

ggplot(portfolio, aes(x = Asset, y = Weight)) +
  geom_col(fill = "#534AB7") +
  labs(title = "Optimal Portfolio Weights",
       y = "Portfolio Weight") +
  theme_minimal()
