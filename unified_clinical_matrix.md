# Unified Clinical Matrix: Complete Phase-Wise Physiological Response

This matrix provides the specific physiological impact of every modifier level—including Healthy / Normal baselines—across all three phases of simulation.

---

## Phase 1: Resting Baseline (The Initial State)

| Factor | Level | Male Logic | Female Logic | Clinical Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Healthy Base** | Standard | 115 SBP / 71 HR | **110 SBP / 78 HR** | Standard baseline. |
| **Smoking** | **Non-Smoker** | 0 Offset | 0 Offset | Reference. |
| | **Ex-Smoker** | +2 HR | +4 HR | Residual adrenergic tone. |
| | **Smoker** | +8 HR (+10 SBP) | **+11 HR** (+10 SBP) | Acute nicotine surge. |
| **Diabetes** | **None** | 0 Offset | 0 Offset | Reference. |
| | **Type 1** | +12 SBP / +8 HR | +15 SBP / +10 HR | High baseline stiffness. |
| | **Type 2** | +10 SBP / +6 HR | +12 SBP / +9 HR | Metabolic vascular tax. |
| **Alcohol** | **None** | 0 Offset | 0 Offset | Reference. |
| | **Moderate** | +2 HR / +2 SBP | +4 HR / +2 SBP | Mild sympathetic trigger. |
| | **Heavy** | +8 HR / +8 SBP | **+12 HR** / +8 SBP | Chronic catecholamine surge. |
| **Activity** | **Active (Base)**| 0 Offset | 0 Offset | Reference. |
| | **Athlete** | -15 HR / -5 SBP | -12 HR / -5 SBP | Athletic Bradycardia. |
| | **Sedentary** | +10 HR / +5 SBP | +12 HR / +8 SBP | Deconditioning offset. |
| **PAD** | **No PAD** | 0 Offset | 0 Offset | Reference. |
| | **PAD** | +15 SBP / +5 HR | +15 SBP / +5 HR | Ischemic sympathetic rest. |

---

## Phase 2: Exercise Phase (The Stress Curve)

| Factor | Level | Male Logic | Female Logic | Metric Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Max Cap** | Floor/Ceiling | 220 - Age | **206 - (0.88 * Age)** | HR Safety Limit. |
| **Smoking** | **Healthy (None)** | 1.0x | 1.0x | No impact on rise. |
| | **Ex-Smoker** | 0.97x | 0.92x | HR Rise rate modifier. |
| | **Smoker** | 0.90x | 0.82x | HR Rise rate modifier. |
| **Diabetes** | **None** | 1.0x | 1.0x | No impact on SBP. |
| | **Type 1** | 1.25x | 1.45x | SBP Rise Multiplier. |
| | **Type 2** | 1.15x | 1.35x | SBP Rise Multiplier. |
| **Alcohol** | **None** | 1.0x | 1.0x | No impact on SBP. |
| | **Moderate** | 1.05x | 1.05x | SBP Rise Multiplier. |
| | **Heavy** | 1.15x | 1.25x | SBP Rise Multiplier. |
| **Activity** | **Active (Base)** | 1.0x | 1.0x | Standard HR rise. |
| | **Athlete** | 0.80x | 0.85x | HR Rise rate modifier. |
| | **Sedentary** | 1.20x HR / 1.15x | 1.25x HR / 1.25x | SBP + HR Multiplier. |
| **PAD** | **No PAD** | 1.0x | 1.0x | Standard response. |
| | **PAD** | 1.20x HR / 1.50x | 1.35x HR / 1.50x | EPR (Pressor Reflex). |
| **Age 65+** | **Senior** | 1.10x SBP | **1.25x SBP** | Estrogen-loss stiffness. |

---

## Phase 3: Recovery Phase (The Cooldown)

| Factor | Level | Male Logic | Female Logic | Metric Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Base Lag** | Standard | 1.00x | **0.85x** | Default female lag. |
| **Smoking** | **Healthy (None)** | 1.0x | 1.0x | Standard recovery. |
| | **Ex-Smoker** | 0.95x | 0.90x | Efficiency Multiplier. |
| | **Smoker** | 0.80x | 0.70x | Efficiency Multiplier. |
| **Diabetes** | **None** | 1.0x | 1.0x | Standard recovery. |
| | **Type 1** | 0.70x | 0.65x | Efficiency Multiplier. |
| | **Type 2** | 0.80x | 0.75x | Efficiency Multiplier. |
| **Alcohol** | **None** | 1.0x | 1.0x | Standard recovery. |
| | **Moderate** | 0.98x | 0.95x | Efficiency Multiplier. |
| | **Heavy** | 0.80x | 0.75x | Efficiency Multiplier. |
| **Activity** | **Active (Base)** | 1.0x | 1.0x | Standard recovery. |
| | **Athlete** | 2.0x | 1.7x | Recovery Velocity. |
| | **Sedentary** | 0.85x | 0.80x | Efficiency Multiplier. |
| **PAD** | **No PAD** | 1.0x | 1.0x | Standard recovery. |
| | **PAD (18-64)** | 0.50x | 0.40x | Efficiency Multiplier. |
| | **PAD (Senior)** | 0.42x | **0.40x** | Combined age + pathology lag.

---

## Section 4: BMI Influence (The "Tissue Tax")
*Dynamic modifiers based on clinical BMI staging (kg/m²).*

| BMI Tier | Classification | Resting SBP Offset | Resting HR Offset | Exercise SBP Mult | Recovery Efficiency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **< 18.5** | **Underweight** | -5.0 mmHg | +2.0 BPM | 1.0x | 1.0x |
| **18.5 - 24.9**| **Healthy** | 0.0 (Ref) | 0.0 (Ref) | 1.0x | 1.0x |
| **25.0 - 29.9**| **Overweight**| +1.6 / pt > 25 | 0.0 | 1.10x | 0.90x |
| **30.0 - 34.9**| **Obese** | +1.6 / pt > 25 | +8.0 BPM | 1.25x | 0.80x |
| **35.0+** | **Morbidly Obese**| +1.6 / pt > 25 | +12.0 BPM | 1.40x | 0.60x |

---

*Last Updated: March 2026*


## Section 5: Age Dynamics (The Aging Curve)
*Annualized physiological decay after the age of 40.*

### Age-Logic Tiers
| Age Range | Classification | Logic Type | Key Physiological Impact |
| :--- | :--- | :--- | :--- |
| **18 - 40** | **Baseline** | Reference | 0.0 Offset. Maximum elastic compliance. |
| **41 - 64** | **Decay** | Linear | +0.6 mmHg SBP / -1% HRR per year. |
| **65 - 100+** | **Senior Pivot** | Compound | Cumulative decay + **Mandatory Stiffness Multiplier**. |

### Implementation Formulas
| Phase | Modifier | Male Logic | Female Logic | Clinical Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1 (Rest)** | **Post-40 Offset** | +0.6 mmHg SBP / year | +0.6 mmHg SBP / year | Arterial Compliance Loss. |
| **Phase 2 (Stress)** | **Senior Pivot (65+)**| 1.10x SBP Rise | **1.25x SBP Rise** | Post-menopausal Stiffness. |
| **Phase 3 (Recov)** | **Post-40 Lag** | -1.0% Efficiency / year | -1.0% Efficiency / year | Autonomic Blunting. |
