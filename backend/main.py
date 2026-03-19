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

from fastapi import FastAPI, HTTPException, status, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import logging

from models import (
    Base, User, UserProfile, SimulationSession, StressTestDataPoint, 
    SimulationAlert, init_db, get_db_session, close_db_session, ChatMessage
)
from auth import get_password_hash, verify_password, create_access_token, create_refresh_token, verify_token
from schemas import (
    UserRegister, UserLogin, UserResponse, Token, SimulationSummary, 
    SimulationList, UserProfileResponse, UserProfileUpdate,
    ChatRequest, ChatResponse, ChatMessageSchema
)
from ai_handler import kardia_ai
from dependencies import get_current_user, get_current_user_optional
from sqlalchemy.orm import Session
from datetime import datetime

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# File Handler
file_handler = logging.FileHandler("backend_logs.txt", mode="a")
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(file_handler)

# Stream Handler (ensure it shows in uvicorn too)
stream_handler = logging.StreamHandler()
stream_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(stream_handler)

# Load ML Model
try:
    with open('heart_model.pkl', 'rb') as file:
        heart_model, scaler = pickle.load(file)
    logger.info("[SUCCESS] ML model loaded")
except Exception as e:
    logger.error(f"[ERROR] Failed to load ML model: {e}")
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

class PADHistory(str, Enum):
    NO_PAD = "no_pad"
    PAD = "pad"

# ==================== PYDANTIC MODELS ====================

class SimulationConfig(BaseModel):
    rest_duration_s: Optional[int] = None
    exercise_duration_s: Optional[int] = None
    recovery_duration_s: Optional[int] = None
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
        if v and (v < 60 or v > 1800):
            raise ValueError('exercise_duration_s: 60-1800 seconds')
        return v

class StartSimulationRequest(BaseModel):
    age: int = Field(..., ge=18, le=105)
    sex: str = Field(..., pattern="^[01]$")
    cp: str = Field("0", pattern="^[0-3]$")
    fbs: Optional[str] = "0"
    restecg: Optional[str] = "0"
    slope: Optional[str] = "1"
    ca: Optional[str] = "0"
    thal: Optional[str] = "2"
    smoking_status: SmokingStatus = SmokingStatus.NON_SMOKER
    diabetes_history: DiabetesHistory = DiabetesHistory.NONE
    alcohol_consumption: AlcoholConsumption = AlcoholConsumption.NONE
    activity_level: ActivityLevel = ActivityLevel.ACTIVE
    pad_history: PADHistory = PADHistory.NO_PAD
    height: Optional[float] = None
    weight: Optional[float] = None
    simulation: Optional[SimulationConfig] = None
    session_name: Optional[str] = None

class WhatIfInput(BaseModel):
    smoking_status: Optional[SmokingStatus] = None
    diabetes_history: Optional[DiabetesHistory] = None
    alcohol_consumption: Optional[AlcoholConsumption] = None
    activity_level: Optional[ActivityLevel] = None
    pad_history: Optional[PADHistory] = None
    height: Optional[float] = None
    weight: Optional[float] = None

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
        # Clinical Baselines (Phase 1) - INITIAL DEFAULTS
        self.sex = "1"  # "1"=Male, "0"=Female
        self.age = 50
        self.height = 175.0 
        self.weight = 75.0  
        self.bmi = 24.5
        self.smoking_status = "non_smoker"
        self.diabetes_history = "none"
        self.alcohol_consumption = "none"
        self.activity_level = "active"
        self.pad_history = "no_pad"
        self.protocol = "standard"

        # Reference Constants (Healthy Adult <50)
        self.male_ref = {"hr": 71.0, "sbp": 115.0, "recovery": 19.0, "peak_sbp": 220.0}
        self.female_ref = {"hr": 78.0, "sbp": 110.0, "recovery": 17.0, "peak_sbp": 200.0}
        
        # Simulation State
        self.baseline_hr = 72.0
        self.baseline_sbp = 120.0
        self.baseline_dbp = 75.0
        self.baseline_oldpeak = 1.0
        
        self.hr = self.baseline_hr
        self.sbp = self.baseline_sbp
        self.dbp = self.baseline_dbp
        self.oldpeak = self.baseline_oldpeak
        self.exang = 0
        self.phase = "rest"
        self.workload_level = 0
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

        # Config & property mapping from incoming config
        self.config = {
            "rest_duration_s": None,
            "exercise_duration_s": None,
            "recovery_duration_s": None,
            "max_workload_level": 3,
            "protocol": "standard"
        }
        
        if config:
            self.config.update(config)
            self.sex = str(config.get("sex", self.sex))
            self.age = int(config.get("age", self.age))
            self.height = float(config.get("height", self.height))
            self.weight = float(config.get("weight", self.weight))
            self.smoking_status = config.get("smoking_status", self.smoking_status)
            self.diabetes_history = config.get("diabetes_history", self.diabetes_history)
            self.alcohol_consumption = config.get("alcohol_consumption", self.alcohol_consumption)
            self.activity_level = config.get("activity_level", self.activity_level)
            self.pad_history = config.get("pad_history", self.pad_history)
            self.protocol = config.get("protocol", self.protocol)

        # Timers & Modifiers
        self.phase_elapsed_s = 0.0
        self.total_duration_s = 0.0
        self.hr_increase_rate_per_min = 11.0
        self.sbp_increase_per_level = 12.0
        self.recovery_rate_per_min = 15.0
        self.age_modifier = 1.0

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

        # Phase 2: Analytics Tracking
        self.peak_hr = 0.0
        self.peak_sbp = 0.0
        self.rest_duration_actual = 0.0
        self.exercise_duration_actual = 0.0
        self.recovery_duration_actual = 0.0

    def pause(self):
        if not self.paused:
            self.paused = True
            self.pause_start_time = time.time()

    def resume(self):
        if self.paused:
            self.pause_elapsed += time.time() - self.pause_start_time
            self.paused = False
            self.pause_start_time = None

    def apply_modifiers(self):
        """Finalized Unified Clinical Matrix Implementation (V1.4)"""
        # 1. Select Sex Baseline
        ref = self.male_ref if self.sex == "1" else self.female_ref
        
        # Initialize Offsets and Multipliers
        self.hr_offset = 0.0
        self.sbp_offset = 0.0
        self.exercise_hr_mult = 1.0
        self.exercise_sbp_mult = 1.0
        # Default female recovery lag (0.85x)
        self.recovery_efficiency = 1.0 if self.sex == "1" else 0.85
        
        # ── 2. AGE DYNAMICS (The Aging Curve) ──────────────────
        if 18 <= self.age <= 40:
            pass # Baseline cohort - Reference state
        elif 41 <= self.age <= 64:
            years_over_40 = self.age - 40
            # Linear Decay: +0.6 mmHg SBP per year / -1% HRR per year
            self.sbp_offset += years_over_40 * 0.6
            self.recovery_efficiency *= (1.0 - (years_over_40 * 0.01))
        elif self.age >= 65:
            years_over_40 = self.age - 40
            # Senior Pivot: Cumulative linear decay + Mandatory Stiffness
            self.sbp_offset += years_over_40 * 0.6
            self.recovery_efficiency *= (1.0 - (years_over_40 * 0.01))
            
            # Mandatory Stiffness Multiplier (Compound)
            stiffness_mult = 1.25 if self.sex == "0" else 1.10
            self.exercise_sbp_mult *= stiffness_mult
        
        if self.height > 0:
            self.bmi = self.weight / ((self.height / 100) ** 2)
            
        # ── 3. BMI INFLUENCE (The "Tissue Tax") ────────────────
        if self.bmi < 18.5: # Underweight
            self.hr_offset += 2.0
            self.sbp_offset -= 5.0
        elif self.bmi > 25:
            # SBP Offset: +1.6 mmHg per BMI point > 25 (Linear Scaling)
            bmi_excess = self.bmi - 25
            self.sbp_offset += bmi_excess * 1.6
            
            if self.bmi >= 35: # Morbidly Obese
                self.hr_offset += 12.0
                self.exercise_sbp_mult *= 1.40
                self.recovery_efficiency *= 0.60
            elif self.bmi >= 30: # Obese
                self.hr_offset += 8.0 # Standard offset for all genders
                self.exercise_sbp_mult *= 1.25
                self.recovery_efficiency *= 0.80
            else: # Overweight (25-29.9)
                self.exercise_sbp_mult *= 1.10
                self.recovery_efficiency *= 0.90

        # ── 4. LIFESTYLE FACTORS ──────────────────────────────
        # Activity Level
        if self.activity_level == "athlete":
            self.hr_offset -= 15.0 if self.sex == "1" else 12.0
            self.sbp_offset -= 5.0
            self.exercise_hr_mult *= 0.80 if self.sex == "1" else 0.85
            self.recovery_efficiency *= 2.0 if self.sex == "1" else 1.7
        elif self.activity_level == "sedentary":
            self.hr_offset += 10.0 if self.sex == "1" else 12.0
            self.sbp_offset += 5.0 if self.sex == "1" else 8.0
            self.exercise_hr_mult *= 1.20 if self.sex == "1" else 1.25
            self.exercise_sbp_mult *= 1.15 if self.sex == "1" else 1.25
            self.recovery_efficiency *= 0.85 if self.sex == "1" else 0.80

        # Smoking Status
        if self.smoking_status == "smoker":
            self.hr_offset += 11.0 if self.sex == "0" else 8.0
            self.sbp_offset += 10.0
            self.exercise_hr_mult *= 0.82 if self.sex == "0" else 0.90
            self.recovery_efficiency *= 0.70 if self.sex == "0" else 0.80
        elif self.smoking_status == "ex_smoker":
            self.hr_offset += 4.0 if self.sex == "0" else 2.0
            self.sbp_offset += 2.0
            self.exercise_hr_mult *= 0.92 if self.sex == "0" else 0.97
            self.recovery_efficiency *= 0.90 if self.sex == "0" else 0.95

        # Alcohol Consumption
        if self.alcohol_consumption == "heavy":
            self.hr_offset += 12.0 if self.sex == "0" else 8.0
            self.sbp_offset += 8.0
            self.exercise_hr_mult *= 1.25 if self.sex == "0" else 1.15
            self.exercise_sbp_mult *= 1.25 if self.sex == "0" else 1.15
            self.recovery_efficiency *= 0.75 if self.sex == "0" else 0.80
        elif self.alcohol_consumption == "moderate":
            self.hr_offset += 4.0 if self.sex == "0" else 2.0
            self.sbp_offset += 2.0
            self.exercise_hr_mult *= 1.05
            self.exercise_sbp_mult *= 1.05
            self.recovery_efficiency *= 0.95 if self.sex == "0" else 0.98

        # ── 5. CLINICAL PATHOLOGIES ───────────────────────────
        # Diabetes
        if "type" in str(self.diabetes_history):
            if self.diabetes_history == "type_1":
                self.hr_offset += 10.0 if self.sex == "0" else 8.0
                self.sbp_offset += 15.0 if self.sex == "0" else 12.0
                self.exercise_sbp_mult *= 1.45 if self.sex == "0" else 1.25
                self.recovery_efficiency *= 0.65 if self.sex == "0" else 0.70
            elif self.diabetes_history == "type_2":
                self.hr_offset += 9.0 if self.sex == "0" else 6.0
                self.sbp_offset += 12.0 if self.sex == "0" else 10.0
                self.exercise_sbp_mult *= 1.35 if self.sex == "0" else 1.15
                self.recovery_efficiency *= 0.75 if self.sex == "0" else 0.80

        # PAD (Peripheral Artery Disease)
        if self.pad_history == "pad":
            self.hr_offset += 5.0
            self.sbp_offset += 15.0
            self.exercise_hr_mult *= 1.35 if self.sex == "0" else 1.20
            self.exercise_sbp_mult *= 1.50
            if self.sex == "0":
                self.recovery_efficiency *= 0.40
            else:
                self.recovery_efficiency *= 0.42 if self.age >= 65 else 0.50

        # ── 6. INTERACTION EFFECTS (Safety Overrides) ─────────
        # Alcohol destroys athletic conditioning benefit
        if self.alcohol_consumption == "heavy" and self.activity_level == "athlete":
            self.hr_offset += 10.0
            self.recovery_efficiency *= 0.75

        # Finalize Vital States
        self.baseline_hr = ref["hr"] + self.hr_offset
        self.baseline_sbp = ref["sbp"] + self.sbp_offset
        
        if self.sex == "0":  # Female (Gulati formula)
            self.max_hr = 206 - (0.88 * self.age)
        else:                # Male (Fox formula)
            self.max_hr = 220 - self.age
            
        self.peak_sbp_cap = ref["peak_sbp"] + (self.sbp_offset if self.sbp_offset > 0 else 0)
        
        self.hr_increase_rate_per_min = 11.0 * self.exercise_hr_mult
        self.sbp_increase_per_level = 12.0 * self.exercise_sbp_mult
        self.recovery_rate_per_min = ref["recovery"] * self.recovery_efficiency
        
        # Sync compatibility fields
        self.hr_modifier = self.exercise_hr_mult
        self.sbp_modifier = self.exercise_sbp_mult
        self.recovery_modifier = self.recovery_efficiency
        
        self.hr = self.baseline_hr
        self.sbp = self.baseline_sbp
        self.peak_hr = self.baseline_hr
        self.peak_sbp = self.baseline_sbp
        
        logger.info(f"[LOG] Digital Twin Calibrated: RR={self.recovery_rate_per_min:.1f} BPM/min, Rest={self.baseline_hr:.1f}/{self.baseline_sbp:.1f}")

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
            probability = float(heart_model.predict_proba(scaled_features)[0][1])

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
        self.total_duration_s += dt

        # Track peaks globally across all phases (Phase 2 fix)
        if self.hr > self.peak_hr: self.peak_hr = self.hr
        if self.sbp > self.peak_sbp: self.peak_sbp = self.sbp

        if self.phase == "rest":
            self.rest_duration_actual += dt
            rest_target = self.config.get("rest_duration_s") or 60  # Default to 60s rest if not set
            if self.phase_elapsed_s >= rest_target:
                self.phase = "exercise"
                self.phase_elapsed_s = 0.0
                self.stage = 0
                self.stage_time = 0.0
        elif self.phase == "exercise":
            self.exercise_duration_actual += dt
            
            # Determine if exercise should end
            current_config = self._get_current_stage_config()
            target_duration = self.config.get("exercise_duration_s")
            
            # If target_duration provided (via What-If or Config Override), use it as a hard cap.
            # Otherwise, ONLY end when current_config is None (all stages finished).
            if (target_duration and self.phase_elapsed_s >= target_duration) or (not target_duration and current_config is None):
                self.phase = "recovery"
                self.phase_elapsed_s = 0.0
                return

            target_hr = self.max_hr * current_config["target_hr"]

            if self.hr < target_hr:
                hr_change = min(
                    self.hr_increase_rate_per_min * (dt / 60.0),
                    target_hr - self.hr
                )
                self.hr += hr_change

            sbp_increase = current_config["workload"] * self.sbp_increase_per_level * dt / 180.0
            self.sbp = min(self.sbp + sbp_increase, self.peak_sbp_cap)

            self.stage_time += dt
            current_config = self._get_current_stage_config()
            if current_config and self.stage_time >= current_config["duration"]:
                self._advance_stage()

        elif self.phase == "recovery":
            self.recovery_duration_actual += dt
            recovery_rate = self.recovery_rate_per_min * (dt / 60.0)
            
            # Clinical Rule: SBP normalizes at ~0.8x of HRR speed
            # Enforce a minimum SBP floor decay of 8 mmHg/min (8 * dt / 60)
            sbp_recovery = max(recovery_rate * 0.8, 8.0 * (dt / 60.0))
            
            self.hr = max(self.baseline_hr, self.hr - recovery_rate)
            self.sbp = max(self.baseline_sbp, self.sbp - sbp_recovery)

            # Dynamic Recovery Logic: 
            # End when vitals return to personal baseline (+/- 2 BPM / 5 mmHg)
            # OR if we hit the standard 2-minute recovery cap (matching UI)
            hr_recovered = self.hr <= (self.baseline_hr + 2.0)
            sbp_recovered = self.sbp <= (self.baseline_sbp + 5.0)
            
            if (hr_recovered and sbp_recovered) or self.phase_elapsed_s >= 120:
                self.protocol_finished = True
                self.phase = "idle"

    def _get_current_stage_config(self):
        # Validate protocol exists
        if self.protocol not in self.protocol_configs:
            logger.warning(f"Invalid protocol: {self.protocol}, defaulting to 'standard'")
            self.protocol = "standard"

        stages = self.protocol_configs[self.protocol]["stages"]
        if self.stage < len(stages):
            return stages[self.stage]
        return None

    def _advance_stage(self):
        # Validate protocol exists
        if self.protocol not in self.protocol_configs:
            logger.warning(f"Invalid protocol: {self.protocol}, defaulting to 'standard'")
            self.protocol = "standard"

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
            "stage_time": round(self.stage_time) if self.phase == "exercise" else round(self.phase_elapsed_s),
            "total_time": round(self.total_duration_s),
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
        self.session_id = None  # Database session ID for authenticated users
        self.start_time = None  # Simulation start time for calculating duration
        self.last_alert_time = {} # Track last alert per type for debouncing

state = SimulationState()
alert_thresholds = {
    "heart_rate_high": 170,
    "heart_rate_low": 50,
    "blood_pressure_high": 140,
    "blood_pressure_low": 90,
    "st_depression_high": 2.0
}

# ----------------- ALERT WATCHDOG -----------------

def check_simulation_alerts():
    """Real-time vital monitoring and alert persistence"""
    if not state.running or not state.engine or not state.session_id:
        return

    engine = state.engine
    # Max HR Ceiling Calculation
    max_hr = 220 - engine.age
    
    potential_alerts = []
    
    # 1. Critical HR Spike (Exceeding 220-age ceiling)
    if engine.hr > max_hr:
        potential_alerts.append({
            "type": "max_hr_exceeded",
            "message": f"CRITICAL: HR ({engine.hr:.1f}) exceeded the safety ceiling of {max_hr}.",
            "severity": "critical",
            "value": engine.hr,
            "threshold": float(max_hr)
        })
    # 2. High HR (Based on custom threshold)
    elif engine.hr > alert_thresholds["heart_rate_high"]:
        potential_alerts.append({
            "type": "heart_rate_high",
            "message": f"Warning: High HR detected ({engine.hr:.1f} bpm).",
            "severity": "high",
            "value": engine.hr,
            "threshold": alert_thresholds["heart_rate_high"]
        })
        
    # 3. High SBP
    if engine.sbp > alert_thresholds["blood_pressure_high"]:
        potential_alerts.append({
            "type": "blood_pressure_high",
            "message": f"Hypertensive Response: SBP reached {engine.sbp:.1f} mmHg.",
            "severity": "high",
            "value": engine.sbp,
            "threshold": alert_thresholds["blood_pressure_high"]
        })
        
    # 4. ECG Abnormality (ST-Depression)
    if engine.oldpeak > alert_thresholds["st_depression_high"]:
        potential_alerts.append({
            "type": "st_depression_high",
            "message": f"Ischemic Sign: ST Depression reached {engine.oldpeak:.2f} mm.",
            "severity": "critical",
            "value": engine.oldpeak,
            "threshold": alert_thresholds["st_depression_high"]
        })

    # Save to DB with Debouncing (Cooldown: 30 seconds per alert type)
    COOLDOWN = 30 
    current_time = time.time()
    
    for alert in potential_alerts:
        alert_type = alert["type"]
        last_triggered = state.last_alert_time.get(alert_type, 0)
        
        if current_time - last_triggered > COOLDOWN:
            try:
                db = get_db_session()
                new_alert = SimulationAlert(
                    session_id=state.session_id,
                    alert_type=alert_type,
                    message=alert["message"],
                    severity=alert["severity"],
                    value=alert["value"],
                    threshold=alert["threshold"],
                    phase=engine.phase
                )
                db.add(new_alert)
                db.commit()
                db.close()
                
                state.last_alert_time[alert_type] = current_time
                logger.info(f"🚨 ALERT PERSISTED: {alert_type} in {engine.phase} phase")
            except Exception as e:
                logger.error(f"Error persisting alert: {e}")

# ==================== BACKGROUND SIMULATION ====================

def background_simulation():
    """Continuous simulation loop"""
    last_update = time.time()
    last_db_save = time.time()

    while True:
        try:
            if not state.running:
                time.sleep(0.5)
                last_update = time.time()
                continue

            if state.engine and state.engine.paused:
                time.sleep(0.2)
                last_update = time.time()
                continue

            if state.engine:
                try:
                    current_time = time.time()
                    dt = current_time - last_update
                    last_update = current_time

                    state.engine.update(dt)

                    if state.engine.protocol_finished and state.running:
                        logger.info("✨ Simulation protocol finished naturally. Triggering auto-stop.")
                        # We can't call stop() directly from thread easily if it's an async route, 
                        # but we can set state.running = False and run the stop logic
                        state.running = False
                        # Trigger the same logic as /stop_simulation but within this thread
                        trigger_stop_logic()
                        continue

                    try:
                        state.latest_data = state.engine.to_latest_data()
                        # Run the Alert Watchdog
                        check_simulation_alerts()

                        # Periodically save data points and duration to database (every 2 seconds)
                        if state.session_id and (current_time - last_db_save) > 2.0:
                            try:
                                db_save = get_db_session()
                                
                                # 1. Update session duration
                                session_record = db_save.query(SimulationSession).filter(
                                    SimulationSession.id == state.session_id
                                ).first()
                                if session_record:
                                    # Periodic Live Capture: Save progress every 2 seconds
                                    session_record.duration = int(state.engine.total_duration_s)
                                    session_record.peak_hr = float(state.engine.peak_hr)
                                    session_record.peak_sbp = float(state.engine.peak_sbp)
                                    session_record.rest_duration = int(state.engine.rest_duration_actual)
                                    session_record.exercise_duration = int(state.engine.exercise_duration_actual)
                                    session_record.recovery_duration = int(state.engine.recovery_duration_actual)
                                
                                # Save telemetry data point every 2 seconds
                                dp = StressTestDataPoint(
                                    session_id=state.session_id,
                                    timestamp=round(float(state.engine.total_duration_s)),
                                    heart_rate=float(state.engine.hr),
                                    blood_pressure_systolic=float(state.engine.sbp),
                                    blood_pressure_diastolic=float(state.engine.dbp),
                                    st_depression=float(state.engine.oldpeak),
                                    protocol=state.engine.protocol,
                                    stage=int(state.engine.stage + 1),
                                    stage_time=round(float(state.engine.stage_time)),
                                    workload_level=float(state.engine.workload_level),
                                    phase=state.engine.phase,
                                    exercise_induced_angina=bool(state.engine.exang),
                                    risk_prediction=state.engine.predict_risk().get("risk_level", "Unknown")
                                )
                                db_save.add(dp)
                                
                                db_save.commit()
                                last_db_save = current_time
                                close_db_session(db_save)
                            except Exception as db_err:
                                logger.error(f"Error periodically saving to database: {db_err}")
                    except Exception as e:
                        logger.error(f"[ERROR] Error converting engine state or checking alerts during {state.engine.phase} phase: {e}", exc_info=True)
                        raise

                except Exception as e:
                    logger.error(f"[ERROR] Engine update error during {getattr(state.engine, 'phase', 'unknown')} phase: {e}", exc_info=True)
                    logger.error(f"Engine state - HR: {getattr(state.engine, 'hr', 'N/A')}, SBP: {getattr(state.engine, 'sbp', 'N/A')}, Stage: {getattr(state.engine, 'stage', 'N/A')}")
                    state.running = False

            time.sleep(0.016)
        except Exception as e:
            logger.error(f"❌ Critical error in background simulation: {e}", exc_info=True)
            time.sleep(1)

# ==================== APP SETUP ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[STARTUP] Starting KardiaTwin FastAPI Server...")
    init_db()
    logger.info("[SUCCESS] Database initialized")

    # Start background thread
    state.simulation_thread = threading.Thread(target=background_simulation, daemon=True)
    state.simulation_thread.start()
    logger.info("[SUCCESS] Simulation thread started")

    yield
    logger.info("[SHUTDOWN] Shutting down...")

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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_details = exc.errors()
    logger.error(f"❌ [422 VALIDATION ERROR] {error_details}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": error_details},
    )

# ==================== ENDPOINTS ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "KardiaTwin backend is running"}

@app.get("/")
async def root():
    return {"message": "KardiaTwin API", "version": "2.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "running": state.running}


# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/api/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister):
    """Register a new user account"""
    db = get_db_session()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(
            (User.username == user_data.username) | (User.email == user_data.email)
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already registered"
            )

        # Create new user
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            username=user_data.username,
            profile_name=user_data.profile_name or user_data.username,
            email=user_data.email,
            password_hash=hashed_password
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Generate tokens
        access_token = create_access_token(data={"sub": str(new_user.id)})
        refresh_token = create_refresh_token(data={"sub": str(new_user.id)})

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": UserResponse.model_validate(new_user)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        close_db_session(db)


@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    """Login with username/email and password"""
    db = get_db_session()
    try:
        # Find user by username or email
        user = db.query(User).filter(
            (User.username == user_data.username) | (User.email == user_data.username)
        ).first()

        if not user:
            logger.warning(f"Login failure: User '{user_data.username}' not found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        if not verify_password(user_data.password, user.password_hash):
            logger.warning(f"Login failure: Incorrect password for user '{user_data.username}'")
            # For debugging purposes ONLY (shoud be removed in prod)
            logger.debug(f"Input password: '{user_data.password}'")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        logger.info(f"Successful login for user '{user.username}' (ID: {user.id})")
        user.last_login = datetime.utcnow()
        db.commit()

        # Generate tokens
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_refresh_token(data={"sub": str(user.id)})

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": UserResponse.model_validate(user)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        close_db_session(db)


class TokenRefreshRequest(BaseModel):
    refresh_token: str

@app.post("/api/auth/refresh", response_model=Token)
async def refresh_token_endpoint(req: TokenRefreshRequest):
    """Refresh access token using refresh token"""
    logger.info(f"Refresh token endpoint called with token: {req.refresh_token[:20]}...")
    payload = verify_token(req.refresh_token, token_type="refresh")

    if not payload:
        logger.error(f"Token verification failed for refresh token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user_id = payload.get("sub")
    db = get_db_session()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )

        access_token = create_access_token(data={"sub": str(user.id)})
        new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user": UserResponse.model_validate(user)
        }
    finally:
        close_db_session(db)


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse.model_validate(current_user)


# ==================== USER PROFILE ENDPOINTS ====================

@app.get("/api/profile", response_model=UserProfileResponse)
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user's profile data"""
    db = get_db_session()
    try:
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if not profile:
            # Return empty profile representation
            return UserProfileResponse(id=0, user_id=current_user.id, profile_name=current_user.profile_name)
        
        response_data = UserProfileResponse.model_validate(profile)
        response_data.profile_name = current_user.profile_name
        return response_data
    finally:
        close_db_session(db)

@app.post("/api/profile", response_model=UserProfileResponse)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    """Create or update user's profile data"""
    db = get_db_session()
    try:
        # Merge current_user into this session to avoid "not persistent" error
        current_user = db.merge(current_user)
        
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        
        if not profile:
            profile = UserProfile(user_id=current_user.id)
            db.add(profile)
            
        # Update fields
        update_data = profile_data.model_dump(exclude_unset=True)
        
        # Handle profile_name update on the User model
        if 'profile_name' in update_data:
            current_user.profile_name = update_data.pop('profile_name')
            
        for key, value in update_data.items():
            setattr(profile, key, value)
            
        profile.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(profile)
        db.refresh(current_user)
        
        response_data = UserProfileResponse.model_validate(profile)
        response_data.profile_name = current_user.profile_name
        return response_data
    except Exception as e:
        db.rollback()
        logger.error(f"Profile update error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        close_db_session(db)

# ==================== SIMULATION HISTORY ENDPOINTS ====================

@app.get("/api/simulations", response_model=SimulationList)
async def list_user_simulations(
    limit: int = 10,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Get list of user's simulation sessions"""
    db = get_db_session()
    try:
        # Query simulations for current user
        sessions = db.query(SimulationSession).filter(
            SimulationSession.user_id == current_user.id
        ).order_by(SimulationSession.created_at.desc()).offset(offset).limit(limit).all()

        total = db.query(SimulationSession).filter(
            SimulationSession.user_id == current_user.id
        ).count()

        result_sessions = []
        for s in sessions:
            summary = SimulationSummary.model_validate(s)
            
            # Map snapshot fields if available
            summary.patient_age = s.patient_age
            summary.patient_gender = s.patient_gender
            summary.smoking_status = s.smoking_status
            summary.diabetes_history = s.diabetes_history
            summary.alcohol_consumption = s.alcohol_consumption
            summary.activity_level = s.activity_level
            
            # Phase 2 Analytics mapping
            summary.peak_hr = s.peak_hr
            summary.peak_sbp = s.peak_sbp
            summary.rest_duration = s.rest_duration
            summary.exercise_duration = s.exercise_duration
            summary.recovery_duration = s.recovery_duration

            # Get latest heart age for this session
            from models import HeartAgeDataPoint
            ha_record = db.query(HeartAgeDataPoint).filter(HeartAgeDataPoint.session_id == s.id).first()
            if ha_record:
                summary.heart_age = ha_record.biological_age
            result_sessions.append(summary)

        return {
            "sessions": result_sessions,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    finally:
        close_db_session(db)


@app.get("/api/simulations/{session_id}", response_model=SimulationSummary)
async def get_simulation_summary(
    session_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get metadata summary for a single simulation session"""
    db = get_db_session()
    try:
        session = db.query(SimulationSession).filter(
            (SimulationSession.id == session_id) & (SimulationSession.user_id == current_user.id)
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Simulation not found or not authorized"
            )

        summary = SimulationSummary.model_validate(session)
        
        # Map snapshot/analytics fields
        summary.patient_age = session.patient_age
        summary.patient_gender = session.patient_gender
        summary.smoking_status = session.smoking_status
        summary.diabetes_history = session.diabetes_history
        summary.alcohol_consumption = session.alcohol_consumption
        summary.activity_level = session.activity_level
        summary.pad_history = session.pad_history
        
        summary.peak_hr = session.peak_hr
        summary.peak_sbp = session.peak_sbp
        summary.rest_duration = session.rest_duration
        summary.exercise_duration = session.exercise_duration
        summary.recovery_duration = session.recovery_duration

        # Get latest heart age
        from models import HeartAgeDataPoint
        ha_record = db.query(HeartAgeDataPoint).filter(HeartAgeDataPoint.session_id == session.id).first()
        if ha_record:
            summary.heart_age = ha_record.biological_age

        return summary
    finally:
        close_db_session(db)


@app.get("/api/simulations/{session_id}/data")
async def get_simulation_data(
    session_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get all high-resolution data points for a simulation session"""
    db = get_db_session()
    try:
        # Verify ownership
        session = db.query(SimulationSession).filter(
            (SimulationSession.id == session_id) & (SimulationSession.user_id == current_user.id)
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Simulation not found or not authorized"
            )

        data_points = db.query(StressTestDataPoint).filter(
            StressTestDataPoint.session_id == session_id
        ).order_by(StressTestDataPoint.timestamp.asc()).all()

        return {
            "session_id": session_id,
            "data_points": [dp.to_dict() for dp in data_points]
        }
    finally:
        close_db_session(db)


@app.delete("/api/simulations/{session_id}")
async def delete_simulation(
    session_id: int,
    current_user: User = Depends(get_current_user)
):
    """Delete a simulation session"""
    db = get_db_session()
    try:
        session = db.query(SimulationSession).filter(
            (SimulationSession.id == session_id) & (SimulationSession.user_id == current_user.id)
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Simulation not found or not authorized"
            )

        db.delete(session)
        db.commit()

        return {"message": "Simulation deleted successfully"}
    finally:
        close_db_session(db)


@app.delete("/api/simulations")
async def delete_all_simulations(
    current_user: User = Depends(get_current_user)
):
    """Delete all simulation sessions for the current user"""
    db = get_db_session()
    try:
        sessions = db.query(SimulationSession).filter(
            SimulationSession.user_id == current_user.id
        ).all()

        for session in sessions:
            db.delete(session)
        
        db.commit()

        return {"message": f"Successfully deleted {len(sessions)} simulations and all associated data"}
    finally:
        close_db_session(db)


@app.post("/api/test-simulation")
async def create_test_simulation(
    current_user: User = Depends(get_current_user)
):
    """Create a dummy simulation for testing purposes (requires authentication)"""
    db = get_db_session()
    try:
        logger.info(f"[LOG] Creating test simulation for user: {current_user.username} (ID: {current_user.id})")
        logger.info(f"[LOG] User object: {current_user.to_dict()}")

        # Create a test simulation session
        test_session = SimulationSession(
            name=f"Test Simulation {datetime.now().strftime('%H:%M:%S')}",
            user_id=current_user.id,
            simulation_type="stress_test",
            protocol="standard",
            duration=30,  # 30 seconds
            user_data={
                "age": 50,
                "sex": "1",
                "cp": "0",
                "smoking_status": "non_smoker",
                "diabetes_history": "none",
                "alcohol_consumption": "none",
                "activity_level": "active"
            },
            patient_age=50,
            patient_gender="M",
            risk_score=45.5,  # Medium risk
            sim_metadata={"test": True}
        )

        logger.info(f"💾 Adding test session to database...")
        db.add(test_session)
        logger.info(f"💾 Committing transaction...")
        db.commit()
        logger.info(f"💾 Refreshing session...")
        db.refresh(test_session)

        logger.info(f"✅ Created test simulation ID={test_session.id} for user {current_user.username}")

        return {
            "message": "Test simulation created successfully",
            "session_id": test_session.id,
            "protocol": "standard",
            "duration": 30,
            "risk_score": 45.5
        }
    except Exception as e:
        logger.error(f"❌ Error creating test simulation: {type(e).__name__}: {str(e)}", exc_info=True)
        try:
            db.rollback()
        except:
            pass
        raise HTTPException(status_code=400, detail=f"{type(e).__name__}: {str(e)}")
    finally:
        try:
            close_db_session(db)
        except:
            pass


@app.post("/api/test-simulation-simple")
async def create_test_simulation_simple():
    """Create a test simulation WITHOUT authentication (for debugging)"""
    db = get_db_session()
    try:
        logger.info(f"🧪 Creating simple test simulation (no auth required)")

        # Get first user or create a test user
        user = db.query(User).first()

        if not user:
            logger.warning("⚠️ No users found in database, cannot create test simulation")
            raise HTTPException(status_code=400, detail="No users in database. Please register first.")

        test_session = SimulationSession(
            name=f"Quick Test {datetime.now().strftime('%H:%M:%S')}",
            user_id=user.id,
            simulation_type="stress_test",
            protocol="standard",
            duration=30,
            user_data={"test": True},
            patient_age=50,
            patient_gender="M",
            risk_score=50.0,
            sim_metadata={"quick_test": True}
        )

        db.add(test_session)
        db.commit()
        db.refresh(test_session)

        logger.info(f"✅ Created simple test simulation {test_session.id} for user {user.username}")

        return {
            "success": True,
            "message": "Test simulation created",
            "session_id": test_session.id,
            "user": user.username
        }
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        close_db_session(db)


@app.post("/start")
async def start_simulation(
    req: StartSimulationRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    logger.info(f"[LOG] /start endpoint called")
    db = get_db_session()
    try:
        logger.info(f"[LOG] Request received: age={req.age}, sex={req.sex}")
        cfg = {}
        if req.simulation:
            cfg = req.simulation.dict(exclude_none=True)

        logger.info(f"[LOG] Creating PhysiologySimulationEngine...")
        state.engine = PhysiologySimulationEngine(config=cfg)
        logger.info(f"[SUCCESS] Engine created successfully")
        state.engine.age = req.age
        state.engine.sex = req.sex
        state.engine.cp = req.cp
        state.engine.fbs = req.fbs
        state.engine.restecg = req.restecg
        state.engine.smoking_status = req.smoking_status.value
        state.engine.diabetes_history = req.diabetes_history.value
        state.engine.alcohol_consumption = req.alcohol_consumption.value
        state.engine.activity_level = req.activity_level.value
        state.engine.pad_history = req.pad_history.value
        
        # Pull height/weight from profile if not provided in req
        try:
            if req.height:
                state.engine.height = req.height
            elif current_user and current_user.profile:
                state.engine.height = current_user.profile.height or 175.0
            else:
                state.engine.height = 175.0
                
            if req.weight:
                state.engine.weight = req.weight
            elif current_user and current_user.profile:
                state.engine.weight = current_user.profile.weight or 75.0
            else:
                state.engine.weight = 75.0
        except Exception as profile_err:
            logger.warning(f"Warning: Could not load user profile details ({profile_err}). Using defaults.")
            state.engine.height = 175.0
            state.engine.weight = 75.0

        state.engine.apply_modifiers()

        state.running = True
        state.start_time = time.time()  # Track when simulation started
        state.user_data = req.dict()
        state.latest_data = state.engine.to_latest_data()

        # Create SimulationSession record if user is authenticated
        if current_user:
            session_name = req.session_name or f"Simulation {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            db_session = SimulationSession(
                name=session_name,
                user_id=current_user.id,
                simulation_type="stress_test",
                protocol=state.engine.protocol,
                user_data=req.dict(),
                patient_age=req.age,
                patient_gender="M" if req.sex == "1" else "F",
                smoking_status=req.smoking_status.value,
                diabetes_history=req.diabetes_history.value,
                alcohol_consumption=req.alcohol_consumption.value,
                activity_level=req.activity_level.value,
                pad_history=req.pad_history.value
            )
            db.add(db_session)
            db.commit()
            db.refresh(db_session)
            state.session_id = db_session.id
            logger.info(f"[SUCCESS] Created simulation session {db_session.id} for user {current_user.username}")
        else:
            state.session_id = None

        protocol = state.engine.protocol
        stages = state.engine.protocol_configs[protocol]["stages"]
        total_duration = sum(s["duration"] for s in stages)

        logger.info(f"[SUCCESS] Simulation started: Age {req.age}, {req.smoking_status.value}")

        return {
            "message": "Simulation started",
            "protocol": protocol,
            "session_id": state.session_id,
            "exercise_stages": [
                {"stage_num": i+1, "duration": s["duration"], "workload": s["workload"]}
                for i, s in enumerate(stages)
            ],
            "total_exercise_duration": total_duration
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        close_db_session(db)

@app.get("/prediction")
async def get_prediction():
    try:
        if not state.latest_data:
            return {
                "thalach": 0, "trestbps": 0, "oldpeak": 0, "exang": 0,
                "prediction": {"risk_level": "Waiting...", "probability": 0, "confidence": "Low"},
                "trend": "Stable", "prediction_history": [], "phase": "idle"
            }
        
        # Ensure data has required prediction structure for frontend
        data = state.latest_data.copy()
        if not isinstance(data.get("prediction"), dict):
            data["prediction"] = {"risk_level": "Waiting...", "probability": 0, "confidence": "Low"}
        
        return data
    except Exception as e:
        logger.error(f"Error in /prediction endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

def trigger_stop_logic():
    """Helper to stop simulation and save final metrics. Reused by auto-stop and manual-stop."""
    current_session_id = state.session_id
    if current_session_id and state.start_time:
        try:
            db = get_db_session()

            # Calculate simulation duration in seconds
            actual_duration = state.engine.total_duration_s if state.engine else (time.time() - state.start_time)

            # Extract risk score from latest data
            risk_score = None
            if state.latest_data and isinstance(state.latest_data, dict):
                prediction = state.latest_data.get("prediction", {})
                if isinstance(prediction, dict):
                    risk_score = prediction.get("probability")

            # Update the simulation session with final values
            session = db.query(SimulationSession).filter(
                SimulationSession.id == current_session_id
            ).first()

            if session:
                session.duration = int(actual_duration)
                session.risk_score = float(risk_score) if risk_score is not None else session.risk_score
                
                # Save Phase 2 Analytics (Final Sync)
                if state.engine:
                    session.peak_hr = float(state.engine.peak_hr)
                    session.peak_sbp = float(state.engine.peak_sbp)
                    session.rest_duration = int(state.engine.rest_duration_actual)
                    session.exercise_duration = int(state.engine.exercise_duration_actual)
                    session.recovery_duration = int(state.engine.recovery_duration_actual)
                    
                    # Ensure risk score is captured
                    prediction = state.engine.predict_risk()
                    session.risk_score = float(prediction["probability"])
                    
                    logger.info(f"[LOG] Finalizing Metrics for Session {current_session_id}: PeakHR={session.peak_hr:.1f}, ExDur={session.exercise_duration}s")

                db.commit()
                logger.info(f"[SUCCESS] Saved final simulation {current_session_id}: duration={actual_duration:.1f}s, risk_score={risk_score}")

            close_db_session(db)
        except Exception as e:
            logger.error(f"[ERROR] Error in trigger_stop_logic for session {current_session_id}: {e}", exc_info=True)

    # Reset simulation state ONLY after attempt
    state.session_id = None
    state.start_time = None

@app.post("/stop_simulation")
async def stop():
    """Stop the simulation and save final metrics to database"""
    state.running = False
    trigger_stop_logic()
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
async def get_status():
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
    """Fetch all alerts for the currently active simulation session"""
    if not state.session_id:
        return {"alerts": []}
    
    db = get_db_session()
    try:
        alerts = db.query(SimulationAlert).filter(
            SimulationAlert.session_id == state.session_id
        ).order_by(SimulationAlert.timestamp.desc()).all()
        return {"alerts": [a.to_dict() for a in alerts]}
    finally:
        close_db_session(db)

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
async def what_if(
    req: WhatIfInput,
    current_user: User = Depends(get_current_user)
):
    # Initialize Baseline Engine
    current_engine = None
    source = "None"
    
    # Tier 1: Is there an active simulation?
    if state.engine:
        current_engine = state.engine
        source = "Active Simulation"
    else:
        # Tier 2: Check database for the most recent session of the current user
        try:
            db = get_db_session()
            from models import SimulationSession, UserProfile
            
            recent_session = db.query(SimulationSession).filter(
                SimulationSession.user_id == current_user.id
            ).order_by(SimulationSession.created_at.desc()).first()
            
            if recent_session:
                current_engine = PhysiologySimulationEngine()
                
                # Load profile data from that user if available
                profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
                if profile:
                    current_engine.age = profile.age if profile.age else 50
                    current_engine.sex = profile.sex if profile.sex else "1"
                    current_engine.smoking_status = profile.smoking_status if profile.smoking_status else "non_smoker"
                    current_engine.diabetes_history = profile.diabetes_history if profile.diabetes_history else "none"
                    current_engine.alcohol_consumption = profile.alcohol_consumption if profile.alcohol_consumption else "none"
                    current_engine.activity_level = profile.activity_level if profile.activity_level else "active"
                    current_engine.pad_history = profile.pad_history if profile.pad_history else "no_pad"
                    current_engine.height = profile.height if profile.height else 175.0
                    current_engine.weight = profile.weight if profile.weight else 75.0
                
                current_engine.apply_modifiers()
                source = "Saved History"
        except Exception as e:
            logger.error(f"Error fetching historical baseline: {e}")
        finally:
            if 'db' in locals():
                close_db_session(db)

    # If still no engine, we cannot perform a grounded analysis
    if not current_engine:
        raise HTTPException(
            status_code=428, 
            detail="Simulation data required. Please complete a stress test simulation first to establish your cardiovascular baseline."
        )

    # Create hypothetical clone
    hyp = PhysiologySimulationEngine(config=current_engine.config)
    
    # Apply baseline state
    hyp.age = current_engine.age
    hyp.sex = current_engine.sex
    hyp.smoking_status = (req.smoking_status.value if req.smoking_status and req.smoking_status != "" else current_engine.smoking_status)
    hyp.diabetes_history = (req.diabetes_history.value if req.diabetes_history and req.diabetes_history != "" else current_engine.diabetes_history)
    hyp.alcohol_consumption = (req.alcohol_consumption.value if req.alcohol_consumption and req.alcohol_consumption != "" else current_engine.alcohol_consumption)
    hyp.activity_level = (req.activity_level.value if req.activity_level and req.activity_level != "" else current_engine.activity_level)
    hyp.pad_history = (req.pad_history.value if req.pad_history and req.pad_history != "" else current_engine.pad_history)
    hyp.height = (req.height if req.height else current_engine.height)
    hyp.weight = (req.weight if req.weight else current_engine.weight)
    
    # Re-apply all modifiers to the clone
    hyp.apply_modifiers()

    # Calculate Physiological deltas
    sbp_reduction = 0.0 if current_engine.sbp_modifier == 0 else ((current_engine.sbp_modifier - hyp.sbp_modifier) / current_engine.sbp_modifier * 100)
    hr_improvement = 0.0 if current_engine.hr_modifier == 0 else ((current_engine.hr_modifier - hyp.hr_modifier) / current_engine.hr_modifier * 100)
    recovery_improvement = 0.0 if current_engine.recovery_modifier == 0 else ((hyp.recovery_modifier - current_engine.recovery_modifier) / current_engine.recovery_modifier * 100)
    baseline_hr_red = current_engine.baseline_hr - hyp.baseline_hr

    # Calculate ML Risk for both (Requires unified state)
    base_risk = current_engine.predict_risk()
    hyp_risk = hyp.predict_risk()

    # Generate personalized message
    positives = []
    if sbp_reduction > 5: positives.append("significantly lower blood pressure")
    if hr_improvement > 5: positives.append("improved heart rate efficiency")
    if recovery_improvement > 5: positives.append("faster cardiovascular recovery")
    
    if positives:
        # Bound years reduced to a realistic clinical range (e.g., max 15 years)
        years_reduced = min(15.0, round(max(sbp_reduction, hr_improvement) / 5, 1))
        message = f"By implementing these changes, your digital twin project indicates a healthier cardiovascular profile with {', '.join(positives)}. This could reduce your overall biological heart age by approximately {years_reduced} years."
    else:
        message = "These changes maintain your current cardiovascular stability. Consistent adherence to a healthy lifestyle remains the best preventative measure for long-term heart health."

    result_data = {
        "current": {
            "sbp_modifier": round(float(current_engine.sbp_modifier), 3),
            "hr_modifier": round(float(current_engine.hr_modifier), 3),
            "recovery_modifier": round(float(current_engine.recovery_modifier), 3),
            "baseline_hr": round(float(current_engine.baseline_hr), 1),
            "risk": base_risk,
            "age": int(current_engine.age)
        },
        "hypothetical": {
            "sbp_modifier": round(float(hyp.sbp_modifier), 3),
            "hr_modifier": round(float(hyp.hr_modifier), 3),
            "recovery_modifier": round(float(hyp.recovery_modifier), 3),
            "baseline_hr": round(float(hyp.baseline_hr), 1),
            "risk": hyp_risk,
            "age": int(hyp.age)
        },
        "predicted_improvements": {
            "sbp_reduction": round(float(sbp_reduction), 1),
            "hr_improvement": round(float(hr_improvement), 1),
            "recovery_improvement": round(float(recovery_improvement), 1),
            "baseline_hr_reduction": round(float(baseline_hr_red), 1)
        },
        "baseline_source": source,
        "message": message
    }

    # Persist What-If results to database if session exists
    if state.session_id:
        try:
            db_save = get_db_session()
            from models import WhatIfScenarioDataPoint
            
            # Save the scenario comparison
            scenario = WhatIfScenarioDataPoint(
                session_id=state.session_id,
                scenario_name="Lifestyle Intervention Analysis",
                current_value=float(current_engine.sbp_modifier),
                projected_value=float(hyp.sbp_modifier),
                improvement=float(sbp_reduction),
                current_risk_score=float(base_risk.get("probability", 0)),
                projected_risk_score=float(hyp_risk.get("probability", 0)),
                risk_reduction=float(base_risk.get("probability", 0) - hyp_risk.get("probability", 0)),
                impact_type="cardiovascular_profile",
                confidence=90.0
            )
            db_save.add(scenario)
            db_save.commit()
            close_db_session(db_save)
            logger.info(f"[SUCCESS] Saved What-If analysis for session {state.session_id}")
        except Exception as e:
            logger.error(f"[ERROR] Error persisting What-If results: {e}")

    return result_data

@app.get("/biological_age")
async def biological_age():
    if not state.engine:
        raise HTTPException(status_code=400, detail="No simulation")

    age = state.engine.age
    
    # Impact Factors (Years added/removed)
    impacts = {
        "smoking": 0,
        "diabetes": 0,
        "activity": 0,
        "bp": 0,
        "alcohol": 0,
        "pad": 0
    }

    if state.engine.smoking_status == "smoker":
        impacts["smoking"] = 5.0
    elif state.engine.smoking_status == "ex_smoker":
        impacts["smoking"] = 2.0

    if state.engine.diabetes_history == "type_1":
        impacts["diabetes"] = 3.0
    elif state.engine.diabetes_history == "type_2":
        impacts["diabetes"] = 2.0

    if state.engine.activity_level == "athlete":
        impacts["activity"] = -3.0
    elif state.engine.activity_level == "sedentary":
        impacts["activity"] = 4.0

    if state.engine.sbp > 140:
        impacts["bp"] = 2.0
    
    if state.engine.alcohol_consumption == "heavy":
        impacts["alcohol"] = 2.0
        
    if state.engine.pad_history == "pad":
        impacts["pad"] = 15.0  # PAD is a severe vascular age accelerator

    total_adjustment = sum(impacts.values())
    heart_age = age + total_adjustment
    
    status = "excellent" if total_adjustment < -2 else "poor" if total_adjustment > 5 else "good"
    interpretation = "Your heart is aging well!" if total_adjustment < 0 else "Your heart age is slightly higher than your chronological age."

    # Persist to database if we have an active session
    if state.session_id:
        db = get_db_session()
        try:
            from models import HeartAgeDataPoint
            # Check if a record already exists for this session to avoid duplicates
            existing = db.query(HeartAgeDataPoint).filter(HeartAgeDataPoint.session_id == state.session_id).first()
            
            if existing:
                existing.chronological_age = age
                existing.biological_age = heart_age
                existing.age_difference = total_adjustment
                existing.smoking_impact = impacts["smoking"]
                existing.diabetes_impact = impacts["diabetes"]
                existing.activity_impact = impacts["activity"]
                existing.bp_impact = impacts["bp"]
                existing.alcohol_impact = impacts["alcohol"]
                existing.total_adjustment = total_adjustment
                existing.interpretation = interpretation
            else:
                data_point = HeartAgeDataPoint(
                    session_id=state.session_id,
                    chronological_age=age,
                    biological_age=heart_age,
                    age_difference=total_adjustment,
                    smoking_impact=impacts["smoking"],
                    diabetes_impact=impacts["diabetes"],
                    activity_impact=impacts["activity"],
                    bp_impact=impacts["bp"],
                    alcohol_impact=impacts["alcohol"],
                    total_adjustment=total_adjustment,
                    interpretation=interpretation
                )
                db.add(data_point)
            
            db.commit()
            logger.info(f"[SUCCESS] Saved Heart Age ({heart_age:.1f}) for session {state.session_id}")
        except Exception as e:
            logger.error(f"[ERROR] Error persisting heart age: {e}")
        finally:
            close_db_session(db)

    return {
        "heart_age": round(heart_age, 1),
        "actual_age": age,
        "age_difference": round(total_adjustment, 1),
        "status": status,
        "interpretation": interpretation,
        "impacts": impacts
    }


# ==================== AI CHATBOT ENDPOINTS ====================

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_advisor(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Secure endpoint to chat with the AI Clinical Advisor"""
    db = get_db_session()
    try:
        # Generate response using the RAG handler with simulation-specific context
        ai_response = kardia_ai.generate_response(db, current_user.id, request.message, session_id=request.session_id)
        logger.debug(f"AI handler returned: {ai_response[:50]}...")
        
        # Fetch updated history to return to UI
        history_records = db.query(ChatMessage).filter(
            ChatMessage.user_id == current_user.id
        ).order_by(ChatMessage.timestamp.desc(), ChatMessage.id.desc()).limit(10).all()
        
        # Reverse to chronological for UI
        history_records.reverse()
        history_schemas = [ChatMessageSchema.model_validate(msg) for msg in history_records]
        
        return {
            "response": ai_response,
            "history": history_schemas
        }
    except Exception as e:
        logger.error(f"Chat API error: {e}")
        raise HTTPException(status_code=500, detail="AI Service currently unavailable")
    finally:
        close_db_session(db)

@app.get("/api/chat/history", response_model=list[ChatMessageSchema])
async def get_my_chat_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Retrieve personal chat history"""
    db = get_db_session()
    try:
        messages = db.query(ChatMessage).filter(
            ChatMessage.user_id == current_user.id
        ).order_by(ChatMessage.timestamp.desc(), ChatMessage.id.desc()).limit(limit).all()
        
        messages.reverse()
        return [ChatMessageSchema.model_validate(msg) for msg in messages]
    finally:
        close_db_session(db)

@app.delete("/api/chat/history")
async def clear_chat_history(
    current_user: User = Depends(get_current_user)
):
    """Clear user's chat messages"""
    db = get_db_session()
    try:
        db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete()
        db.commit()
        return {"status": "success", "message": "Chat history cleared"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not clear history")
    finally:
        close_db_session(db)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
