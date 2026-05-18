from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.auth import create_access_token, hash_password, verify_password
from backend.core.exceptions import bad_request, conflict
from backend.database import get_db
from backend.models.user import User
from backend.schemas.user import LoginRequest, Token, UserCreate

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    if not settings.allow_registration:
        raise bad_request("Registration is disabled")

    existing = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    )
    if existing.scalar_one_or_none():
        raise conflict("Username or email already taken")

    user_count = await db.execute(select(User))
    is_first_user = user_count.first() is None

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
        is_admin=is_first_user,
    )
    db.add(user)
    await db.flush()
    return {"id": user.id, "username": user.username, "is_admin": user.is_admin}


@router.post("/login", response_model=Token)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return Token(access_token=create_access_token(user.id))
