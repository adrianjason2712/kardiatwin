"""
KardiaTwin FastAPI Server
Cardiac stress test simulator with real-time monitoring and analysis
"""

import random
import time
import threading
import pickle
import numpy as np
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import logging

from models import (
    engine, get_db_session, close_db_session,
    SimulationSession, SimulationDataPoint, StressTestDataPoint,
    SimulationAlert, init_db
)
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load the trained ML Model and scaler
try:
    with open('heart_model.pkl', 'rb') as file:
        heart_model, scaler = pickle.load(file)
    logger.info("✓ ML model loaded successfully")
except Exception as e:
    logger.error(f"✗ Failed to load ML model: {e}")
    heart_model, scaler = None, None

# ==================== Pydantic Models ====================

class UserInputData(BaseModel):
    """User input for simulation"""
    age: int = Field(..., ge=18, le=100)
    sex: str = Field(..., pattern="^[01MF]$")
    cp: str = Field(..., pattern="^[0-3]$")
    fbs: Optional[str] = "0"
    restecg: Optional[str] = "0"
    slope: Optional[str] = "1"
    ca: Optional[str] = "0"
    thal: Optional[str] = "2"
    smoking_status: str = "non_smoker"
    diabetes_history: str = "none"
    alcohol_consumption: str = "none"
    activity_level: str = "active"
    simulation: Optional[Dict[str, Any]] = None


class SimulationResponse(BaseModel):
    """Response for simulation data"""
    trestbps: float
    dbp: float
    chol: float
    thalach: float
    exang: int
    oldpeak: float
    phase: str
    workload_level: float
    prediction: str
    protocol: str
    stage: int
    stage_time: int
    future_predictions: List[Dict[str, Any]] = []


class WhatIfInput(BaseModel):
    """Input for what-if analysis"""
    smoking_status: Optional[str] = None
    diabetes_history: Optional[str] = None
    alcohol_consumption: Optional[str] = None
    activity_level: Optional[str] = None


class AlertData(BaseModel):
    """Alert data structure"""
    alert_type: str
    message: str
    severity: str
    value: Optional[float] = None
    threshold: Optional[float] = None


# ==================== Global State ====================

class SimulationEngine:
    """Global simulation state"""
    def __init__(self):
        self.running = False
        self.paused = False
        self.pause_start_time = None
        self.pause_elapsed = 0.0
        self.simulation_thread = None
        self.current_session_id = None
        self.simulation_start_time = None
        self.latest_data = None
        self.alerts = []
        self.engine = None
        self.user_static_data = {}

engine_state = SimulationEngine()

# Alert thresholds
alert_thresholds = {
    "heart_rate_high": 170,
    "heart_rate_low": 50,
    "blood_pressure_high": 140,
    "blood_pressure_low": 90,
    "st_depression_high": 2.0
}

# ==================== Lifespan Event ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("🚀 KardiaTwin FastAPI Server Starting...")
    init_db()
    logger.info("✓ Database initialized")
    yield
    # Shutdown
    logger.info("🛑 KardiaTwin FastAPI Server Shutting Down...")


# ==================== FastAPI App Setup ====================

app = FastAPI(
    title="KardiaTwin API",
    description="Cardiac Stress Test Simulator API",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Dependency ====================

def get_db():
    """Database session dependency"""
    session = get_db_session()
    try:
        yield session
    finally:
        close_db_session(session)

# ==================== Physiology Simulation Engine ====================

class PhysiologySimulationEngine:
    """Rule-based simulator for vitals with rest, exercise, and recovery phases."""

    def __init__(self, config=None):
        # Baselines
        self.baseline_hr = 72.0
        self.baseline_sbp = 120.0
        self.baseline_dbp = 75.0
        self.baseline_oldpeak = 1.0

        # Current state variables
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
        self.protocol_completed = False
        self.protocol_finished = False

        # Protocol configurations
        self.protocol_configs = {
            "standard": {
                "stages": [
                    {"duration": 180, "workload": 1, "target_hr": 0.85},
                    {"duration": 180, "workload": 2, "target_hr": 0.90},
                    {"duration": 180, "workload": 3, "target_hr": 0.95}
                ],
                "workload_increments": [1, 2, 3]
            },
            "modified_bruce": {
                "stages": [
                    {"duration": 300, "workload": 0.5, "target_hr": 0.70},
                    {"duration": 300, "workload": 1.0, "target_hr": 0.80},
                    {"duration": 300, "workload": 1.5, "target_hr": 0.85},
                    {"duration": 300, "workload": 2.0, "target_hr": 0.90}
                ],
                "workload_increments": [0.5, 1.0, 1.5, 2.0]
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

        # Internal timers
        self.phase_elapsed_s = 0.0
        self.hr_increase_rate_per_min = 11.0
        self.sbp_increase_per_level = 12.0
        self.recovery_start_hr = self.hr
        self.recovery_flagged = False

        # Age-related parameters
        self.age = 50
        self.age_modifier = 1.0

        # Physiological modifiers
        self.smoking_status = "non_smoker"
        self.diabetes_history = "none"
        self.alcohol_consumption = "none"
        self.activity_level = "active"

        # Lifestyle-based modifiers
        self.sbp_modifier = 1.0
        self.hr_modifier = 1.0
        self.recovery_modifier = 1.0
        self.max_workload_capacity = 1.0
        self.ectopic_beat_chance = 0.0
        self.silent_ischemia_enabled = False

        # Dynamic event tracking
        self.last_event_triggers = {}
        self.abnormal_bp_reported = False
        self.shortness_of_breath_reported = False
        self.palpitations_reported = False
        self.dizziness_reported = False

    def apply_age_modifiers(self):
        """Apply age-based modifiers to protocol functioning"""
        if self.age < 30:
            age_hr_factor = 0.95
            self.hr_modifier *= 1.05
        elif self.age < 40:
            age_hr_factor = 1.0
        elif self.age < 50:
            age_hr_factor = 1.05
            self.hr_modifier *= 1.0
        elif self.age < 60:
            age_hr_factor = 1.08
            self.hr_modifier *= 0.98
        elif self.age < 70:
            age_hr_factor = 1.15
            self.hr_modifier *= 0.93
        else:
            age_hr_factor = 1.25
            self.hr_modifier *= 0.85

        # Recovery capacity based on age
        if self.age < 30:
            self.recovery_modifier *= 1.2
        elif self.age < 40:
            self.recovery_modifier *= 1.1
        elif self.age < 50:
            self.recovery_modifier *= 1.0
        elif self.age < 60:
            self.recovery_modifier *= 0.95
        elif self.age < 70:
            self.recovery_modifier *= 0.85
        else:
            self.recovery_modifier *= 0.75

        # Blood pressure response based on age
        if self.age < 40:
            self.sbp_modifier *= 1.0
        elif self.age < 50:
            self.sbp_modifier *= 1.02
        elif self.age < 60:
            self.sbp_modifier *= 1.04
        elif self.age < 70:
            self.sbp_modifier *= 1.07
        else:
            self.sbp_modifier *= 1.10

        # Workload capacity based on age
        if self.age < 30:
            self.max_workload_capacity *= 1.1
        elif self.age < 40:
            self.max_workload_capacity *= 1.0
        elif self.age < 50:
            self.max_workload_capacity *= 0.97
        elif self.age < 60:
            self.max_workload_capacity *= 0.90
        elif self.age < 70:
            self.max_workload_capacity *= 0.80
        else:
            self.max_workload_capacity *= 0.65

        self.age_modifier = age_hr_factor

    def apply_lifestyle_modifiers(self):
        """Calculate physiological modifiers based on lifestyle inputs"""
        self.sbp_modifier = 1.0
        self.hr_modifier = 1.0
        self.recovery_modifier = 1.0
        self.max_workload_capacity = 1.0
        self.ectopic_beat_chance = 0.0
        self.silent_ischemia_enabled = False

        # Smoking status modifiers
        if self.smoking_status == "smoker":
            self.sbp_modifier *= 1.12
            self.hr_modifier *= 1.1
            self.recovery_modifier *= 0.65
            self.max_workload_capacity *= 0.85
        elif self.smoking_status == "ex_smoker":
            self.sbp_modifier *= 1.03
            self.recovery_modifier *= 0.95
            self.max_workload_capacity *= 0.95

        # Diabetes history modifiers
        if self.diabetes_history in ["type_1", "type_2"]:
            self.hr_modifier *= 0.85
            self.recovery_modifier *= 0.75
            self.silent_ischemia_enabled = True
            if self.diabetes_history == "type_1":
                self.sbp_modifier *= 1.05

        # Alcohol consumption modifiers
        if self.alcohol_consumption == "moderate":
            self.sbp_modifier *= 1.05
            self.ectopic_beat_chance = 0.02
        elif self.alcohol_consumption == "heavy":
            self.sbp_modifier *= 1.15
            self.ectopic_beat_chance = 0.05
            self.hr_modifier *= 1.12
            self.recovery_modifier *= 0.8

        # Activity level modifiers
        if self.activity_level == "sedentary":
            self.hr_modifier *= 1.15
            self.max_workload_capacity *= 0.75
            self.recovery_modifier *= 0.7
            self.baseline_hr = min(self.baseline_hr * 1.2, 100)
        elif self.activity_level == "athlete":
            self.baseline_hr = max(self.baseline_hr * 0.75, 50)
            self.recovery_modifier *= 1.4
            self.max_workload_capacity *= 1.3
            self.hr_modifier *= 0.85

    def _to_next_phase(self, next_phase):
        """Transition to next phase"""
        self.phase = next_phase
        self.phase_elapsed_s = 0.0
        self.stage = 0
        self.stage_time = 0

        if next_phase == "rest":
            self.exang = 0
            self.workload_level = 0
            self.recovery_flagged = False
        elif next_phase == "exercise":
            self.exang = 1
            self.workload_level = self.protocol_configs[self.protocol]["stages"][0]["workload"]
            self.hr_increase_rate_per_min = random.uniform(10.0, 12.0)
            self.sbp_increase_per_level = random.uniform(10.0, 15.0)
            self.protocol_completed = False
        elif next_phase == "recovery":
            self.exang = 0
            self.recovery_start_hr = self.hr
            self.recovery_flagged = False

    def _get_current_stage_config(self):
        """Get configuration for current exercise stage"""
        if self.protocol not in self.protocol_configs:
            return None

        stages = self.protocol_configs[self.protocol]["stages"]
        if self.stage < len(stages):
            return stages[self.stage]
        return stages[-1]

    def _advance_stage(self):
        """Advance to next exercise stage"""
        current_stage = self._get_current_stage_config()
        if current_stage and self.stage_time >= current_stage["duration"]:
            self.stage += 1
            self.stage_time = 0

            if self.stage < len(self.protocol_configs[self.protocol]["stages"]):
                self.workload_level = self.protocol_configs[self.protocol]["stages"][self.stage]["workload"]
                return True
            else:
                self._to_next_phase("recovery")
                return False
        return False

    def update(self, dt):
        """Update simulation state"""
        if self.phase == "rest":
            self._update_rest(dt)
        elif self.phase == "exercise":
            self._update_exercise(dt)
        elif self.phase == "recovery":
            self._update_recovery(dt)

    def _update_rest(self, dt):
        """Update rest phase"""
        self.phase_elapsed_s += dt
        self.stage_time += dt

        self.hr += (self.baseline_hr - self.hr) * min(1.0, dt/15.0) + random.uniform(-0.2, 0.2)
        self.sbp += (self.baseline_sbp - self.sbp) * min(1.0, dt/20.0) + random.uniform(-0.5, 0.5)
        self.dbp += (self.baseline_dbp - self.dbp) * min(1.0, dt/20.0) + random.uniform(-0.3, 0.3)
        self.oldpeak += (self.baseline_oldpeak - self.oldpeak) * min(1.0, dt/20.0) + random.uniform(-0.02, 0.02)

        if self.phase_elapsed_s >= self.config["rest_duration_s"]:
            self._to_next_phase("exercise")

    def _update_exercise(self, dt):
        """Update exercise phase"""
        self.phase_elapsed_s += dt
        self.stage_time += dt
        self._advance_stage()

        current_stage = self._get_current_stage_config()
        if not current_stage:
            return

        max_hr = 220 - self.age
        target_hr = max_hr * current_stage["target_hr"]

        hr_response = self.hr_increase_rate_per_min * (self.hr_modifier * self.age_modifier)
        self.hr += (target_hr - self.hr) * (dt / 60.0) * (hr_response / 11.0) + random.uniform(-0.5, 0.5)
        self.hr = max(self.baseline_hr, min(max_hr, self.hr))

        sbp_increase = self.sbp_increase_per_level * current_stage["workload"] * self.sbp_modifier
        self.sbp = self.baseline_sbp + sbp_increase + random.uniform(-1, 1)

        self.dbp = self.baseline_dbp + (current_stage["workload"] * 0.8) + random.uniform(-0.5, 0.5)

        self.oldpeak = self.baseline_oldpeak + (current_stage["workload"] * 0.1) + random.uniform(-0.05, 0.05)

        # Check if exercise duration exceeded
        total_exercise_duration = sum(s["duration"] for s in self.protocol_configs[self.protocol]["stages"])
        if self.phase_elapsed_s >= total_exercise_duration:
            self._to_next_phase("recovery")

    def _update_recovery(self, dt):
        """Update recovery phase"""
        self.phase_elapsed_s += dt
        self.stage_time += dt

        recovery_rate = 20.0 * self.recovery_modifier
        self.hr = max(self.baseline_hr, self.hr - (recovery_rate * dt))

        self.sbp = max(self.baseline_sbp, self.sbp - (recovery_rate * 0.5 * dt))
        self.dbp = max(self.baseline_dbp, self.dbp - (recovery_rate * 0.3 * dt))

        if self.phase_elapsed_s >= self.config["recovery_duration_s"]:
            self.protocol_finished = True

    def predict_risk(self, user_static_data):
        """Predict risk using ML model"""
        if not heart_model or not scaler:
            return "Waiting..."

        try:
            input_data = np.array([[
                float(user_static_data.get("age", 50)),
                float(user_static_data.get("sex", 1)),
                float(user_static_data.get("cp", 0)),
                float(user_static_data.get("fbs", 0)),
                self.sbp,
                float(user_static_data.get("restecg", 0)),
                self.hr,
                int(self.exang),
                self.oldpeak,
                float(user_static_data.get("slope", 1)),
                float(user_static_data.get("ca", 0)),
                float(user_static_data.get("thal", 2)),
                float(user_static_data.get("chol", 200))
            ]])

            input_scaled = scaler.transform(input_data)
            prediction = heart_model.predict(input_scaled)[0]
            return "High Risk" if prediction == 1 else "Low Risk"
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return "Error"


# ==================== API Endpoints ====================

@app.post("/start")
async def start_simulation(user_data: UserInputData, db: Session = Depends(get_db)):
    """Start a new simulation session"""
    try:
        # Create simulation session
        session_name = f"Simulation {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

        user_data_dict = user_data.dict()
        sim_config = user_data_dict.pop("simulation", {}) or {}

        # Parse protocol
        protocol_map = {
            "Standard Bruce": "standard",
            "Modified Bruce": "modified_bruce"
        }
        protocol = sim_config.get("protocol", "standard")
        if protocol not in ["standard", "modified_bruce"]:
            protocol = "standard"

        # Create database session record
        db_session = SimulationSession(
            name=session_name,
            simulation_type="stress_test",
            simulation_subtype=f"bruce_{'standard' if protocol == 'standard' else 'modified'}",
            protocol=protocol,
            user_data=user_data_dict,
            patient_age=int(user_data.age),
            patient_gender="M" if user_data.sex in ["1", "M"] else "F"
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)

        # Update global engine state
        engine_state.current_session_id = db_session.id
        engine_state.simulation_start_time = time.time()
        engine_state.user_static_data = user_data_dict

        # Initialize physiology engine
        cfg = {
            "rest_duration_s": sim_config.get("rest_duration_s", 60),
            "exercise_duration_s": sim_config.get("exercise_duration_s", 180),
            "recovery_duration_s": sim_config.get("recovery_duration_s", 120),
            "max_workload_level": sim_config.get("max_workload_level", 3),
            "protocol": protocol
        }

        engine_state.engine = PhysiologySimulationEngine(config=cfg)
        engine_state.engine.age = int(user_data.age)
        engine_state.engine.apply_age_modifiers()

        engine_state.engine.smoking_status = user_data.smoking_status
        engine_state.engine.diabetes_history = user_data.diabetes_history
        engine_state.engine.alcohol_consumption = user_data.alcohol_consumption
        engine_state.engine.activity_level = user_data.activity_level
        engine_state.engine.apply_lifestyle_modifiers()

        engine_state.running = True

        logger.info(f"✓ Simulation started - Session ID: {db_session.id}")
        logger.info(f"  Age: {engine_state.engine.age}, Protocol: {protocol}")
        logger.info(f"  Modifiers - HR: {engine_state.engine.hr_modifier:.2f}x, Recovery: {engine_state.engine.recovery_modifier:.2f}x")

        # Calculate exercise stages
        protocol_stages = engine_state.engine.protocol_configs[protocol]["stages"]
        total_exercise_duration = sum(stage["duration"] for stage in protocol_stages)

        exercise_stages = [
            {
                "stage_num": i + 1,
                "duration": stage["duration"],
                "workload": stage["workload"],
                "target_hr": stage["target_hr"]
            }
            for i, stage in enumerate(protocol_stages)
        ]

        return {
            "message": "Simulation started",
            "session_id": db_session.id,
            "engine_config": {
                **engine_state.engine.config,
                "exercise_duration_s": total_exercise_duration
            },
            "protocol": protocol,
            "exercise_stages": exercise_stages,
            "total_exercise_duration": total_exercise_duration
        }

    except Exception as e:
        logger.error(f"Error starting simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/prediction")
async def get_prediction(intensity: int = 50, db: Session = Depends(get_db)) -> SimulationResponse:
    """Get current simulation data"""
    try:
        if not engine_state.running or not engine_state.engine:
            raise HTTPException(status_code=400, detail="No active simulation")

        # Update simulation
        elapsed = time.time() - engine_state.simulation_start_time
        engine_state.engine.update(0.016)  # ~60Hz update

        # Predict risk
        prediction = engine_state.engine.predict_risk(engine_state.user_static_data)

        # Store data point
        if engine_state.current_session_id:
            data_point = StressTestDataPoint(
                session_id=engine_state.current_session_id,
                timestamp=int(elapsed),
                heart_rate=engine_state.engine.hr,
                blood_pressure_systolic=engine_state.engine.sbp,
                blood_pressure_diastolic=engine_state.engine.dbp,
                st_depression=engine_state.engine.oldpeak,
                protocol=engine_state.engine.protocol,
                stage=engine_state.engine.stage,
                stage_time=engine_state.engine.stage_time,
                workload_level=engine_state.engine.workload_level,
                mets=engine_state.engine.workload_level,
                phase=engine_state.engine.phase,
                risk_prediction=prediction,
                exercise_induced_angina=bool(engine_state.engine.exang)
            )
            db.add(data_point)
            db.commit()

        return SimulationResponse(
            trestbps=round(engine_state.engine.sbp, 1),
            dbp=round(engine_state.engine.dbp, 1),
            chol=200,
            thalach=round(engine_state.engine.hr, 1),
            exang=engine_state.engine.exang,
            oldpeak=round(engine_state.engine.oldpeak, 2),
            phase=engine_state.engine.phase,
            workload_level=engine_state.engine.workload_level,
            prediction=prediction,
            protocol=engine_state.engine.protocol,
            stage=engine_state.engine.stage,
            stage_time=engine_state.engine.stage_time
        )

    except Exception as e:
        logger.error(f"Error getting prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/stop_simulation")
async def stop_simulation(db: Session = Depends(get_db)):
    """Stop the current simulation"""
    try:
        engine_state.running = False

        # Update session with duration
        if engine_state.current_session_id:
            session = db.query(SimulationSession).filter(
                SimulationSession.id == engine_state.current_session_id
            ).first()
            if session:
                elapsed = time.time() - engine_state.simulation_start_time
                session.duration = int(elapsed)
                session.updated_at = datetime.utcnow()
                db.commit()

        logger.info("✓ Simulation stopped")
        return {"message": "Simulation stopped"}

    except Exception as e:
        logger.error(f"Error stopping simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pause_simulation")
async def pause_simulation():
    """Pause the current simulation"""
    try:
        if not engine_state.running:
            raise HTTPException(status_code=400, detail="No active simulation")

        engine_state.paused = True
        engine_state.pause_start_time = time.time()

        logger.info("⏸ Simulation paused")
        return {"message": "Simulation paused", "paused": True}

    except Exception as e:
        logger.error(f"Error pausing simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/resume_simulation")
async def resume_simulation():
    """Resume the paused simulation"""
    try:
        if not engine_state.paused:
            raise HTTPException(status_code=400, detail="Simulation is not paused")

        pause_duration = time.time() - engine_state.pause_start_time
        engine_state.pause_elapsed += pause_duration
        engine_state.paused = False

        logger.info("▶ Simulation resumed")
        return {"message": "Simulation resumed", "paused": False}

    except Exception as e:
        logger.error(f"Error resuming simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pause_status")
async def get_pause_status():
    """Get pause status"""
    return {"paused": engine_state.paused}


@app.get("/status")
async def get_status():
    """Get simulation status"""
    return {
        "running": engine_state.running,
        "paused": engine_state.paused,
        "session_id": engine_state.current_session_id,
        "phase": engine_state.engine.phase if engine_state.engine else None
    }


@app.post("/what_if_analysis")
async def what_if_analysis(changes: WhatIfInput, db: Session = Depends(get_db)):
    """Analyze what-if scenarios"""
    try:
        if not engine_state.engine:
            raise HTTPException(status_code=400, detail="No active simulation")

        current_modifiers = {
            "sbp": engine_state.engine.sbp_modifier,
            "hr": engine_state.engine.hr_modifier,
            "recovery": engine_state.engine.recovery_modifier,
            "workload": engine_state.engine.max_workload_capacity
        }

        # Create hypothetical engine with new parameters
        hyp_engine = PhysiologySimulationEngine()
        hyp_engine.age = engine_state.engine.age
        hyp_engine.apply_age_modifiers()

        hyp_engine.smoking_status = changes.smoking_status or engine_state.engine.smoking_status
        hyp_engine.diabetes_history = changes.diabetes_history or engine_state.engine.diabetes_history
        hyp_engine.alcohol_consumption = changes.alcohol_consumption or engine_state.engine.alcohol_consumption
        hyp_engine.activity_level = changes.activity_level or engine_state.engine.activity_level
        hyp_engine.apply_lifestyle_modifiers()

        projected_modifiers = {
            "sbp": hyp_engine.sbp_modifier,
            "hr": hyp_engine.hr_modifier,
            "recovery": hyp_engine.recovery_modifier,
            "workload": hyp_engine.max_workload_capacity
        }

        improvements = {
            "sbp": ((current_modifiers["sbp"] - projected_modifiers["sbp"]) / current_modifiers["sbp"] * 100) if current_modifiers["sbp"] != 0 else 0,
            "hr": ((current_modifiers["hr"] - projected_modifiers["hr"]) / current_modifiers["hr"] * 100) if current_modifiers["hr"] != 0 else 0,
            "recovery": ((projected_modifiers["recovery"] - current_modifiers["recovery"]) / current_modifiers["recovery"] * 100) if current_modifiers["recovery"] != 0 else 0,
            "workload": ((projected_modifiers["workload"] - current_modifiers["workload"]) / current_modifiers["workload"] * 100) if current_modifiers["workload"] != 0 else 0
        }

        return {
            "current_modifiers": current_modifiers,
            "projected_modifiers": projected_modifiers,
            "improvements": improvements,
            "timeframe_months": 3
        }

    except Exception as e:
        logger.error(f"Error in what-if analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/biological_age")
async def get_biological_age(db: Session = Depends(get_db)):
    """Calculate biological heart age"""
    try:
        if not engine_state.engine or not engine_state.current_session_id:
            raise HTTPException(status_code=400, detail="No active simulation")

        age = engine_state.engine.age
        adjustment = 0

        # Smoking impact
        if engine_state.engine.smoking_status == "smoker":
            adjustment += 5
        elif engine_state.engine.smoking_status == "ex_smoker":
            adjustment += 2

        # Diabetes impact
        if engine_state.engine.diabetes_history == "type_1":
            adjustment += 3
        elif engine_state.engine.diabetes_history == "type_2":
            adjustment += 2

        # Activity impact
        if engine_state.engine.activity_level == "athlete":
            adjustment -= 3
        elif engine_state.engine.activity_level == "sedentary":
            adjustment += 4

        # BP impact
        if engine_state.engine.sbp > 140:
            adjustment += 2

        biological_age = age + adjustment
        interpretation = "Normal aging"
        if adjustment > 5:
            interpretation = "Accelerated aging"
        elif adjustment < -2:
            interpretation = "Slower aging"

        return {
            "chronological_age": age,
            "biological_age": biological_age,
            "adjustment": adjustment,
            "interpretation": interpretation
        }

    except Exception as e:
        logger.error(f"Error calculating biological age: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/alerts")
async def get_alerts(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Get all alerts for current session"""
    try:
        if not engine_state.current_session_id:
            return []

        alerts = db.query(SimulationAlert).filter(
            SimulationAlert.session_id == engine_state.current_session_id
        ).all()

        return [alert.to_dict() for alert in alerts]

    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/thresholds")
async def get_thresholds():
    """Get alert thresholds"""
    return alert_thresholds


@app.post("/thresholds")
async def update_thresholds(thresholds: Dict[str, float]):
    """Update alert thresholds"""
    try:
        alert_thresholds.update(thresholds)
        logger.info("✓ Thresholds updated")
        return {"message": "Thresholds updated", "thresholds": alert_thresholds}

    except Exception as e:
        logger.error(f"Error updating thresholds: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/protocols")
async def get_protocols():
    """Get available protocols"""
    return {
        "protocols": [
            {
                "name": "Standard Bruce",
                "value": "standard",
                "description": "3-minute stages, higher intensity"
            },
            {
                "name": "Modified Bruce",
                "value": "modified_bruce",
                "description": "5-minute stages, gentler progression"
            }
        ]
    }


@app.get("/protocol_info")
async def get_protocol_info(protocol: str = "standard"):
    """Get information about a specific protocol"""
    info = {
        "standard": {
            "name": "Standard Bruce Protocol",
            "duration": 9,
            "stages": 3,
            "stage_duration": 3,
            "description": "3-minute stages with higher intensity progression"
        },
        "modified_bruce": {
            "name": "Modified Bruce Protocol",
            "duration": 20,
            "stages": 4,
            "stage_duration": 5,
            "description": "5-minute stages with gentler progression"
        }
    }
    return info.get(protocol, info["standard"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "KardiaTwin FastAPI Server",
        "version": "2.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="localhost",
        port=5000,
        reload=True,
        log_level="info"
    )
