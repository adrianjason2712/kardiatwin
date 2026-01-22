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

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import logging

from models import init_db, get_db_session, close_db_session, User, SimulationSession, StressTestDataPoint
from auth import get_password_hash, verify_password, create_access_token, create_refresh_token, verify_token
from schemas import UserRegister, UserLogin, UserResponse, Token, SimulationSummary, SimulationList
from dependencies import get_current_user, get_current_user_optional
from sqlalchemy.orm import Session
from datetime import datetime

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
        self.session_id = None  # Database session ID for authenticated users
        self.start_time = None  # Simulation start time for calculating duration

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

                    try:
                        state.latest_data = state.engine.to_latest_data()
                    except Exception as e:
                        logger.error(f"❌ Error converting engine state to data during {state.engine.phase} phase: {e}", exc_info=True)
                        raise

                except Exception as e:
                    logger.error(f"❌ Engine update error during {getattr(state.engine, 'phase', 'unknown')} phase: {e}", exc_info=True)
                    logger.error(f"Engine state - HR: {getattr(state.engine, 'hr', 'N/A')}, SBP: {getattr(state.engine, 'sbp', 'N/A')}, Stage: {getattr(state.engine, 'stage', 'N/A')}")
                    state.running = False

            time.sleep(0.016)
        except Exception as e:
            logger.error(f"❌ Critical error in background simulation: {e}", exc_info=True)
            time.sleep(1)

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
            email=user_data.email,
            password_hash=hashed_password
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Generate tokens
        access_token = create_access_token(data={"sub": new_user.id})
        refresh_token = create_refresh_token(data={"sub": new_user.id})

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

        if not user or not verify_password(user_data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()

        # Generate tokens
        access_token = create_access_token(data={"sub": user.id})
        refresh_token = create_refresh_token(data={"sub": user.id})

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

        access_token = create_access_token(data={"sub": user.id})
        new_refresh_token = create_refresh_token(data={"sub": user.id})

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

        return {
            "sessions": [SimulationSummary.model_validate(s) for s in sessions],
            "total": total,
            "limit": limit,
            "offset": offset
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


@app.post("/start")
async def start_simulation(
    req: StartSimulationRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    logger.info(f"✓ /start endpoint called")
    db = get_db_session()
    try:
        logger.info(f"✓ Request received: age={req.age}, sex={req.sex}")
        cfg = {}
        if req.simulation:
            cfg = req.simulation.dict(exclude_none=True)

        logger.info(f"✓ Creating PhysiologySimulationEngine...")
        state.engine = PhysiologySimulationEngine(config=cfg)
        logger.info(f"✓ Engine created successfully")
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
                patient_gender="M" if req.sex == "1" else "F"
            )
            db.add(db_session)
            db.commit()
            db.refresh(db_session)
            state.session_id = db_session.id
            logger.info(f"✓ Created simulation session {db_session.id} for user {current_user.username}")
        else:
            state.session_id = None

        protocol = state.engine.protocol
        stages = state.engine.protocol_configs[protocol]["stages"]
        total_duration = sum(s["duration"] for s in stages)

        logger.info(f"✓ Simulation started: Age {req.age}, {req.smoking_status.value}")

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
        if not state.running or not state.latest_data:
            raise HTTPException(status_code=400, detail="No active simulation")

        # Ensure data has required fields with safe defaults
        try:
            data = state.latest_data.copy() if isinstance(state.latest_data, dict) else {}
        except Exception as e:
            logger.error(f"Error copying latest_data: {e}")
            data = {}

        # Validate prediction structure
        if not isinstance(data.get("prediction"), dict):
            data["prediction"] = {
                "risk_level": "Waiting...",
                "probability": 0,
                "confidence": "Low"
            }
        else:
            # Fill in missing prediction fields
            pred = data["prediction"]
            if "risk_level" not in pred:
                pred["risk_level"] = "Waiting..."
            if "probability" not in pred:
                pred["probability"] = 0
            if "confidence" not in pred:
                pred["confidence"] = "Low"

        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /prediction endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

@app.post("/stop_simulation")
async def stop():
    """Stop the simulation and save final metrics to database"""
    state.running = False

    # Save final simulation metrics if this was an authenticated user's session
    if state.session_id and state.start_time:
        try:
            db = get_db_session()

            # Calculate simulation duration in seconds
            duration = time.time() - state.start_time

            # Extract risk score from latest data
            risk_score = None
            if state.latest_data and isinstance(state.latest_data, dict):
                prediction = state.latest_data.get("prediction", {})
                if isinstance(prediction, dict):
                    risk_score = prediction.get("probability")

            # Update the simulation session with final values
            session = db.query(SimulationSession).filter(
                SimulationSession.id == state.session_id
            ).first()

            if session:
                session.duration = int(duration)
                session.risk_score = risk_score
                db.commit()
                logger.info(f"✓ Saved simulation {state.session_id}: duration={duration:.1f}s, risk_score={risk_score}")

            db.close()
        except Exception as e:
            logger.error(f"Error saving simulation metrics: {e}")

    # Reset simulation state
    state.session_id = None
    state.start_time = None

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
