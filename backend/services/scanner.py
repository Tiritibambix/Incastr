import mimetypes
import secrets
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.models.folder import Folder
from backend.models.video import Video
from backend.services.thumbnail import generate_thumbnail, get_video_metadata

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".ts", ".flv", ".wmv", ".mpg", ".mpeg", ".m2ts", ".mts"}


async def scan_folder(
    folder: Folder,
    db: AsyncSession,
    background_tasks: BackgroundTasks,
) -> dict:
    settings = get_settings()
    root = Path(folder.path)
    if not root.exists() or not root.is_dir():
        return {"scanned": 0, "added": 0, "updated": 0}

    added = 0
    updated = 0
    scanned = 0

    found_paths: set[str] = set()

    def _walk(path: Path, depth: int):
        if depth > settings.max_scan_depth:
            return
        try:
            entries = list(path.iterdir())
        except PermissionError:
            return
        for entry in entries:
            if entry.is_dir():
                yield from _walk(entry, depth + 1)
            elif entry.is_file() and entry.suffix.lower() in VIDEO_EXTENSIONS:
                yield entry

    async def _process(filepath: Path):
        nonlocal added, updated, scanned
        scanned += 1
        rel = filepath.relative_to(root)
        category = rel.parts[0] if len(rel.parts) > 1 else None
        fp_str = str(filepath)

        result = await db.execute(
            select(Video).where(Video.filepath == fp_str, Video.user_id == folder.user_id)
        )
        video = result.scalar_one_or_none()

        if video is None:
            meta = await get_video_metadata(fp_str)
            mime, _ = mimetypes.guess_type(fp_str)
            video = Video(
                id=str(uuid.uuid4()),
                user_id=folder.user_id,
                folder_id=folder.id,
                filepath=fp_str,
                filename=filepath.name,
                title=filepath.stem,
                category=category,
                share_token=secrets.token_urlsafe(32),
                mime_type=mime,
                duration_seconds=meta["duration_seconds"],
                file_size_bytes=meta["file_size_bytes"],
                last_scanned_at=datetime.utcnow(),
            )
            db.add(video)
            await db.flush()
            background_tasks.add_task(
                _generate_thumb_and_update, fp_str, folder.user_id, video.id
            )
            added += 1
        else:
            video.last_scanned_at = datetime.utcnow()
            video.is_missing = False
            updated += 1

        found_paths.add(fp_str)

    for filepath in _walk(root, 0):
        await _process(filepath)

    result = await db.execute(
        select(Video).where(Video.folder_id == folder.id, Video.user_id == folder.user_id)
    )
    for video in result.scalars():
        if video.filepath not in found_paths:
            video.is_missing = True

    return {"scanned": scanned, "added": added, "updated": updated}


async def _generate_thumb_and_update(filepath: str, user_id: str, video_id: str):
    from sqlalchemy import select

    from backend.database import AsyncSessionLocal

    thumb_path = await generate_thumbnail(filepath, user_id, video_id)
    if thumb_path:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Video).where(Video.id == video_id))
            video = result.scalar_one_or_none()
            if video:
                video.thumbnail_path = thumb_path
                await session.commit()
