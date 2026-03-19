import sys
import os
from sqlalchemy.orm import Session

# Add the backend directory to the path 
sys.path.append(os.getcwd())

from models import User, UserProfile, SimulationSession, get_db_session, close_db_session

def check_db_gender():
    db = get_db_session()
    try:
        print("--- Database Gender Audit ---")
        
        # Check User Profiles
        profiles = db.query(UserProfile).all()
        print(f"\n[UserProfile Table] ({len(profiles)} records)")
        for p in profiles:
            user = db.query(User).filter(User.id == p.user_id).first()
            username = user.username if user else "Unknown"
            print(f"- User: {username}, Sex Value: '{p.sex}' (Type: {type(p.sex)})")

        # Check Recent Simulation Sessions
        sessions = db.query(SimulationSession).order_by(SimulationSession.created_at.desc()).limit(5).all()
        print(f"\n[SimulationSession Table] (Recent 5 records)")
        for s in sessions:
            print(f"- ID: {s.id}, Gender Value: '{s.patient_gender}' (Type: {type(s.patient_gender)})")

    finally:
        close_db_session(db)

if __name__ == "__main__":
    check_db_gender()
