import requests
import time

BASE_URL = "http://127.0.0.1:8000"

def trigger_alerts():
    print("--- STARTING ALERT TRIGGER TEST ---")
    
    # 1. Register/Login to get an authenticated session
    user_payload = {
        "username": "watchdog_tester",
        "email": "watchdog@test.com",
        "password": "password123"
    }
    
    try:
        # Try login first
        print("Checking authentication...")
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=user_payload)
        if resp.status_code != 200:
            print("Registering new test user...")
            requests.post(f"{BASE_URL}/api/auth/register", json=user_payload)
            resp = requests.post(f"{BASE_URL}/api/auth/login", json=user_payload)
        
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✓ Authenticated")
        
        # 2. Set very aggressive thresholds to trigger alerts quickly
        print("Setting aggressive thresholds for testing...")
        threshold_payload = {
            "heart_rate_high": 60, # Very low to trigger HR alert immediately
            "blood_pressure_high": 120, # Low to trigger BP alert
            "st_depression_high": 0.5 # Low to trigger ST alert
        }
        requests.post(f"{BASE_URL}/thresholds", json=threshold_payload, headers=headers)
        
        # 3. Start simulation
        start_payload = {
            "age": 80,
            "sex": "1",
            "cp": "2",
            "smoking_status": "smoker",
            "diabetes_history": "type_1",
            "alcohol_consumption": "heavy",
            "activity_level": "sedentary"
        }
        
        print("🚀 Starting simulation with High-Risk parameters...")
        start_resp = requests.post(f"{BASE_URL}/start", json=start_payload, headers=headers)
        if start_resp.status_code != 200:
            print(f"❌ Failed to start simulation: {start_resp.text}")
            return

        # 4. Monitor for alerts
        print("⏱ Monitoring alerts for 15 seconds (expecting debounced results)...")
        found_alerts = False
        for i in range(15):
            time.sleep(1)
            resp = requests.get(f"{BASE_URL}/alerts", headers=headers)
            if resp.status_code == 200:
                alerts = resp.json().get("alerts", [])
                if alerts:
                    found_alerts = True
                    print(f"[{i+1}s] 🚨 ALERT(S) FOUND: {len(alerts)}")
                    for a in alerts[:3]: # Show first 3
                        print(f"  - [{a['severity'].upper()}] {a['alert_type']}: {a['message']}")
                else:
                    print(f"[{i+1}s] .")
            else:
                print(f"[{i+1}s] Error fetching alerts: {resp.status_code}")
                
        if not found_alerts:
            print("❌ FAILED: No alerts were recorded in the database.")
        else:
            print("✅ SUCCESS: Watchdog successfully triggered and persisted alerts.")
            
        # 5. Stop simulation
        requests.post(f"{BASE_URL}/stop_simulation", headers=headers)
        print("--- TEST COMPLETE ---")

    except Exception as e:
        print(f"❌ Critical Test Error: {e}")

if __name__ == "__main__":
    trigger_alerts()
