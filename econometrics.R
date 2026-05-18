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

##################
## Econometrics ##
##################

#1. Pull data from Eurostat
library(eurostat)
library(tidyverse)
library(forecast)

# Search for datasets — run this to explore what's available
search_eurostat("GDP") |> select(title, code) |> head(10)

# Download GDP growth for Italy & Germany (dataset: "namq_10_gdp")
gdp_raw <- get_eurostat("namq_10_gdp",
                        filters = list(
                          geo    = c("IT", "DE"),
                          na_item = "B1GQ",   # GDP
                          unit   = "CLV_PCH_PRE"  # % change previous quarter
                        )
)

# Clean and filter
gdp <- gdp_raw |>
  filter(time >= "2010-01-01") |>
  select(time, geo, values) |>
  drop_na()

glimpse(gdp)

#2. Visualise: Italy vs Germany GDP growth
ggplot(gdp, aes(x=time, y=values, color=geo)) +
  geom_line(size=1) +
  geom_hline(yintercept=0, linetype="dashed", color="grey50") +
  scale_color_manual(values=c("IT"="#534AB7", "DE"="#185FA5"),
                     labels=c("IT"="Italy", "DE"="Germany")) +
  labs(title="Italy vs Germany: Quarterly GDP Growth (%)",
       subtitle="Source: Eurostat, 2010–2024",
       x=NULL, y="% change vs previous quarter",
       color="Country") +
  theme_minimal() +
  theme(legend.position="top")

#3. Run ARIMA forecast
# Filter Italy only and convert to time series
italy_gdp <- gdp |> filter(geo == "IT") |> pull(values)
ts_italy  <- ts(italy_gdp, frequency=4, start=c(2010,1))

# Fit best ARIMA model automatically
arima_model <- auto.arima(ts_italy, seasonal=TRUE)
summary(arima_model)  # note the model order for your README

# Forecast 8 quarters ahead (2 years)
fcast <- forecast(arima_model, h=8, level=c(80, 95))

# Plot forecast
autoplot(fcast) +
  labs(title="Italy GDP Growth Forecast — 8 Quarters",
       subtitle="ARIMA model with 80% and 95% confidence intervals",
       x=NULL, y="% growth") +
  theme_minimal()

#4. Regression: does German GDP predict Italian GDP?
# Pivot wide to run regression
gdp_wide <- gdp |>
  pivot_wider(names_from=geo, values_from=values) |>
  drop_na()

model <- lm(IT ~ DE, data=gdp_wide)
summary(model)  # look at R-squared and p-value — write about this in README

ggplot(gdp_wide, aes(x=DE, y=IT)) +
  geom_point(color="#534AB7", alpha=0.6) +
  geom_smooth(method="lm", color="#1D9E75", se=TRUE) +
  labs(title="Does Germany's GDP growth predict Italy's?",
       x="Germany GDP growth (%)", y="Italy GDP growth (%)") +
  theme_minimal()
