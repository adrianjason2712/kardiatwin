import google.generativeai as genai
import os
import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from models import ChatMessage
from ai_context import get_clinical_grounding, get_patient_summary, get_chat_history
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Configure Gemini
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
else:
    logger.warning("GOOGLE_API_KEY not found in environment variables.")

class KardiaAIHandler:
    """Handles the direct interaction with Gemini SDK (Traditional Raw SDK approach)"""
    
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model_name = model_name
        self._grounding_cache = None

    def get_grounding(self) -> str:
        """Simple in-memory caching of the clinical matrix."""
        if not self._grounding_cache:
            self._grounding_cache = get_clinical_grounding()
        return self._grounding_cache

    def generate_response(self, db: Session, user_id: int, user_message: str) -> str:
        """
        Orchestrates the RAG workflow via Direct SDK:
        1. Gathers context (SQL + File)
        2. Retrieves history (SQL)
        3. Calls Gemini
        4. Saves turns (SQL)
        """
        try:
            # 1. PREPARE CONTEXT (THE 'AUGMENT' IN RAG)
            grounding = self.get_grounding()
            patient_summary = get_patient_summary(db, user_id)
            history = get_chat_history(db, user_id)

            # 2. DEFINE SYSTEM INSTRUCTION
            # This is the 'Prompts' component of our build.
            system_instruction = (
                "You are the KardiaTwin Physiological Advisor, a specialized medical AI expert in cardiology and stress testing.\n\n"
                "### YOUR PRIMARY SOURCE OF TRUTH:\n"
                f"{grounding}\n\n"
                "### PATIENT DATA FOR THIS SESSION:\n"
                f"{patient_summary}\n\n"
                "### YOUR MANDATORY RULES:\n"
                "1. Always use the Clinical Matrix logic (e.g., SBP multipliers for PAD) when explaining data.\n"
                "2. Reference the patient's Bio Age and 'What If' scenarios to illustrate health trajectories.\n"
                "3. Explain findings through the lens of their specific markers (PAD, Smoking, Diabetes).\n"
                "4. STRICT MEDICAL DISCLAIMER: End every response with: '*Insight provided based on physiological simulation. Consult a physician for medical diagnosis.*'\n"
                "5. Provide actionable, data-driven insights based on their simulation history and projected improvements."
            )

            # 3. INITIALIZE MODEL WITH INSTRUCTIONS
            model = genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=system_instruction
            )

            # 4. SEND MESSAGE WITH HISTORY
            chat = model.start_chat(history=history)
            response = chat.send_message(user_message)
            ai_text = response.text

            # 5. PERSIST CONVERSATION (THE 'MEMORY' COMPONENT)
            user_msg_record = ChatMessage(user_id=user_id, role="user", content=user_message)
            ai_msg_record = ChatMessage(user_id=user_id, role="model", content=ai_text)
            db.add(user_msg_record)
            db.add(ai_msg_record)
            db.commit()

            return ai_text

        except Exception as e:
            logger.error(f"Error in KardiaAIHandler: {e}")
            db.rollback()
            return "I apologize, but I'm having trouble accessing the clinical simulation data right now. Please try again in a moment."

# Global singleton
kardia_ai = KardiaAIHandler()
