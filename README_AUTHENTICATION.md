# JWT Authentication System

This document explains the JWT (JSON Web Token) authentication system used in the KardiaTwin application.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [JWT Token Structure](#jwt-token-structure)
4. [API Endpoints](#api-endpoints)
5. [Frontend Integration](#frontend-integration)
6. [Authentication Flow](#authentication-flow)
7. [Token Refresh Mechanism](#token-refresh-mechanism)
8. [Configuration](#configuration)
9. [Security Features](#security-features)
10. [Examples](#examples)

---

## Overview

KardiaTwin uses **JWT (JSON Web Token)** for stateless authentication. The system provides:

- **Stateless Authentication:** Tokens contain all user information, no server-side session storage needed
- **Token-Based Authorization:** Each API request includes a JWT token in the `Authorization` header
- **Automatic Token Refresh:** Short-lived access tokens with long-lived refresh tokens for seamless user experience
- **Guest Mode Support:** Some endpoints work for both authenticated and unauthenticated users
- **Secure Password Storage:** Passwords hashed with bcrypt algorithm

---

## Architecture

### Backend (FastAPI)

**Key Files:**
- `backend/auth.py` - JWT token creation/verification, password hashing
- `backend/dependencies.py` - FastAPI dependency injection for route protection
- `backend/main.py` - Authentication endpoints and protected routes
- `backend/models.py` - User database model

### Frontend (React + TypeScript)

**Key Files:**
- `src/contexts/AuthContext.tsx` - Global authentication state management
- `src/pages/LoginPage.tsx` - User login UI
- `src/pages/RegisterPage.tsx` - User registration UI
- `src/components/ProtectedRoute.tsx` - Route-level protection wrapper
- `src/utils/axios.ts` - Axios HTTP client with token injection and refresh logic

---

## JWT Token Structure

### Token Format

A JWT token consists of three parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImV4cCI6MTY3MjUwMjQwMH0.signature
        [Header]          .         [Payload]          .      [Signature]
```

### Access Token (Payload)

**Expiration:** 30 minutes

```json
{
  "sub": 1,           // User ID (subject)
  "exp": 1672502400  // Expiration time (Unix timestamp in seconds)
}
```

### Refresh Token (Payload)

**Expiration:** 7 days

```json
{
  "sub": 1,           // User ID
  "type": "refresh",  // Token type identifier
  "exp": 1673107200  // Expiration time (Unix timestamp in seconds)
}
```

### Token Algorithm

- **Algorithm:** HS256 (HMAC with SHA-256)
- **Secret Key:** Environment variable `SECRET_KEY`
- **Encoding:** JWT standard (RFC 7519)

---

## API Endpoints

### 1. Register New User

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "john",
    "email": "john@example.com",
    "created_at": "2024-01-23T10:30:00Z"
  }
}
```

### 2. Login User

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john",
  "password": "securepassword123"
}
```

**Note:** You can use either `username` or `email` for login

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "john",
    "email": "john@example.com",
    "created_at": "2024-01-23T10:30:00Z"
  }
}
```

**Error (401):**
```json
{
  "detail": "Invalid username or password"
}
```

### 3. Refresh Access Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "john",
    "email": "john@example.com",
    "created_at": "2024-01-23T10:30:00Z"
  }
}
```

### 4. Get Current User

```http
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "id": 1,
  "username": "john",
  "email": "john@example.com",
  "created_at": "2024-01-23T10:30:00Z"
}
```

**Error (401):**
```json
{
  "detail": "Not authenticated"
}
```

### 5. Protected Endpoint Example: List Simulations

```http
GET /api/simulations
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "simulations": [
    {
      "id": 1,
      "user_id": 1,
      "name": "Simulation 1",
      "created_at": "2024-01-23T10:30:00Z"
    }
  ]
}
```

---

## Frontend Integration

### 1. AuthContext Hook

The app uses React Context API for global auth state management.

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const {
    isAuthenticated,
    user,
    accessToken,
    login,
    register,
    logout,
    refreshAccessToken
  } = useAuth();

  if (!isAuthenticated) {
    return <p>Please log in</p>;
  }

  return <p>Welcome, {user.username}!</p>;
}
```

### 2. Login Example

```typescript
const { login } = useAuth();

async function handleLogin(username: string, password: string) {
  try {
    await login(username, password);
    // Tokens automatically stored in localStorage
    // User redirected to dashboard
  } catch (error) {
    console.error('Login failed:', error);
  }
}
```

### 3. Protected Routes

```typescript
<ProtectedRoute requireAuth={true}>
  <DashboardPage />
</ProtectedRoute>
```

If user is not authenticated, they're automatically redirected to `/login`.

### 4. Making API Requests

The axios client automatically includes the JWT token:

```typescript
import { API } from '../utils/axios';

// Token is automatically added to Authorization header
const response = await API.get('/api/simulations');
```

---

## Authentication Flow

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER REGISTRATION/LOGIN                                      │
│ ─────────────────────────────────                               │
│ User fills in credentials → Frontend sends to /api/auth/login   │
│ Backend validates password against bcrypt hash                  │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. TOKEN GENERATION                                             │
│ ───────────────────────                                         │
│ Backend creates 2 tokens:                                       │
│  - Access Token (30 min expiry)                                │
│  - Refresh Token (7 day expiry)                                │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. FRONTEND TOKEN STORAGE                                       │
│ ──────────────────────────                                      │
│ localStorage.setItem('access_token', token)                    │
│ localStorage.setItem('refresh_token', token)                   │
│ localStorage.setItem('user', userData)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. MAKING API REQUESTS                                          │
│ ──────────────────────                                          │
│ Frontend adds to every request:                                 │
│ Authorization: Bearer <access_token>                            │
│                                                                 │
│ Backend validates token signature + expiration                 │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. ACCESS TOKEN EXPIRES (After 30 minutes)                      │
│ ────────────────────────────────────────────                   │
│ Next API request with expired token                            │
│ Backend returns 401 Unauthorized                               │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. AUTOMATIC TOKEN REFRESH                                      │
│ ─────────────────────────────────                               │
│ Frontend axios interceptor catches 401                         │
│ Sends refresh token to /api/auth/refresh                       │
│ Receives new access token                                      │
│ Stores new token in localStorage                               │
│ Retries original request with new token                        │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. USER LOGGED OUT                                              │
│ ──────────────────────                                          │
│ Frontend clears localStorage                                    │
│ Redux state reset                                               │
│ User redirected to login page                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Token Refresh Mechanism

### Why Dual Tokens?

- **Access Token (Short-lived, 30 min):**
  - Used for API requests
  - If leaked, exposure is limited to 30 minutes
  - Requires constant verification

- **Refresh Token (Long-lived, 7 days):**
  - Only used to get new access tokens
  - More secure, rarely transmitted
  - User doesn't need to re-enter password for 7 days

### Automatic Refresh Process

```typescript
// 1. Request interceptor - adds token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 2. Response interceptor - handles expired tokens
API.interceptors.response.use(
  response => response,  // Success - return response
  async error => {
    if (error.response?.status === 401 && refreshToken) {
      // Token expired, refresh it
      const newAccessToken = await API.post('/api/auth/refresh', {
        refresh_token: refreshToken
      });

      // Store new token
      localStorage.setItem('access_token', newAccessToken);

      // Retry original request
      return API(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## Configuration

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# JWT Configuration
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
DATABASE_URL=sqlite:///./test.db

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Token Expiration Defaults

```python
# backend/auth.py
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
```

### Frontend Configuration

```typescript
// src/utils/axios.ts
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:8000';
```

---

## Security Features

### 1. Password Security

- **Bcrypt Hashing:** Passwords never stored in plain text
- **Hash Function:** `passlib.context.CryptContext` with bcrypt
- **Verification:** Secure comparison to prevent timing attacks

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hashing password on registration
hashed = pwd_context.hash("user_password")

# Verifying password on login
pwd_context.verify("user_password", hashed)  # True/False
```

### 2. JWT Security

- **Signature Verification:** Token signature verified with SECRET_KEY
- **Expiration Checking:** Server validates token hasn't expired
- **Algorithm:** HS256 (HMAC-SHA256) prevents algorithm confusion attacks

### 3. Token Storage

- **localStorage:** Used for token persistence (accessible via JavaScript)
- **HTTPOnly Cookies:** (Not currently used, but recommended for production)
  - More secure than localStorage, immune to XSS
  - Automatically included in requests

### 4. CORS Protection

- **Configured Domains:** Only specific origins can make requests
- **Credentials:** Cross-origin requests include credentials

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 5. Authorization Header Format

- **Standard Bearer Token:** `Authorization: Bearer <token>`
- **Prevents Token in URL:** Tokens not exposed in browser history

### 6. Secure Defaults

- **Production Mode:** Change `SECRET_KEY` from default
- **HTTPS Only:** Tokens should only be transmitted over HTTPS in production
- **Refresh Token Rotation:** New refresh token issued on refresh

---

## Examples

### Example 1: Complete Login Flow

**Frontend:**

```typescript
import { useAuth } from '../contexts/AuthContext';

function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/dashboard');  // Redirect on success
    } catch (error) {
      alert('Login failed: ' + error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username or Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

**Backend (FastAPI):**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.auth import verify_password, create_access_token, create_refresh_token
from backend.models import User
from backend.database import get_db

router = APIRouter(prefix="/api/auth")

@router.post("/login")
async def login(username: str, password: str, db: Session = Depends(get_db)):
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == username) | (User.email == username)
    ).first()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at
        }
    }
```

### Example 2: Accessing Protected Route

**Frontend:**

```typescript
function Dashboard() {
  const { user } = useAuth();
  const [simulations, setSimulations] = useState([]);

  useEffect(() => {
    // This request automatically includes the access token
    API.get('/api/simulations')
      .then(res => setSimulations(res.data.simulations))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <h1>Welcome, {user.username}</h1>
      <p>Your simulations:</p>
      {simulations.map(sim => <p key={sim.id}>{sim.name}</p>)}
    </div>
  );
}
```

**Backend (Protected Route):**

```python
from fastapi import Depends
from backend.dependencies import get_current_user
from backend.models import User

@app.get("/api/simulations")
async def list_simulations(current_user: User = Depends(get_current_user)):
    # get_current_user dependency:
    # 1. Extracts token from Authorization header
    # 2. Verifies token signature and expiration
    # 3. Fetches user from database
    # 4. Returns user object (or raises 401 if invalid)

    sessions = db.query(SimulationSession).filter(
        SimulationSession.user_id == current_user.id
    ).all()
    return {"simulations": sessions}
```

### Example 3: Handling Token Expiration

When a token expires and is automatically refreshed:

```typescript
// Request with expired token
GET /api/simulations
Authorization: Bearer <expired_token>

// Server responds with 401 Unauthorized

// Frontend interceptor automatically:
// 1. Detects 401 error
// 2. Sends refresh token
POST /api/auth/refresh
{ "refresh_token": "<refresh_token>" }

// Gets new token
// 3. Updates localStorage
// 4. Retries original request
GET /api/simulations
Authorization: Bearer <new_token>

// Request succeeds
```

### Example 4: Guest Mode (Optional Auth)

Some endpoints work without authentication:

```python
from backend.dependencies import get_current_user_optional

@app.post("/start")
async def start_simulation(
    req: StartSimulationRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    # current_user is None if not authenticated, User object if authenticated

    if current_user:
        # Save simulation to user's history
        db_session = SimulationSession(user_id=current_user.id, ...)
        db.add(db_session)
        db.commit()

    # Simulation starts for both authenticated and guest users
    return {"simulation_id": simulation_id}
```

---

## Troubleshooting

### Issue: "Invalid Token" Error

**Possible Causes:**
1. Token expired - frontend should auto-refresh
2. SECRET_KEY changed - tokens signed with old key are invalid
3. Token malformed - check Authorization header format

**Solution:**
```typescript
// Clear tokens and redirect to login
localStorage.removeItem('access_token');
localStorage.removeItem('refresh_token');
window.location.href = '/login';
```

### Issue: Token Not Being Sent

**Check:**
1. Token exists in localStorage
2. Axios interceptor is configured properly
3. Authorization header format: `Bearer <token>`

```typescript
// Debug: Check token in console
console.log(localStorage.getItem('access_token'));

// Check request headers
API.get('/api/auth/me').then(
  res => console.log(res.config.headers.Authorization)
);
```

### Issue: CORS Error During Login

**Solution:** Ensure backend CORS is configured:

```python
CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Best Practices

### For Development

- Use test credentials during development
- Keep `SECRET_KEY` secure, never commit to git
- Test token refresh mechanism
- Verify protected routes work

### For Production

1. **Change SECRET_KEY** - Use a strong, random secret
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. **Use HTTPS Only** - Tokens only over encrypted connections

3. **Consider HTTPOnly Cookies** - More secure than localStorage for tokens
   ```python
   response.set_cookie("access_token", value=token, httponly=True)
   ```

4. **Monitor Token Refresh** - Log suspicious refresh patterns

5. **Implement Token Blacklist** (Optional) - For logout functionality
   - Store revoked tokens in Redis or database
   - Check revocation status before serving request

6. **Rate Limiting** - Limit login attempts to prevent brute force
   ```python
   from slowapi import Limiter

   limiter = Limiter(key_func=get_remote_address)

   @app.post("/api/auth/login")
   @limiter.limit("5/minute")
   async def login(...):
       ...
   ```

7. **Security Headers** - Add protective headers
   ```python
   app.add_middleware(
       TrustedHostMiddleware,
       allowed_hosts=["yourdomain.com"]
   )
   ```

---

## Summary

| Aspect | Details |
|--------|---------|
| **Auth Type** | JWT (JSON Web Token) |
| **Algorithm** | HS256 (HMAC-SHA256) |
| **Access Token Expiry** | 30 minutes |
| **Refresh Token Expiry** | 7 days |
| **Password Storage** | Bcrypt hashing |
| **Token Format** | Bearer token in Authorization header |
| **Auto Refresh** | Yes - axios interceptor |
| **Guest Mode** | Supported on some endpoints |
| **State Management** | React Context API + localStorage |

---

## Additional Resources

- [JWT.io](https://jwt.io/) - JWT explanation and validation tools
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/) - FastAPI authentication docs
- [React Context API](https://react.dev/reference/react/useContext) - React Context documentation
- [Bcrypt Documentation](https://pypi.org/project/bcrypt/) - Bcrypt password hashing
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

