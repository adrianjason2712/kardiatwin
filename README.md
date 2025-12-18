# KardiaTwin

Cardio Twin is a real-time heart monitoring application that offers advanced cardiac simulation capabilities.

## Features
- Real-time heart monitoring simulation
- Advanced cardiac simulation experience

## Technologies Used
- **Frontend:** React with Vite
- **Backend:** Python

# Screenshot

## Installation

### Prerequisites
- Node.js (npm)
- Python

### Frontend Installation
```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Backend Installation
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the Python server
python server.py
```

## Usage
- Access the application through your browser after starting both frontend and backend servers.
- Monitor and simulate cardiac data in real-time.

## Documentation

### Input Parameters Guide
**For detailed information about how each input parameter affects your simulation results, see:**
- 📖 **[README_SIMULATION_INPUTS.md](./README_SIMULATION_INPUTS.md)** - Comprehensive guide explaining:
  - How Age affects heart rate response, recovery, and protocol selection
  - Gender impact on baseline vitals and risk prediction
  - Chest Pain Type and exercise recommendations
  - Protocol selection (Standard Bruce vs Modified Bruce)
  - Lifestyle factors: Smoking, Diabetes, Alcohol, Activity Level
  - How modifiers work together
  - Understanding your test results
  - Quick reference tables and risk factor combinations

### Quick Start for New Users
1. Select your **Age** (18-100) using the slider
2. Choose your **Gender** (Male/Female)
3. Select your **Chest Pain Type** (if applicable)
4. **Exercise Protocol** auto-selects (age < 60 → Standard Bruce, age ≥ 60 → Modified Bruce)
   - You can override this choice if needed
5. (Optional) Fill in **Lifestyle & Medical History** for more personalized results
6. Click "Start Simulation" to begin

**Note:** Modified Bruce Protocol is recommended and auto-selected for patients 60+, following medical standards for safer stress testing.

