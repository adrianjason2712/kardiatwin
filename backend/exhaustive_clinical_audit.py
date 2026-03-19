import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from main import PhysiologySimulationEngine

def test_config(name, config, expected):
    engine = PhysiologySimulationEngine(config=config)
    engine.apply_modifiers()
    
    results = {
        "HR Offset": (engine.hr_offset, expected.get("hr_offset")),
        "SBP Offset": (engine.sbp_offset, expected.get("sbp_offset")),
        "HR Rise Mult": (round(engine.exercise_hr_mult, 2), expected.get("hr_rise")),
        "SBP Rise Mult": (round(engine.exercise_sbp_mult, 2), expected.get("sbp_rise")),
        "Recovery Eff": (round(engine.recovery_efficiency, 2), expected.get("recov_eff"))
    }
    
    passed = True
    report = []
    for key, (actual, exp) in results.items():
        if exp is not None:
            # Handle small floating point differences in age/efficiency
            if abs(actual - exp) > 0.01:
                passed = False
                report.append(f"  FAILED {key}: Got {actual}, Expected {exp}")
            else:
                report.append(f"  PASSED {key}: {actual}")
    
    status = "[PASS]" if passed else "[FAIL]"
    print(f"{status} {name}")
    for line in report:
        print(line)
    return passed

def full_audit():
    print("=== KardiaTwin: EXHAUSTIVE CLINICAL AUDIT (V1.5) ===\n")
    all_passed = True
    
    # --- PHASE 1: RESTING OFFSETS ---
    all_passed &= test_config("MALE HEALTHY BASE", {"age": 25, "sex": "1"}, {"hr_offset": 0, "sbp_offset": 0})
    all_passed &= test_config("FEMALE HEALTHY BASE", {"age": 25, "sex": "0"}, {"hr_offset": 0, "sbp_offset": 0})
    
    all_passed &= test_config("SMOKER MALE REST", {"age": 25, "sex": "1", "smoking_status": "smoker"}, {"hr_offset": 8, "sbp_offset": 10})
    all_passed &= test_config("SMOKER FEMALE REST", {"age": 25, "sex": "0", "smoking_status": "smoker"}, {"hr_offset": 11, "sbp_offset": 10})
    
    all_passed &= test_config("DIABETES T1 FEMALE REST", {"age": 25, "sex": "0", "diabetes_history": "type_1"}, {"hr_offset": 10, "sbp_offset": 15})
    all_passed &= test_config("DIABETES T2 MALE REST", {"age": 25, "sex": "1", "diabetes_history": "type_2"}, {"hr_offset": 6, "sbp_offset": 10})
    
    # --- PHASE 2: EXERCISE MULTIPLIERS ---
    all_passed &= test_config("DIABETES T1 FEMALE RISE", {"age": 25, "sex": "0", "diabetes_history": "type_1"}, {"sbp_rise": 1.45})
    all_passed &= test_config("ATHLETE MALE RISE", {"age": 25, "sex": "1", "activity_level": "athlete"}, {"hr_rise": 0.80})
    all_passed &= test_config("PAD MALE SBP RISE", {"age": 45, "sex": "1", "pad_history": "pad"}, {"sbp_rise": 1.50})
    
    # --- PHASE 3: RECOVERY EFFICIENCY ---
    all_passed &= test_config("FEMALE BASE RECOV", {"age": 25, "sex": "0"}, {"recov_eff": 0.85})
    all_passed &= test_config("SMOKER FEMALE RECOV", {"age": 30, "sex": "0", "smoking_status": "smoker"}, {"recov_eff": round(0.85 * 0.70, 2)}) 
    all_passed &= test_config("ATHLETE MALE RECOV", {"age": 25, "sex": "1", "activity_level": "athlete"}, {"recov_eff": 2.0})
    all_passed &= test_config("PAD SENIOR MALE RECOV", {"age": 70, "sex": "1", "pad_history": "pad"}, {"recov_eff": round(0.42 * 0.70, 2)}) 
    
    # --- SECTION 4: BMI ---
    all_passed &= test_config("UNDERWEIGHT BMI", {"age": 30, "height": 180, "weight": 55}, {"hr_offset": 2.0, "sbp_offset": -5.0})
    all_passed &= test_config("OBESE MALE (BMI 32)", {"age": 30, "sex": "1", "height": 175, "weight": 98}, {"hr_offset": 8.0, "sbp_rise": 1.25})
    all_passed &= test_config("MORBID OBESE SBP OFFSET", {"age": 30, "sex": "1", "height": 170, "weight": 110}, {"sbp_offset": round((38.062 - 25) * 1.6, 1)})

    # --- SECTION 5: AGE DYNAMICS ---
    all_passed &= test_config("SENIOR FEMALE STIFFNESS", {"age": 68, "sex": "0"}, {"sbp_rise": 1.25})
    all_passed &= test_config("SENIOR MALE STIFFNESS", {"age": 68, "sex": "1"}, {"sbp_rise": 1.10})

    # --- NEW: ALCOHOL & ACTIVITY SYNERGY ---
    all_passed &= test_config("HEAVY ALCOHOL FEMALE REST", {"age": 30, "sex": "0", "alcohol_consumption": "heavy"}, {"hr_offset": 12.0, "sbp_offset": 8.0})
    all_passed &= test_config("SEDENTARY FEMALE RISE", {"age": 30, "sex": "0", "activity_level": "sedentary"}, {"sbp_rise": 1.25, "hr_rise": 1.25})
    
    # --- SENIOR CONSISTENCY (THE "WHOLE MATRIX" FIX) ---
    # Age 66 Athlete: 71 (Base) + 0 (Age Factor) - 15 (Athlete) = -15.0
    all_passed &= test_config("SENIOR ATHLETE REST (66yo)", {"age": 66, "sex": "1", "activity_level": "athlete"}, {"hr_offset": -15.0})

    # --- ULTIMATE STRESS TEST: MULTI-MORBIDITY COMPOUNDING ---
    # Male, Age 70, BMI 32, Smoker, PAD, T1 Diabetes
    # HR Offset: Age(+0.0) + Obese(+8) + Smoker(+8) + PAD(+5) + Diabetes(+8) = +29.0
    # SBP Offset: Age(+18) + BMI_Linear(+11.2) + Smoker(+10) + PAD(+15) + Diabetes(+12) = +66.2
    # SBP Rise Mult: Senior(1.10) * Obese(1.25) * PAD(1.50) * T1_Diabetes(1.25) = 2.578
    all_passed &= test_config("ULTIMATE STRESS TEST (COMPOUNDING)", 
        {"age": 70, "sex": "1", "height": 175, "weight": 98, "smoking_status": "smoker", "pad_history": "pad", "diabetes_history": "type_1"}, 
        {"hr_offset": 29.0, "sbp_offset": 66.2, "sbp_rise": 2.58}
    )

    if all_passed:
        print("\n[CONCLUSION] 100% Alignment with Unified Clinical Matrix. Scientific Integrity Confirmed.")
    else:
        print("\n[CONCLUSION] Mismatches detected. Engine requires calibration.")

if __name__ == "__main__":
    full_audit()
