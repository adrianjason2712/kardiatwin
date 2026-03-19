import os
import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from models import UserProfile, SimulationSession, ChatMessage, HeartAgeDataPoint, WhatIfScenarioDataPoint
import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

def get_clinical_grounding(matrix_path: str = "../unified_clinical_matrix.md") -> str:
    """Reads the clinical matrix to provide grounding for the AI."""
    try:
        # Try relative to backend dir first
        base_dir = os.path.dirname(os.path.abspath(__file__))
        abs_path = os.path.join(base_dir, matrix_path)
        
        if not os.path.exists(abs_path):
            # Fallback if matrix is in root
            abs_path = os.path.join(os.path.dirname(base_dir), "unified_clinical_matrix.md")

        with open(abs_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error reading clinical matrix: {e}")
        return "Clinical matrix not available."

def get_patient_summary(db: Session, user_id: int, session_id: Optional[int] = None) -> str:
    """
    Builds a personalized context vignette. 
    Priority: Simulation Session Data > User Profile Data.
    Fixed Data: Height, Weight, Family History (Always from Profile).
    """
    try:
        # 1. Fetch User Profile (The primary source for fixed data)
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        
        # 2. Identify the active/selected Simulation Session for physiological markers
        target_sim = None
        if session_id:
            target_sim = db.query(SimulationSession).filter(SimulationSession.id == session_id).first()
        else:
            # Fallback to the most recent session
            target_sim = db.query(SimulationSession).filter(
                SimulationSession.user_id == user_id
            ).order_by(SimulationSession.created_at.desc()).first()

        if not profile and not target_sim:
            return "Patient profile not found. User is a new patient with no recorded physiological data."

        # 3. Resolve Physiological Markers (Priority: Session > Profile)
        # We use simulation-specific markers if available to ensure the AI speaks to the current test state.
        age = getattr(target_sim, 'patient_age', None) or getattr(profile, 'age', 0)
        gender_raw = str(getattr(target_sim, 'patient_gender', None) or getattr(profile, 'sex', "unknown")).lower()
        smoking = getattr(target_sim, 'smoking_status', None) or getattr(profile, 'smoking_status', "unknown")
        diabetes = getattr(target_sim, 'diabetes_history', None) or getattr(profile, 'diabetes_history', "unknown")
        alcohol = getattr(target_sim, 'alcohol_consumption', None) or getattr(profile, 'alcohol_consumption', "unknown")
        activity = getattr(target_sim, 'activity_level', None) or getattr(profile, 'activity_level', "unknown")
        pad = getattr(target_sim, 'pad_history', None) or getattr(profile, 'pad_history', "no_pad")

        # Chest Pain Type mapping (Baseline clinical classification)
        # Priority: Simulation user_data['cp'] > Profile.cp
        u_data = target_sim.user_data if target_sim else {}
        cp_raw = u_data.get('cp') if isinstance(u_data, dict) else None
        if cp_raw is None:
            cp_raw = getattr(profile, 'cp', "3") # Default to Asymptomatic
            
        cp_map = {
            "0": "Typical Angina",
            "1": "Atypical Angina",
            "2": "Non-anginal Pain",
            "3": "Asymptomatic"
        }
        cp_label = cp_map.get(str(cp_raw), "Asymptomatic")

        # 4. Resolve Fixed Data (Always Profile)
        height = getattr(profile, 'height', 175.0)
        weight = getattr(profile, 'weight', 75.0)
        family_history = getattr(profile, 'family_history', 'None recorded')
        allergies = getattr(profile, 'allergies', 'None recorded')

        # Robust Mapping for M/F, 1/0, and Full Strings
        if gender_raw in ["1", "male", "m", "man"]:
            gender_str = "Male"
        elif gender_raw in ["0", "female", "f", "woman"]:
            gender_str = "Female"
        else:
            gender_str = "Unknown"
        
        narrative = f"### Current Simulation Physiological Profile\n"
        if target_sim:
            narrative += f"*Note: This context is grounded in Simulation Session #{target_sim.id} ({target_sim.name}).*\n"
        
        narrative += f"- **Age**: {age}\n"
        narrative += f"- **Gender**: {gender_str}\n"
        narrative += f"- **Height/Weight**: {height}cm / {weight}kg (Fixed Profile Data)\n"
        narrative += f"- **Baseline Clinical Markers**: CP Type: {cp_label}, PAD: {pad}, Smoker: {smoking}, Diabetes: {diabetes}\n"
        narrative += f"- **Activity**: {activity}, Alcohol: {alcohol}\n"
        narrative += f"- **Family History**: {family_history}\n"
        narrative += f"- **Allergies/Notes**: {allergies}\n"
        
        # 5. Biological & Historical Context (Recent Trends)
        heart_age = db.query(HeartAgeDataPoint).join(SimulationSession).filter(
            SimulationSession.user_id == user_id
        ).order_by(HeartAgeDataPoint.timestamp.desc()).first()

        what_if_scenarios = db.query(WhatIfScenarioDataPoint).join(SimulationSession).filter(
            SimulationSession.user_id == user_id
        ).order_by(WhatIfScenarioDataPoint.timestamp.desc()).limit(3).all()

        if heart_age:
            narrative += f"\n### Biological Analysis (Heart Age History)\n"
            narrative += f"- **Calculated Bio Age**: {heart_age.biological_age} (Difference: {heart_age.age_difference} years)\n"
            narrative += f"- **Interpretation**: {heart_age.interpretation}\n"

        if what_if_scenarios:
            narrative += f"\n### Projected 'What If' Scenarios\n"
            for scenario in what_if_scenarios:
                narrative += f"- **Scenario**: {scenario.scenario_name}\n"
                narrative += f"  - Improvement: {scenario.improvement}%\n"
                narrative += f"  - Risk Reduction: {scenario.risk_reduction}%\n"

        # 6. Session-Specific Analytics (If viewing a session)
        if target_sim:
            narrative += f"\n### Active Session Analytics (#{target_sim.id})\n"
            narrative += f" - Peak HR: {target_sim.peak_hr}, Peak SBP: {target_sim.peak_sbp}\n"
            
            # Live Symptom Observations (Transients during the test)
            live_cp = u_data.get('chestPain', 'None reported') if isinstance(u_data, dict) else 'None reported'
            ecg_findings = u_data.get('ecgFindings', 'Normal') if isinstance(u_data, dict) else 'Normal'
            narrative += f" - Live Symptom Observations: Current Chest Pain: {live_cp}, ECG: {ecg_findings}\n"
            
            if target_sim.peak_hr and target_sim.recovery_duration:
                eff = "High" if target_sim.recovery_duration < 180 else "Normal" if target_sim.recovery_duration < 300 else "Delayed"
                narrative += f" - Analysis: Recovery Efficiency is {eff} ({target_sim.recovery_duration}s)\n"
            
            if target_sim.abnormalities_detected:
                narrative += f" - Clinical Findings: {', '.join(target_sim.abnormalities_detected)}\n"

        return narrative

    except Exception as e:
        logger.error(f"Error building patient summary: {e}")
        return "Error retrieving patient data from database."

def get_chat_history(db: Session, user_id: int, limit: int = 15) -> List[dict]:
    """
    Fetches the last N turns of chat history for a user.
    Formats it for Gemini SDK: [{'role': 'user'|'model', 'parts': [content]}]
    """
    try:
        messages = db.query(ChatMessage).filter(
            ChatMessage.user_id == user_id
        ).order_by(ChatMessage.timestamp.desc(), ChatMessage.id.desc()).limit(limit).all()
        
        # Reverse to get chronological order
        messages.reverse()
        
        history = []
        for msg in messages:
            history.append({
                "role": msg.role,
                "parts": [msg.content]
            })
        return history
    except Exception as e:
        logger.error(f"Error retrieving chat history: {e}")
        return []
