from datetime import datetime

from pydantic import BaseModel

from backend.models.video import Visibility
from backend.schemas.tag import TagOut


class VideoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    visibility: Visibility | None = None


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
    thumbnail_path: str | None
    duration_seconds: int | None
    file_size_bytes: int | None
    mime_type: str | None
    is_missing: bool
    created_at: datetime
    updated_at: datetime
    last_scanned_at: datetime | None
    tags: list[TagOut] = []

    model_config = {"from_attributes": True}


class VideoPublic(BaseModel):
    id: str
    title: str
    description: str | None
    category: str | None
    thumbnail_path: str | None
    duration_seconds: int | None
    tags: list[TagOut] = []

    model_config = {"from_attributes": True}
