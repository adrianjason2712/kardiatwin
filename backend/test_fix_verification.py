import requests
import json

BASE_URL = "http://localhost:8000"

def test_start_simulation():
    print("Testing /start simulation...")
    
    # Standard request payload
    payload = {
        "age": 45,
        "sex": "1",
        "cp": "0",
        "fbs": "0",
        "restecg": "1",
        "smoking_status": "non_smoker",
        "diabetes_history": "none",
        "alcohol_consumption": "none",
        "activity_level": "active",
        "pad_history": "no_pad",
        "height": 180,
        "weight": 85,
        "simulation": {
            "protocol": "standard",
            "rest_duration_s": 30,
            "exercise_duration_s": 60,
            "recovery_duration_s": 120
        }
    }
    
    try:
        response = requests.post(f"{BASE_URL}/start", json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success! Response:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Failed! Error: {response.text}")
    except Exception as e:
        print(f"Error connecting to server: {e}")

if __name__ == "__main__":
    test_start_simulation()
