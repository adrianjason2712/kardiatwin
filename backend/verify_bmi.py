import sys
import os

# Add the backend directory to the path so we can import the engine
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from main import PhysiologySimulationEngine

def test_bmi_logic():
    print("--- BMI Physiological Logic Test ---")
    
    # 1. Normal Patient (Reference)
    # Height: 175cm, Weight: 70kg -> BMI: 22.86
    engine_normal = PhysiologySimulationEngine()
    engine_normal.sex = "1"
    engine_normal.age = 40
    engine_normal.height = 175.0
    engine_normal.weight = 70.0
    engine_normal.apply_modifiers()
    
    print(f"Normal Patient (BMI: {engine_normal.bmi:.2f}):")
    print(f"  SBP Offset: {engine_normal.sbp_offset}")
    print(f"  Exercise SBP Multiplier: {engine_normal.exercise_sbp_mult}")
    print(f"  Recovery Efficiency: {engine_normal.recovery_efficiency}")
    
    # 2. Obese Patient (BMI > 30)
    # Height: 175cm, Weight: 100kg -> BMI: 32.65
    engine_obese = PhysiologySimulationEngine()
    engine_obese.sex = "1"
    engine_obese.age = 40
    engine_obese.height = 175.0
    engine_obese.weight = 100.0
    engine_obese.apply_modifiers()
    
    print(f"\nObese Patient (BMI: {engine_obese.bmi:.2f}):")
    print(f"  SBP Offset: {engine_obese.sbp_offset:.2f} (Expected: (32.65-25)*1.6 = 12.24)")
    print(f"  Exercise SBP Multiplier: {engine_obese.exercise_sbp_mult} (Expected: 1.25)")
    print(f"  Recovery Efficiency: {engine_obese.recovery_efficiency:.2f} (Expected: 1.0 * 0.8 = 0.8)")

    # 3. Female Obese Patient (Additive effect check)
    engine_female_obese = PhysiologySimulationEngine()
    engine_female_obese.sex = "0"
    engine_female_obese.age = 40
    engine_female_obese.height = 160.0
    engine_female_obese.weight = 90.0
    engine_female_obese.apply_modifiers()
    
    print(f"\nFemale Obese Patient (BMI: {engine_female_obese.bmi:.2f}):")
    print(f"  SBP Offset: {engine_female_obese.sbp_offset:.2f}")
    print(f"  Recovery Efficiency: {engine_female_obese.recovery_efficiency:.2f} (Expected: 0.85 * 0.8 = 0.68)")

if __name__ == "__main__":
    test_bmi_logic()
