import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from main import PhysiologySimulationEngine

def verify_matrix():
    print("=== KardiaTwin: Clinical Matrix Verification Suite ===\n")
    
    # 1. TEST: BASELINE SEX DIFFERENCES (Phase 1)
    male_engine = PhysiologySimulationEngine(config={"age": 25, "sex": "1"})
    male_engine.apply_modifiers()
    
    female_engine = PhysiologySimulationEngine(config={"age": 25, "sex": "0"})
    female_engine.apply_modifiers()
    
    print(f"[SEX BASELINE] Male: {male_engine.baseline_hr}/{male_engine.baseline_sbp} (Expected 71/115)")
    print(f"[SEX BASELINE] Female: {female_engine.baseline_hr}/{female_engine.baseline_sbp} (Expected 78/110)")
    
    # 2. TEST: SMOKING & DIABETES (Phase 2 Rise)
    smoker_engine = PhysiologySimulationEngine(config={"age": 30, "sex": "0", "smoking_status": "smoker"})
    smoker_engine.apply_modifiers()
    print(f"\n[SMOKER FEMALE] HR Rise Mult: {smoker_engine.exercise_hr_mult:.2f} (Expected 0.82x)")
    print(f"[SMOKER FEMALE] Rest HR Offset: {smoker_engine.hr_offset} (Expected +11.0)")
    
    db_engine = PhysiologySimulationEngine(config={"age": 30, "sex": "0", "diabetes_history": "type_1"})
    db_engine.apply_modifiers()
    print(f"[DIABETES T1 FEMALE] SBP Rise Mult: {db_engine.exercise_sbp_mult:.2f} (Expected 1.45x)")
    
    # 3. TEST: PAD & SENIOR PIVOT (Phase 2 & 3 Combined)
    senior_pad_engine = PhysiologySimulationEngine(config={"age": 70, "sex": "1", "pad_history": "pad"})
    senior_pad_engine.apply_modifiers()
    print(f"\n[SENIOR PAD MALE] SBP Rise Mult: {senior_pad_engine.exercise_sbp_mult:.2f} (Expected 1.10x * 1.50x = 1.65x)")
    print(f"[SENIOR PAD MALE] Recovery Efficiency: {senior_pad_engine.recovery_efficiency:.2f} (Expected 0.42x * Age-Decay)")
    
    # 4. TEST: BMI TISSUE TAX (Section 4)
    obese_engine = PhysiologySimulationEngine(config={"age": 30, "sex": "1", "height": 170, "weight": 95}) # BMI ~32.9
    obese_engine.apply_modifiers()
    print(f"\n[OBESE BMI 32.9] SBP Rest Offset: {obese_engine.sbp_offset:.1f} (Expected (32.9-25)*1.6 = 12.6)")
    print(f"[OBESE BMI 32.9] HR Rest Offset: {obese_engine.hr_offset} (Expected +8.0)")
    
    # 5. TEST: AGE DYNAMICS (Section 5)
    age_60_engine = PhysiologySimulationEngine(config={"age": 60, "sex": "1"})
    age_60_engine.apply_modifiers()
    print(f"\n[AGE 60 DECAY] SBP Offset: {age_60_engine.sbp_offset:.1f} (Expected 20 * 0.6 = 12.0)")
    print(f"[AGE 60 DECAY] Recovery Eff: {age_60_engine.recovery_efficiency:.2f} (Expected 0.80x typical of -20% decay)")

if __name__ == "__main__":
    verify_matrix()
