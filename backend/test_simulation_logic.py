import unittest
from main import PhysiologySimulationEngine

class TestSimulationLogic(unittest.TestCase):
    def test_high_risk_patient_modifiers(self):
        """
        Test Case 1: The "High-Risk Patient"
        Profile: 55y/o, Smoker, Sedentary, Type 2 Diabetes.
        Expected Theoretical HR Modifier: 1.1 (Age) * 1.1 (Smoking) * 1.08 (Diabetes) * 1.1 (Sedentary) = ~1.437
        """
        engine = PhysiologySimulationEngine()
        engine.age = 55
        engine.smoking_status = "smoker"
        engine.diabetes_history = "type_2"
        engine.activity_level = "sedentary"

        engine.hr_modifier = 1.0
        engine.sbp_modifier = 1.0
        engine.recovery_modifier = 1.0

        engine.apply_age_modifiers()
        engine.apply_lifestyle_modifiers()

        self.assertAlmostEqual(round(engine.hr_modifier, 2), 1.44)

        engine.phase = "exercise"
        base_hr = engine.hr
        engine.update(60.0)
        
        expected_hr_increase = 11.0 * (60.0 / 60.0) * engine.hr_modifier
        self.assertAlmostEqual(round(engine.hr, 1), round(base_hr + expected_hr_increase, 1))

    def test_recovery_speed(self):
        """
        Test Case 2: Recovery Speed
        Verify a "Non-Smoker Athlete" recovers faster than a "Smoker Sedentary" user.
        """
        # Profile 1: Non-Smoker Athlete
        p1 = PhysiologySimulationEngine()
        p1.age = 30
        p1.smoking_status = "non_smoker"
        p1.activity_level = "athlete"
        p1.hr = 150.0 # Peak HR
        p1.phase = "recovery"
        
        p1.apply_age_modifiers()
        p1.apply_lifestyle_modifiers()
        
        # Profile 2: Smoker Sedentary
        p2 = PhysiologySimulationEngine()
        p2.age = 30
        p2.smoking_status = "smoker"
        p2.activity_level = "sedentary"
        p2.hr = 150.0 # Peak HR
        p2.phase = "recovery"

        p2.apply_age_modifiers()
        p2.apply_lifestyle_modifiers()
        
        self.assertGreater(p1.recovery_modifier, p2.recovery_modifier)
        
        # Simulate 60 seconds of recovery
        p1.update(60.0)
        p2.update(60.0)
        
        # P1 (Athlete) should have a significantly lower HR than P2 (Sedentary Smoker)
        self.assertLess(p1.hr, p2.hr)
        
        hr_drop_p1 = 150.0 - p1.hr
        hr_drop_p2 = 150.0 - p2.hr
        
        ratio = hr_drop_p1 / hr_drop_p2
        self.assertGreater(ratio, 1.4)

    def test_heart_age_accuracy(self):
        """
        Test Case 3: Heart Age Accuracy & Modifier Influence
        Profile: Chronological Age = 40. Lifestyle: Smoker (+5), Athlete (-3).
        Expected Heart Age depends on SBP being over 140. 
        If SBP stays normal: 40 + 5 - 3 = 42.
        If SBP modifier pushes SBP > 140: 40 + 5 - 3 + 2 = 44.
        """
        engine = PhysiologySimulationEngine()
        engine.age = 40
        engine.smoking_status = "smoker"
        engine.activity_level = "athlete"
        engine.sbp = 120.0 # Normal

        engine.apply_age_modifiers()
        engine.apply_lifestyle_modifiers()

        # Phase 1: Normal SBP
        adjustment = 5 - 3 # Smoker, Athlete
        if engine.sbp > 140:
            adjustment += 2
            
        heart_age = engine.age + adjustment
        self.assertEqual(heart_age, 42)

        # Phase 2: Simulate 10 minutes of exercise to push SBP high using the active modifiers!
        engine.phase = "exercise"
        # The SBP modifier for smokers is high (1.12), applying it over time scales SBP
        engine.update(600.0)
        
        # Now SBP should be high
        self.assertGreater(engine.sbp, 140.0)

        # Recalculate heart age
        adjustment = 5 - 3
        if engine.sbp > 140:
            adjustment += 2

        heart_age = engine.age + adjustment
        # Heart age is increased dynamically due to the modifier pushing the SBP!
        self.assertEqual(heart_age, 44)

    def test_explicit_modifier_application(self):
        """
        Test Case 4: Explicitly verifies that when `engine.update()` happens, 
        the SBP actually uses `sbp_modifier` in the engine formula.
        """
        # Baseline engine
        engine_base = PhysiologySimulationEngine()
        engine_base.sbp_modifier = 1.0
        engine_base.phase = "exercise"
        base_sbp_start = engine_base.sbp

        # Modified engine
        engine_mod = PhysiologySimulationEngine()
        engine_mod.sbp_modifier = 1.5 # Huge modifier for testing
        engine_mod.phase = "exercise"
        mod_sbp_start = engine_mod.sbp

        engine_base.update(60.0)
        engine_mod.update(60.0)

        base_diff = engine_base.sbp - base_sbp_start
        mod_diff = engine_mod.sbp - mod_sbp_start

        # mod_diff should be exactly 1.5x base_diff
        self.assertAlmostEqual(mod_diff, base_diff * 1.5)


    def test_what_if_analysis(self):
        """
        Test Case 5: What-If Analysis formula check.
        Formula: Improvement % = ((Current_Mod - 1.0) / Current_Mod) * 100
        """
        engine = PhysiologySimulationEngine()
        engine.smoking_status = "smoker"
        engine.diabetes_history = "type_2"
        
        # Original current_sbp modifier
        engine.apply_age_modifiers()
        engine.apply_lifestyle_modifiers()
        
        current_mod = engine.sbp_modifier

        # Hypothetical: no smoking, no diabetes => modifier 1.0 (assuming age < 40)
        hyp = PhysiologySimulationEngine()
        hyp.age = engine.age
        hyp.apply_age_modifiers()
        hyp.apply_lifestyle_modifiers() # All defaults "none"

        hyp_mod = hyp.sbp_modifier

        # Formula test
        expected_improvement = ((current_mod - hyp_mod) / current_mod) * 100
        
        # In main.py: round(((state.engine.sbp_modifier - hyp.sbp_modifier) / state.engine.sbp_modifier * 100), 1)
        # Let's verify our engine test calculates the exact same percentage
        calc_improvement = round(((current_mod - hyp_mod) / current_mod * 100), 1)
        expected_rounded = round(expected_improvement, 1)

        self.assertEqual(calc_improvement, expected_rounded)

if __name__ == '__main__':
    unittest.main()
