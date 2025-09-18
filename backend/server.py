import random
import time
import threading
import pickle
import numpy as np
import json
import uuid
from flask import Flask, jsonify, request
from flask_cors import CORS
from threading import Lock
from models import get_db_session, SimulationSession, SimulationDataPoint, SimulationAlert

app = Flask(__name__)
CORS(app)

# Load the trained ML Model and scaler
with open('heart_model.pkl', 'rb') as file:
    heart_model, scaler = pickle.load(file)

# Store user input
user_static_data = {
    "age": 50,
    "sex": 1,
    "cp": 0,
    "fbs": 0,
    "restecg": 0,
    "slope": 1,
    "ca": 0,
    "thal": 2
}

# Alert thresholds
alert_thresholds = {
    "heart_rate_high": 170,
    "heart_rate_low": 50,
    "blood_pressure_high": 140,
    "blood_pressure_low": 90,
    "st_depression_high": 2.0
}

# Store alerts
alerts = []
alert_lock = Lock()

# Simulation session tracking
current_session_id = None
simulation_start_time = None
session_lock = Lock()

# Live simulation data
latest_data = {
    "trestbps": 120,  # Systolic Blood Pressure (mmHg)
    "dbp": 75,        # Diastolic Blood Pressure (mmHg)
    "chol": 200,      # Cholesterol (static)
    "thalach": 72,    # Heart Rate (BPM)
    "exang": 0,       # Exercise-induced angina (0/1)
    "oldpeak": 1.0,   # ST Depression
    "phase": "rest",  # rest | exercise | recovery
    "workload_level": 0,  # 0..N during exercise
    "prediction": "Waiting...",
    "future_predictions": [], # Store future predictions
    "protocol": "standard",  # standard | modified_bruce
    "stage": 0,       # Current stage number
    "stage_time": 0   # Time in current stage
}

running = False  # Control simulation
paused = False   # Control pause state
pause_start_time = None  # Track when pause started
pause_elapsed = 0.0  # Total time paused
data_lock = Lock()  # Thread-safe access to latest_data

# Store previous values for smoothing (kept for safety)
previous_values = {
    "trestbps": 120,
    "thalach": 72,
    "oldpeak": 1.0
}

def smooth_value(current, previous, max_change=5):
    """Smoothly transition between values with a maximum change limit."""
    if abs(current - previous) > max_change:
        if current > previous:
            return previous + max_change
        else:
            return previous - max_change
    return current


class PhysiologySimulationEngine:
    """Rule-based simulator for vitals with rest, exercise, and recovery phases."""

    def __init__(self, config=None):
        # Baselines (can be adjusted later per-user)
        self.baseline_hr = 72.0
        self.baseline_sbp = 120.0
        self.baseline_dbp = 75.0
        self.baseline_oldpeak = 1.0

        # Current state variables
        self.hr = self.baseline_hr
        self.sbp = self.baseline_sbp
        self.dbp = self.baseline_dbp
        self.oldpeak = self.baseline_oldpeak
        self.exang = 0
        self.phase = "rest"  # rest | exercise | recovery
        self.workload_level = 0
        self.protocol = "standard"  # standard | modified_bruce
        self.stage = 0
        self.stage_time = 0
        self.protocol_completed = False
        self.protocol_finished = False  # New flag to indicate protocol is completely done

        # Protocol-specific configurations (must be defined before using in config handling)
        self.protocol_configs = {
            "standard": {
                "stages": [
                    {"duration": 180, "workload": 1, "target_hr": 0.85},  # 3 min stages
                    {"duration": 180, "workload": 2, "target_hr": 0.90},
                    {"duration": 180, "workload": 3, "target_hr": 0.95}
                ],
                "workload_increments": [1, 2, 3]
            },
            "modified_bruce": {
                "stages": [
                    {"duration": 300, "workload": 0.5, "target_hr": 0.70},  # 5 min stages, gentler
                    {"duration": 300, "workload": 1.0, "target_hr": 0.80},
                    {"duration": 300, "workload": 1.5, "target_hr": 0.85},
                    {"duration": 300, "workload": 2.0, "target_hr": 0.90}
                ],
                "workload_increments": [0.5, 1.0, 1.5, 2.0]
            }
        }

        # Config
        self.config = {
            "rest_duration_s": 60,
            "exercise_duration_s": 180,
            "recovery_duration_s": 120,
            "max_workload_level": 3,
            "protocol": "standard"
        }
        if config:
            self.config.update(config)
            self.protocol = config.get("protocol", "standard")

        # Internal timers
        self.phase_elapsed_s = 0.0
        self.hr_increase_rate_per_min = 11.0  # bpm/min during exercise
        self.sbp_increase_per_level = 12.0    # mmHg per workload level
        self.recovery_start_hr = self.hr
        self.recovery_flagged = False
        
        # Pause functionality
        self.paused = False
        self.pause_start_time = None
        self.pause_elapsed = 0.0

        # Protocol-specific configurations moved above

    def _to_next_phase(self, next_phase):
        
        
        self.phase = next_phase
        self.phase_elapsed_s = 0.0
        self.stage = 0
        self.stage_time = 0
        
        if next_phase == "rest":
            self.exang = 0
            self.workload_level = 0
            self.recovery_flagged = False
        elif next_phase == "exercise":
            self.exang = 1
            self.workload_level = self.protocol_configs[self.protocol]["stages"][0]["workload"]
            # Draw fresh parameters for this exercise bout
            self.hr_increase_rate_per_min = random.uniform(10.0, 12.0)
            self.sbp_increase_per_level = random.uniform(10.0, 15.0)
            # Reset protocol completion flag when starting a new exercise phase
            self.protocol_completed = False
        elif next_phase == "recovery":
            self.exang = 0
            self.recovery_start_hr = self.hr
            self.recovery_flagged = False
            
        

    def _get_current_stage_config(self):
        """Get configuration for current exercise stage."""
        if self.protocol not in self.protocol_configs:
            return None
        
        stages = self.protocol_configs[self.protocol]["stages"]
        if self.stage < len(stages):
            return stages[self.stage]
        return stages[-1]  # Use last stage if exceeded

    def _advance_stage(self):
        """Advance to next exercise stage if time permits."""
        current_stage = self._get_current_stage_config()
        if current_stage and self.stage_time >= current_stage["duration"]:
            old_stage = self.stage
            self.stage += 1
            self.stage_time = 0
            
            
            if self.stage < len(self.protocol_configs[self.protocol]["stages"]):
                self.workload_level = self.protocol_configs[self.protocol]["stages"][self.stage]["workload"]
                
                return True
            else:
                # All stages completed, move to recovery
                
                self._to_next_phase("recovery")
                return False
        return False

    def _update_rest(self, dt):
        # Update rest timer
        self.phase_elapsed_s += dt
        self.stage_time += dt  # Update stage_time for frontend timer display
        
        # Drift towards baseline with small noise
        self.hr += (self.baseline_hr - self.hr) * min(1.0, dt/15.0) + random.uniform(-0.2, 0.2)
        self.sbp += (self.baseline_sbp - self.sbp) * min(1.0, dt/20.0) + random.uniform(-0.5, 0.5)
        self.dbp += (self.baseline_dbp - self.dbp) * min(1.0, dt/20.0) + random.uniform(-0.3, 0.3)
        self.oldpeak += (self.baseline_oldpeak - self.oldpeak) * min(1.0, dt/20.0) + random.uniform(-0.02, 0.02)

        if self.phase_elapsed_s >= self.config["rest_duration_s"]:
            self._to_next_phase("exercise")

    def _update_exercise(self, dt):
        # Update exercise timer
        self.phase_elapsed_s += dt
        
        # Update stage time and check for stage advancement
        self.stage_time += dt
        self._advance_stage()
        
        # Get current stage configuration
        current_stage = self._get_current_stage_config()
        if not current_stage:
            return

        # Log stage info every 30 seconds
        

        # Calculate target heart rate for current stage
        target_hr_percent = current_stage["target_hr"]
        max_hr = 220 - float(user_static_data.get("age", 50))  # Age-predicted max HR
        target_hr = max_hr * target_hr_percent

        # HR increases towards target for current stage
        hr_delta = target_hr - self.hr
        hr_change_rate = self.hr_increase_rate_per_min / 60.0  # per second
        self.hr += np.clip(hr_delta * hr_change_rate * dt, -2.0, 2.0) + random.uniform(-0.2, 0.4)

        # SBP rises with workload level
        target_sbp = self.baseline_sbp + self.sbp_increase_per_level * self.workload_level
        sbp_delta = target_sbp - self.sbp
        self.sbp += np.clip(sbp_delta, -3.0, 3.0)  # limit per-second change

        # DBP stable or slight increase
        target_dbp = self.baseline_dbp + min(5.0, 0.8 * self.workload_level)
        dbp_delta = target_dbp - self.dbp
        self.dbp += np.clip(dbp_delta, -1.0, 1.0)

        # ST depression increases with workload
        target_oldpeak = self.baseline_oldpeak + 0.1 * self.workload_level
        self.oldpeak += np.clip(target_oldpeak - self.oldpeak, -0.05, 0.05) + random.uniform(-0.01, 0.01)

        # Check if all stages completed
        if self.stage >= len(self.protocol_configs[self.protocol]["stages"]):
            
            self._to_next_phase("recovery")

    def _update_recovery(self, dt):
        # Update recovery timer
        self.phase_elapsed_s += dt
        self.stage_time += dt  # Update stage_time for frontend timer display
        
        # First minute: HR should drop by ~20 bpm
        if self.phase_elapsed_s <= 60.0:
            expected_drop = 20.0 * (self.phase_elapsed_s / 60.0)
            target_hr = max(self.baseline_hr, self.recovery_start_hr - expected_drop)
            self.hr += (target_hr - self.hr) * min(1.0, dt/5.0) + random.uniform(-0.3, 0.3)
            if self.phase_elapsed_s >= 60.0 and not self.recovery_flagged:
                actual_drop = self.recovery_start_hr - self.hr
                if actual_drop < 18.0:  # flag abnormal if < ~20 bpm
                    self.recovery_flagged = True
        else:
            # Then ease towards baseline
            self.hr += (self.baseline_hr - self.hr) * min(1.0, dt/20.0) + random.uniform(-0.2, 0.2)

        # SBP and DBP return towards baseline
        self.sbp += (self.baseline_sbp - self.sbp) * min(1.0, dt/15.0)
        self.dbp += (self.baseline_dbp - self.dbp) * min(1.0, dt/15.0)
        self.oldpeak += (self.baseline_oldpeak - self.oldpeak) * min(1.0, dt/20.0) + random.uniform(-0.01, 0.01)

        if self.phase_elapsed_s >= self.config["recovery_duration_s"]:
            # Add protocol completion event and stop cycling
            self.protocol_completed = True
            self.protocol_finished = True  # Mark protocol as completely finished
            # Don't go back to rest - protocol is complete
            # Explicitly stop the global running flag so clients know the protocol ended
            try:
                global running
                running = False
            except Exception:
                pass
            return  # Stop updating

    def update(self, dt):
        # Don't update if paused or protocol is finished
        if self.paused or self.protocol_finished:
            return
            
        if self.phase == "rest":
            self._update_rest(dt)
        elif self.phase == "exercise":
            self._update_exercise(dt)
        elif self.phase == "recovery":
            self._update_recovery(dt)

    def to_latest_data(self):
        # Determine the correct time value based on the current phase
        if self.phase == "rest":
            current_time = int(self.phase_elapsed_s)
        elif self.phase == "exercise":
            current_time = int(self.stage_time)
        elif self.phase == "recovery":
            current_time = int(self.phase_elapsed_s)
        else:
            current_time = 0
            
        return {
            "trestbps": int(round(self.sbp)),
            "dbp": int(round(self.dbp)),
            "chol": 200,
            "thalach": int(round(self.hr)),
            "exang": 1 if self.exang else 0,
            "oldpeak": round(float(self.oldpeak), 2),
            "phase": self.phase,
            "workload_level": round(self.workload_level, 1),
            "protocol": self.protocol,
            "stage": self.stage + 1,  # 1-indexed for display
            "stage_time": current_time
        }

    def pop_events(self):
        events = []
        if self.phase == "recovery" and self.phase_elapsed_s >= 60.0 and self.recovery_flagged:
            # Emit once per recovery minute window then reset flag so we don't spam
            events.append({
                "type": "recovery_abnormal",
                "message": "HR failed to drop ~20 bpm within first minute of recovery",
                "severity": "medium"
            })
            self.recovery_flagged = False
            
        if self.protocol_completed:
            # Add protocol completion event
            events.append({
                "type": "protocol_completed",
                "message": "The exercise protocol has been completed successfully.",
                "severity": "info"
            })
            self.protocol_completed = False
            
        return events
    
    def pause(self):
        """Pause the simulation and record pause start time."""
        if not self.paused:
            self.paused = True
            self.pause_start_time = time.time()
            print(f"[PAUSE] Simulation paused at phase: {self.phase}, elapsed: {self.phase_elapsed_s:.1f}s")
    
    def resume(self):
        """Resume the simulation and calculate total pause time."""
        if self.paused:
            pause_duration = time.time() - self.pause_start_time
            self.pause_elapsed += pause_duration
            self.paused = False
            self.pause_start_time = None
            print(f"[RESUME] Simulation resumed after {pause_duration:.1f}s pause. Total paused: {self.pause_elapsed:.1f}s")
    
    def is_paused(self):
        """Check if simulation is currently paused."""
        return self.paused
    
    def get_pause_info(self):
        """Get pause status information."""
        return {
            "paused": self.paused,
            "pause_elapsed": self.pause_elapsed,
            "current_pause_duration": time.time() - self.pause_start_time if self.pause_start_time else 0
        }
    
    def get_protocol_status(self):
        """Get protocol completion status."""
        return {
            "protocol_completed": self.protocol_completed,
            "protocol_finished": self.protocol_finished,
            "current_phase": self.phase,
            "phase_elapsed": self.phase_elapsed_s,
            "stage": self.stage,
            "stage_time": self.stage_time
        }

@app.route('/start', methods=['POST'])
def start_simulation():
    """Start the simulation with user inputs and optional simulation plan."""
    global user_static_data, running, engine, current_session_id, simulation_start_time
    data = request.json or {}
    
    # Generate a session name if not provided
    session_name = data.get("session_name", f"Simulation {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Reset session tracking
    with session_lock:
        current_session_id = None
        simulation_start_time = time.time()

    # Populate user_static_data with default values if fields are missing
    user_static_data = {
        "age": data.get("age", 50),
        "sex": data.get("sex", 1),
        "cp": data.get("cp", 0),
        "fbs": data.get("fbs", 0),
        "restecg": data.get("restecg", 0),
        "slope": data.get("slope", 1),
        "ca": data.get("ca", 0),
        "thal": data.get("thal", 2)
    }

    # Validate user_static_data
    for key, value in user_static_data.items():
        if value == '':
            print(f"❌ Error: Empty value found in user_static_data for key: {key}")
            user_static_data[key] = 0  # Set default value if empty

    # Optional simulation configuration
    sim_cfg = data.get("simulation", {}) or {}
    cfg = {}
    if "rest_duration_s" in sim_cfg:
        cfg["rest_duration_s"] = int(sim_cfg["rest_duration_s"]) or 60
    if "exercise_duration_s" in sim_cfg:
        cfg["exercise_duration_s"] = int(sim_cfg["exercise_duration_s"]) or 180
    if "recovery_duration_s" in sim_cfg:
        cfg["recovery_duration_s"] = int(sim_cfg["recovery_duration_s"]) or 120
    if "max_workload_level" in sim_cfg:
        cfg["max_workload_level"] = max(1, int(sim_cfg["max_workload_level"]))
    
    # Protocol selection
    protocol = sim_cfg.get("protocol", "standard")
    if protocol not in ["standard", "modified_bruce"]:
        protocol = "standard"
    cfg["protocol"] = protocol

    # Reset engine with new configuration
    engine = PhysiologySimulationEngine(config=cfg)
    running = True
    print("[INFO] Simulation started with:", user_static_data)
    print("[INFO] Engine config:", engine.config)
    print("[INFO] Protocol selected:", protocol)
    print("[INFO] Running flag set to:", running)
    print(f"[INFO] Protocol stages: {len(engine.protocol_configs[protocol]['stages'])} stages")
    for i, stage in enumerate(engine.protocol_configs[protocol]['stages']):
        print(f"[INFO] Stage {i+1}: {stage['duration']}s, workload {stage['workload']}, target HR {stage['target_hr']*100:.0f}%")
    return jsonify({
        "message": "Simulation started", 
        "engine_config": engine.config,
        "protocol": protocol,
        "protocol_info": {
            "standard": "Standard Bruce Protocol - 3 min stages, higher intensity",
            "modified_bruce": "Modified Bruce Protocol - 5 min stages, gentler progression"
        }
    })

def check_alerts():
    """Check for any threshold violations and create alerts."""
    global alerts
    with alert_lock:
        current_time = time.strftime("%Y-%m-%d %H:%M:%S")
        
        # Check heart rate
        if latest_data["thalach"] > alert_thresholds["heart_rate_high"]:
            alerts.append({
                "timestamp": current_time,
                "type": "heart_rate",
                "message": f"High heart rate detected: {latest_data['thalach']} BPM",
                "severity": "high",
                "acknowledged": False
            })
        elif latest_data["thalach"] < alert_thresholds["heart_rate_low"]:
            alerts.append({
                "timestamp": current_time,
                "type": "heart_rate",
                "message": f"Low heart rate detected: {latest_data['thalach']} BPM",
                "severity": "medium",
                "acknowledged": False
            })
            
        # Check blood pressure
        if latest_data["trestbps"] > alert_thresholds["blood_pressure_high"]:
            alerts.append({
                "timestamp": current_time,
                "type": "blood_pressure",
                "message": f"High blood pressure detected: {latest_data['trestbps']} mmHg",
                "severity": "high",
                "acknowledged": False
            })
        elif latest_data["trestbps"] < alert_thresholds["blood_pressure_low"]:
            alerts.append({
                "timestamp": current_time,
                "type": "blood_pressure",
                "message": f"Low blood pressure detected: {latest_data['trestbps']} mmHg",
                "severity": "medium",
                "acknowledged": False
            })
            
        # Check ST depression
        if latest_data["oldpeak"] > alert_thresholds["st_depression_high"]:
            alerts.append({
                "timestamp": current_time,
                "type": "st_depression",
                "message": f"High ST depression detected: {latest_data['oldpeak']}",
                "severity": "critical",
                "acknowledged": False
            })

def generate_future_predictions():
    """Generate predictions for various future time points."""
    global latest_data
    future_predictions = []
    
    # Current values as base
    base_trestbps = latest_data["trestbps"]
    base_thalach = latest_data["thalach"]
    base_oldpeak = latest_data["oldpeak"]
    
    # Define time points and their corresponding scale factors for variation
    time_points = [
        (30, 2.0),   # 30 minutes - significant variation
        (360, 3.0),  # 6 hours - large variation
        (1440, 4.0), # 1 day - very large variation
        (2880, 5.0)  # 2 days - maximum variation
    ]
    
    for minutes, scale_factor in time_points:
        # Calculate time label
        if minutes < 60:
            time_label = f"+{minutes}min"
        elif minutes < 1440:
            hours = minutes // 60
            time_label = f"+{hours}h"
        else:
            days = minutes // 1440
            time_label = f"+{days}d"
        
        # Generate values with increasing variation based on time
        future_trestbps = int(np.clip(
            np.random.normal(loc=base_trestbps, scale=5*scale_factor),
            90, 200
        ))
        future_thalach = int(np.clip(
            np.random.normal(loc=base_thalach, scale=8*scale_factor),
            60, 200
        ))
        future_oldpeak = round(np.clip(
            np.random.normal(loc=base_oldpeak, scale=0.5*scale_factor),
            0, 6.2
        ), 2)
        
        # Prepare input for ML model (13 features from heart.csv)
        input_data = np.array([[  
            float(user_static_data["age"]), float(user_static_data["sex"]), float(user_static_data["cp"]),
            float(future_trestbps), float(latest_data["chol"]), float(user_static_data["fbs"]),
            float(user_static_data["restecg"]), float(future_thalach), float(latest_data["exang"]),
            float(future_oldpeak), float(user_static_data["slope"]), float(user_static_data["ca"]), float(user_static_data["thal"])
        ]], dtype=np.float64)
        
        # Scale the input data using the trained scaler
        input_data_scaled = scaler.transform(input_data)
        
        # Make Prediction using the real heart disease model
        prediction = heart_model.predict(input_data_scaled)[0]
        
        future_predictions.append({
            "time": time_label,
            "trestbps": future_trestbps,
            "thalach": future_thalach,
            "oldpeak": future_oldpeak,
            "prediction": "High Risk" if prediction == 1 else "Low Risk"
        })
    
    return future_predictions

def simulate_physiology_engine():
    """Run the rule-based physiology simulation engine."""
    global latest_data, previous_values, engine
    
    
    # Initialize engine if not already
    if 'engine' not in globals() or engine is None:
        engine = PhysiologySimulationEngine()
    else:
        pass

    last_tick = time.time()
    iteration = 0
    
    
    while True:
        iteration += 1
        if iteration <= 5:
            pass
        
        # If globally stopped, idle
        if not running:
            # Idle but keep loop alive
            if iteration % 10 == 0:
                pass
            time.sleep(0.5)
            last_tick = time.time()
            continue

        # Hard pause: when engine is paused, do not mutate state or predictions
        if engine and engine.paused:
            time.sleep(0.2)
            last_tick = time.time()
            continue

        now = time.time()
        dt = now - last_tick  # Use actual time difference
        last_tick = now

        try:
            if iteration <= 5:
                pass
            
            # Advance simulation only when not paused/finished
            engine.update(dt)

            with data_lock:
                # Pull engine state into latest_data
                sim_snapshot = engine.to_latest_data()
                latest_data.update(sim_snapshot)
                
                # If paused, do not produce alerts or predictions; keep state frozen
                if engine.paused:
                    time.sleep(0.05)
                    continue

                # Persist previous values for smoothing compatibility
                previous_values["trestbps"] = latest_data["trestbps"]
                previous_values["thalach"] = latest_data["thalach"]
                previous_values["oldpeak"] = latest_data["oldpeak"]

                # Check for alerts (threshold-based)
                check_alerts()

                # Engine-derived events (e.g., abnormal recovery)
                for event in engine.pop_events():
                    current_time = time.strftime("%Y-%m-%d %H:%M:%S")
                    with alert_lock:
                        alerts.append({
                            "timestamp": current_time,
                            "type": event["type"],
                            "message": event["message"],
                            "severity": event["severity"],
                            "acknowledged": False
                        })

                # Prepare input for ML model (13 features from heart.csv)
                input_data = np.array([[  
                    float(user_static_data["age"]), float(user_static_data["sex"]), float(user_static_data["cp"]),
                    float(latest_data["trestbps"]), float(latest_data["chol"]), float(user_static_data["fbs"]),
                    float(user_static_data["restecg"]), float(latest_data["thalach"]), float(latest_data["exang"]),
                    float(latest_data["oldpeak"]), float(user_static_data["slope"]), float(user_static_data["ca"]), float(user_static_data["thal"])
                ]], dtype=np.float64)

                # Scale the input data using the trained scaler
                input_data_scaled = scaler.transform(input_data)

                # Make Prediction using the real heart disease model
                prediction = heart_model.predict(input_data_scaled)[0]
                latest_data["prediction"] = "High Risk" if prediction == 1 else "Low Risk"

                # Generate future predictions
                latest_data["future_predictions"] = generate_future_predictions()

        except Exception as e:
            with data_lock:
                latest_data["prediction"] = "Error"

        time.sleep(1)

# Start the simulation thread
try:
    engine = PhysiologySimulationEngine()
    running = True
    sim_thread = threading.Thread(target=simulate_physiology_engine, daemon=True)
    sim_thread.start()
    time.sleep(0.5)
    try:
        engine.update(1.0)
        test_data = engine.to_latest_data()
    except Exception:
        pass
except Exception:
    engine = None
    running = False


@app.route('/prediction', methods=['GET'])
def get_prediction():
    """Return the latest simulated heart health data."""
    try:
        with data_lock:
            # Convert NumPy types to JSON-safe Python types
            safe_latest_data = {
                k: int(v) if isinstance(v, np.integer) else float(v) if isinstance(v, np.floating) else v
                for k, v in latest_data.items()
            }
            return jsonify(safe_latest_data)
    except Exception as e:
        print("JSON Serialization Error:", e)
        return jsonify({"error": "Failed to generate prediction data"}), 500

@app.route('/protocols', methods=['GET'])
def get_protocols():
    """Return available exercise protocols and their configurations."""
    protocols = {
        "standard": {
            "name": "Standard Bruce Protocol",
            "description": "Standard cardiac stress test with 3-minute stages and higher intensity",
            "stages": [
                {"stage": 1, "duration": "3 min", "workload": 1, "target_hr": "85% of max HR"},
                {"stage": 2, "duration": "3 min", "workload": 2, "target_hr": "90% of max HR"},
                {"stage": 3, "duration": "3 min", "workload": 3, "target_hr": "95% of max HR"}
            ],
            "total_duration": "9 minutes",
            "suitable_for": "Standard cardiac stress testing, healthy individuals"
        },
        "modified_bruce": {
            "name": "Modified Bruce Protocol", 
            "description": "Gentler progression with 5-minute stages, suitable for elderly or compromised patients",
            "stages": [
                {"stage": 1, "duration": "5 min", "workload": 0.5, "target_hr": "70% of max HR"},
                {"stage": 2, "duration": "5 min", "workload": 1.0, "target_hr": "80% of max HR"},
                {"stage": 3, "duration": "5 min", "workload": 1.5, "target_hr": "85% of max HR"},
                {"stage": 4, "duration": "5 min", "workload": 2.0, "target_hr": "90% of max HR"}
            ],
            "total_duration": "20 minutes",
            "suitable_for": "Elderly patients, post-MI recovery, compromised individuals"
        }
    }
    return jsonify(protocols)

@app.route('/alerts', methods=['GET'])
def get_alerts():
    """Return the list of unacknowledged alerts."""
    with alert_lock:
        unacknowledged = [alert for alert in alerts if not alert["acknowledged"]]
        return jsonify(unacknowledged)

@app.route('/alerts/<int:index>/acknowledge', methods=['POST'])
def acknowledge_alert(index):
    """Acknowledge a specific alert."""
    with alert_lock:
        if 0 <= index < len(alerts):
            alerts[index]["acknowledged"] = True
            return jsonify({"message": "Alert acknowledged"})
        return jsonify({"error": "Invalid alert index"}), 400

@app.route('/thresholds', methods=['GET', 'POST'])
def manage_thresholds():
    """Get or update alert thresholds."""
    global alert_thresholds
    if request.method == 'POST':
        new_thresholds = request.json
        for key, value in new_thresholds.items():
            if key in alert_thresholds:
                try:
                    value = float(value)
                    if value < 0:
                        return jsonify({"error": f"Negative values are not allowed for {key}"}), 400
                    alert_thresholds[key] = value
                except (ValueError, TypeError):
                    return jsonify({"error": f"Invalid value for {key}"}), 400
        return jsonify({"message": "Thresholds updated"})
    return jsonify(alert_thresholds)

@app.route('/status', methods=['GET'])
def get_simulation_status():
    """Get the current simulation status."""
    global running, engine
    if engine:
        pause_info = engine.get_pause_info()
        protocol_info = engine.get_protocol_status()
        return jsonify({
            "running": running,
            "paused": pause_info["paused"],
            "phase": engine.phase,
            "stage": engine.stage,
            "stage_time": engine.stage_time,
            "phase_elapsed_s": engine.phase_elapsed_s,
            "workload_level": engine.workload_level,
            "pause_elapsed": pause_info["pause_elapsed"],
            "protocol_completed": protocol_info["protocol_completed"],
            "protocol_finished": protocol_info["protocol_finished"]
        })
    return jsonify({
        "running": running,
        "paused": False,
        "phase": "unknown",
        "stage": 0,
        "stage_time": 0,
        "phase_elapsed_s": 0,
        "workload_level": 0,
        "pause_elapsed": 0,
        "protocol_completed": False,
        "protocol_finished": False
    })

@app.route('/start_simulation', methods=['POST'])
def start_simulation_manual():
    """Manually start the simulation."""
    global running, engine
    running = True
    if not engine:
        engine = PhysiologySimulationEngine()
    
    return jsonify({"message": "Simulation started", "running": True})

@app.route('/stop_simulation', methods=['POST'])
def stop_simulation():
    """Stop the simulation."""
    global running
    running = False
    
    return jsonify({"message": "Simulation stopped", "running": False})

@app.route('/pause_simulation', methods=['POST'])
def pause_simulation():
    """Pause the simulation."""
    global engine
    if engine:
        engine.pause()
        return jsonify({
            "message": "Simulation paused",
            "paused": True,
            "phase": engine.phase,
            "phase_elapsed": engine.phase_elapsed_s
        })
    return jsonify({"error": "No engine available"}), 400

@app.route('/resume_simulation', methods=['POST'])
def resume_simulation():
    """Resume the simulation."""
    global engine
    if engine:
        engine.resume()
        return jsonify({
            "message": "Simulation resumed",
            "paused": False,
            "phase": engine.phase,
            "phase_elapsed": engine.phase_elapsed_s
        })
    return jsonify({"error": "No engine available"}), 400

@app.route('/pause_status', methods=['GET'])
def get_pause_status():
    """Get the current pause status."""
    global engine
    if engine:
        pause_info = engine.get_pause_info()
        return jsonify({
            "paused": pause_info["paused"],
            "pause_elapsed": pause_info["pause_elapsed"],
            "current_pause_duration": pause_info["current_pause_duration"],
            "phase": engine.phase,
            "phase_elapsed": engine.phase_elapsed_s
        })
    return jsonify({"error": "No engine available"}), 400

@app.route('/protocol_status', methods=['GET'])
def get_protocol_status():
    """Get the current protocol completion status."""
    global engine
    if engine:
        protocol_info = engine.get_protocol_status()
        return jsonify({
            "protocol_completed": protocol_info["protocol_completed"],
            "protocol_finished": protocol_info["protocol_finished"],
            "current_phase": protocol_info["current_phase"],
            "phase_elapsed": protocol_info["phase_elapsed"],
            "stage": protocol_info["stage"],
            "stage_time": protocol_info["stage_time"]
        })
    return jsonify({"error": "No engine available"}), 400

@app.route('/reset_protocol', methods=['POST'])
def reset_protocol():
    """Reset the protocol to start over from rest phase."""
    global engine
    if engine:
        # Create a new engine instance to reset everything
        engine = PhysiologySimulationEngine()
        return jsonify({
            "message": "Protocol reset successfully",
            "phase": "rest",
            "protocol_completed": False,
            "protocol_finished": False
        })
    return jsonify({"error": "No engine available"}), 400

@app.route('/protocol_info', methods=['GET'])
def get_protocol_info():
    """Get detailed information about the current protocol configuration."""
    global engine
    if engine:
        protocol_name = engine.protocol
        stages = engine.protocol_configs[protocol_name]["stages"]
        current_stage = engine.stage
        current_stage_config = engine._get_current_stage_config()
        
        return jsonify({
            "protocol_name": protocol_name,
            "current_stage": current_stage + 1,  # 1-indexed for display
            "total_stages": len(stages),
            "stages": stages,
            "current_stage_config": current_stage_config,
            "workload_level": engine.workload_level,
            "phase": engine.phase,
            "stage_time": engine.stage_time,
            "phase_elapsed": engine.phase_elapsed_s
        })
    return jsonify({"error": "No engine available"}), 400

@app.route('/test', methods=['GET'])
def test_endpoint():
    """Test endpoint to verify backend is working."""
    global engine, running
    if engine:
        pause_info = engine.get_pause_info()
        return jsonify({
            "message": "Backend is working!",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "running": running,
            "paused": pause_info["paused"],
            "engine_exists": engine is not None,
            "engine_phase": engine.phase,
            "engine_stage_time": engine.stage_time,
            "engine_phase_elapsed": engine.phase_elapsed_s,
            "latest_data_phase": latest_data.get("phase", "None"),
            "latest_data_stage_time": latest_data.get("stage_time", "None"),
            "pause_elapsed": pause_info["pause_elapsed"]
        })
    return jsonify({
        "message": "Backend is working!",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "running": running,
        "paused": False,
        "engine_exists": False,
        "engine_phase": "None",
        "engine_stage_time": "None",
        "engine_phase_elapsed": "None",
        "latest_data_phase": latest_data.get("phase", "None"),
        "latest_data_stage_time": latest_data.get("stage_time", "None"),
        "pause_elapsed": 0
    })

@app.route('/force_update', methods=['POST'])
def force_update():
    """Force a single simulation update to test if it's working."""
    global engine, latest_data
    try:
        if engine:
            # Force one update
            engine.update(1.0)
            snapshot = engine.to_latest_data()
            latest_data.update(snapshot)
            
            return jsonify({
                "message": "Forced update successful",
                "new_phase": engine.phase,
                "new_stage_time": engine.stage_time,
                "new_phase_elapsed": engine.phase_elapsed_s,
                "snapshot": snapshot
            })
        else:
            return jsonify({"error": "No engine available"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run()