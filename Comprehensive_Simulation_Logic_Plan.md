# KardiaTwin: Comprehensive Simulation Logic & Testing Plan

This document serves as the master reference for the physiological simulation engine, including lifestyle modifiers, advanced health analysis, and verification procedures.

---

## 🧠 1. Core Physiology Engine Logic
The `PhysiologySimulationEngine` in `backend/main.py` drives the simulation across three phases: **Rest → Exercise → Recovery**.

### A. Phase Dynamics
- **Rest**: Vitals oscillate around a personalized baseline.
- **Exercise**: HR and SBP increase linearly based on the workload level of the current protocol stage.
- **Recovery**: Vitals return to baseline using a decay function influenced by the `recovery_modifier`.

### B. Physiological Modifiers (Multipliers)
Modifiers are cumulative and affect the *rate of change* for vitals.

| Factor | SBP Modifier | HR Modifier | Recovery Modifier |
| :--- | :--- | :--- | :--- |
| **Smoker** | 1.12x | 1.1x | 0.85x |
| **Ex-Smoker** | 1.05x | 1.02x | 1.0x |
| **Type 1 Diabetes** | 1.15x | 1.12x | 0.8x |
| **Type 2 Diabetes** | 1.1x | 1.08x | 0.85x |
| **Heavy Alcohol** | 1.08x | 1.0x | 0.9x |
| **Athlete** | 1.0x | 0.85x | 1.2x |
| **Sedentary** | 1.0x | 1.1x | 0.9x |

---

## ❤️ 2. Advanced Health Analysis

### A. Heart Age Calculation (`biological_age`)
Calculates "Biological Age" by applying point-based adjustments to chronological age:
- **Smoking**: Smoker (+5) / Ex-Smoker (+2)
- **Diabetes**: Type 1 (+3) / Type 2 (+2)
- **Activity**: Athlete (-3) / Sedentary (+4)
- **High BP**: >140 SBP (+2)

### B. What-If Scenario Analysis
Predicts improvement in **Systolic Blood Pressure (SBP)** by comparing the current modifier against a hypothetical baseline (1.0).
- **Formula**: `Improvement % = ((Current_Mod - 1.0) / Current_Mod) * 100`

---

## 🧪 3. Verification & Testing Procedures

### Test Case 1: The "High-Risk Patient"
- **Profile**: 55y/o, Smoker, Sedentary, Type 2 Diabetes.
- **Expected Theoretical HR Modifier**: `1.1 (Age) * 1.1 (Smoking) * 1.08 (Diabetes) * 1.1 (Sedentary) = 1.43`
- **Verification**: Ensure peak HR in the Exercise phase reaches ~1.43x the baseline rate faster than a healthy peer.

### Test Case 2: Recovery Speed
- **Profile**: Verify a "Non-Smoker Athlete" returns to baseline HR 40% faster than a "Smoker Sedentary" user.
- **Metric**: Time from Exercise End to HR < 100 BPM.

### Test Case 3: Heart Age Accuracy
- **Setup**: Chronological Age = 40. Lifestyle: Smoker (+5), Athlete (-3), Normal BP.
- **Expected Heart Age**: `40 + 5 - 3 = 42`.
- **Status**: Should label as "Good" (Threshold: poor > 5, excellent < -2).

---

## 🚀 4. Implementation Guidelines
- **ML Integration**: Real-time risk predictions (`predict_risk`) must receive these modified vitals to accurately reflect lifestyle risk.
- **Alert System**: `adaptive_thresholds` must decrease for high-risk profiles to trigger early clinical warnings.

*This document is intended for maintainers and developers. Last Updated: March 2026.*
