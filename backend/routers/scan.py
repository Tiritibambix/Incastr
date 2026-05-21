from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    for folder in folders:
        stats = await scan_folder(folder, db, background_tasks)
        for k in totals:
            totals[k] += stats[k]
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
    result = await db.execute(
        select(Video).where(
            Video.user_id == current_user.id,
            Video.thumbnail_path.is_(None),
            ~Video.is_missing,
        )
    )
    videos = list(result.scalars().all())
    for video in videos:
        background_tasks.add_task(
            _generate_thumb_and_update, video.filepath, video.user_id, video.id
        )
    return {"queued": len(videos)}
