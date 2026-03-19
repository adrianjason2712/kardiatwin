import sys
import os

# Add the backend directory to the path so we can import the engine
sys.path.append(os.getcwd())

from main import PhysiologySimulationEngine

def test_scenario(name, profile):
    print(f"\n--- Testing Scenario: {name} ---")
    engine = PhysiologySimulationEngine()
    
    # Apply profile
    engine.age = profile['age']
    engine.sex = profile['sex']
    engine.height = profile.get('height', 175)
    engine.weight = profile.get('weight', 75)
    engine.activity_level = profile.get('activity_level', 'active')
    engine.smoking_status = profile.get('smoking_status', 'non_smoker')
    engine.diabetes_history = profile.get('diabetes_history', 'none')
    engine.alcohol_consumption = profile.get('alcohol_consumption', 'none')
    engine.pad_history = profile.get('pad_history', 'no_pad')
    
    # Calibrate
    engine.apply_modifiers()
    
    print(f"Profile: Age={engine.age}, Sex={'M' if engine.sex=='1' else 'F'}, BMI={engine.bmi:.1f}")
    print(f"Resting Vitals: {engine.baseline_hr:.1f} BPM / {engine.baseline_sbp:.1f} mmHg")
    print(f"Max HR (Target): {engine.max_hr:.1f} BPM")
    print(f"Exercise HR Multiplier: {engine.exercise_hr_mult:.2f}x")
    print(f"Exercise SBP Multiplier: {engine.exercise_sbp_mult:.2f}x")
    print(f"Recovery Efficiency: {engine.recovery_efficiency:.2f}x")
    print(f"Recovery Rate: {engine.recovery_rate_per_min:.1f} BPM/min")

def run_all_tests():
    # 1. Underweight Tier
    test_scenario("Underweight Test", {
        'age': 20, 'sex': "0", 'height': 170, 'weight': 51, 
        'activity_level': 'active'
    })
    
    # 2. Overweight Tier
    test_scenario("Overweight Test", {
        'age': 35, 'sex': "1", 'height': 180, 'weight': 90, 
        'activity_level': 'active'
    })
    
    # 3. Morbidly Obese Tier (Compounded with Age)
    test_scenario("Morbidly Obese Senior", {
        'age': 45, 'sex': "0", 'height': 165, 'weight': 101, 
        'activity_level': 'active'
    })

    # 4. Vascular Crisis (The Ultimate Stress Test)
    test_scenario("Vascular Crisis", {
        'age': 60, 'sex': "1", 'height': 175, 'weight': 105, 
        'activity_level': 'sedentary', 'diabetes_history': 'type_2',
        'pad_history': 'pad', 'smoking_status': 'smoker',
        'alcohol_consumption': 'heavy'
    })

if __name__ == "__main__":
    run_all_tests()
