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

def get_patient_summary(db: Session, user_id: int) -> str:
    """
    Builds a personalized context vignette for a specific user.
    Retrieves Profile + Bio Age + What-If + Last 3 Sessions.
    """
    try:
        # 1. Fetch User Profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            return "Patient profile not found. User is a new patient with no recorded physiological data."

        # 2. Fetch Latest Heart Age (Bio Age)
        heart_age = db.query(HeartAgeDataPoint).join(SimulationSession).filter(
            SimulationSession.user_id == user_id
        ).order_by(HeartAgeDataPoint.timestamp.desc()).first()

        # 3. Fetch Latest What-If Analyses
        what_if_scenarios = db.query(WhatIfScenarioDataPoint).join(SimulationSession).filter(
            SimulationSession.user_id == user_id
        ).order_by(WhatIfScenarioDataPoint.timestamp.desc()).limit(3).all()

        # 4. Fetch Last 3 Stress Test Sessions
        sessions = db.query(SimulationSession).filter(
            SimulationSession.user_id == user_id,
            SimulationSession.simulation_type == "stress_test"
        ).order_by(SimulationSession.created_at.desc()).limit(3).all()

        # 5. Build Narrative
        gender = str(profile.sex).lower()
        gender_str = "Male" if gender in ["1", "male", "m"] else "Female" if gender in ["0", "female", "f"] else "Unknown"
        
        narrative = f"### Patient Physiological Profile\n"
        narrative += f"- **Age**: {profile.age}\n"
        narrative += f"- **Gender**: {gender_str}\n"
        narrative += f"- **Height/Weight**: {profile.height}cm / {profile.weight}kg\n"
        narrative += f"- **Clinical Markers**: PAD: {profile.pad_history}, Smoker: {profile.smoking_status}, Diabetes: {profile.diabetes_history}\n"
        narrative += f"- **Activity**: {profile.activity_level}, Alcohol: {profile.alcohol_consumption}\n"
        narrative += f"- **Family History**: {profile.family_history or 'None recorded'}\n"
        narrative += f"- **Allergies/Notes**: {profile.allergies or 'None recorded'}\n"
        
        if heart_age:
            narrative += f"\n### Biological Analysis (Heart Age)\n"
            narrative += f"- **Calculated Bio Age**: {heart_age.biological_age} (Difference: {heart_age.age_difference} years)\n"
            narrative += f"- **Interpretation**: {heart_age.interpretation}\n"

        if what_if_scenarios:
            narrative += f"\n### Projected 'What If' Scenarios\n"
            for scenario in what_if_scenarios:
                narrative += f"- **Scenario**: {scenario.scenario_name}\n"
                narrative += f"  - Improvement: {scenario.improvement}%\n"
                narrative += f"  - Risk Reduction: {scenario.risk_reduction}%\n"

        if sessions:
            narrative += "\n### Recent Stress Test History & Analytics\n"
            for i, sim in enumerate(sessions):
                date_str = sim.created_at.strftime("%Y-%m-%d")
                narrative += f"**Session {i+1} ({date_str})**:\n"
                narrative += f" - Peak HR: {sim.peak_hr}, Peak SBP: {sim.peak_sbp}\n"
                
                # Pull Transient Simulation Data from user_data
                u_data = sim.user_data or {}
                chest_pain = u_data.get('chestPain', 'None reported')
                ecg_findings = u_data.get('ecgFindings', 'Normal')
                narrative += f" - Transient Inputs: Chest Pain: {chest_pain}, ECG: {ecg_findings}\n"
                
                # High-Resolution Analytics Summary (Chart Interpretation)
                if sim.peak_hr and sim.recovery_duration:
                    # Logic: If recovery is fast (Phase 2 matrix), summarize efficiency
                    eff = "High" if sim.recovery_duration < 180 else "Normal" if sim.recovery_duration < 300 else "Delayed"
                    narrative += f" - Analytics Chart: Recovery Efficiency is {eff} ({sim.recovery_duration}s to baseline)\n"
                
                if sim.abnormalities_detected:
                    narrative += f" - Clinical Findings: {', '.join(sim.abnormalities_detected)}\n"
        else:
            narrative += "\nNo stress test simulations recorded yet.\n"

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
