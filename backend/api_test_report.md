# API Test Report: KardiaTwin Backend Server

Testing against running server at http://127.0.0.1:8000...

## 1. Simulation Start (/start)
✅ Successfully started simulation for a 40 y/o Sedentary Smoker.

## 2. Biological Age (/biological_age)
✅ Biological age correctly calculated as 49. (Adjustment: +9)

## 3. What-If Scenario Analysis (/what_if_analysis)
Tested hypothetical scenario: Non-Smoker, Active.
Current SBP Modifier: 1.12
Hypothetical SBP Modifier: 1.0
Improvement %: 10.7%
✅ What-If correctly predicts improvement based on lifestyle changes.

## 4. Simulation Status (/status)
✅ Engine is actively running in 'rest' phase.

## 5. Stop Simulation (/stop_simulation)
✅ Successfully stopped active simulation.