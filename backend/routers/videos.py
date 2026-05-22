import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.core.auth import decode_token
from backend.core.dependencies import get_current_user
from backend.core.exceptions import bad_request, conflict, not_found
from backend.database import get_db
from backend.models.folder import Folder
from backend.models.tag import Tag
from backend.models.user import User
from backend.models.video import Video, Visibility
from backend.schemas.video import VideoMoveCategory, VideoOut, VideoPublic, VideoRenameFile, VideoUpdate
from backend.services.search import search_videos

_optional_bearer = HTTPBearer(auto_error=False)


async def _resolve_stream_user(
    token: str | None,
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> User:
    raw = (credentials.credentials if credentials else None) or token
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_token(raw)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

router = APIRouter(prefix="/api/videos", tags=["videos"])

CHUNK_SIZE = 1024 * 1024  # 1 MB


@router.get("/public", response_model=list[VideoPublic])
async def list_public_videos(
    q: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Video)
        .where(Video.visibility == Visibility.public, ~Video.is_missing)
        .options(selectinload(Video.tags))
        .order_by(Video.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if q:
        stmt = stmt.where(Video.title.ilike(f"%{q}%"))
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/public/{video_id}", response_model=VideoPublic)
async def get_public_video(video_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video)
        .where(Video.id == video_id, Video.visibility == Visibility.public)
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


@router.get("", response_model=list[VideoOut])
async def list_videos(
    q: str | None = None,
    field: str | None = None,
    visibility: str | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await search_videos(db, current_user.id, q=q, field=field, visibility=visibility, category=category, skip=skip, limit=limit)


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
    return video


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
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete file from disk: {exc.strerror}. "
                       "Make sure the volume is not mounted read-only (:ro).",
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
        raise HTTPException(status_code=409, detail=f"Cannot move file: {exc.strerror}. Check the volume is not read-only.")

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
        raise HTTPException(status_code=409, detail=f"Cannot rename file: {exc.strerror}. Check the volume is not read-only.")

    video.filepath = str(new_path)
    video.filename = new_name
    video.title = new_path.stem  # sync title with the new filename stem
    return video


@router.get("/{video_id}/stream")
async def stream_video(
    video_id: str,
    request: Request,
    token: str | None = None,
    cat_token: str | None = None,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
):
    raw = (credentials.credentials if credentials else None) or token
    video = None

    if raw:
        user_id = decode_token(raw)
        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            current_user = result.scalar_one_or_none()
            if current_user:
                result = await db.execute(
                    select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
                )
                video = result.scalar_one_or_none()

    if video is None and cat_token:
        from backend.models.category_share import CategoryShare
        cs_result = await db.execute(
            select(CategoryShare).where(CategoryShare.token == cat_token)
        )
        cs = cs_result.scalar_one_or_none()
        if cs and cs.is_valid():
            result = await db.execute(
                select(Video).where(
                    Video.id == video_id,
                    Video.category == cs.category,
                    Video.user_id == cs.user_id,
                )
            )
            video = result.scalar_one_or_none()

    if video is None:
        result = await db.execute(
            select(Video).where(Video.id == video_id, Video.visibility == Visibility.public)
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
