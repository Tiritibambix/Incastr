from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.dependencies import get_current_user
from backend.core.exceptions import not_found
from backend.database import get_db
from backend.models.folder import Folder
from backend.models.user import User
from backend.models.video import Video
from backend.services.scanner import _generate_thumb_and_update, scan_folder

router = APIRouter(prefix="/api/scan", tags=["scan"])


@router.post("", response_model=dict)
async def scan_all(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Folder).where(Folder.user_id == current_user.id))
    folders = result.scalars().all()
    totals = {"scanned": 0, "added": 0, "updated": 0}
    errors = []
    warnings = []
    for folder in folders:
        stats = await scan_folder(folder, db, background_tasks)
        for k in totals:
            totals[k] += stats[k]
        if stats.get("error"):
            errors.append({"folder_id": folder.id, "label": folder.label, "error": stats["error"]})
        if stats.get("warning"):
            warnings.append({"folder_id": folder.id, "label": folder.label, "warning": stats["warning"]})
    if errors:
        totals["errors"] = errors
    if warnings:
        totals["warnings"] = warnings
    return totals


@router.post("/{folder_id}", response_model=dict)
async def scan_one(
    folder_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == current_user.id)
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise not_found("Folder not found")
    return await scan_folder(folder, db, background_tasks)


@router.post("/thumbnails/regenerate", response_model=dict)
async def regenerate_missing_thumbnails(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Queue thumbnail (re)generation for videos missing a thumbnail file, and/or
    hover-scrub frames, on disk. Checks actual disk state rather than a DB flag so
    manually deleted files and videos scanned before hover-scrub existed both get
    backfilled.
    """
    settings = get_settings()
    result = await db.execute(
        select(Video).where(
            Video.user_id == current_user.id,
            ~Video.is_missing,
        )
    )
    videos = list(result.scalars().all())
    queued = 0
    for video in videos:
        needs_thumb = not video.thumbnail_path or not Path(video.thumbnail_path).exists()
        scrub_dir = Path(settings.thumbs_dir) / video.user_id / video.id
        needs_scrub = not (scrub_dir / "scrub_0.jpg").exists()
        if needs_thumb or needs_scrub:
            background_tasks.add_task(
                _generate_thumb_and_update, video.filepath, video.user_id, video.id
            )
            queued += 1
    return {"queued": queued}
