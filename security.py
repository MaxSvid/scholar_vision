"""
JWT + password hashing utilities.

All routers import `get_current_user` from here to protect endpoints.
The dependency extracts the JWT from the Authorization: Bearer header,
validates it, and returns the user's UUID string — used as `session_id`
in all database queries.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "sv-change-this-to-a-long-random-secret-in-production")
ALGORITHM  = "HS256"
TOKEN_EXPIRE_DAYS = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> str:
    """Decode JWT and return user_id. Raises JWTError on failure."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    sub = payload.get("sub")
    if not sub:
        raise JWTError("Missing sub claim")
    return sub


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    FastAPI dependency — validates the Bearer JWT and returns the user_id (str).
    This value is used as `session_id` in all data-table queries.
    """
    try:
        return _decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
