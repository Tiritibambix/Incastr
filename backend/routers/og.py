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


@router.api_route("/video/{share_token}.jpg", methods=["GET", "HEAD"])
async def get_video_og_image(share_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video).where(Video.share_token == share_token, Video.visibility == Visibility.unlisted)
    )
    video = result.scalar_one_or_none()
    if not video or not video.thumbnail_path:
        raise not_found("Preview not available")
    cache_path = await ensure_cached_preview(video.thumbnail_path, f"video_{video.id}")
    if not cache_path:
        raise not_found("Preview not available")
    return FileResponse(str(cache_path), media_type="image/jpeg")


@router.api_route("/category/{token}.jpg", methods=["GET", "HEAD"])
async def get_category_og_image(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CategoryShare).where(CategoryShare.token == token))
    share = result.scalar_one_or_none()
    if not share or not share.is_valid():
        raise not_found("Preview not available")

    video = await _first_category_video(share, db)
    if not video or not video.thumbnail_path:
        raise not_found("Preview not available")
    cache_path = await ensure_cached_preview(video.thumbnail_path, f"category_{token}")
    if not cache_path:
        raise not_found("Preview not available")
    return FileResponse(str(cache_path), media_type="image/jpeg")


async def _first_category_video(share: CategoryShare, db: AsyncSession) -> Video | None:
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
    return video_result.scalar_one_or_none()


async def ensure_cached_preview(source_thumbnail: str, cache_key: str) -> Path | None:
    """Generate (if needed) and return the cached OG preview path for a source thumbnail.

    Shared by the serving routes above and by callers that want to pre-warm the cache
    (e.g. right when a video/category becomes shared) so a crawler's first fetch is
    always a fast disk read instead of a synchronous ffmpeg call — some link-preview
    fetchers (e.g. Signal's) time out much sooner than others and never retry.
    """
    source = Path(source_thumbnail)
    if not source.exists():
        return None

    settings = get_settings()
    cache_dir = Path(settings.thumbs_dir) / "og"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{cache_key}.jpg"

    if not cache_path.exists() or cache_path.stat().st_mtime < source.stat().st_mtime:
        if not await generate_og_preview(str(source), str(cache_path)):
            return None

    return cache_path


async def warm_video_og_preview(thumbnail_path: str, video_id: str) -> None:
    await ensure_cached_preview(thumbnail_path, f"video_{video_id}")


async def warm_category_og_preview(user_id: str, category: str, token: str) -> None:
    from backend.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        share_result = await db.execute(
            select(CategoryShare).where(CategoryShare.user_id == user_id, CategoryShare.category == category)
        )
        share = share_result.scalar_one_or_none()
        if not share:
            return
        video = await _first_category_video(share, db)
        if not video or not video.thumbnail_path:
            return
        await ensure_cached_preview(video.thumbnail_path, f"category_{token}")
