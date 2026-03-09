# KardiaTwin Backend API

A FastAPI-based cardiac stress test simulator with real-time monitoring and ML-based risk prediction.

---

## Quick Start

### 1. Install Dependencies

```bash
pip install fastapi uvicorn sqlalchemy python-dotenv pydantic[email] passlib[bcrypt] python-jose[cryptography] scikit-learn pandas
```

### 2. Run the Server

```bash
cd backend
uvicorn main:app --reload
```

Server runs on `http://localhost:8000`

---

## Environment Variables

Create a `.env` file in the backend folder:

```env
# Database
DATABASE_URL=sqlite:///data/simulation_sessions.db
# Or PostgreSQL: postgresql://user:password@localhost/kardiatwin

# Authentication
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

---

## API Endpoints

### Authentication

#### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "john",
  "email": "john@example.com",
  "password": "SecurePass123"
}

Response (201):
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "john",
    "email": "john@example.com",
    "created_at": "2024-01-22T10:30:00"
  }
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "john",
  "password": "SecurePass123"
}

Response (200):
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": { ... }
}
```

#### Refresh Token
```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGci..."
}

Response (200):
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": { ... }
}
```

#### Get Current User
```bash
GET /api/auth/me
Authorization: Bearer <access_token>

Response (200):
{
  "id": 1,
  "username": "john",
  "email": "john@example.com",
  "created_at": "2024-01-22T10:30:00"
}
```

---

### Simulation

#### Start Simulation
```bash
POST /start
Content-Type: application/json
Authorization: Bearer <access_token> (optional)

{
  "age": 45,
  "sex": "1",           // 1=male, 0=female
  "cp": "0",            // chest pain type
  "fbs": "0",           // fasting blood sugar
  "restecg": "0",       // resting ECG
  "slope": "1",         // ST slope
  "ca": "0",            // major vessels
  "thal": "2",          // thalassemia
  "smoking_status": "non_smoker",
  "diabetes_history": "none",
  "alcohol_consumption": "none",
  "activity_level": "active",
  "session_name": "Morning Test",
  "simulation": {
    "rest_duration_s": 60,
    "exercise_duration_s": 180,
    "recovery_duration_s": 120,
    "protocol": "standard"
  }
}

Response (200):
{
  "message": "Simulation started",
  "protocol": "standard",
  "session_id": 123,
  "exercise_stages": [
    {"stage_num": 1, "duration": 180, "workload": 1},
    {"stage_num": 2, "duration": 180, "workload": 2},
    {"stage_num": 3, "duration": 180, "workload": 3}
  ],
  "total_exercise_duration": 540
}
```

#### Get Prediction (Real-time)
```bash
GET /prediction

Response (200):
{
  "trestbps": 125.3,           // systolic BP
  "dbp": 78.5,                 // diastolic BP
  "chol": 200,                 // cholesterol
  "thalach": 110.2,            // heart rate
  "exang": 0,                  // exercise-induced angina
  "oldpeak": 1.2,              // ST depression
  "phase": "exercise",         // rest, exercise, recovery
  "workload_level": 1.5,
  "prediction": {
    "risk_level": "Low Risk",
    "probability": 25.4,       // percentage
    "confidence": "High"
  },
  "trend": "Stable",           // Stable, Improving, Worsening
  "prediction_history": [
    {"time": 0, "probability": 20.1, "risk_level": "Low Risk", "phase": "rest"},
    {"time": 10, "probability": 22.5, "risk_level": "Low Risk", "phase": "exercise"}
  ],
  "protocol": "standard",
  "stage": 1,
  "stage_time": 45
}
```

#### Stop Simulation
```bash
POST /stop_simulation

Response (200):
{
  "message": "Stopped"
}
```

#### Pause Simulation
```bash
POST /pause_simulation

Response (200):
{
  "message": "Paused"
}
```

#### Resume Simulation
```bash
POST /resume_simulation

Response (200):
{
  "message": "Resumed"
}
```

#### Get Status
```bash
GET /status

Response (200):
{
  "running": true,
  "paused": false,
  "phase": "exercise"
}
```

#### Get Prediction History
```bash
GET /prediction_history

Response (200):
{
  "history": [
    {"time": 0, "probability": 20.1, "risk_level": "Low Risk", "phase": "rest"},
    {"time": 10, "probability": 22.5, "risk_level": "Low Risk", "phase": "exercise"}
  ],
  "trend": "Stable"
}
```

---

### Simulation History (Authenticated Only)

#### List Simulations
```bash
GET /api/simulations?limit=10&offset=0
Authorization: Bearer <access_token>

Response (200):
{
  "sessions": [
    {
      "id": 1,
      "created_at": "2024-01-22T10:30:00",
      "protocol": "standard",
      "duration": 540,          // seconds
      "risk_score": 25.4
    }
  ],
  "total": 5,
  "limit": 10,
  "offset": 0
}
```

#### Delete Simulation
```bash
DELETE /api/simulations/1
Authorization: Bearer <access_token>

Response (200):
{
  "message": "Simulation deleted successfully"
}
```

---

### Analysis

#### What-If Analysis
```bash
POST /what_if_analysis
Content-Type: application/json

{
  "smoking_status": "non_smoker",
  "diabetes_history": "none",
  "alcohol_consumption": "none",
  "activity_level": "athlete"
}

Response (200):
{
  "current_sbp": 1.15,
  "hypothetical_sbp": 1.08,
  "improvement": 6.1         // percentage improvement
}
```

#### Biological Age
```bash
GET /biological_age

Response (200):
{
  "heart_age": 48.5,
  "actual_age": 45,
  "age_difference": 3.5,     // positive = older, negative = younger
  "status": "good"           // excellent, good, poor
}
```

---

### Configuration

#### Get Protocols
```bash
GET /protocols

Response (200):
{
  "standard": "Standard Bruce - 3 stages, 3 min each",
  "modified_bruce": "Modified Bruce - 4 stages, 5 min each"
}
```

#### Get Alert Thresholds
```bash
GET /thresholds

Response (200):
{
  "heart_rate_high": 170,
  "heart_rate_low": 50,
  "blood_pressure_high": 140,
  "blood_pressure_low": 90,
  "st_depression_high": 2.0
}
```

#### Update Thresholds
```bash
POST /thresholds
Content-Type: application/json

{
  "heart_rate_high": 180,
  "blood_pressure_high": 150
}

Response (200):
{
  "thresholds": {
    "heart_rate_high": 180,
    "heart_rate_low": 50,
    "blood_pressure_high": 150,
    "blood_pressure_low": 90,
    "st_depression_high": 2.0
  }
}
```

---

## Authentication Flow

### 1. Register & Login
```
User creates account → Get access_token + refresh_token → Store in localStorage
```

### 2. Make API Requests
```
GET /api/simulations
Authorization: Bearer <access_token>
→ Server verifies token signature
→ Returns data
```

### 3. Handle Token Expiry
```
Access token expires (30 min)
→ Frontend gets 401 error
→ Frontend sends refresh_token to /api/auth/refresh
→ Get new access_token
→ Retry request with new token
```

### 4. Logout
```
Clear localStorage: remove access_token, refresh_token, user
→ Frontend redirects to login
```

---

## JWT Tokens

### Access Token (30 minutes)
```
Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "sub": 1,              // user ID
  "exp": 1674556800,     // expiration time
  "iat": 1674470400      // issued at
}

Signature:
HMACSHA256(header.payload, SECRET_KEY)
```

### Refresh Token (7 days)
```
Payload:
{
  "sub": 1,              // user ID
  "exp": 1674901200,     // 7 days from now
  "type": "refresh"      // marks as refresh token
}
```

See `JWT_EXPLANATION.md` for detailed examples with real tokens.

---

## Database Models

### User
```python
id: int (primary key)
username: str (unique)
email: str (unique, validated)
password_hash: str (bcrypt)
created_at: datetime
last_login: datetime (nullable)
is_active: bool
```

### SimulationSession
```python
id: int (primary key)
name: str
user_id: int (FK to User, nullable for guests)
created_at: datetime
simulation_type: str (stress_test, heart_age, what_if)
protocol: str (standard, modified_bruce)
duration: int (seconds)
risk_score: float (0-100)
user_data: JSON (stored request parameters)
patient_age: int
patient_gender: str (M/F)
```

---

## Error Handling

### Standard Errors
```json
401 Unauthorized
{
  "detail": "Invalid or expired token"
}

400 Bad Request
{
  "detail": "Login failed"
}

409 Conflict
{
  "detail": "Username or email already registered"
}

404 Not Found
{
  "detail": "Simulation not found or not authorized"
}
```

---

## File Structure

```
backend/
├── main.py              # FastAPI app + endpoints
├── auth.py              # JWT token management
├── models.py            # SQLAlchemy database models
├── schemas.py           # Pydantic validation models
├── dependencies.py      # FastAPI dependencies (auth)
├── train_model.py       # ML model training
├── heart_model.pkl      # Trained ML model
└── data/
    └── simulation_sessions.db  # SQLite database
```

---

## Testing

### Test Registration
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"Test@1234"}'
```

### Test Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test@1234"}'
```

### Test Protected Endpoint
```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <your_access_token>"
```

### Test Simulation
```bash
curl -X POST http://localhost:8000/start \
  -H "Content-Type: application/json" \
  -d '{"age":45,"sex":"1","cp":"0"}'

# Get real-time data
curl -X GET http://localhost:8000/prediction
```

---

## Troubleshooting

### Server won't start
```
ERROR: Could not import module "main"
```
→ Make sure you're in the `backend` folder
→ Run: `cd backend && uvicorn main:app --reload`

### 401 Unauthorized errors
```
{"detail": "Invalid or expired token"}
```
→ Token expired (30 min), use refresh endpoint
→ Token invalid, login again
→ Authorization header format: `Bearer <token>` (with space)

### Bcrypt warning
```
(trapped) error reading bcrypt version
```
→ Harmless warning, upgrade bcrypt: `pip install --upgrade bcrypt`

### ML model errors
```
X does not have valid feature names
```
→ Harmless sklearn warning, ignore it

---

## Production Deployment

1. **Change SECRET_KEY**
   ```
   Generate: python -c "import secrets; print(secrets.token_urlsafe(32))"
   Set in .env
   ```

2. **Use PostgreSQL**
   ```
   DATABASE_URL=postgresql://user:password@localhost/kardiatwin
   ```

3. **Disable debug mode**
   ```python
   uvicorn main:app --reload  # Remove --reload
   ```

4. **Use HTTPS**
   ```
   Only send tokens over HTTPS
   Set secure cookies in production
   ```

5. **CORS Configuration**
   ```python
   # In main.py, update allowed origins
   allow_origins=["https://yourdomain.com"]  # Change from "*"
   ```

---

## Support

See `JWT_EXPLANATION.md` for detailed JWT examples.

For more help: `/help`
