import requests
import time

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    report = ["# API Test Report: KardiaTwin Backend Server\n"]
    report.append(f"Testing against running server at {BASE_URL}...\n")
    
    # 1. Test /biological_age without auth
    # To test this, we first need to start a simulation to set the engine state.
    
    # Profile: 40y/o, Smoker, Sedentary
    start_payload = {
        "age": 40,
        "sex": "1",
        "cp": "0",
        "smoking_status": "smoker",
        "diabetes_history": "none",
        "alcohol_consumption": "none",
        "activity_level": "sedentary"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/start", json=start_payload)
        resp.raise_for_status()
        report.append("## 1. Simulation Start (/start)")
        report.append(f"✅ Successfully started simulation for a 40 y/o Sedentary Smoker.")
        
        # Give engine a tiny bit of time to init
        time.sleep(0.5)

        # 2. Check Biological Age
        age_resp = requests.get(f"{BASE_URL}/biological_age")
        age_data = age_resp.json()
        report.append("\n## 2. Biological Age (/biological_age)")
        # Expectation: 40 + 5 (smoker) + 4 (sedentary) = 49
        if age_data.get("heart_age") == 49.0:
            report.append(f"✅ Biological age correctly calculated as 49. (Adjustment: +9)")
        else:
            report.append(f"❌ Biological age incorrect. Returned: {age_data}")

        # 3. Check What-If Analysis
        whatif_payload = {
            "smoking_status": "non_smoker",
            "activity_level": "active"
        }
        whatif_resp = requests.post(f"{BASE_URL}/what_if_analysis", json=whatif_payload)
        whatif_data = whatif_resp.json()
        
        report.append("\n## 3. What-If Scenario Analysis (/what_if_analysis)")
        report.append(f"Tested hypothetical scenario: Non-Smoker, Active.")
        report.append(f"Current SBP Modifier: {whatif_data.get('current_sbp')}")
        report.append(f"Hypothetical SBP Modifier: {whatif_data.get('hypothetical_sbp')}")
        report.append(f"Improvement %: {whatif_data.get('improvement')}%")
        
        if whatif_data.get('improvement') > 0:
            report.append("✅ What-If correctly predicts improvement based on lifestyle changes.")
        else:
            report.append("❌ What-If logic failed to show improvement.")

        # 4. Check status and ensure simulation is running
        status_resp = requests.get(f"{BASE_URL}/status")
        status_data = status_resp.json()
        report.append("\n## 4. Simulation Status (/status)")
        if status_data.get("running"):
            report.append(f"✅ Engine is actively running in '{status_data.get('phase')}' phase.")
        else:
            report.append(f"❌ Engine is not running.")
            
        # 5. Stop Simulation
        stop_resp = requests.post(f"{BASE_URL}/stop_simulation")
        report.append("\n## 5. Stop Simulation (/stop_simulation)")
        if stop_resp.status_code == 200:
            report.append("✅ Successfully stopped active simulation.")
            
    except Exception as e:
        report.append(f"\n❌ Error during API testing: {e}")

    # Write report to markdown
    report_text = "\n".join(report)
    with open("api_test_report.md", "w", encoding="utf-8") as f:
        f.write(report_text)
    
    print("\n--- TEST COMPLETE ---")
    print(report_text)

if __name__ == "__main__":
    run_tests()
