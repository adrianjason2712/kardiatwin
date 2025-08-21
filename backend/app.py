import asyncio
import websockets
import joblib
import json
import random
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
import threading

# Load the ML model
model = joblib.load("C:\\Users\\mjona\\CardioTwin\\backend\\heart_model.pkl")

app = Flask(__name__)
CORS(app)  # Enable CORS for React Frontend

# Store latest prediction
latest_prediction = {"prediction": "Waiting for data..."}

# Simulated Data Generation
def generate_patient_data():
    return np.random.rand(13).tolist()  # Simulate 13 heart-related values

# Predict Function
def predict_disease(data):
    input_data = np.array(data).reshape(1, -1)
    prediction = model.predict(input_data)
    return "Disease Detected" if prediction[0] == 1 else "No Disease"

# API Route to Get Prediction
@app.route("/predict", methods=["GET"])
def get_prediction():
    patient_data = generate_patient_data()
    prediction = predict_disease(patient_data)

    global latest_prediction
    latest_prediction = {"prediction": prediction, "data": patient_data}

    return jsonify(latest_prediction)

async def send_live_data(websocket, path):
    while True:
        data = {"message": "Hello from WebSocket!"}  # Send a JSON object
        await websocket.send(json.dumps(data))  # Convert dict to JSON string
        await asyncio.sleep(1)

def start_websocket():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    server = websockets.serve(send_live_data, "localhost", 5001)
    loop.run_until_complete(server)
    loop.run_forever()

# Run Flask & WebSocket Together
if __name__ == "__main__":
    threading.Thread(target=start_websocket, daemon=True).start()
    app.run(host="0.0.0.0", port=5000, debug=True)