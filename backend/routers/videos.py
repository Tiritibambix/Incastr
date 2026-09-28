import os
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.dependencies import get_current_user
from backend.core.exceptions import bad_request, conflict, not_found
from backend.database import get_db
from backend.models.folder import Folder
from backend.models.tag import Tag
from backend.models.user import User
from backend.models.video import Video, Visibility
from backend.models.watch_history import WatchHistory
from backend.models.watch_progress import WatchProgress
from backend.schemas.video import (
    DuplicateGroup,
    VideoMoveCategory,
    VideoOut,
    VideoPublic,
    VideoRenameFile,
    VideoUpdate,
    WatchHistoryEntry,
    WatchProgressUpdate,
)
from backend.services.search import search_videos
from backend.services.sort import apply_sort
from backend.services.video_access import resolve_video_access

_optional_bearer = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/videos", tags=["videos"])

CHUNK_SIZE = 1024 * 1024  # 1 MB


@router.get("/public", response_model=list[VideoPublic])
async def list_public_videos(
    q: str | None = None,
    category: str | None = None,
    sort: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Video)
        .where(Video.visibility == Visibility.public, ~Video.is_missing)
        .options(selectinload(Video.tags))
    )
    if q:
        stmt = stmt.where(Video.title.ilike(f"%{q}%"))
    if category:
        stmt = stmt.where(Video.category == category)
    stmt = apply_sort(stmt, sort).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/public/categories")
async def list_public_categories(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import distinct as sql_distinct
    result = await db.execute(
        select(sql_distinct(Video.category))
        .where(
            Video.visibility == Visibility.public,
            Video.category.isnot(None),
            ~Video.is_missing,
        )
        .order_by(Video.category)
    )
    return [row[0] for row in result.all()]


@router.get("/public/{video_id}", response_model=VideoPublic)
async def get_public_video(video_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video)
        .where(Video.id == video_id, Video.visibility == Visibility.public, ~Video.is_missing)
        .options(selectinload(Video.tags))
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")
    return video


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import distinct as sql_distinct
    result = await db.execute(
        select(sql_distinct(Video.category))
        .where(
            Video.user_id == current_user.id,
            Video.category.isnot(None),
            ~Video.is_missing,
        )
        .order_by(Video.category)
    )
    return [row[0] for row in result.all()]


@router.get("/duplicates", response_model=list[DuplicateGroup])
async def list_duplicate_videos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video)
        .where(
            Video.user_id == current_user.id,
            ~Video.is_missing,
            Video.file_size_bytes.isnot(None),
        )
        .options(selectinload(Video.tags))
        .order_by(Video.filename)
    )
    groups: dict[tuple[str, int], list[Video]] = {}
    for video in result.scalars().all():
        key = (video.filename, video.file_size_bytes)
        groups.setdefault(key, []).append(video)
    return [
        DuplicateGroup(filename=filename, file_size_bytes=size, videos=group)
        for (filename, size), group in groups.items()
        if len(group) > 1
    ]


@router.get("/history", response_model=list[WatchHistoryEntry])
async def list_watch_history(
    skip: int = 0,
    limit: int = 16,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WatchHistory, Video)
        .join(Video, Video.id == WatchHistory.video_id)
        .where(WatchHistory.user_id == current_user.id, ~Video.is_missing)
        .options(selectinload(Video.tags))
        .order_by(WatchHistory.watched_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return [
        WatchHistoryEntry(watched_at=entry.watched_at, video=VideoOut.model_validate(video))
        for entry, video in result.all()
    ]


@router.delete("/history/{video_id}", status_code=204)
async def delete_watch_history_entry(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WatchHistory).where(
            WatchHistory.user_id == current_user.id,
            WatchHistory.video_id == video_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry:
        await db.delete(entry)


@router.delete("/history", status_code=204)
async def clear_watch_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(WatchHistory).where(WatchHistory.user_id == current_user.id))
    for entry in result.scalars().all():
        await db.delete(entry)


@router.get("", response_model=list[VideoOut])
async def list_videos(
    q: str | None = None,
    field: str | None = None,
    visibility: str | None = None,
    category: str | None = None,
    sort: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await search_videos(db, current_user.id, q=q, field=field, visibility=visibility, category=category, sort=sort, skip=skip, limit=limit)


@router.get("/share/{share_token}", response_model=VideoPublic)
async def get_shared_video(share_token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video)
        .where(Video.share_token == share_token, Video.visibility == Visibility.unlisted)
        .options(selectinload(Video.tags))
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")
    return video


@router.get("/share/{share_token}/stream")
async def stream_shared_video(share_token: str, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video).where(Video.share_token == share_token, Video.visibility == Visibility.unlisted)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")

    filepath = video.filepath
    if not os.path.isfile(filepath):
        raise not_found("File not found on disk")

    file_size = os.path.getsize(filepath)
    content_type = video.mime_type or "video/mp4"
    range_header = request.headers.get("range")
    if range_header:
        range_val = range_header.replace("bytes=", "")
        start_str, _, end_str = range_val.partition("-")
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        def iterfile():
            with open(filepath, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            iterfile(),
            status_code=206,
            media_type=content_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
            },
        )
    return FileResponse(filepath, media_type=content_type, headers={"Accept-Ranges": "bytes"})


@router.get("/{video_id}", response_model=VideoOut)
async def get_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video)
        .where(Video.id == video_id, Video.user_id == current_user.id)
        .options(selectinload(Video.tags))
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")

    progress_result = await db.execute(
        select(WatchProgress).where(
            WatchProgress.user_id == current_user.id,
            WatchProgress.video_id == video_id,
        )
    )
    progress = progress_result.scalar_one_or_none()
    video_out = VideoOut.model_validate(video)
    video_out.resume_position_seconds = progress.position_seconds if progress else None
    return video_out


@router.patch("/{video_id}", response_model=VideoOut)
async def update_video(
    video_id: str,
    body: VideoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video)
        .where(Video.id == video_id, Video.user_id == current_user.id)
        .options(selectinload(Video.tags))
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")
    if body.title is not None:
        video.title = body.title
    if body.description is not None:
        video.description = body.description
    if body.visibility is not None:
        video.visibility = body.visibility
    return video


@router.post("/{video_id}/tags/{tag_id}", response_model=VideoOut)
async def add_tag_to_video(
    video_id: str,
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video)
        .where(Video.id == video_id, Video.user_id == current_user.id)
        .options(selectinload(Video.tags))
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")

    tag_result = await db.execute(
        select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id)
    )
    tag = tag_result.scalar_one_or_none()
    if not tag:
        raise not_found("Tag not found")

    if tag not in video.tags:
        video.tags.append(tag)
    return video


@router.delete("/{video_id}/tags/{tag_id}", response_model=VideoOut)
async def remove_tag_from_video(
    video_id: str,
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video)
        .where(Video.id == video_id, Video.user_id == current_user.id)
        .options(selectinload(Video.tags))
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")

    video.tags = [t for t in video.tags if t.id != tag_id]
    return video


@router.delete("/{video_id}", status_code=204)
async def delete_video(
    video_id: str,
    delete_file: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")
    if delete_file:
        try:
            os.remove(video.filepath)
        except FileNotFoundError:
            pass  # already gone, proceed
        except OSError as exc:
            raise conflict(
                f"Cannot delete file from disk: {exc.strerror}. "
                "Make sure the volume is not mounted read-only (:ro)."
            )
    await db.delete(video)


@router.patch("/{video_id}/category", response_model=VideoOut)
async def move_video_category(
    video_id: str,
    body: VideoMoveCategory,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video)
        .where(Video.id == video_id, Video.user_id == current_user.id)
        .options(selectinload(Video.tags))
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")

    folder_result = await db.execute(select(Folder).where(Folder.id == video.folder_id))
    folder = folder_result.scalar_one_or_none()
    if not folder:
        raise not_found("Folder not found")

    new_cat = body.category.strip() if body.category else None
    if new_cat and ("/" in new_cat or "\\" in new_cat or ".." in new_cat):
        raise bad_request("Invalid category name")

    new_dir = Path(folder.path) / new_cat if new_cat else Path(folder.path)
    new_path = new_dir / video.filename

    if str(new_path) == video.filepath:
        return video

    if new_path.exists():
        raise conflict("A file with this name already exists in the target category")

    try:
        new_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(video.filepath, str(new_path))
    except OSError as exc:
        raise conflict(f"Cannot move file: {exc.strerror}. Check the volume is not read-only.")

    video.filepath = str(new_path)
    video.category = new_cat
    return video


@router.patch("/{video_id}/rename", response_model=VideoOut)
async def rename_video_file(
    video_id: str,
    body: VideoRenameFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_name = body.filename.strip()
    if not new_name or "/" in new_name or "\\" in new_name or ".." in new_name:
        raise bad_request("Invalid filename")

    result = await db.execute(
        select(Video)
        .where(Video.id == video_id, Video.user_id == current_user.id)
        .options(selectinload(Video.tags))
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")

    old_path = Path(video.filepath)
    new_path = old_path.parent / new_name

    if new_path == old_path:
        return video

    if new_path.exists():
        raise conflict("A file with this name already exists")

    try:
        old_path.rename(new_path)
    except OSError as exc:
        raise conflict(f"Cannot rename file: {exc.strerror}. Check the volume is not read-only.")

    video.filepath = str(new_path)
    video.filename = new_name
    video.title = new_path.stem  # sync title with the new filename stem
    return video


@router.put("/{video_id}/progress", status_code=204)
async def update_watch_progress(
    video_id: str,
    body: WatchProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")

    progress_result = await db.execute(
        select(WatchProgress).where(
            WatchProgress.user_id == current_user.id,
            WatchProgress.video_id == video_id,
        )
    )
    progress = progress_result.scalar_one_or_none()
    if progress:
        progress.position_seconds = body.position_seconds
    else:
        db.add(WatchProgress(
            user_id=current_user.id,
            video_id=video_id,
            position_seconds=body.position_seconds,
        ))

    history_result = await db.execute(
        select(WatchHistory).where(
            WatchHistory.user_id == current_user.id,
            WatchHistory.video_id == video_id,
        )
    )
    history_entry = history_result.scalar_one_or_none()
    if history_entry:
        history_entry.watched_at = datetime.utcnow()
    else:
        db.add(WatchHistory(user_id=current_user.id, video_id=video_id))


@router.get("/{video_id}/stream")
async def stream_video(
    video_id: str,
    request: Request,
    token: str | None = None,
    cat_token: str | None = None,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
):
    video = await resolve_video_access(video_id, db, credentials=credentials, token=token, cat_token=cat_token)
    if not video:
        raise not_found("Video not found")

    filepath = video.filepath
    if not os.path.isfile(filepath):
        raise not_found("File not found on disk")

    file_size = os.path.getsize(filepath)
    content_type = video.mime_type or "video/mp4"

    range_header = request.headers.get("range")
    if range_header:
        range_val = range_header.replace("bytes=", "")
        start_str, _, end_str = range_val.partition("-")
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        def iterfile():
            with open(filepath, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            iterfile(),
            status_code=206,
            media_type=content_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
            },
        )

    return FileResponse(filepath, media_type=content_type, headers={"Accept-Ranges": "bytes"})
