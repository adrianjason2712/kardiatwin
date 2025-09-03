from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, JSON, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime
import os
import json

# Create database directory if it doesn't exist
os.makedirs('data', exist_ok=True)

# Create SQLite database engine
engine = create_engine('sqlite:///data/simulation_sessions.db')
Base = declarative_base()

class SimulationSession(Base):
    """Model for storing simulation session data"""
    __tablename__ = 'simulation_sessions'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    protocol = Column(String(50), nullable=False)
    duration = Column(Integer)  # Total duration in seconds
    
    # User data (stored as JSON)
    user_data = Column(JSON, nullable=False)
    
    # Relationship with data points
    data_points = relationship("SimulationDataPoint", back_populates="session", cascade="all, delete-orphan")
    
    # Relationship with alerts
    alerts = relationship("SimulationAlert", back_populates="session", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "protocol": self.protocol,
            "duration": self.duration,
            "user_data": self.user_data
        }

class SimulationDataPoint(Base):
    """Model for storing individual data points during a simulation"""
    __tablename__ = 'simulation_data_points'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('simulation_sessions.id'))
    timestamp = Column(Integer)  # Seconds from start of simulation
    
    # Vital signs
    heart_rate = Column(Float)  # thalach
    blood_pressure = Column(Float)  # trestbps
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

class SimulationAlert(Base):
    """Model for storing alerts generated during a simulation"""
    __tablename__ = 'simulation_alerts'
    
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('simulation_sessions.id'))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    alert_type = Column(String(50))  # heart_rate, blood_pressure, st_depression, recovery_abnormal
    message = Column(Text)
    severity = Column(String(20))  # low, medium, high, critical
    
    # Relationship
    session = relationship("SimulationSession", back_populates="alerts")
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "alert_type": self.alert_type,
            "message": self.message,
            "severity": self.severity
        }

# Create all tables
Base.metadata.create_all(engine)

# Create session factory
SessionFactory = sessionmaker(bind=engine)

def get_db_session():
    """Get a new database session"""
    return SessionFactory()