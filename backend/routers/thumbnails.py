from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.dependencies import get_current_user
from backend.core.exceptions import not_found
from backend.database import get_db
from backend.models.user import User
from backend.models.video import Video

router = APIRouter(prefix="/api/thumbnails", tags=["thumbnails"])


@router.get("/{user_id}/{video_id}.jpg")
async def get_thumbnail(
    user_id: str,
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id != user_id and not current_user.is_admin:
        raise not_found("Thumbnail not found")

    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == user_id)
    )
    video = result.scalar_one_or_none()
    if not video or not video.thumbnail_path:
        raise not_found("Thumbnail not found")

    thumb_path = Path(video.thumbnail_path)
    if not thumb_path.exists():
        raise not_found("Thumbnail file missing")

    return FileResponse(str(thumb_path), media_type="image/jpeg")
