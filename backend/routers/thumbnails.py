from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.exceptions import not_found
from backend.database import get_db
from backend.services.video_access import resolve_video_access

router = APIRouter(prefix="/api/thumbnails", tags=["thumbnails"])

_optional_bearer = HTTPBearer(auto_error=False)


@router.get("/{user_id}/{video_id}.jpg")
async def get_thumbnail(
    user_id: str,
    video_id: str,
    token: str | None = None,
    cat_token: str | None = None,
    share_token: str | None = None,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
):
    video = await resolve_video_access(
        video_id, db, credentials=credentials, token=token, cat_token=cat_token, share_token=share_token
    )
    if not video or video.user_id != user_id or not video.thumbnail_path:
        raise not_found("Thumbnail not found")

    thumb_path = Path(video.thumbnail_path)
    if not thumb_path.exists():
        raise not_found("Thumbnail file missing")

    return FileResponse(str(thumb_path), media_type="image/jpeg")


@router.get("/{user_id}/{video_id}/scrub/{frame}.jpg")
async def get_scrub_frame(
    user_id: str,
    video_id: str,
    frame: int,
    token: str | None = None,
    cat_token: str | None = None,
    share_token: str | None = None,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
):
    video = await resolve_video_access(
        video_id, db, credentials=credentials, token=token, cat_token=cat_token, share_token=share_token
    )
    if not video or video.user_id != user_id:
        raise not_found("Video not found")

    settings = get_settings()
    frame_path = Path(settings.thumbs_dir) / user_id / video_id / f"scrub_{frame}.jpg"
    if not frame_path.exists():
        raise not_found("Scrub frame not found")

    return FileResponse(str(frame_path), media_type="image/jpeg")
