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

#################
## Credit Risk ##
#################

#1. The German Credit dataset
library(tidyverse)
library(ROCR)

# This dataset is built into R — no download needed!
data("GermanCredit", package="caret")

library(caret)
glimpse(GermanCredit)
# 1000 loan applicants, 62 features, "Class" = Good or Bad

# Quick exploration
table(GermanCredit$Class)
# Good: 700, Bad: 300 — imbalanced

#2. Visual
# Default rate by loan duration
GermanCredit |>
  mutate(default = ifelse(Class == "Bad", 1, 0)) |>
  group_by(duration_group = cut(Duration,
                                breaks = c(0,12,24,36,72))) |>
  summarise(default_rate = mean(default) * 100) |>
  ggplot(aes(x = duration_group, y = default_rate)) +
  geom_col(fill = "#534AB7") +
  labs(title = "Default rate by loan duration",
       x = "Duration (months)",
       y = "Default rate (%)") +
  theme_minimal()

#3. Train/test split and logistic regression
set.seed(42)
n     <- nrow(GermanCredit)
train_idx <- sample(1:n, round(0.8*n))

train <- GermanCredit[train_idx, ]
test  <- GermanCredit[-train_idx, ]

# Fit logistic regression — start with key predictors
model <- glm(Class ~ Duration + Amount + Age + 
               InstallmentRatePercentage + NumberExistingCredits,
             data=train, family="binomial")

summary(model)
# Look at p-values: *** = highly significant predictor
# Note for README: which variables predict default most strongly?

# Predict on test set
pred_prob <- predict(model, newdata=test, type="response")
pred_class <- ifelse(pred_prob > 0.5, "Bad", "Good")

# Accuracy
accuracy <- mean(pred_class == test$Class)
cat("Model accuracy:", round(accuracy*100, 1), "%\n")

#4. ROC curve
library(ROCR)

pred_obj <- prediction(pred_prob, test$Class, 
                       label.ordering=c("Good","Bad"))
perf     <- performance(pred_obj, "tpr", "fpr")
auc      <- performance(pred_obj, "auc")@y.values[[1]]

plot(perf, colorize=FALSE, col="#534AB7", lwd=2,
     main=paste0("ROC Curve — AUC = ", round(auc,3)))
abline(a=0, b=1, lty=2, col="grey50")
# AUC > 0.7 is good for credit risk.
