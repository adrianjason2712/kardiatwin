import requests
import time

SERVER_URL = "http://localhost:5000/prediction"  # Fetch from server

def fetch_data():
    """Continuously fetch prediction data from the server."""
    while True:
        try:
            response = requests.get(SERVER_URL)
            if response.status_code == 200:
                data = response.json()
                print("Latest Prediction:", data["prediction"])
            else:
                print("Error: Unexpected response from server")
        except Exception as e:
            print("Error fetching data:", e)

        time.sleep(3)  # Fetch every 3 seconds

if __name__ == "__main__":
    fetch_data()