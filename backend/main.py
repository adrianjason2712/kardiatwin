"""
KardiaTwin FastAPI Server - Pure FastAPI Implementation
Cardiac stress test simulator with real-time monitoring
"""

import time
import threading
import pickle
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import logging

from models import init_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load ML Model
try:
    with open('heart_model.pkl', 'rb') as file:
        heart_model, scaler = pickle.load(file)
    logger.info("✓ ML model loaded")
except Exception as e:
    logger.error(f"✗ Failed to load ML model: {e}")
    heart_model, scaler = None, None

# ==================== ENUMS ====================

class SmokingStatus(str, Enum):
    NON_SMOKER = "non_smoker"
    SMOKER = "smoker"
    EX_SMOKER = "ex_smoker"

class DiabetesHistory(str, Enum):
    NONE = "none"
    TYPE_1 = "type_1"
    TYPE_2 = "type_2"

class AlcoholConsumption(str, Enum):
    NONE = "none"
    MODERATE = "moderate"
    HEAVY = "heavy"

class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"
    ACTIVE = "active"
    ATHLETE = "athlete"

# ==================== PYDANTIC MODELS ====================

class SimulationConfig(BaseModel):
    rest_duration_s: Optional[int] = 60
    exercise_duration_s: Optional[int] = 180
    recovery_duration_s: Optional[int] = 120
    max_workload_level: Optional[int] = 3
    protocol: Optional[str] = "standard"

    @field_validator('rest_duration_s')
    @classmethod
    def validate_rest(cls, v):
        if v and (v < 30 or v > 300):
            raise ValueError('rest_duration_s: 30-300 seconds')
        return v

    @field_validator('exercise_duration_s')
    @classmethod
    def validate_exercise(cls, v):
        if v and (v < 60 or v > 600):
            raise ValueError('exercise_duration_s: 60-600 seconds')
        return v

class StartSimulationRequest(BaseModel):
    age: int = Field(..., ge=18, le=100)
    sex: str = Field(..., pattern="^[01]$")
    cp: str = Field(..., pattern="^[0-3]$")
    fbs: Optional[str] = "0"
    restecg: Optional[str] = "0"
    slope: Optional[str] = "1"
    ca: Optional[str] = "0"
    thal: Optional[str] = "2"
    smoking_status: SmokingStatus = SmokingStatus.NON_SMOKER
    diabetes_history: DiabetesHistory = DiabetesHistory.NONE
    alcohol_consumption: AlcoholConsumption = AlcoholConsumption.NONE
    activity_level: ActivityLevel = ActivityLevel.ACTIVE
    simulation: Optional[SimulationConfig] = None
    session_name: Optional[str] = None

class WhatIfInput(BaseModel):
    smoking_status: Optional[SmokingStatus] = None
    diabetes_history: Optional[DiabetesHistory] = None
    alcohol_consumption: Optional[AlcoholConsumption] = None
    activity_level: Optional[ActivityLevel] = None

class ThresholdUpdate(BaseModel):
    heart_rate_high: Optional[float] = None
    heart_rate_low: Optional[float] = None
    blood_pressure_high: Optional[float] = None
    blood_pressure_low: Optional[float] = None
    st_depression_high: Optional[float] = None

# ==================== PHYSIOLOGY ENGINE ====================

class PhysiologySimulationEngine:
    """Cardiac stress test simulator"""

    def __init__(self, config=None):
        # Baselines
        self.baseline_hr = 72.0
        self.baseline_sbp = 120.0
        self.baseline_dbp = 75.0
        self.baseline_oldpeak = 1.0

        # Current state
        self.hr = self.baseline_hr
        self.sbp = self.baseline_sbp
        self.dbp = self.baseline_dbp
        self.oldpeak = self.baseline_oldpeak
        self.exang = 0
        self.phase = "rest"
        self.workload_level = 0
        self.protocol = "standard"
        self.stage = 0
        self.stage_time = 0
        self.protocol_finished = False

        # Protocols
        self.protocol_configs = {
            "standard": {
                "stages": [
                    {"duration": 180, "workload": 1, "target_hr": 0.85},
                    {"duration": 180, "workload": 2, "target_hr": 0.90},
                    {"duration": 180, "workload": 3, "target_hr": 0.95}
                ]
            },
            "modified_bruce": {
                "stages": [
                    {"duration": 300, "workload": 0.5, "target_hr": 0.70},
                    {"duration": 300, "workload": 1.0, "target_hr": 0.80},
                    {"duration": 300, "workload": 1.5, "target_hr": 0.85},
                    {"duration": 300, "workload": 2.0, "target_hr": 0.90}
                ]
            }
        }

        # Config
        self.config = {
            "rest_duration_s": 60,
            "exercise_duration_s": 180,
            "recovery_duration_s": 120,
            "max_workload_level": 3,
            "protocol": "standard"
        }
        if config:
            self.config.update(config)
            self.protocol = config.get("protocol", "standard")

        # Timers
        self.phase_elapsed_s = 0.0
        self.hr_increase_rate_per_min = 11.0
        self.sbp_increase_per_level = 12.0
        self.recovery_rate_per_min = 15.0

        # User info
        self.age = 50
        self.age_modifier = 1.0
        self.smoking_status = "non_smoker"
        self.diabetes_history = "none"
        self.alcohol_consumption = "none"
        self.activity_level = "active"

        # Modifiers
        self.sbp_modifier = 1.0
        self.hr_modifier = 1.0
        self.recovery_modifier = 1.0
        self.max_workload_capacity = 1.0

        # Pause
        self.paused = False
        self.pause_start_time = None
        self.pause_elapsed = 0.0

        # Prediction history tracking
        self.prediction_history = []
        self.risk_thresholds = {
            "high": 0.7,
            "medium": 0.4
        }
        self.previous_risk_level = None

    def pause(self):
        if not self.paused:
            self.paused = True
            self.pause_start_time = time.time()

    def resume(self):
        if self.paused:
            self.pause_elapsed += time.time() - self.pause_start_time
            self.paused = False
            self.pause_start_time = None

    def apply_age_modifiers(self):
        if self.age < 30:
            self.age_modifier = 0.95
        elif self.age < 40:
            self.age_modifier = 1.0
        elif self.age < 50:
            self.age_modifier = 1.05
        elif self.age < 60:
            self.age_modifier = 1.1
        else:
            self.age_modifier = 1.15

        self.hr_modifier *= self.age_modifier
        self.sbp_modifier *= (1.0 + (self.age - 40) * 0.01)

    def apply_lifestyle_modifiers(self):
        if self.smoking_status == "smoker":
            self.sbp_modifier *= 1.12
            self.hr_modifier *= 1.1
            self.recovery_modifier *= 0.85
        elif self.smoking_status == "ex_smoker":
            self.sbp_modifier *= 1.05
            self.hr_modifier *= 1.02

        if self.diabetes_history == "type_1":
            self.sbp_modifier *= 1.15
            self.hr_modifier *= 1.12
            self.recovery_modifier *= 0.8
        elif self.diabetes_history == "type_2":
            self.sbp_modifier *= 1.1
            self.hr_modifier *= 1.08
            self.recovery_modifier *= 0.85

        if self.alcohol_consumption == "heavy":
            self.sbp_modifier *= 1.08
            self.recovery_modifier *= 0.9
        elif self.alcohol_consumption == "moderate":
            self.sbp_modifier *= 1.02

        if self.activity_level == "athlete":
            self.hr_modifier *= 0.85
            self.recovery_modifier *= 1.2
            self.max_workload_capacity = 1.3
        elif self.activity_level == "active":
            self.hr_modifier *= 0.95
            self.recovery_modifier *= 1.1
            self.max_workload_capacity = 1.1
        else:
            self.hr_modifier *= 1.1
            self.recovery_modifier *= 0.9
            self.max_workload_capacity = 0.8

    def calculate_adaptive_thresholds(self):
        """Calculate personalized risk thresholds based on user profile"""
        high_risk_threshold = 0.7
        medium_risk_threshold = 0.4

        # Adjust for smoking status
        if self.smoking_status == "smoker":
            high_risk_threshold -= 0.15  # More conservative for current smokers
            medium_risk_threshold -= 0.1
        elif self.smoking_status == "ex_smoker":
            high_risk_threshold -= 0.05

        # Adjust for diabetes
        if self.diabetes_history == "type_1":
            high_risk_threshold -= 0.2
            medium_risk_threshold -= 0.15
        elif self.diabetes_history == "type_2":
            high_risk_threshold -= 0.1
            medium_risk_threshold -= 0.08

        # Adjust for age
        if self.age > 65:
            high_risk_threshold -= 0.1
        elif self.age > 55:
            high_risk_threshold -= 0.05

        # Adjust for activity level (athletes get stricter thresholds for safety)
        if self.activity_level == "athlete":
            high_risk_threshold -= 0.05
        elif self.activity_level == "sedentary":
            high_risk_threshold -= 0.15

        # Adjust for alcohol consumption
        if self.alcohol_consumption == "heavy":
            high_risk_threshold -= 0.1

        # Ensure thresholds stay in valid range and maintain proper ordering
        high_risk_threshold = max(0.3, min(0.85, high_risk_threshold))
        medium_risk_threshold = max(0.1, min(0.6, medium_risk_threshold))
        high_risk_threshold = max(high_risk_threshold, medium_risk_threshold + 0.1)

        return {
            "high": high_risk_threshold,
            "medium": medium_risk_threshold
        }

    def predict_risk(self):
        """Predict risk using ML model and return probability with risk level"""
        global heart_model, scaler

        if heart_model is None or scaler is None:
            return {
                "risk_level": "In Progress",
                "probability": 0.0,
                "confidence": "Low"
            }

        try:
            # Prepare features for ML model (13 features for UCI Heart Disease dataset)
            # Order: age, sex, cp, trestbps, chol, fbs, restecg, thalach, exang, oldpeak, slope, ca, thal
            features = [
                self.age,                    # age
                1 if hasattr(self, 'sex') and self.sex == "1" else 0,  # sex (1=male, 0=female)
                int(getattr(self, 'cp', 0)),  # cp (chest pain type)
                int(self.sbp),              # trestbps (resting blood pressure)
                200,                        # chol (cholesterol)
                int(getattr(self, 'fbs', 0)),  # fbs (fasting blood sugar)
                int(getattr(self, 'restecg', 0)),  # restecg (resting ECG)
                self.hr,                    # thalach (max heart rate)
                self.exang,                 # exang (exercise induced angina)
                self.oldpeak,               # oldpeak (ST depression)
                1,                          # slope (ST slope)
                0,                          # ca (major vessels)
                2                           # thal (thalassemia)
            ]

            # Scale features
            scaled_features = scaler.transform([features])

            # Get prediction probability (probability of disease)
            probability = heart_model.predict_proba(scaled_features)[0][1]

            # Get adaptive thresholds
            thresholds = self.calculate_adaptive_thresholds()

            # Determine risk level based on adaptive thresholds
            if probability >= thresholds["high"]:
                risk_level = "High Risk"
                confidence = "High" if probability > 0.85 else "Medium"
            elif probability >= thresholds["medium"]:
                risk_level = "Medium Risk"
                confidence = "Medium"
            else:
                risk_level = "Low Risk"
                confidence = "High" if probability < 0.3 else "Medium"

            # Store in history
            self.prediction_history.append({
                "time": round(self.phase_elapsed_s),
                "probability": round(probability * 100, 1),
                "risk_level": risk_level,
                "phase": self.phase
            })

            self.previous_risk_level = risk_level

            return {
                "risk_level": risk_level,
                "probability": round(probability * 100, 1),
                "confidence": confidence
            }

        except Exception as e:
            logger.error(f"Error in risk prediction: {e}")
            return {
                "risk_level": "In Progress",
                "probability": 0.0,
                "confidence": "Low"
            }

    def get_trend(self):
        """Analyze trend in risk predictions"""
        if len(self.prediction_history) < 2:
            return "Stable"

        recent_prob = self.prediction_history[-1]["probability"]
        previous_prob = self.prediction_history[max(0, len(self.prediction_history) - 6)]["probability"]

        diff = recent_prob - previous_prob
        if diff > 5:
            return "Worsening"
        elif diff < -5:
            return "Improving"
        else:
            return "Stable"

    def update(self, dt):
        if self.protocol_finished:
            return

        self.phase_elapsed_s += dt

        if self.phase == "rest":
            if self.phase_elapsed_s >= self.config["rest_duration_s"]:
                self.phase = "exercise"
                self.phase_elapsed_s = 0.0
                self.stage = 0
        elif self.phase == "exercise":
            current_config = self._get_current_stage_config()
            if current_config is None:
                self.phase = "recovery"
                self.phase_elapsed_s = 0.0
                return

            max_hr = 220 - self.age
            target_hr = max_hr * current_config["target_hr"] * self.hr_modifier

            if self.hr < target_hr:
                hr_change = min(
                    self.hr_increase_rate_per_min * (dt / 60.0) * self.hr_modifier,
                    target_hr - self.hr
                )
                self.hr += hr_change

            sbp_increase = current_config["workload"] * self.sbp_increase_per_level * self.sbp_modifier * dt / 180.0
            self.sbp = min(self.sbp + sbp_increase, 240.0)

            self.stage_time += dt
            current_config = self._get_current_stage_config()
            if current_config and self.stage_time >= current_config["duration"]:
                self._advance_stage()

        elif self.phase == "recovery":
            recovery_rate = self.recovery_rate_per_min * self.recovery_modifier * (dt / 60.0)
            self.hr = max(self.baseline_hr, self.hr - recovery_rate)
            self.sbp = max(self.baseline_sbp, self.sbp - (recovery_rate * 0.4))

            if self.phase_elapsed_s >= self.config["recovery_duration_s"]:
                self.protocol_finished = True

    def _get_current_stage_config(self):
        stages = self.protocol_configs[self.protocol]["stages"]
        if self.stage < len(stages):
            return stages[self.stage]
        return None

    def _advance_stage(self):
        stages = self.protocol_configs[self.protocol]["stages"]
        if self.stage < len(stages) - 1:
            self.stage += 1
            self.stage_time = 0
            current_config = self._get_current_stage_config()
            if current_config:
                self.workload_level = current_config["workload"]
        else:
            self.phase = "recovery"
            self.phase_elapsed_s = 0.0

    def to_latest_data(self):
        # Get ML-based risk prediction
        prediction = self.predict_risk()

        return {
            "trestbps": round(self.sbp, 1),
            "dbp": round(self.dbp, 1),
            "chol": 200,
            "thalach": round(self.hr, 1),
            "exang": self.exang,
            "oldpeak": round(self.oldpeak, 2),
            "phase": self.phase,
            "workload_level": round(self.workload_level, 2),
            "prediction": prediction,
            "trend": self.get_trend(),
            "prediction_history": self.prediction_history,
            "protocol": self.protocol,
            "stage": self.stage + 1,
            "stage_time": round(self.phase_elapsed_s),
            "future_predictions": []
        }

# ==================== GLOBAL STATE ====================

class SimulationState:
    def __init__(self):
        self.running = False
        self.engine = None
        self.latest_data = None
        self.simulation_thread = None
        self.user_data = {}

state = SimulationState()
alert_thresholds = {
    "heart_rate_high": 170,
    "heart_rate_low": 50,
    "blood_pressure_high": 140,
    "blood_pressure_low": 90,
    "st_depression_high": 2.0
}

# ==================== BACKGROUND SIMULATION ====================

def background_simulation():
    """Continuous simulation loop"""
    last_update = time.time()

    while True:
        if not state.running:
            time.sleep(0.5)
            last_update = time.time()
            continue

        if state.engine and state.engine.paused:
            time.sleep(0.2)
            last_update = time.time()
            continue

        if state.engine:
            current_time = time.time()
            dt = current_time - last_update
            last_update = current_time

            state.engine.update(dt)
            state.latest_data = state.engine.to_latest_data()

        time.sleep(0.016)

# ==================== APP SETUP ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting KardiaTwin FastAPI Server...")
    init_db()
    logger.info("✓ Database initialized")

    # Start background thread
    state.simulation_thread = threading.Thread(target=background_simulation, daemon=True)
    state.simulation_thread.start()
    logger.info("✓ Simulation thread started")

    yield
    logger.info("🛑 Shutting down...")

app = FastAPI(
    title="KardiaTwin API",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== ENDPOINTS ====================

@app.get("/")
async def root():
    return {"message": "KardiaTwin API", "version": "2.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "running": state.running}

@app.post("/start")
async def start_simulation(req: StartSimulationRequest):
    try:
        cfg = {}
        if req.simulation:
            cfg = req.simulation.dict(exclude_none=True)

        state.engine = PhysiologySimulationEngine(config=cfg)
        state.engine.age = req.age
        state.engine.sex = req.sex
        state.engine.cp = req.cp
        state.engine.fbs = req.fbs
        state.engine.restecg = req.restecg
        state.engine.smoking_status = req.smoking_status.value
        state.engine.diabetes_history = req.diabetes_history.value
        state.engine.alcohol_consumption = req.alcohol_consumption.value
        state.engine.activity_level = req.activity_level.value

        state.engine.apply_age_modifiers()
        state.engine.apply_lifestyle_modifiers()

        state.running = True
        state.user_data = req.dict()
        state.latest_data = state.engine.to_latest_data()

        protocol = state.engine.protocol
        stages = state.engine.protocol_configs[protocol]["stages"]
        total_duration = sum(s["duration"] for s in stages)

        logger.info(f"✓ Simulation started: Age {req.age}, {req.smoking_status.value}")

        return {
            "message": "Simulation started",
            "protocol": protocol,
            "exercise_stages": [
                {"stage_num": i+1, "duration": s["duration"], "workload": s["workload"]}
                for i, s in enumerate(stages)
            ],
            "total_exercise_duration": total_duration
        }
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/prediction")
async def get_prediction():
    if not state.running or not state.latest_data:
        raise HTTPException(status_code=400, detail="No active simulation")
    return state.latest_data

@app.post("/stop_simulation")
async def stop():
    state.running = False
    return {"message": "Stopped"}

@app.post("/pause_simulation")
async def pause():
    if not state.engine:
        raise HTTPException(status_code=400, detail="No simulation")
    state.engine.pause()
    return {"message": "Paused"}

@app.post("/resume_simulation")
async def resume():
    if not state.engine:
        raise HTTPException(status_code=400, detail="No simulation")
    state.engine.resume()
    return {"message": "Resumed"}

@app.get("/status")
async def status():
    return {
        "running": state.running,
        "paused": state.engine.paused if state.engine else False,
        "phase": state.engine.phase if state.engine else None
    }

@app.get("/pause_status")
async def pause_status():
    return {
        "paused": state.engine.paused if state.engine else False
    }

@app.get("/prediction_history")
async def prediction_history():
    if not state.engine:
        raise HTTPException(status_code=400, detail="No active simulation")
    return {
        "history": state.engine.prediction_history,
        "trend": state.engine.get_trend()
    }

@app.get("/protocols")
async def get_protocols():
    return {
        "standard": "Standard Bruce - 3 stages, 3 min each",
        "modified_bruce": "Modified Bruce - 4 stages, 5 min each"
    }

@app.get("/alerts")
async def get_alerts():
    return {"alerts": []}

@app.get("/thresholds")
async def get_thresholds():
    return alert_thresholds

@app.post("/thresholds")
async def update_thresholds(updates: ThresholdUpdate):
    global alert_thresholds
    data = updates.dict(exclude_none=True)
    alert_thresholds.update(data)
    return {"thresholds": alert_thresholds}

@app.post("/what_if_analysis")
async def what_if(req: WhatIfInput):
    if not state.engine:
        raise HTTPException(status_code=400, detail="No simulation")

    hyp = PhysiologySimulationEngine(config=state.engine.config)
    hyp.age = state.engine.age
    hyp.apply_age_modifiers()

    hyp.smoking_status = req.smoking_status.value if req.smoking_status else state.engine.smoking_status
    hyp.diabetes_history = req.diabetes_history.value if req.diabetes_history else state.engine.diabetes_history
    hyp.alcohol_consumption = req.alcohol_consumption.value if req.alcohol_consumption else state.engine.alcohol_consumption
    hyp.activity_level = req.activity_level.value if req.activity_level else state.engine.activity_level
    hyp.apply_lifestyle_modifiers()

    return {
        "current_sbp": round(state.engine.sbp_modifier, 2),
        "hypothetical_sbp": round(hyp.sbp_modifier, 2),
        "improvement": round(((state.engine.sbp_modifier - hyp.sbp_modifier) / state.engine.sbp_modifier * 100), 1)
    }

@app.get("/biological_age")
async def biological_age():
    if not state.engine:
        raise HTTPException(status_code=400, detail="No simulation")

    age = state.engine.age
    adjustment = 0

    if state.engine.smoking_status == "smoker":
        adjustment += 5
    elif state.engine.smoking_status == "ex_smoker":
        adjustment += 2

    if state.engine.diabetes_history == "type_1":
        adjustment += 3
    elif state.engine.diabetes_history == "type_2":
        adjustment += 2

    if state.engine.activity_level == "athlete":
        adjustment -= 3
    elif state.engine.activity_level == "sedentary":
        adjustment += 4

    if state.engine.sbp > 140:
        adjustment += 2

    heart_age = age + adjustment

    return {
        "heart_age": round(heart_age, 1),
        "actual_age": age,
        "age_difference": round(adjustment, 1),
        "status": "excellent" if adjustment < -2 else "poor" if adjustment > 5 else "good"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
