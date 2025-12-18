"""
KardiaTwin Database Models - PostgreSQL with Flask Support
Enhanced schema with type-specific data tables and analysis support
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, JSON, ForeignKey, Text, Index, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.pool import QueuePool
import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database Configuration - Support both PostgreSQL and SQLite for backwards compatibility
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    None
)

# Determine which database to use
# Default to SQLite for safety, PostgreSQL only if explicitly configured
if DATABASE_URL and 'postgresql' in DATABASE_URL:
    # Use PostgreSQL if explicitly configured
    db_type = 'postgresql'
    db_url = DATABASE_URL
else:
    # Default to SQLite for backwards compatibility
    db_type = 'sqlite'
    os.makedirs('data', exist_ok=True)
    db_url = 'sqlite:///data/simulation_sessions.db'

# Create database engine with connection pooling
# Use different settings for SQLite vs PostgreSQL
if db_type == 'postgresql':
    engine = create_engine(
        db_url,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False
    )
else:
    # SQLite doesn't support connection pooling the same way
    engine = create_engine(
        db_url,
        echo=False,
        connect_args={'check_same_thread': False}
    )

Base = declarative_base()


class SimulationSession(Base):
    """Model for storing simulation session metadata"""
    __tablename__ = 'simulation_sessions'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Simulation type classification
    simulation_type = Column(String(50), nullable=False, default="stress_test")  # stress_test | heart_age | what_if
    simulation_subtype = Column(String(50))  # bruce_standard | bruce_modified | etc.

    # Protocol (for backwards compatibility with stress tests)
    protocol = Column(String(50), nullable=False)
    duration = Column(Integer)  # Total duration in seconds

    # User data (stored as JSON)
    user_data = Column(JSON, nullable=False)

    # Patient demographics
    patient_age = Column(Integer)
    patient_gender = Column(String(10))  # M, F

    # Metadata and tags for analysis
    sim_metadata = Column(JSON, default={})  # Flexible metadata per simulation type
    tags = Column(JSON, default=[])  # For categorization: ["patient_education", "risk_assessment", "follow_up"]

    # Analysis metadata
    risk_score = Column(Float)  # Calculated risk score (0-100)
    abnormalities_detected = Column(JSON, default=[])  # List of abnormalities
    notes = Column(Text)  # Clinical notes or observations

    # Relationship with data points
    data_points = relationship("SimulationDataPoint", back_populates="session", cascade="all, delete-orphan")
    stress_test_data = relationship("StressTestDataPoint", back_populates="session", cascade="all, delete-orphan")
    heart_age_data = relationship("HeartAgeDataPoint", back_populates="session", cascade="all, delete-orphan")
    what_if_data = relationship("WhatIfScenarioDataPoint", back_populates="session", cascade="all, delete-orphan")

    # Relationship with alerts
    alerts = relationship("SimulationAlert", back_populates="session", cascade="all, delete-orphan")

    # Index for faster queries
    __table_args__ = (
        Index('idx_session_created_at', 'created_at'),
        Index('idx_session_type', 'simulation_type'),
        Index('idx_session_risk', 'risk_score'),
        Index('idx_patient_age', 'patient_age'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "simulation_type": self.simulation_type,
            "simulation_subtype": self.simulation_subtype,
            "protocol": self.protocol,
            "duration": self.duration,
            "patient_age": self.patient_age,
            "patient_gender": self.patient_gender,
            "user_data": self.user_data,
            "sim_metadata": self.sim_metadata,
            "tags": self.tags,
            "risk_score": self.risk_score,
            "abnormalities_detected": self.abnormalities_detected,
            "notes": self.notes
        }


class SimulationDataPoint(Base):
    """Model for storing individual data points during a simulation (generic)"""
    __tablename__ = 'simulation_data_points'

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('simulation_sessions.id'))
    timestamp = Column(Integer)  # Seconds from start of simulation

    # Vital signs
    heart_rate = Column(Float)  # thalach
    blood_pressure = Column(Float)  # trestbps (systolic)
    diastolic_bp = Column(Float)  # dbp
    st_depression = Column(Float)  # oldpeak

    # Simulation state
    phase = Column(String(20))  # rest, exercise, recovery
    stage = Column(Integer)
    stage_time = Column(Integer)
    workload_level = Column(Float)

    # Prediction
    prediction = Column(String(20))  # High Risk or Low Risk

    # Relationship
    session = relationship("SimulationSession", back_populates="data_points")

    # Index for faster time-series queries
    __table_args__ = (
        Index('idx_datapoint_session_time', 'session_id', 'timestamp'),
        Index('idx_datapoint_phase', 'phase'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "heart_rate": self.heart_rate,
            "blood_pressure": self.blood_pressure,
            "diastolic_bp": self.diastolic_bp,
            "st_depression": self.st_depression,
            "phase": self.phase,
            "stage": self.stage,
            "stage_time": self.stage_time,
            "workload_level": self.workload_level,
            "prediction": self.prediction
        }


class StressTestDataPoint(Base):
    """Type-specific: Stress test data points with exercise-specific fields"""
    __tablename__ = 'stress_test_data_points'

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('simulation_sessions.id'))
    timestamp = Column(Integer)  # Seconds from start

    # Core vitals
    heart_rate = Column(Float)
    blood_pressure_systolic = Column(Float)
    blood_pressure_diastolic = Column(Float)
    st_depression = Column(Float)

    # Exercise-specific
    protocol = Column(String(50))  # bruce_standard | bruce_modified
    stage = Column(Integer)
    stage_time = Column(Integer)
    workload_level = Column(Float)
    mets = Column(Float)  # Metabolic equivalents

    # Physiological response
    phase = Column(String(20))  # rest | exercise | recovery
    recovery_hr_drop = Column(Float)  # HR drop from peak (used for recovery assessment)
    exercise_induced_angina = Column(Boolean, default=False)

    # Risk indicators
    risk_prediction = Column(String(20))  # High Risk | Low Risk
    st_changes = Column(String(50))  # normal | mild | moderate | severe
    arrhythmia_detected = Column(Boolean, default=False)

    # Relationship
    session = relationship("SimulationSession", back_populates="stress_test_data")

    __table_args__ = (
        Index('idx_stress_test_session_time', 'session_id', 'timestamp'),
        Index('idx_stress_test_phase', 'phase'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "heart_rate": self.heart_rate,
            "blood_pressure_systolic": self.blood_pressure_systolic,
            "blood_pressure_diastolic": self.blood_pressure_diastolic,
            "st_depression": self.st_depression,
            "protocol": self.protocol,
            "stage": self.stage,
            "workload_level": self.workload_level,
            "mets": self.mets,
            "phase": self.phase,
            "recovery_hr_drop": self.recovery_hr_drop,
            "exercise_induced_angina": self.exercise_induced_angina,
            "risk_prediction": self.risk_prediction,
            "st_changes": self.st_changes,
            "arrhythmia_detected": self.arrhythmia_detected
        }


class HeartAgeDataPoint(Base):
    """Type-specific: Heart age calculation data"""
    __tablename__ = 'heart_age_data_points'

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('simulation_sessions.id'))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Chronological vs biological age
    chronological_age = Column(Integer)
    biological_age = Column(Float)
    age_difference = Column(Float)  # biological - chronological (positive = older, negative = younger)

    # Contributing factors
    smoking_impact = Column(Float)  # Years added/removed
    diabetes_impact = Column(Float)
    activity_impact = Column(Float)
    bp_impact = Column(Float)
    alcohol_impact = Column(Float)

    # Summary
    total_adjustment = Column(Float)  # Sum of all impacts
    interpretation = Column(String(100))  # "Normal aging", "Accelerated aging", "Slower aging"

    # Relationship
    session = relationship("SimulationSession", back_populates="heart_age_data")

    __table_args__ = (
        Index('idx_heart_age_session', 'session_id'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "chronological_age": self.chronological_age,
            "biological_age": self.biological_age,
            "age_difference": self.age_difference,
            "smoking_impact": self.smoking_impact,
            "diabetes_impact": self.diabetes_impact,
            "activity_impact": self.activity_impact,
            "bp_impact": self.bp_impact,
            "alcohol_impact": self.alcohol_impact,
            "total_adjustment": self.total_adjustment,
            "interpretation": self.interpretation
        }


class WhatIfScenarioDataPoint(Base):
    """Type-specific: What-if analysis comparing scenarios"""
    __tablename__ = 'what_if_scenario_data_points'

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('simulation_sessions.id'))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Scenario comparison
    scenario_name = Column(String(100))  # e.g., "Quit smoking", "Start exercising"
    current_value = Column(Float)  # Current state metric
    projected_value = Column(Float)  # After intervention
    improvement = Column(Float)  # Percentage improvement

    # Risk comparison
    current_risk_score = Column(Float)
    projected_risk_score = Column(Float)
    risk_reduction = Column(Float)  # Percentage

    # Timeline
    timeframe_months = Column(Integer)  # How long to see benefit

    # Impact areas
    impact_type = Column(String(50))  # heart_rate | blood_pressure | recovery | risk_score
    confidence = Column(Float)  # Confidence level (0-100)

    # Relationship
    session = relationship("SimulationSession", back_populates="what_if_data")

    __table_args__ = (
        Index('idx_what_if_session', 'session_id'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "scenario_name": self.scenario_name,
            "current_value": self.current_value,
            "projected_value": self.projected_value,
            "improvement": self.improvement,
            "current_risk_score": self.current_risk_score,
            "projected_risk_score": self.projected_risk_score,
            "risk_reduction": self.risk_reduction,
            "timeframe_months": self.timeframe_months,
            "impact_type": self.impact_type,
            "confidence": self.confidence
        }


class SimulationAlert(Base):
    """Model for storing alerts generated during a simulation"""
    __tablename__ = 'simulation_alerts'

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('simulation_sessions.id'))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Alert details
    alert_type = Column(String(50))  # heart_rate | blood_pressure | st_depression | recovery_abnormal | arrhythmia
    message = Column(Text)
    severity = Column(String(20))  # low | medium | high | critical

    # Additional context
    value = Column(Float)  # The value that triggered the alert
    threshold = Column(Float)  # The threshold that was exceeded
    phase = Column(String(20))  # rest | exercise | recovery

    # Relationship
    session = relationship("SimulationSession", back_populates="alerts")

    __table_args__ = (
        Index('idx_alert_session_severity', 'session_id', 'severity'),
        Index('idx_alert_type', 'alert_type'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "alert_type": self.alert_type,
            "message": self.message,
            "severity": self.severity,
            "value": self.value,
            "threshold": self.threshold,
            "phase": self.phase
        }


# Create all tables
def init_db():
    """Initialize database - creates all tables"""
    Base.metadata.create_all(engine)
    print("Database initialized successfully!")


# Session factory
SessionFactory = sessionmaker(bind=engine)


def get_db_session():
    """Get a new database session"""
    return SessionFactory()


def close_db_session(session):
    """Close a database session"""
    if session:
        session.close()
