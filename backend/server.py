import random
import time
import threading
import pickle
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from threading import Lock

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
    "future_predictions": []  # Store future predictions
}

running = False  # Control simulation
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

        # Config
        self.config = {
            "rest_duration_s": 60,
            "exercise_duration_s": 180,
            "recovery_duration_s": 120,
            "max_workload_level": 3
        }
        if config:
            self.config.update(config)

        # Internal timers
        self.phase_elapsed_s = 0.0
        self.hr_increase_rate_per_min = 11.0  # bpm/min during exercise
        self.sbp_increase_per_level = 12.0    # mmHg per workload level
        self.recovery_start_hr = self.hr
        self.recovery_flagged = False

    def _to_next_phase(self, next_phase):
        self.phase = next_phase
        self.phase_elapsed_s = 0.0
        if next_phase == "rest":
            self.exang = 0
            self.workload_level = 0
            self.recovery_flagged = False
        elif next_phase == "exercise":
            self.exang = 1
            self.workload_level = 1
            # Draw fresh parameters for this exercise bout
            self.hr_increase_rate_per_min = random.uniform(10.0, 12.0)
            self.sbp_increase_per_level = random.uniform(10.0, 15.0)
        elif next_phase == "recovery":
            self.exang = 0
            self.recovery_start_hr = self.hr
            self.recovery_flagged = False

    def _update_rest(self, dt):
        # Drift towards baseline with small noise
        self.hr += (self.baseline_hr - self.hr) * min(1.0, dt/15.0) + random.uniform(-0.2, 0.2)
        self.sbp += (self.baseline_sbp - self.sbp) * min(1.0, dt/20.0) + random.uniform(-0.5, 0.5)
        self.dbp += (self.baseline_dbp - self.dbp) * min(1.0, dt/20.0) + random.uniform(-0.3, 0.3)
        self.oldpeak += (self.baseline_oldpeak - self.oldpeak) * min(1.0, dt/20.0) + random.uniform(-0.02, 0.02)

        if self.phase_elapsed_s >= self.config["rest_duration_s"]:
            self._to_next_phase("exercise")

    def _update_exercise(self, dt):
        # Determine workload progression
        max_level = max(1, int(self.config["max_workload_level"]))
        segment = self.config["exercise_duration_s"] / max_level
        new_level = min(max_level, int(self.phase_elapsed_s // max(1, segment)) + 1)
        self.workload_level = new_level

        # HR increases 10–12 bpm per minute during exercise
        hr_increase_per_sec = self.hr_increase_rate_per_min / 60.0
        self.hr = min(195.0, self.hr + hr_increase_per_sec * dt + random.uniform(-0.2, 0.4))

        # SBP rises 10–15 mmHg per workload level; approach target smoothly
        target_sbp = self.baseline_sbp + self.sbp_increase_per_level * self.workload_level
        sbp_delta = target_sbp - self.sbp
        self.sbp += np.clip(sbp_delta, -3.0, 3.0)  # limit per-second change

        # DBP stable or slight increase
        target_dbp = self.baseline_dbp + min(5.0, 0.8 * self.workload_level)
        dbp_delta = target_dbp - self.dbp
        self.dbp += np.clip(dbp_delta, -1.0, 1.0)

        # ST depression mild increase with workload in healthy individuals; noise
        target_oldpeak = self.baseline_oldpeak + 0.1 * self.workload_level
        self.oldpeak += np.clip(target_oldpeak - self.oldpeak, -0.05, 0.05) + random.uniform(-0.01, 0.01)

        if self.phase_elapsed_s >= self.config["exercise_duration_s"]:
            self._to_next_phase("recovery")

    def _update_recovery(self, dt):
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
            self._to_next_phase("rest")

    def update(self, dt):
        self.phase_elapsed_s += dt
        if self.phase == "rest":
            self._update_rest(dt)
        elif self.phase == "exercise":
            self._update_exercise(dt)
        elif self.phase == "recovery":
            self._update_recovery(dt)

    def to_latest_data(self):
        return {
            "trestbps": int(round(self.sbp)),
            "dbp": int(round(self.dbp)),
            "chol": 200,
            "thalach": int(round(self.hr)),
            "exang": 1 if self.exang else 0,
            "oldpeak": round(float(self.oldpeak), 2),
            "phase": self.phase,
            "workload_level": int(self.workload_level)
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
        return events

@app.route('/start', methods=['POST'])
def start_simulation():
    """Start the simulation with user inputs and optional simulation plan."""
    global user_static_data, running, engine
    data = request.json or {}

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

    # Reset engine with new configuration
    engine = PhysiologySimulationEngine(config=cfg)
    running = True
    print("[INFO] Simulation started with:", user_static_data)
    print("[INFO] Engine config:", engine.config)
    print("[INFO] Running flag set to:", running)
    return jsonify({"message": "Simulation started", "engine_config": engine.config})

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

    last_tick = time.time()
    while True:
        if not running:
            # Idle but keep loop alive
            time.sleep(0.5)
            last_tick = time.time()
            continue

        now = time.time()
        dt = max(0.5, min(2.0, now - last_tick))  # clamp dt between 0.5s and 2s
        last_tick = now

        try:
            engine.update(dt)

            with data_lock:
                # Pull engine state into latest_data
                sim_snapshot = engine.to_latest_data()
                latest_data.update(sim_snapshot)

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
            print("❌ Error in Simulation/Prediction:", e)
            with data_lock:
                latest_data["prediction"] = "Error"

        time.sleep(1)

# Start the simulation thread
engine = PhysiologySimulationEngine()
threading.Thread(target=simulate_physiology_engine, daemon=True).start()
print("[INFO] Physiology simulation thread started.")


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

if __name__ == "__main__":
    print("[INFO] Starting Flask server...")
    app.run(debug=True)