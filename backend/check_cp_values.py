import sys
import os
from sqlalchemy.orm import Session

# Add the backend directory to the path 
sys.path.append(os.getcwd())

from models import UserProfile, SimulationSession, get_db_session, close_db_session

def check_cp_values():
    db = get_db_session()
    try:
        print("--- Chest Pain (CP) Value Audit ---")
        
        # Check User Profiles
        profiles = db.query(UserProfile).all()
        print(f"\n[UserProfile Table] ({len(profiles)} records)")
        for p in profiles:
            print(f"- Sex: {p.sex}, CP Value: '{p.cp}' (Type: {type(p.cp)})")

        # Check Recent Simulation Sessions
        sessions = db.query(SimulationSession).order_by(SimulationSession.created_at.desc()).limit(5).all()
        print(f"\n[SimulationSession Table] (Recent 5 records)")
        for s in sessions:
            u_data = s.user_data or {}
            print(f"- ID: {s.id}, CP Baseline: '{u_data.get('cp')}', Transient CP: '{u_data.get('chestPain')}'")

    finally:
        close_db_session(db)

if __name__ == "__main__":
    check_cp_values()
