"""
Authentication utilities for JWT token and password management
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import os

# Password hashing context - using argon2 for better security and no password length limits
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Configuration - HARDCODED (env loading not working)
SECRET_KEY = "kardiatwin123456789abcdefghijklmnopqrstuvwxyz0987654321kardiatwin"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480
REFRESH_TOKEN_EXPIRE_DAYS = 30


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against its hash
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Generate argon2 hash of password (no length limits)
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token

    Args:
        data: Dictionary of data to encode in token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # jwt requires the 'exp' claim to be an integer timestamp
    to_encode.update({"exp": int(expire.timestamp())})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Create a JWT refresh token with longer expiration

    Args:
        data: Dictionary of data to encode in token

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": int(expire.timestamp()), "type": "refresh"})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT token

    Args:
        token: JWT token string

    Returns:
        Decoded token data or None if invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"JWT Decode error: {e}")
        return None


def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    """
    Verify a token and return decoded payload

    Args:
        token: JWT token string
        token_type: Either "access" or "refresh"

    Returns:
        Decoded token data or None if invalid/expired
    """
    import logging
    logger = logging.getLogger(__name__)

    payload = decode_token(token)

    if payload is None:
        logger.error(f"Token decode failed for token_type={token_type}")
        return None

    # Check token type for refresh tokens
    if token_type == "refresh" and payload.get("type") != "refresh":
        logger.error(f"Token type mismatch: expected 'refresh', got '{payload.get('type')}'")
        return None

    return payload
