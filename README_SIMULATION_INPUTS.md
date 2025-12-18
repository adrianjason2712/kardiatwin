# KardiaTwin Simulation Inputs - How Each Parameter Affects Your Results

## Overview

KardiaTwin is a personalized cardiac stress test simulator that tailors your exercise protocol based on your individual characteristics. This document explains exactly how each input parameter affects the simulation and what happens during testing.

---

## Table of Contents

1. [Basic Information](#basic-information)
   - [Age](#age)
   - [Gender](#gender)
   - [Chest Pain Type](#chest-pain-type)
   - [Exercise Protocol](#exercise-protocol)

2. [Lifestyle & Medical History](#lifestyle--medical-history)
   - [Smoking Status](#smoking-status)
   - [Diabetes History](#diabetes-history)
   - [Alcohol Consumption](#alcohol-consumption)
   - [Activity Level](#activity-level)

3. [How Modifiers Work](#how-modifiers-work)

4. [Understanding Your Results](#understanding-your-results)

---

## Basic Information

### Age

**Range:** 18-100 years
**How to Enter:** Use the age slider to select your exact age

#### What Age Affects:

1. **Heart Rate Response During Exercise**
   - Younger (< 30): Your heart responds quickly and efficiently to exercise
     - Heart rate increases smoothly toward target (85-95% of max)
     - Quick, responsive adaptation

   - Middle-aged (40-50): Moderate response, slight delay
     - Heart rate response is normal but slightly slower
     - Takes longer to reach target HR

   - Older (60-70+): Significant blunting
     - Your heart responds more slowly to exercise demands
     - May not reach target heart rates as quickly
     - This is physiologically normal with aging

2. **Heart Rate Recovery (After Exercise)**
   - **Young (< 30):** Excellent recovery (1.2x multiplier)
     - Heart rate drops ~25-30 BPM in first minute
     - Returns to baseline quickly

   - **Middle-aged (40-50):** Normal recovery (1.0x)
     - Heart rate drops ~20 BPM in first minute
     - Steady descent to baseline

   - **Older (60-70+):** Slower recovery (0.75-0.85x)
     - Heart rate drops only ~15-18 BPM in first minute
     - Takes longer to return to baseline
     - May remain elevated after exercise ends

3. **Blood Pressure Response**
   - **Younger:** Normal BP increase with exercise
   - **Older:** Exaggerated BP increase (older patients show 7-10% higher BP response)
     - Systolic BP rises more with each workload level
     - This is expected in aging cardiovascular systems

4. **Maximum Workload Capacity**
   - **Younger (< 30):** Full capacity + 10% (can handle intense exercise)
   - **Age 40-60:** Slight reduction (-3% to -10%)
   - **Older (60-70):** Reduced capacity (-20%)
   - **Older Senior (70+):** Significantly reduced (-35%)

5. **Protocol Selection (Auto-Default)**
   - **Age < 60:** Defaults to "Standard Bruce"
     - 3-minute stages, higher intensity
     - Better for assessing full exercise capacity

   - **Age ≥ 60:** Defaults to "Modified Bruce"
     - 5-minute stages, gentler progression
     - Safer, more appropriate for older patients
     - Medical standard recommendation
     - *You can override this choice if needed*

6. **Heart Age Calculation**
   - Your "biological heart age" is calculated based on your actual age plus/minus adjustments for other factors
   - Formula: Base age + lifestyle adjustments (smoking, diabetes, BP, etc.)
   - Shows if your heart is aging normally, faster, or slower than chronological age

#### Example Scenarios:

**Scenario 1: Patient Age 28**
```
✓ Standard Bruce auto-selected (3-min stages)
✓ Heart rate response: Fast and efficient
✓ Recovery: Excellent (25-30 BPM drop in 1st minute)
✓ Workload capacity: 110% (can handle high intensity)
✓ Expected max HR: ~192 BPM (220-28)
```

**Scenario 2: Patient Age 65**
```
✓ Modified Bruce auto-selected (5-min stages)
✓ Heart rate response: Slower, more blunted
✓ Recovery: Slower (15-18 BPM drop in 1st minute)
✓ Workload capacity: 80% (limited by age)
✓ Expected max HR: ~155 BPM (220-65)
✓ BP rises more with each stage
```

---

### Gender

**Options:** Male / Female
**Impact Level:** Moderate (affects baseline vitals and modifiers)

#### What Gender Affects:

1. **Baseline Heart Rate**
   - **Male:** Typically slightly lower resting HR
   - **Female:** Typically slightly higher resting HR
   - Difference: Usually 5-10 BPM

2. **Blood Pressure Response**
   - **Male:** Higher average systolic BP
   - **Female:** Lower average systolic BP (pre-menopausal)
   - Note: Used in ML model for risk prediction

3. **Heart Rate Response to Exercise**
   - Used in cardiovascular risk assessment
   - Affects ML model predictions

4. **Risk Prediction**
   - Part of the 13-feature input to heart disease risk model
   - Helps predict "High Risk" vs "Low Risk" status

#### Clinical Significance:
- Gender is one of many factors in cardiovascular disease risk
- Affects both baseline measurements and exercise response interpretation
- Important for personalized protocol recommendations

---

### Chest Pain Type

**Options:**
- Typical Angina
- Atypical Angina
- Non-Anginal
- Asymptomatic

**Impact Level:** High (affects risk prediction and recommendations)

#### What Each Type Means:

1. **Typical Angina**
   - Classic chest pain during exercise or stress
   - Pressure or tightness in chest
   - **Simulation Impact:**
     - Higher baseline risk score
     - More conservative exercise recommendations
     - Enhanced monitoring suggested

2. **Atypical Angina**
   - Chest discomfort that doesn't fit typical pattern
   - May be sharp, brief, or in unusual location
   - **Simulation Impact:**
     - Moderate baseline risk
     - Recommendations based on actual exercise results
     - Careful monitoring during test

3. **Non-Anginal**
   - Chest pain not related to cardiac issues
   - Musculoskeletal, GI, or other cause
   - **Simulation Impact:**
     - Lower baseline risk
     - Focus on exercise tolerance assessment
     - Standard monitoring

4. **Asymptomatic**
   - No chest pain or discomfort
   - **Simulation Impact:**
     - Baseline risk depends on other factors
     - Good candidate for standard exercise testing
     - Normal protocol can be used

#### How It Affects Your Test:

```
Chest Pain Type → ML Model Input → Risk Classification
                                  ↓
                          "High Risk" or "Low Risk"
                                  ↓
                      Affects exercise recommendations
                           & monitoring level
```

#### Exercise Recommendations Change Based on Type:

| Chest Pain Type | Brisk Walking | Swimming | Cycling | Sports |
|-----------------|---------------|----------|---------|--------|
| Typical Angina | Caution | Caution | Caution | Avoid |
| Atypical Angina | Recommended | Recommended | Caution | Caution |
| Non-Anginal | Recommended | Recommended | Recommended | Caution |
| Asymptomatic | Recommended | Recommended | Recommended | Varies |

---

### Exercise Protocol

**Options:**
- **Standard Bruce** (3-minute stages, higher intensity)
- **Modified Bruce** (5-minute stages, gentler progression)

**Auto-Default:** Age < 60 → Standard | Age ≥ 60 → Modified
**Overridable:** Yes, you can choose either protocol
**Impact Level:** Critical (determines entire exercise progression)

#### Protocol Comparison:

**Standard Bruce Protocol**
```
Stage 1: 3 minutes @ Workload 1.0 (Target HR: 85% max)
Stage 2: 3 minutes @ Workload 2.0 (Target HR: 90% max)
Stage 3: 3 minutes @ Workload 3.0 (Target HR: 95% max)
────────────────────────────────────────────────
Total Exercise: 9 minutes
Intensity: Higher
Best for: Younger, fitter patients
Risk: Higher intensity demands
```

**Modified Bruce Protocol**
```
Stage 1: 5 minutes @ Workload 0.5 (Target HR: 70% max)
Stage 2: 5 minutes @ Workload 1.0 (Target HR: 80% max)
Stage 3: 5 minutes @ Workload 1.5 (Target HR: 85% max)
Stage 4: 5 minutes @ Workload 2.0 (Target HR: 90% max)
────────────────────────────────────────────────
Total Exercise: 20 minutes
Intensity: Lower with gradual progression
Best for: Older, frailer patients
Risk: Safer with easier early stages
```

#### Why the Difference Matters:

1. **Workload Level**
   - Standard Bruce jumps to higher intensity faster
   - Modified Bruce has gentler progression
   - Your simulated vitals respond differently

2. **Stage Duration**
   - Longer stages (5 min vs 3 min) allow body to adapt
   - More time to reach target HR
   - Better for patients with slower HR response

3. **Peak Intensity**
   - Standard Bruce: 3.0 METs (metabolic equivalents)
   - Modified Bruce: 2.0 METs
   - Standard is more demanding

4. **Time to Max HR**
   - Standard: Can reach max HR in ~6-9 minutes
   - Modified: Takes longer, reaches lower max
   - Affects recovery monitoring

#### When to Choose Each:

**Choose Standard Bruce if:**
- Age < 50 and good fitness
- Excellent exercise capacity
- No significant health limitations
- Want to assess maximum capacity
- Faster protocol preferred

**Choose Modified Bruce if:**
- Age ≥ 60 (recommended standard)
- Limited exercise capacity
- Recent illness or deconditioning
- Cardiovascular disease history
- Prefer safer progression
- Want longer exercise duration

#### Impact on Your Simulation Results:

```
Standard Bruce:
├─ Faster HR increase
├─ Higher peak HR reached
├─ Shorter total duration
└─ More intense exercise

Modified Bruce:
├─ Slower, steadier HR increase
├─ Lower peak HR (but still significant)
├─ Longer total duration
└─ Easier progression
```

---

## Lifestyle & Medical History

### Smoking Status

**Options:**
- Non-Smoker
- Ex-Smoker
- Smoker (Current)

**Impact Level:** Very High (affects nearly all physiological responses)

#### How Smoking Affects Your Simulation:

1. **Current Smoker**
   ```
   ✗ Blood Pressure: +12% increase (higher resting & exercise BP)
   ✗ Heart Rate Response: +10% faster HR increase (cardiac stress)
   ✗ Recovery: -35% slower (only 65% of normal recovery rate)
   ✗ Workload Capacity: -15% reduced (quicker fatigue)
   ✗ ST Depression: May increase faster (ischemia risk)
   ✗ Oxygen Delivery: Impaired due to carboxyhemoglobin
   ```

   **In Your Test:**
   - Heart rate climbs more than expected
   - Blood pressure rises significantly
   - Fatigue comes earlier
   - Recovery takes much longer (HR stays elevated)
   - More likely to show "High Risk" prediction

2. **Ex-Smoker** (quit smoking)
   ```
   ✓ Blood Pressure: +3% (minimal increase)
   ✓ Heart Rate: Normal response
   ✓ Recovery: -5% slightly slower (still mostly recovered)
   ✓ Workload Capacity: -5% minimal reduction
   ```

   **In Your Test:**
   - Mostly normal responses
   - Slight residual effects from smoking history
   - Recovery nearly normal
   - Better outcomes than current smokers

3. **Non-Smoker**
   ```
   ✓ No smoking penalties
   ✓ Normal BP and HR response
   ✓ Excellent oxygen delivery
   ✓ Normal recovery
   ```

   **In Your Test:**
   - Baseline physiological responses
   - Normal oxygen utilization
   - Standard recovery pattern

#### Real-World Impact:

```
Exercise Test Results: 50-year-old male, Standard Bruce

Scenario 1: Non-Smoker
├─ Rest: HR 70, BP 120/75
├─ Stage 2: HR 140, BP 150/90
├─ Peak: HR 165, BP 165/100
└─ Recovery (1 min): HR 145 ✓

Scenario 2: Ex-Smoker (quit 5 years ago)
├─ Rest: HR 72, BP 122/76
├─ Stage 2: HR 142, BP 153/92
├─ Peak: HR 165, BP 167/101
└─ Recovery (1 min): HR 144 ✓

Scenario 3: Current Smoker
├─ Rest: HR 75, BP 134/82
├─ Stage 2: HR 151, BP 168/100
├─ Peak: HR 175, BP 183/108
└─ Recovery (1 min): HR 160 ✗ (Poor recovery)
```

#### Recommendations:

- **Smokers:** Consider quitting - dramatic health benefits within months
- **Ex-smokers:** Continued improvement over years
- **Non-smokers:** Maintain healthy lifestyle

---

### Diabetes History

**Options:**
- None
- Type 1 Diabetes
- Type 2 Diabetes

**Impact Level:** Very High (affects cardiac autonomy and recovery)

#### How Diabetes Affects Your Simulation:

1. **No Diabetes**
   ```
   ✓ Normal HR response to exercise
   ✓ Normal recovery rate
   ✓ Normal blood pressure control
   ✓ Standard ischemia risk
   ```

2. **Type 1 Diabetes**
   ```
   ✗ Blood Pressure: +5% higher baseline
   ✗ Heart Rate Response: -15% blunted (autonomic neuropathy)
   ✗ Recovery: -25% slower
   ✗ Silent Ischemia: Enabled (pain-free ischemia possible)
   ✗ ST Depression: May increase without symptoms
   ✗ Risk: Significantly elevated
   ```

   **In Your Test:**
   - HR doesn't increase as expected (blunted response)
   - May not feel chest pain during ischemia
   - Recovery is notably slow
   - May need earlier test termination
   - "High Risk" more likely

3. **Type 2 Diabetes**
   ```
   ✗ Heart Rate Response: -15% blunted
   ✗ Recovery: -25% slower
   ✗ Silent Ischemia: Enabled
   ✗ Blood Pressure: No additional increase (but baseline may be higher)
   ✗ Risk: Elevated
   ```

   **In Your Test:**
   - Similar to Type 1 but usually slightly better
   - Blunted HR response
   - Slow recovery
   - Risk of painless ischemia

#### Why Diabetes Affects Testing:

```
Diabetes → Autonomic Neuropathy → Heart doesn't respond normally

Normal: Exercise → Signal to heart → HR increases
With Diabetes: Exercise → Damaged nerves → HR increases slowly

Recovery is similarly affected - signals to slow HR are also delayed
```

#### Real-World Example:

```
Test Results: 60-year-old male, Modified Bruce

No Diabetes:
├─ HR Response: Reaches target smoothly
├─ ST Segment: Normal depression curve
├─ Symptoms: Chest tightness if ischemia
└─ Recovery: Normal (HR drops steadily)

Type 2 Diabetes:
├─ HR Response: Slower to reach target
├─ ST Segment: May be abnormal without symptoms
├─ Symptoms: NO warning (silent ischemia)
└─ Recovery: Slow, HR remains elevated
```

#### Implications for Your Health:

- Diabetics need more careful monitoring during exercise
- Must not rely on chest pain as warning sign
- Regular testing important for early detection
- Medication adherence critical

---

### Alcohol Consumption

**Options:**
- None
- Moderate (up to 2 drinks/day)
- Heavy (more than 2 drinks/day)

**Impact Level:** High (affects BP control and arrhythmia risk)

#### How Alcohol Affects Your Simulation:

1. **No Alcohol Consumption**
   ```
   ✓ Normal BP response
   ✓ Normal HR regulation
   ✓ No arrhythmia risk
   ✓ Standard cardiac response
   ```

2. **Moderate Alcohol**
   ```
   ✗ Blood Pressure: +5% (slight hypertension)
   ✗ Arrhythmias: 2% chance per minute at high intensity
   ✗ Heart Rate: Normal response
   ✗ Recovery: Normal
   ```

   **In Your Test:**
   - Slightly elevated BP throughout
   - Small risk of irregular heartbeats at peak
   - Otherwise normal test

3. **Heavy Alcohol**
   ```
   ✗ Blood Pressure: +15% (significant hypertension)
   ✗ Heart Rate: +12% higher for same workload (cardiac drift)
   ✗ Arrhythmias: 5% chance per minute at high intensity
   ✗ Recovery: -20% slower
   ✗ Dehydration effects visible
   ```

   **In Your Test:**
   - Notably high BP at all stages
   - HR climbs higher than expected
   - Risk of ectopic beats (irregular heartbeats)
   - Poor recovery
   - Elevated "High Risk" prediction

#### Why Heavy Alcohol Affects Cardiac Testing:

```
Alcohol:
├─ Increases resting BP (hypertension risk)
├─ Weakens heart muscle (cardiomyopathy)
├─ Causes arrhythmias
├─ Impairs autonomic nervous system
├─ Causes dehydration (cardiac drift = HR stays high)
└─ Slows recovery
```

#### Real-World Example:

```
60-year-old male, Standard Bruce

No Alcohol:
├─ Rest: HR 72, BP 125/80
├─ Peak: HR 155, BP 160/95
└─ Recovery: HR 135 (normal drop)

Heavy Alcohol:
├─ Rest: HR 75, BP 143/88
├─ Peak: HR 173, BP 184/105
├─ Irregular beats: 3-4 episodes detected
└─ Recovery: HR 162 (slow drop, still elevated)
```

---

### Activity Level

**Options:**
- Sedentary (minimal exercise)
- Active (regular exercise 3-5x/week)
- Athlete (intense training regularly)

**Impact Level:** Very High (affects all exercise responses)

#### How Activity Level Affects Your Simulation:

1. **Sedentary**
   ```
   ✗ Baseline HR: +20% higher (elevated resting HR)
   ✗ Heart Rate Response: +15% faster increase
   ✗ Workload Capacity: -25% (quicker fatigue)
   ✗ Recovery: -30% slower
   ✗ Overall Fitness: Poor
   ```

   **In Your Test:**
   - High resting heart rate
   - HR climbs quickly with low workloads
   - Fatigue comes early
   - Slow recovery to baseline
   - May not tolerate full protocol
   - Likely "High Risk" prediction

2. **Active**
   ```
   ✓ Baseline HR: Normal
   ✓ Heart Rate Response: Normal
   ✓ Workload Capacity: Normal
   ✓ Recovery: Normal
   ✓ Overall Fitness: Good
   ```

   **In Your Test:**
   - Expected normal responses
   - Good exercise tolerance
   - Normal recovery
   - Baseline for risk assessment

3. **Athlete**
   ```
   ✓ Baseline HR: -25% lower (low resting HR)
   ✓ Heart Rate Response: -15% slower (efficient response)
   ✓ Workload Capacity: +30% higher (excellent capacity)
   ✓ Recovery: +40% faster (excellent recovery)
   ✓ Overall Fitness: Excellent
   ```

   **In Your Test:**
   - Low resting heart rate (may be 50-60 BPM)
   - HR increases smoothly and efficiently
   - Can tolerate high workloads
   - Rapid recovery (20-25 BPM drop in 1st minute)
   - Usually "Low Risk" prediction

#### Real-World Example:

```
50-year-old male, Standard Bruce

SEDENTARY:
├─ Rest: HR 90, BP 130/85
├─ Stage 1: HR 125, BP 150/90
├─ Stage 2: HR 145, BP 165/95 (fatigue reported)
├─ May stop at Stage 2
└─ Recovery: Slow (HR still 120 after 3 min)

ACTIVE:
├─ Rest: HR 70, BP 125/80
├─ Stage 1: HR 115, BP 145/88
├─ Stage 2: HR 135, BP 160/92
├─ Stage 3: HR 155, BP 170/95
└─ Recovery: Normal (HR 130 after 3 min)

ATHLETE:
├─ Rest: HR 55, BP 120/75
├─ Stage 1: HR 110, BP 140/85
├─ Stage 2: HR 130, BP 155/90
├─ Stage 3: HR 150, BP 168/93
└─ Recovery: Excellent (HR 100 after 3 min)
```

---

## How Modifiers Work

### The Modifier System

Your simulation combines multiple factors through a **multiplicative modifier system**:

```
Final Result = Baseline × Age Modifier × Lifestyle Modifier × Other Factors
```

### Example Calculation:

```
Patient: 70-year-old smoker with Type 2 diabetes
Protocol: Modified Bruce

Age Modifier (70):
├─ HR Response: 0.93x (slower response)
├─ Recovery: 0.85x (slower recovery)
├─ BP Response: 1.07x (higher BP)
└─ Workload Capacity: 0.80x (limited)

Smoking Modifier:
├─ HR Response: 1.10x (faster)
├─ Recovery: 0.65x (much slower)
├─ BP: 1.12x (higher)
└─ Workload: 0.85x (limited)

Diabetes Modifier:
├─ HR Response: 0.85x (blunted)
├─ Recovery: 0.75x (slower)
└─ Silent Ischemia: ENABLED

Combined Effect:
├─ HR Response: 0.93 × 1.10 × 0.85 = 0.87 (significantly blunted)
├─ Recovery: 0.85 × 0.65 × 0.75 = 0.41 (very slow)
├─ BP: 1.07 × 1.12 = 1.20 (20% higher)
└─ Result: Multiple high-risk factors
```

### Why This Matters:

- **Factors don't work in isolation** - they interact
- **Cumulative risk:** Each additional risk factor multiplies the effect
- **Individual variation:** Your simulation is uniquely tailored
- **Clinical accuracy:** Reflects real-world cardiac physiology

---

## Understanding Your Results

### The Four Phases of Your Test

Every simulation includes these phases:

#### 1. Rest Phase (60 seconds)
- **Purpose:** Establish baseline measurements
- **What happens:** Relaxed sitting, measuring resting HR/BP
- **Age impact:** Older patients have higher resting HR
- **Lifestyle impact:** Sedentary patients show elevated baseline
- **Tobacco/Alcohol:** May show elevated baseline BP

#### 2. Exercise Phase (9-20 minutes depending on protocol)
- **Purpose:** Stress the heart gradually
- **Standard Bruce:** 9 minutes total (3 stages × 3 min)
- **Modified Bruce:** 20 minutes total (4 stages × 5 min)
- **What's measured:** HR, BP, ST segment, symptoms
- **Age impact:** Older patients may not reach target HR
- **Activity level:** Athletes reach peak quickly; sedentary stop early
- **Diabetes:** HR blunted, pain not reliable indicator

#### 3. Recovery Phase (120 seconds)
- **Purpose:** Monitor heart's ability to recover
- **What happens:** Stop exercise, observe vitals decline
- **Key metric:** How much HR drops in first minute
- **Age impact:** Older patients recover slowly
- **Smoking/Diabetes:** Very slow recovery indicates problems
- **Athlete:** Rapid drop (20-25 BPM) is excellent

#### 4. Analysis
- **Risk prediction:** Based on all factors
- **Abnormalities detected:** ST changes, arrhythmias, slow recovery
- **Recommendations:** Exercise guidelines based on results
- **Heart Age:** Calculated biological age vs. chronological

### What "High Risk" Means

High Risk is indicated when:
- ST segment depresses significantly
- Blood pressure is excessively high
- Heart rate doesn't increase normally (or increases too much)
- Recovery is abnormally slow
- Arrhythmias detected
- Age + multiple risk factors present

**This doesn't necessarily mean you have heart disease** - it means:
- Your test shows markers that warrant further evaluation
- Follow-up testing may be recommended
- Lifestyle modifications would be beneficial
- Medication adjustments might help

### Interpreting Your Vitals

#### Heart Rate During Exercise

```
Expected range based on age and protocol:

Age 30, Standard Bruce:
├─ Rest: 60-70 BPM
├─ Stage 1: 110-125 BPM
├─ Stage 2: 130-150 BPM
└─ Stage 3: 150-170 BPM (target: 85-95% of max = 165-185)

Age 70, Modified Bruce:
├─ Rest: 70-80 BPM
├─ Stage 1: 95-110 BPM
├─ Stage 2: 110-130 BPM
├─ Stage 3: 130-145 BPM
└─ Stage 4: 140-160 BPM (target: 70-90% of max = 105-155)
```

#### Blood Pressure During Exercise

```
Expected ranges:

Normal:
├─ Rest: < 140/90 mmHg
├─ Exercise Peak: 150-180 systolic
└─ Diastolic: Increases slightly or stays same

Elevated (may indicate risk):
├─ Rest: > 140/90 mmHg (hypertension)
├─ Exercise Peak: > 190 systolic
└─ Excessive rise per stage
```

#### Recovery (Most Important)

```
Excellent Recovery:
├─ 1st minute: HR drops 20-30 BPM
├─ 2nd minute: HR drops another 15-20 BPM
├─ 3rd minute: Near baseline
└─ This indicates good cardiac autonomy

Poor Recovery (High Risk Marker):
├─ 1st minute: HR drops < 12 BPM
├─ 2nd minute: Still elevated significantly
├─ 3rd minute: Doesn't approach baseline
└─ Indicates autonomic dysfunction or deconditioning
```

### What to Discuss with Your Doctor

Bring your results and discuss:

1. **If Chest Pain Type = "Typical Angina"**
   - Explore cardiac workup further
   - Medication evaluation
   - Lifestyle modifications

2. **If "High Risk" Prediction**
   - Request additional testing (EKG, stress echo, catheterization)
   - Discuss medication options
   - Consider specialist referral

3. **If Poor Recovery**
   - Indicates autonomic dysfunction
   - May need further cardiac evaluation
   - Could indicate need for training (if sedentary)

4. **If Any Abnormalities**
   - Get professional interpretation
   - Don't self-diagnose
   - Work with your healthcare team

---

## Summary Tables

### Quick Reference: How Each Input Affects Your Test

| Input | Range | Primary Effect | Secondary Effect |
|-------|-------|-----------------|------------------|
| **Age** | 18-100 | Protocol choice, HR response | Recovery speed, BP change |
| **Gender** | M/F | Baseline vitals | Risk model input |
| **Chest Pain** | 4 types | Risk prediction | Exercise recommendations |
| **Protocol** | 2 types | Duration, intensity | Peak HR achieved |
| **Smoking** | Current/Ex/None | HR & BP response | Recovery, arrhythmia risk |
| **Diabetes** | Type 1/2/None | HR response blunting | Recovery, silent ischemia |
| **Alcohol** | Heavy/Mod/None | BP control | Arrhythmia risk |
| **Activity** | 3 levels | Baseline HR & capacity | Recovery speed |

### Age Impact Matrix

| Age Group | Default Protocol | HR Response | Recovery | BP Rise | Capacity |
|-----------|-----------------|------------|----------|---------|----------|
| 18-30 | Standard | Fast ✓ | Excellent ✓ | Normal ✓ | +10% ✓ |
| 30-40 | Standard | Normal ✓ | Good ✓ | Normal ✓ | Normal ✓ |
| 40-50 | Standard | Slight ↓ | Normal ✓ | +2% | -3% |
| 50-60 | Standard | Moderate ↓ | Slight ↓ | +4% | -10% |
| 60-70 | Modified | Pronounced ↓ | Slow ↓ | +7% | -20% |
| 70+ | Modified | Significant ↓ | Very Slow ↓ | +10% | -35% |

### Risk Factor Combinations

| Combination | Overall Risk | Recovery Expected | Notes |
|------------|--------------|-------------------|-------|
| Young + Active + Non-smoker | Low | Excellent | Best case scenario |
| Young + Smoker + Sedentary | Moderate | Slow | Modifiable risk factors |
| Older + Multiple factors | High | Poor | Requires close monitoring |
| Older + Diabetic + Smoker | Very High | Very Poor | Multiple compounding factors |

---

## Final Notes

### Your Simulation is Personalized

- Based on YOUR specific characteristics
- Reflects real-world cardiac physiology
- Combines medical research with individual data
- More accurate than generic tables

### Modifiers Are Cumulative

- Multiple risk factors multiply effects
- Combined impact is greater than sum of parts
- Each lifestyle modification helps
- Changes can be dramatic with intervention

### Follow Medical Guidance

- Use simulation results as ONE data point
- Discuss with qualified healthcare provider
- Don't self-diagnose
- Follow recommended follow-up testing

### Lifestyle Changes Matter

- Smoking cessation: Most impactful change
- Exercise: Improves capacity and recovery
- Weight management: Lowers BP and HR stress
- Diabetes control: Critical for outcomes
- Alcohol: Limit to recommended amounts

---

## Questions?

For technical questions about the simulation:
- Contact KardiaTwin support team
- Review simulation parameters
- Discuss results with healthcare provider

For clinical interpretation:
- Always consult your physician
- Don't rely solely on this simulation
- Use as educational and motivational tool
- Part of comprehensive cardiac evaluation

---

**Last Updated:** December 2025
**Version:** 1.0
**For Educational Purposes Only**
