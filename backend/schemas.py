"""
Pydantic models for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


# ==================== Authentication Models ====================

class UserRegister(BaseModel):
    """User registration request"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    """User login request"""
    username: str  # Can be username or email
    password: str


class UserResponse(BaseModel):
    """User information response"""
    id: int
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenRefresh(BaseModel):
    """Token refresh request"""
    refresh_token: str


class TokenResponse(BaseModel):
    """Access token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ==================== Simulation History Models ====================

class SimulationDataPoint(BaseModel):
    """Single simulation data point"""
    timestamp: float
    heart_rate: int
    blood_pressure_systolic: int
    blood_pressure_diastolic: int
    st_depression: float
    cholesterol: int
    phase: str
    stage: int
    workload_level: float
    risk_probability: Optional[float] = None

    class Config:
        from_attributes = True


class SimulationSummary(BaseModel):
    """Summary of a simulation session"""
    id: int
    created_at: datetime
    protocol: str
    duration: Optional[float] = None
    risk_score: Optional[float] = None

    class Config:
        from_attributes = True


class SimulationDetail(BaseModel):
    """Detailed simulation with all data points"""
    session: SimulationSummary
    data_points: list[SimulationDataPoint]


class SimulationList(BaseModel):
    """Paginated list of simulations"""
    sessions: list[SimulationSummary]
    total: int
    limit: int
    offset: int
