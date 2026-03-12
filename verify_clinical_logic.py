import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

from backend.main import PhysiologySimulationEngine

def run_vignette(name, age, sex, lifestyle):
    print(f"\n--- Vignette: {name} ---")
    engine = PhysiologySimulationEngine()
    engine.age = age
    engine.sex = sex
    engine.smoking_status = lifestyle.get('smoking', 'non_smoker')
    engine.diabetes_history = lifestyle.get('diabetes', 'none')
    engine.alcohol_consumption = lifestyle.get('alcohol', 'none')
    engine.activity_level = lifestyle.get('activity', 'active')
    
    engine.apply_modifiers()
    
    print(f"Demographics: {age}y, {'Male' if sex == '1' else 'Female'}")
    print(f"Lifestyle: {lifestyle}")
    print(f"Resting Baseline: {engine.baseline_hr:.1f} HR / {engine.baseline_sbp:.1f} SBP")
    print(f"Max HR (Ceiling): {engine.max_hr:.1f} ({'Gulati' if sex == '0' else 'Fox'})")
    print(f"Exercise Multipliers: HR={engine.hr_increase_rate_per_min/11.0:.2f}x, SBP={engine.sbp_increase_per_level/12.0:.2f}x")
    print(f"Recovery Efficiency: {engine.recovery_efficiency:.2f}")

# 1. Healthy Male vs Healthy Female
run_vignette("Healthy Male (40y)", 40, "1", {})
run_vignette("Healthy Female (40y)", 40, "0", {})

# 2. Senior (70y) Male vs Senior (70y) Female
run_vignette("Senior Male (70y)", 70, "1", {})
run_vignette("Senior Female (70y)", 70, "0", {})

# 3. High Risk Male vs High Risk Female
lifestyle = {'smoking': 'smoker', 'diabetes': 'type_1', 'alcohol': 'heavy', 'activity': 'sedentary'}
run_vignette("High Risk Male (60y)", 60, "1", lifestyle)
run_vignette("High Risk Female (60y)", 60, "0", lifestyle)

# 4. Athlete Male vs Athlete Female
lifestyle_athlete = {'activity': 'athlete'}
run_vignette("Athlete Male (30y)", 30, "1", lifestyle_athlete)
run_vignette("Athlete Female (30y)", 30, "0", lifestyle_athlete)
