# SECRET_KEY Explanation for KardiaTwin

## What is SECRET_KEY?

**SECRET_KEY** is a secret password that ONLY the server knows. It's used to:
1. **Sign** JWT tokens (create signature)
2. **Verify** JWT tokens (check if valid)

It's like a master key that proves a token came from your server.

---

## How SECRET_KEY Works in JWT

### Step 1: Creating a Token (Server creates signature)

```python
SECRET_KEY = "your-super-secret-key-change-this-in-production"

# When user registers
payload = {"sub": 5, "exp": 1674556800}

# Server creates signature using SECRET_KEY
signature = HMACSHA256(
    "header.payload",
    SECRET_KEY  # ← Only server knows this!
)

# Result: "kqxMq3cz_1234567890abcdefghijklmnop"

# Full token
token = "eyJhbGci...eyJzdWIi...kqxMq3cz..."
```

### Step 2: Verifying a Token (Server checks if valid)

```python
# Client sends token
token = "eyJhbGci...eyJzdWIi...kqxMq3cz..."

# Server recreates signature to verify
recalculated_signature = HMACSHA256(
    "header.payload",
    SECRET_KEY  # ← Same secret key!
)
# Result: "kqxMq3cz_1234567890abcdefghijklmnop"

# Compare
if recalculated_signature == token_signature:
    print("✅ Token is valid! Wasn't modified!")
else:
    print("❌ Token is invalid! Someone changed it!")
```

---

## Why SECRET_KEY Must Be Secret

### Scenario 1: If SECRET_KEY is public ❌

```
Hacker knows SECRET_KEY = "secret123"

Hacker creates fake token:
payload = {"sub": 999}  # User ID 999 (admin)

Hacker signs it:
signature = HMACSHA256("header.payload", "secret123")
# Creates valid signature!

fake_token = "eyJhbGci...eyJzdWI5OTk...signature..."

Server receives token and verifies:
recalculated = HMACSHA256("header.payload", "secret123")
# Matches! ✅

Server thinks token is valid and user is admin! ❌❌❌
```

### Scenario 2: If SECRET_KEY is secret ✅

```
Hacker doesn't know SECRET_KEY

Hacker creates fake token:
payload = {"sub": 999}

Hacker tries to guess signature:
signature = "random_guess_123..."

fake_token = "eyJhbGci...eyJzdWI5OTk...random_guess_123..."

Server receives and verifies:
SECRET_KEY = "your-super-secret-key-change-this-in-production"
recalculated = HMACSHA256("header.payload", SECRET_KEY)
# Result: "kqxMq3cz_1234567890abcdefghijklmnop"

# Compare
"kqxMq3cz_1234567890abcdefghijklmnop" ≠ "random_guess_123..."

Server rejects token! ✅ Protected!
```

---

## SECRET_KEY in KardiaTwin Code

### In `auth.py`:

```python
from datetime import datetime, timedelta, timezone
import os

# Load from environment variable or use default (BAD FOR PRODUCTION!)
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
```

**What's happening:**
1. Try to load `SECRET_KEY` from `.env` file
2. If not found, use default (which is NOT SECURE!)

### Create Token Function:

```python
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    # ← Here's where SECRET_KEY is used!
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
```

**Step by step:**
```
1. to_encode = {"sub": 5, "exp": 1674556800}
2. Create header: {"alg": "HS256", "typ": "JWT"}
3. Base64URL encode header: eyJhbGci...
4. Base64URL encode payload: eyJzdWIi...
5. Sign with SECRET_KEY: HMACSHA256(header.payload, SECRET_KEY)
6. Combine: header.payload.signature
```

### Verify Token Function:

```python
def decode_token(token: str) -> Optional[dict]:
    try:
        # ← Here's where SECRET_KEY is used!
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
```

**Step by step:**
```
1. Split token: header | payload | signature
2. Recreate signature: HMACSHA256(header.payload, SECRET_KEY)
3. Compare with provided signature
4. If match → Valid token ✅
5. If no match → Invalid token ❌
```

---

## How to Set SECRET_KEY Properly

### ❌ DO NOT DO THIS (Current default):

```python
SECRET_KEY = "your-secret-key-change-this-in-production"
```

**Why:** Everyone sees this value. It's not secret!

### ✅ DO THIS: Use .env file

**Create `.env` file in backend folder:**

```env
SECRET_KEY=your-actual-secret-key-here-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

**In `auth.py`:**
```python
import os
from dotenv import load_dotenv

load_dotenv()  # Load from .env

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
```

### ✅ BEST: Generate a strong SECRET_KEY

**Generate a secure random key:**

```bash
# Option 1: Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Output example:
# 7X9q4kL_mN2pR6sT8vW1yZ3aB5cD9eF-GhIjKlMnOpQrStUvWxYzAbCdEfGhIjKl
```

**Add to `.env`:**
```env
SECRET_KEY=7X9q4kL_mN2pR6sT8vW1yZ3aB5cD9eF-GhIjKlMnOpQrStUvWxYzAbCdEfGhIjKl
```

### Why 32 characters?

```
32 characters = 256 bits = 32 bytes
HMACSHA256 uses 256-bit keys
More characters = More secure
```

---

## Real KardiaTwin Example

### User Registration Flow:

```
POST /api/auth/register
{
  "username": "john",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

### Server processes:

```python
# In main.py

@app.post("/api/auth/register")
async def register(user_data: UserRegister):
    # ... validate and store user ...

    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    # ↓ Calls auth.py create_access_token()
    # ↓ Uses SECRET_KEY to sign

    # Create refresh token
    refresh_token = create_refresh_token(data={"sub": user.id})
    # ↓ Calls auth.py create_refresh_token()
    # ↓ Uses SECRET_KEY to sign

    return {
        "access_token": "eyJhbGci...kqxMq3cz...",  # Signed with SECRET_KEY
        "refresh_token": "eyJhbGci...xyz789...",   # Signed with SECRET_KEY
        "token_type": "bearer",
        "user": {...}
    }
```

### User makes API request:

```
GET /api/simulations
Authorization: Bearer eyJhbGci...kqxMq3cz...
```

### Server verifies:

```python
# In dependencies.py

async def get_current_user(authorization: str = Header(None)):
    token = authorization.split(" ")[1]
    # token = "eyJhbGci...kqxMq3cz..."

    payload = verify_token(token)
    # ↓ Calls auth.py verify_token()
    # ↓ Calls auth.py decode_token()
    # ↓ Uses SECRET_KEY to verify signature

    if payload is None:
        raise HTTPException(status_code=401)  # Invalid!

    user_id = payload["sub"]  # 5
    # ... get user from DB ...
    return user  # ✅ User authenticated!
```

---

## What Happens With Wrong SECRET_KEY

### Scenario: Developer changes SECRET_KEY

```python
# Old .env
SECRET_KEY=7X9q4kL_mN2pR6sT8vW1yZ3aB5cD9eF-GhIj...

# User registers and gets token signed with old SECRET_KEY
token = "eyJhbGci...signature_from_old_key..."

# Developer changes .env (updates SECRET_KEY)
SECRET_KEY=AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSs...

# User tries to use old token with new SECRET_KEY
# Server verifies:
old_signature = "signature_from_old_key..."
recalculated = HMACSHA256(header.payload, NEW_SECRET_KEY)
# ≠ old_signature

# Token is invalid! ❌ User must login again!
```

**This is why:**
- Changing SECRET_KEY invalidates ALL existing tokens
- In production, use the same SECRET_KEY (store it securely)
- If you change SECRET_KEY, all users must login again

---

## Security Best Practices

### 1. Keep SECRET_KEY in .env (NOT in code)

❌ WRONG:
```python
SECRET_KEY = "my-secret-key"  # Anyone can see it!
```

✅ RIGHT:
```python
SECRET_KEY = os.getenv("SECRET_KEY")  # Hidden in .env
```

### 2. Add .env to .gitignore

```bash
# .gitignore
.env
.env.local
```

This prevents pushing SECRET_KEY to GitHub!

### 3. Generate strong SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Example: 7X9q4kL_mN2pR6sT8vW1yZ3aB5cD9eF-GhIjKlMnOpQrStUvWxYzAbCdEfGhIjKl
```

### 4. Use different SECRET_KEY per environment

```
Development: SECRET_KEY=dev_key_123...
Production: SECRET_KEY=prod_key_456...
Staging: SECRET_KEY=staging_key_789...
```

### 5. Rotate SECRET_KEY periodically (if needed)

- In production, some companies rotate keys monthly/yearly
- When rotating: new tokens use new key, old tokens become invalid
- Requires users to login again

---

## Summary Table

| Aspect | Details |
|--------|---------|
| **Purpose** | Sign and verify JWT tokens |
| **Length** | 32+ characters (256+ bits) |
| **Storage** | `.env` file (NOT in code) |
| **Who knows it** | Only server (kept secret!) |
| **Used in** | `create_token()` and `decode_token()` |
| **If changed** | All existing tokens become invalid |
| **If leaked** | Attackers can forge valid tokens |
| **Best practice** | Use `secrets.token_urlsafe(32)` |

---

## In KardiaTwin Config

**Your current .env should have:**

```env
# Authentication
SECRET_KEY=your-actual-secret-key-here-generate-a-strong-one
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
DATABASE_URL=sqlite:///data/simulation_sessions.db
```

**To generate SECRET_KEY:**

```bash
cd backend
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Copy the output and paste in `.env`:**

```env
SECRET_KEY=7X9q4kL_mN2pR6sT8vW1yZ3aB5cD9eF-GhIjKlMnOpQrStUvWxYzAbCdEfGhIjKl
```

---

## Visual: How SECRET_KEY Works

```
┌──────────────────────────────────────────────────────┐
│              CREATING TOKEN (Server)                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│  User Data: {"sub": 5, "exp": 1674556800}          │
│                     ↓                               │
│  Header: {"alg":"HS256","typ":"JWT"}               │
│  Payload: User Data                                 │
│                     ↓                               │
│  Header.Payload = "eyJhbGci...eyJzdWIi..."         │
│                     ↓                               │
│  Sign with SECRET_KEY                              │
│  Signature = HMACSHA256(Header.Payload, SECRET_KEY)│
│           = "kqxMq3cz..."                          │
│                     ↓                               │
│  Token = "eyJhbGci...eyJzdWIi...kqxMq3cz..."      │
│                     ↓                               │
│         Send to Client                              │
│                                                      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              VERIFYING TOKEN (Server)                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Client sends: "eyJhbGci...eyJzdWIi...kqxMq3cz..." │
│                     ↓                               │
│  Server extracts Header & Payload                   │
│  Server extracts Signature                          │
│                     ↓                               │
│  Recalculate Signature                              │
│  New_Sig = HMACSHA256(Header.Payload, SECRET_KEY)  │
│          = "kqxMq3cz..."                           │
│                     ↓                               │
│  Compare Signatures                                 │
│  New_Sig == Token_Sig?                              │
│  "kqxMq3cz..." == "kqxMq3cz..." → ✅ VALID!       │
│                     ↓                               │
│  Return User Data                                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Key Takeaway

**SECRET_KEY is the master key that:**
1. ✅ Signs tokens (proves they come from your server)
2. ✅ Verifies tokens (checks they weren't modified)
3. ✅ Is kept secret (only server knows it)
4. ✅ Is stored in `.env` (not in code)

**If SECRET_KEY is leaked:**
- ❌ Attackers can forge valid tokens
- ❌ Attackers can impersonate any user
- ❌ System is compromised!

**That's why it's CRITICAL to keep it secret! 🔐**
