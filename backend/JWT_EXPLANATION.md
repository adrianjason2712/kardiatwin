# JWT (JSON Web Token) Explanation

## What is JWT?

JWT is a token-based authentication method. Instead of storing sessions on the server, the server gives the client a signed token. The client sends this token with every request, and the server verifies it without needing a database lookup.

---

## JWT Structure

A JWT consists of 3 parts separated by dots (`.`):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMywiZXhwIjoxNjc0NTU2ODAwfQ.kqxMq3cz...
│                                           │                                           │
└─────────────── Header ──────────────────┘ └─────── Payload ──────────┘ └────── Signature ─────┘
```

### 1. Header (Encoded)
```json
{
  "alg": "HS256",    // Algorithm: HMAC SHA-256
  "typ": "JWT"       // Token type
}
```
**Base64 Encoded:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`

### 2. Payload (Encoded)
```json
{
  "sub": 123,                    // Subject (user ID)
  "exp": 1674556800,             // Expiration time (Unix timestamp)
  "iat": 1674470400,             // Issued at
  "type": "access"               // Token type (access or refresh)
}
```
**Base64 Encoded:** `eyJzdWIiOjEyMywiZXhwIjoxNjc0NTU2ODAwfQ`

### 3. Signature (Encrypted)
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  SECRET_KEY
)
```
**Result:** `kqxMq3cz...` (unique hash)

---

## Real Example from KardiaTwin

### Step 1: User Registration

**Frontend sends:**
```json
POST /api/auth/register
{
  "username": "john",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Backend receives:**
- Hashes password: `SecurePass123` → `$2b$12$...` (bcrypt hash)
- Stores in database

**Backend creates tokens:**

#### Access Token (Expires in 30 minutes)
```python
payload = {
  "sub": 5,                    # user ID
  "exp": 1674556800,           # 30 min from now
  "type": "access"             # not needed for access tokens but can be added
}
encoded = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
# Result: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.signature...
```

#### Refresh Token (Expires in 7 days)
```python
payload = {
  "sub": 5,                    # user ID
  "exp": 1674901200,           # 7 days from now
  "type": "refresh"            # marks this as refresh token
}
encoded = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
# Result: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDkwMTIwMCwidHlwZSI6InJlZnJlc2gifQ.signature...
```

**Backend returns:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.signature...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDkwMTIwMCwidHlwZSI6InJlZnJlc2gifQ.signature...",
  "token_type": "bearer",
  "user": {
    "id": 5,
    "username": "john",
    "email": "john@example.com"
  }
}
```

---

### Step 2: Frontend Stores Tokens

**localStorage:**
```javascript
localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
localStorage.setItem('refresh_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
localStorage.setItem('user', JSON.stringify({id: 5, username: 'john', ...}))
```

---

### Step 3: Frontend Makes API Request

**Frontend sends:**
```
GET /api/simulations
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.signature...
```

---

### Step 4: Backend Validates Token

**Code in dependencies.py:**
```python
async def get_current_user(authorization: Optional[str] = Header(None)):
    # Extract token from "Bearer <token>"
    token = authorization.split(" ")[1]
    # "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.signature..."

    # Decode and verify signature
    payload = verify_token(token, token_type="access")
    # verify_token does:
    # 1. Extract the 3 parts (header.payload.signature)
    # 2. Recreate signature: HMACSHA256(header.payload, SECRET_KEY)
    # 3. Compare with provided signature
    # 4. If match → payload is valid
    # 5. Check if expired: exp > current_time

    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # payload = {"sub": 5, "exp": 1674556800}
    user_id = payload.get("sub")  # 5

    # Get user from database
    user = db.query(User).filter(User.id == user_id).first()
    return user
```

**Backend returns:**
```json
{
  "id": 5,
  "username": "john",
  "email": "john@example.com",
  "simulations": [...]
}
```

---

### Step 5: Token Expires (30 minutes later)

**Frontend tries to make request:**
```
GET /api/simulations
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Backend checks token:**
```python
payload = jwt.decode(token, SECRET_KEY, algorithm="HS256")
# exp = 1674556800, current_time = 1674557000
# exp < current_time → Token EXPIRED!
raise HTTPException(status_code=401)
```

**Frontend receives 401 response:**
```javascript
// In axios.ts interceptor
if (error.response?.status === 401) {
    // Token expired, use refresh token
    const refreshToken = localStorage.getItem('refresh_token')

    const response = await axios.post('/api/auth/refresh', {
        refresh_token: refreshToken
    })
    // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDkwMTIwMCwidHlwZSI6InJlZnJlc2gifQ.signature...
}
```

**Backend validates refresh token:**
```python
@app.post("/api/auth/refresh")
async def refresh_token_endpoint(req: TokenRefreshRequest):
    payload = verify_token(req.refresh_token, token_type="refresh")
    # Checks:
    # 1. Signature is valid
    # 2. Token not expired
    # 3. type == "refresh"

    if not payload:
        raise HTTPException(status_code=401)

    user_id = payload.get("sub")  # 5

    # Create NEW access token
    access_token = create_access_token(data={"sub": user_id})
    # New token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.NEW_SIGNATURE...

    return {
        "access_token": access_token,
        "refresh_token": refreshToken,  # Return same refresh token (can be new too)
        "token_type": "bearer"
    }
```

**Frontend stores new token:**
```javascript
localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.NEW_SIGNATURE...')

// Retry original request with new token
return API(originalRequest)  // GET /api/simulations with new token
```

**Backend accepts new token and returns data** ✅

---

## Why JWT?

| Feature | Benefit |
|---------|---------|
| **Stateless** | No database lookup needed to verify token |
| **Fast** | Just signature verification (no DB query) |
| **Secure** | Can't be forged (only server knows SECRET_KEY) |
| **Scalable** | Works with multiple servers (no session sharing needed) |
| **Mobile Friendly** | Works with mobile apps, SPAs, etc |

---

## Security in KardiaTwin

1. **SECRET_KEY** - Never shared, only server knows
   ```python
   SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
   ```

2. **Password Hashing** - Bcrypt, not plaintext
   ```python
   hashed = get_password_hash("SecurePass123")  # → $2b$12$...
   verify_password("SecurePass123", hashed)     # → True
   ```

3. **Token Expiration** - Access token expires in 30 min
   ```python
   ACCESS_TOKEN_EXPIRE_MINUTES = 30
   ```

4. **Refresh Token** - Longer expiration (7 days) for getting new access tokens
   ```python
   REFRESH_TOKEN_EXPIRE_DAYS = 7
   ```

5. **HTTPS** - Use in production (prevents token interception)

---

## Timeline

```
User Registration
└─> Create User + Hash Password
└─> Create Access Token (30 min)
└─> Create Refresh Token (7 days)
└─> Return tokens to client

Client makes request (0-30 min)
└─> Send request with Access Token
└─> Server verifies → Success ✅

Client makes request (30 min passed)
└─> Send request with expired Access Token
└─> Server rejects → 401 ❌
└─> Client sends Refresh Token
└─> Server creates NEW Access Token
└─> Client retries with new token
└─> Server verifies → Success ✅

Client makes request (7 days passed)
└─> Both Access & Refresh tokens expired
└─> User must login again ❌
```

---

## In Code

**Login:**
```bash
POST /api/auth/login
{ "username": "john", "password": "SecurePass123" }
→ Returns access_token + refresh_token
```

**Use API:**
```bash
GET /api/simulations
Authorization: Bearer <access_token>
→ Returns simulations ✅
```

**Token Expired (30 min later):**
```bash
GET /api/simulations
Authorization: Bearer <expired_access_token>
→ Returns 401 ❌
```

**Get New Token:**
```bash
POST /api/auth/refresh
{ "refresh_token": "<refresh_token>" }
→ Returns new access_token ✅
```

**Retry:**
```bash
GET /api/simulations
Authorization: Bearer <new_access_token>
→ Returns simulations ✅
```

---

That's it! JWT is just a signed message that proves who you are, and the server can verify it without storing anything.
