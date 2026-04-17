from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    revoke_refresh_token,
    is_refresh_token_revoked,
)
from app.models.user import User
from app.schemas.auth import TokenPair
from app.schemas.user import UserCreate

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=payload.email, password_hash=get_password_hash(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})
    return {"access_token": access_token, "refresh_token": refresh_token}


@router.post("/login", response_model=TokenPair)
def login(payload: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access_token = create_access_token({"sub": user.id})
    refresh_token = create_refresh_token({"sub": user.id})
    return {"access_token": access_token, "refresh_token": refresh_token}


class LogoutPayload(BaseModel):
    refresh_token: Optional[str] = None


@router.post("/logout")
def logout(payload: Optional[LogoutPayload] = None):
    if payload and payload.refresh_token:
        revoke_refresh_token(payload.refresh_token)
    return {"detail": "Logged out successfully"}


class TokenRefreshPayload(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: TokenRefreshPayload):
    if is_refresh_token_revoked(payload.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")
    token_data = decode_token(payload.refresh_token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user_id = token_data.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})
    return {"access_token": access_token, "refresh_token": refresh_token}
