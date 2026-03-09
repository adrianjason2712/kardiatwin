# JWT Structure with KardiaTwin Project

## JWT Format

A JWT token consists of 3 parts separated by dots (`.`):

```
HEADER.PAYLOAD.SIGNATURE
```

Example from KardiaTwin:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMywiZXhwIjoxNjc0NTU2ODAwfQ.kqxMq3cz_1234567890abcdefghijklmnop
│                                           │                                           │
└─────────────── PART 1: HEADER ──────────────────┘ └─────── PART 2: PAYLOAD ──────────────┘ └────── PART 3: SIGNATURE ─────┘
```

---

## PART 1: HEADER

### What it is:
The header tells the server **HOW** the token is encoded and signed.

### In Plain JSON:
```json
{
  "alg": "HS256",    // Algorithm: HMAC SHA-256
  "typ": "JWT"       // Type: JWT
}
```

### What "HS256" means:
- **H** = HMAC (Hash-based Message Authentication Code)
- **S** = SHA (Secure Hash Algorithm)
- **256** = 256-bit hash

### How it's encoded:
The JSON is converted to Base64URL (a URL-safe version of Base64)

```
Original JSON:
{"alg":"HS256","typ":"JWT"}

Base64URL Encoded:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
```

**In KardiaTwin code (`auth.py`):**
```python
from jose import jwt

# This header is created automatically by jwt.encode()
# You don't write it explicitly, jwt library does it
encoded_jwt = jwt.encode(
    to_encode,           # payload
    SECRET_KEY,
    algorithm="HS256"    # This determines the header
)
```

---

## PART 2: PAYLOAD

### What it is:
The payload contains the **CLAIMS** (data/information about the user).

### In Plain JSON:
```json
{
  "sub": 123,              // Subject: User ID (required by JWT standard)
  "exp": 1674556800,       // Expiration time (Unix timestamp)
  "iat": 1674470400,       // Issued at (when token was created)
  "type": "access"         // Custom claim: token type (our addition)
}
```

### What each field means:

| Field | Meaning | Example |
|-------|---------|---------|
| `sub` | Subject (User ID) | `123` |
| `exp` | Expiration (Unix timestamp) | `1674556800` (Jan 26, 2023) |
| `iat` | Issued at (Unix timestamp) | `1674470400` (Jan 23, 2023) |
| `type` | Token type (custom) | `"access"` or `"refresh"` |

### How it's encoded:
Same as header - converted to Base64URL

```
Original JSON:
{"sub":123,"exp":1674556800}

Base64URL Encoded:
eyJzdWIiOjEyMywiZXhwIjoxNjc0NTU2ODAwfQ
```

### In KardiaTwin code (`auth.py`):

**For Access Token:**
```python
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()  # data = {"sub": user_id}

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})  # Add expiration

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return encoded_jwt
```

**For Refresh Token:**
```python
def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()  # data = {"sub": user_id}
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,           # Expiration
        "type": "refresh"        # Mark as refresh token
    })

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return encoded_jwt
```

---

## PART 3: SIGNATURE

### What it is:
The signature **PROVES** that the token wasn't tampered with. It's like a digital fingerprint.

### How it's created:
```
SIGNATURE = HMACSHA256(
    base64UrlEncode(HEADER) + "." + base64UrlEncode(PAYLOAD),
    SECRET_KEY
)
```

### Step by step:

**Step 1: Combine header and payload**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMywiZXhwIjoxNjc0NTU2ODAwfQ
```

**Step 2: Apply HMACSHA256 with SECRET_KEY**
```
SECRET_KEY = "your-super-secret-key-change-this-in-production"

HMACSHA256(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMywiZXhwIjoxNjc0NTU2ODAwfQ",
    "your-super-secret-key-change-this-in-production"
)
```

**Step 3: Get the signature**
```
kqxMq3cz_1234567890abcdefghijklmnop
```

### Why it's important:
If someone tries to change the payload:

**Original token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEyMywiZXhwIjoxNjc0NTU2ODAwfQ.kqxMq3cz...
```

**Attacker changes payload (changes user ID from 123 to 999):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjk5OSwiZXhwIjoxNjc0NTU2ODAwfQ.kqxMq3cz...
                                         ☝️ Changed!                       ☝️ Still old signature
```

**Server verifies:**
```python
# Server recreates signature with the modified payload
new_signature = HMACSHA256(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjk5OSwiZXhwIjoxNjc0NTU2ODAwfQ",
    SECRET_KEY
)

# new_signature would be: xyz123...
# Provided signature is: kqxMq3cz...

# They don't match! → Token is invalid ❌
```

### In KardiaTwin code (`auth.py`):
```python
def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # jwt.decode() automatically:
        # 1. Splits token into 3 parts
        # 2. Recreates the signature using SECRET_KEY
        # 3. Compares with provided signature
        # 4. If they don't match → JWTError

        return payload
    except JWTError:
        return None  # Invalid signature!
```

---

## Complete Example: User Registration in KardiaTwin

### Step 1: User calls `/api/auth/register`

```json
POST /api/auth/register
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "MySecurePass123"
}
```

### Step 2: Server creates tokens

**Creating Access Token:**
```python
# In main.py login() function
user = User(
    id=5,
    username="john_doe",
    email="john@example.com",
    password_hash="$2b$12$..."  # bcrypt hash
)

# Create access token
access_token = create_access_token(data={"sub": user.id})
```

**What gets encoded:**
```python
to_encode = {"sub": 5}  # user ID

# Add expiration
expire = datetime.now(timezone.utc) + timedelta(minutes=30)
to_encode.update({"exp": 1674556800})

# Now to_encode = {"sub": 5, "exp": 1674556800}

# Create token
access_token = jwt.encode(to_encode, "your-secret-key-change-this", "HS256")
```

**Breaking down the token:**

```
PART 1: HEADER (tells how it's signed)
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
↓ Base64URL Decoded:
{"alg":"HS256","typ":"JWT"}

PART 2: PAYLOAD (contains user data)
eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0
↓ Base64URL Decoded:
{"sub":5,"exp":1674556800}
   ↑          ↑
   user ID    expires in 30 min

PART 3: SIGNATURE (proves authenticity)
kqxMq3cz_1234567890abcdefghijklmnop
↑ Created by:
HMACSHA256(
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0",
  "your-secret-key-change-this"
)

Complete Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.kqxMq3cz_1234567890abcdefghijklmnop
```

### Step 3: Server creates refresh token

**What gets encoded:**
```python
to_encode = {"sub": 5}  # user ID

# Add expiration (7 days)
expire = datetime.now(timezone.utc) + timedelta(days=7)
to_encode.update({"exp": 1674901200, "type": "refresh"})

# Now to_encode = {"sub": 5, "exp": 1674901200, "type": "refresh"}

# Create token
refresh_token = jwt.encode(to_encode, "your-secret-key-change-this", "HS256")
```

**The token:**
```
PART 1: HEADER
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
{"alg":"HS256","typ":"JWT"}

PART 2: PAYLOAD (with "type" field!)
eyJzdWIiOjUsImV4cCI6MTY3NDkwMTIwMCwidHlwZSI6InJlZnJlc2gifQ
↓ Base64URL Decoded:
{"sub":5,"exp":1674901200,"type":"refresh"}
                              ↑ Marks as refresh!

PART 3: SIGNATURE
xyz789_refreshtoken_signature_here

Complete Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDkwMTIwMCwidHlwZSI6InJlZnJlc2gifQ.xyz789_refreshtoken_signature_here
```

### Step 4: Server returns to client

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.kqxMq3cz...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDkwMTIwMCwidHlwZSI6InJlZnJlc2gifQ.xyz789...",
  "token_type": "bearer",
  "user": {
    "id": 5,
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```

---

## How Server Verifies Token

### When client makes API request

**Frontend sends:**
```
GET /api/simulations
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.kqxMq3cz...
```

**Backend receives and verifies (`dependencies.py`):**
```python
async def get_current_user(authorization: Optional[str] = Header(None)):
    # Extract token from "Bearer <token>"
    token = authorization.split(" ")[1]
    # token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.kqxMq3cz..."

    # Verify token (in auth.py)
    payload = verify_token(token, token_type="access")
```

**Verification process (`auth.py`):**
```python
def decode_token(token: str) -> Optional[dict]:
    try:
        # jwt.decode() does:
        # 1. Split token:
        #    header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        #    payload = "eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0"
        #    signature = "kqxMq3cz..."

        # 2. Decode header
        #    {"alg":"HS256","typ":"JWT"}

        # 3. Decode payload
        #    {"sub":5,"exp":1674556800}

        # 4. Check expiration
        #    exp = 1674556800, current_time = 1674470500
        #    exp > current_time → NOT EXPIRED ✅

        # 5. Verify signature
        #    recalculated_signature = HMACSHA256(
        #        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0",
        #        "your-secret-key-change-this"
        #    )
        #    recalculated_signature == "kqxMq3cz..." → MATCH ✅

        # 6. Return decoded payload
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
        # Returns: {"sub": 5, "exp": 1674556800}

    except JWTError:
        return None  # Invalid!

def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    payload = decode_token(token)

    if payload is None:
        return None  # Invalid signature or expired

    # Check token type for refresh tokens
    if token_type == "refresh" and payload.get("type") != "refresh":
        return None  # Wrong token type!

    return payload
```

**Extract user ID and get user:**
```python
    user_id = payload.get("sub")  # 5

    db = get_db_session()
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user  # User object with id=5, username="john_doe"
```

---

## Visual Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FULL JWT TOKEN                                 │
│  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsImV4cCI6MTY3NDU1NjgwMH0.xyz...  │
└─────────────────────────────────────────────────────────────────────────┘
                              │              │              │
                              ▼              ▼              ▼
                        ┌────────────┐┌────────────┐┌────────────┐
                        │  HEADER    ││  PAYLOAD   ││ SIGNATURE  │
                        └────────────┘└────────────┘└────────────┘
                             │              │              │
                    Base64URL DECODED   Base64URL DECODED  HMACSHA256
                             │              │              │
                             ▼              ▼              ▼
                        ┌─────────┐   ┌─────────┐     ┌─────────┐
                        │ {alg,   │   │ {sub,   │     │  hash   │
                        │  typ}   │   │  exp}   │     │ proves  │
                        └─────────┘   └─────────┘     │ valid   │
                                                      └─────────┘
```

---

## Summary Table

| Component | What it is | Example | Encoded as |
|-----------|-----------|---------|-----------|
| **Header** | Encoding method | `{"alg":"HS256"}` | Base64URL |
| **Payload** | User data + claims | `{"sub":5,"exp":1674556800}` | Base64URL |
| **Signature** | Digital fingerprint | `kqxMq3cz...` | HMACSHA256 hash |

---

## Key Takeaways for KardiaTwin

1. **Header** = Tells server "I'm signed with HS256"
2. **Payload** = Contains user ID and expiration
3. **Signature** = Proves nobody modified it

4. **Access Token** = Has `sub` and `exp` (expires in 30 min)
5. **Refresh Token** = Has `sub`, `exp`, and `"type":"refresh"` (expires in 7 days)

6. **Bearer** = Format: `Authorization: Bearer <token>`

7. **Verification** = Server recreates signature and compares with provided one

8. **Security** = Only server knows SECRET_KEY, so only server can create valid signatures
