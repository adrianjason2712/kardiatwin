"""
FastAPI dependencies for authentication
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from auth import verify_token
from models import User, get_db_session


async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> User:
    """
    Get current authenticated user from JWT token

    Args:
        authorization: Authorization header with Bearer token

    Returns:
        User object

    Raises:
        HTTPException: If token is invalid or user not found
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1]
    payload = verify_token(token, token_type="access")

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: int = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session = get_db_session()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user
    finally:
        session.close()


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
) -> Optional[User]:
    """
    Get current user if authenticated, otherwise return None (for guest mode)

    Args:
        authorization: Optional Authorization header with Bearer token

    Returns:
        User object or None
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ")[1]
    payload = verify_token(token, token_type="access")

    if payload is None:
        return None

    user_id: int = payload.get("sub")
    if user_id is None:
        return None

    session = get_db_session()
    try:
        user = session.query(User).filter(User.id == user_id).first()
        return user
    finally:
        session.close()
