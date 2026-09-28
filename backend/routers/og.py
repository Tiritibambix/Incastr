from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.exceptions import not_found
from backend.database import get_db
from backend.models.category_share import CategoryShare
from backend.models.video import Video, Visibility
from backend.services.thumbnail import generate_og_preview

router = APIRouter(prefix="/api/og", tags=["og"])


@router.get("/video/{share_token}.jpg")
async def get_video_og_image(share_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video).where(Video.share_token == share_token, Video.visibility == Visibility.unlisted)
    )
    video = result.scalar_one_or_none()
    if not video or not video.thumbnail_path:
        raise not_found("Preview not available")
    return await _serve_cached_preview(video.thumbnail_path, f"video_{video.id}")


@router.get("/category/{token}.jpg")
async def get_category_og_image(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CategoryShare).where(CategoryShare.token == token))
    share = result.scalar_one_or_none()
    if not share or not share.is_valid():
        raise not_found("Preview not available")

    video_result = await db.execute(
        select(Video)
        .where(
            Video.user_id == share.user_id,
            Video.category == share.category,
            ~Video.is_missing,
            Video.thumbnail_path.isnot(None),
        )
        .order_by(Video.created_at.asc())
        .limit(1)
    )
    video = video_result.scalar_one_or_none()
    if not video or not video.thumbnail_path:
        raise not_found("Preview not available")
    return await _serve_cached_preview(video.thumbnail_path, f"category_{token}")


async def _serve_cached_preview(source_thumbnail: str, cache_key: str) -> FileResponse:
    source = Path(source_thumbnail)
    if not source.exists():
        raise not_found("Preview not available")

    settings = get_settings()
    cache_dir = Path(settings.thumbs_dir) / "og"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{cache_key}.jpg"

    if not cache_path.exists() or cache_path.stat().st_mtime < source.stat().st_mtime:
        if not await generate_og_preview(str(source), str(cache_path)):
            raise not_found("Preview not available")

    return FileResponse(str(cache_path), media_type="image/jpeg")
