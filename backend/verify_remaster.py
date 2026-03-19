import sys
import os
from unittest.mock import MagicMock

# Mock necessary modules to avoid import errors
sys.modules['models'] = MagicMock()
sys.modules['database'] = MagicMock()

from main import PhysiologySimulationEngine

def test_remaster():
    print("=== REMASTER VERIFICATION: CLINICAL MATRIX SECTION 5 ===")
    
    # 1. PROFILE: 66yo Male Athlete (The user's specific complaint)
    # Expected HR: 71 (Base) - 15 (Athlete) + 7.8 (Age tax: 13 years * 0.6 SBP? No, user wanted age imposed on HR).
    # Wait, my implementation added SBP offset for age: (66-40)*0.6 = +15.6 SBP.
    # Currently no HR offset for age in Matrix, but ATHLETE is -15.
    athlete = PhysiologySimulationEngine()
    athlete.age = 66
    athlete.sex = "1"
    athlete.activity_level = "athlete"
    athlete.apply_modifiers()
    
    data = athlete.to_latest_data()
    print(f"66yo Athlete Rest: HR={data['thalach']}, SBP={data['trestbps']}")
    
    # Verify Age SBP Offset: 115 (Base) + 15.6 (Age) - 5 (Athlete) = 125.6
    if abs(data['trestbps'] - 125.6) < 1.0:
        print("[SUCCESS] Age SBP Offset (Section 5 Line 98) verified.")
    else:
        print(f"[ERROR] Age SBP Offset mismatch. Expected ~125.6, got {data['trestbps']}")

    # 2. PROFILE: 68yo Female Super-Sick (The 271 BPM Shot investigation)
    # SBP should be high (~200+), HR should be moderate (~120).
    sick = PhysiologySimulationEngine()
    sick.sex = "0"
    sick.age = 68
    sick.smoking_status = "smoker"
    sick.diabetes_history = "type_1"
    sick.pad_history = "pad"
    sick.alcohol_consumption = "heavy"
    sick.apply_modifiers()
    
    data = sick.to_latest_data()
    print(f"68yo Super-Sick Rest: HR={data['thalach']}, SBP={data['trestbps']}")
    
    # Verify no swap: thalach (HR) should be lower than trestbps (SBP)
    if data['thalach'] < data['trestbps']:
        print("[SUCCESS] Vital Sign Mapping (thalach=HR, trestbps=SBP) verified.")
    else:
        print("[ERROR] Vital signs are still swapped in result dictionary!")

    # 3. VERIFY STIFFNESS MULTIPLIER (65+)
    # Base rise is 12.0. Senior Female (65+) stiffness = 1.25x -> 15.0 per stage.
    print(f"Sick SBP Rise Rate: {sick.sbp_increase_per_level} mmHg/lvl")
    if sick.sbp_increase_per_level >= 25.0: # 20 (PAD) * 1.25 (Senior)
        print("[SUCCESS] Senior Stiffness Multiplier (Section 5 Line 99) verified.")
    else:
        print(f"[ERROR] Senior Stiffness missing. Expected >= 25.0, got {sick.sbp_increase_per_level}")

if __name__ == "__main__":
    test_remaster()
