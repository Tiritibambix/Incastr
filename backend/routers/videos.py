import os
from pathlib import Path
from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from backend.database import get_db
from backend.models.user import User
from backend.models.video import Video, Visibility
from backend.models.tag import Tag
from backend.schemas.video import VideoOut, VideoUpdate, VideoPublic
from backend.core.dependencies import get_current_user
from backend.core.exceptions import not_found, forbidden
from backend.services.search import search_videos

router = APIRouter(prefix="/api/videos", tags=["videos"])

CHUNK_SIZE = 1024 * 1024  # 1 MB


@router.get("/", response_model=list[VideoOut])
async def list_videos(
    q: str | None = None,
    field: str | None = None,
    visibility: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await search_videos(db, current_user.id, q=q, field=field, visibility=visibility, skip=skip, limit=limit)


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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
    )
    video = result.scalar_one_or_none()
    if not video:
        raise not_found("Video not found")
    await db.delete(video)


@router.get("/{video_id}/stream")
async def stream_video(
    video_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Video).where(Video.id == video_id, Video.user_id == current_user.id)
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
