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
####################
## FP&A Dashboard ##
####################

# scripts/01_analysis.R
library(tidyverse)
library(scales)
library(readxl)

financials <- read_xlsx("C:/Users/prati/OneDrive/Documents/Jobs/Projects/Financials.xlsx")

#analysis script
# Calculate key metrics
financials <- financials |>
  mutate(
    ebitda_margin = round(EBITDA/`Net Revenue` * 100, 1),
    net_margin    = round(`Net Income`/`Net Revenue` * 100, 1),
    yoy_growth    = round((`Net Revenue`/lag(`Net Revenue`) - 1) * 100, 1))

# Revenue trend chart
ggplot(financials, aes(x = Year, y = `Net Revenue`)) +
  geom_col(fill = "#534AB7", width = 0.6) +
  geom_text(aes(label = paste0(round(`Net Revenue`/1000,1), "B")),
            vjust = -0.5, size = 3.5, color = "#26215C") +
  labs(title = "Ferrari Revenue 2015–2025 (€M)",
       x = "Year", y = "Revenue (€M)") +
  theme_minimal() +
  scale_y_continuous(labels = comma)

# app.R — Shiny dashboard
library(shiny)
library(tidyverse)
library(plotly)
library(DT)


ui <- fluidPage(
  titlePanel("Ferrari S.p.A. — Financial Performance Dashboard"),
  sidebarLayout(
    sidebarPanel(
      selectInput("metric", "Select metric:",
                  choices = c("Revenue"="revenue",
                              "EBITDA"="ebitda",
                              "Net Income"="net_income"))
    ),
    mainPanel(
      plotlyOutput("chart"),
      br(),
      DTOutput("table")
    )
  )
)

server <- function(input, output) {
  output$chart <- renderPlotly({
    p <- ggplot(financials, aes(x=year, y=.data[[input$metric]])) +
      geom_col(fill="#534AB7") +
      geom_line(color="#1D9E75", size=1) +
      theme_minimal() +
      labs(x="Year", y="€M")
    ggplotly(p)
  })
  output$table <- renderDT({
    datatable(financials, options=list(pageLength=5))
  })
}

shinyApp(ui, server)

######
library(forecast)

# Simple linear forecast for next 2 years
rev_ts <- ts(financials$`Net Revenue`, start=2015)
model  <- auto.arima(rev_ts)
fcast  <- forecast(model, h=3)

autoplot(fcast) +
  labs(title="Revenue forecast 2026-2027",
       x="Year", y="Revenue (€M)") +
  theme_minimal()
