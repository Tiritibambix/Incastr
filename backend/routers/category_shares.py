from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.dependencies import get_current_user
from backend.core.exceptions import not_found
from backend.database import get_db
from backend.models.category_share import CategoryShare
from backend.models.user import User
from backend.models.video import Video
from backend.schemas.video import VideoPublic

router = APIRouter(prefix="/api/category-shares", tags=["category-shares"])


class CategoryShareCreate(BaseModel):
    category: str
    expires_at: datetime | None = None


class CategoryShareUpdate(BaseModel):
    enabled: bool | None = None
    expires_at: datetime | None = None


class CategoryShareOut(BaseModel):
    token: str
    category: str
    enabled: bool
    expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[CategoryShareOut])
async def list_shares(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CategoryShare).where(CategoryShare.user_id == current_user.id)
    )
    return list(result.scalars().all())


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CategoryShareOut)
async def create_or_get_share(
    body: CategoryShareCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CategoryShare).where(
            CategoryShare.user_id == current_user.id,
            CategoryShare.category == body.category,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        share = CategoryShare(
            user_id=current_user.id,
            category=body.category,
            expires_at=body.expires_at,
        )
        db.add(share)
        await db.flush()
    return share


@router.patch("/{token}", response_model=CategoryShareOut)
async def update_share(
    token: str,
    body: CategoryShareUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CategoryShare).where(
            CategoryShare.token == token,
            CategoryShare.user_id == current_user.id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise not_found("Share not found")
    if body.enabled is not None:
        share.enabled = body.enabled
    if "expires_at" in body.model_fields_set:
        share.expires_at = body.expires_at
    return share


@router.delete("/{token}", status_code=204)
async def revoke_share(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CategoryShare).where(
            CategoryShare.token == token,
            CategoryShare.user_id == current_user.id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise not_found("Share not found")
    await db.delete(share)


@router.get("/{token}/video/{video_id}", response_model=VideoPublic)
async def get_shared_category_video(
    token: str, video_id: str, db: AsyncSession = Depends(get_db)
):
    share = await _get_valid_share(token, db)
    video_result = await db.execute(
        select(Video)
        .where(
            Video.id == video_id,
            Video.category == share.category,
            Video.user_id == share.user_id,
        )
        .options(selectinload(Video.tags))
    )
    video = video_result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")
    return video


@router.get("/{token}/videos", response_model=list[VideoPublic])
async def get_shared_category_videos(token: str, db: AsyncSession = Depends(get_db)):
    share = await _get_valid_share(token, db)
    videos_result = await db.execute(
        select(Video)
        .where(
            Video.user_id == share.user_id,
            Video.category == share.category,
            ~Video.is_missing,
        )
        .options(selectinload(Video.tags))
        .order_by(Video.created_at.desc())
    )
    return list(videos_result.scalars().all())


async def _get_valid_share(token: str, db: AsyncSession) -> CategoryShare:
    result = await db.execute(
        select(CategoryShare).where(CategoryShare.token == token)
    )
    share = result.scalar_one_or_none()
    if not share or not share.is_valid():
        raise not_found("Share not found or expired")
    return share
