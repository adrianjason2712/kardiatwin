# KardiaTwin ML Model Evolution: Option 1 (Sliding Window)

This document outlines the 1-day implementation plan for upgrading the static `heart_model.pkl` to a time-aware model using Feature Engineering (Sliding Windows), as chosen by the user.

We currently paused this implementation to prioritize the RAG Chatbot integration, but this document serves as the exact roadmap for when we return to the ML model.

## The Goal
To stop the ML model from looking at the user's vitals as a single snapshot in time, and instead teach it to understand the *rate of change* (e.g., how fast the heart rate is climbing during exercise, or failing to drop during recovery).

## Implementation Roadmap (Estimated Time: 2-3 Hours)

### Step 1: Add the Sliding Window Tracker to `main.py`
Modify `PhysiologySimulationEngine` in `backend/main.py`.
1.  Initialize a deque: `self.hr_history = deque(maxlen=30)` (holds 30 seconds of HR data).
2.  Update the deque in the `update(dt)` loop.
3.  Create a function `get_hr_gradient()` that calculates `(current_hr - oldest_hr) / time_delta`.

### Step 2: Generate Synthetic Data (`generate_dataset.py`)
Because we don't have real hospital time-series data, we will use the Simulation Engine to generate our own.
1.  Write a script that runs the `PhysiologySimulationEngine` in a headless loop for 1,000 different "virtual patients" (randomizing their age, smoking status, etc.).
2.  At random intervals during the simulation, capture: `[Age, Sex, Current_HR, HR_Gradient, Max_HR, Phase]`.
3.  Label the data: If the patient is a Smoker/Diabetic/Older, label `Risk=1`. If Healthy/Athlete, label `Risk=0`.
4.  Export this to `simulated_heart_data.csv`.

### Step 3: Train the New ML Model (`train_model.py`)
We will train a new model that understands the gradients.
1.  Load `simulated_heart_data.csv` using `pandas`.
2.  Train a `RandomForestClassifier` from `scikit-learn` using the features defined in Step 2.
3.  Export the trained model as pulling `heart_model_v2.pkl`.

### Step 4: Plug it into the Backend
1.  In `backend/main.py`, replace the loading of `heart_model.pkl` with `heart_model_v2.pkl`.
2.  Update `predict_risk()` to fetch `self.get_hr_gradient()` and pass it into the new model's `predict_proba()` function along with the standard vitals.

---
*Ready to resume when the RAG Chatbot is complete.*
