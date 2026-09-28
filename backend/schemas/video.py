from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel

from backend.models.video import Visibility
from backend.schemas.tag import TagOut

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int


class VideoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    visibility: Visibility | None = None
    share_name: str | None = None
    share_enabled: bool | None = None
    share_expires_at: datetime | None = None


class VideoMoveCategory(BaseModel):
    category: str | None = None  # None = move to root of folder (no category)


class VideoRenameFile(BaseModel):
    filename: str


class VideoOut(BaseModel):
    id: str
    user_id: str
    folder_id: str
    filepath: str
    filename: str
    title: str
    description: str | None
    category: str | None
    visibility: Visibility
    share_token: str
    share_name: str | None
    share_enabled: bool
    share_expires_at: datetime | None
    thumbnail_path: str | None
    duration_seconds: int | None
    file_size_bytes: int | None
    mime_type: str | None
    is_missing: bool
    created_at: datetime
    updated_at: datetime
    last_scanned_at: datetime | None
    tags: list[TagOut] = []
    resume_position_seconds: int | None = None

    model_config = {"from_attributes": True}


class DuplicateGroup(BaseModel):
    filename: str
    file_size_bytes: int
    videos: list[VideoOut]


class WatchProgressUpdate(BaseModel):
    position_seconds: int


class WatchHistoryEntry(BaseModel):
    watched_at: datetime
    video: VideoOut


class VideoPublic(BaseModel):
    id: str
    user_id: str
    title: str
    description: str | None
    category: str | None
    visibility: Visibility
    thumbnail_path: str | None
    duration_seconds: int | None
    mime_type: str | None
    tags: list[TagOut] = []

    model_config = {"from_attributes": True}
