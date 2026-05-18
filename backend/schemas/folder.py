from datetime import datetime

from pydantic import BaseModel


class FolderCreate(BaseModel):
    path: str
    label: str


class FolderUpdate(BaseModel):
    path: str | None = None
    label: str | None = None


class FolderOut(BaseModel):
    id: str
    user_id: str
    path: str
    label: str
    created_at: datetime

    model_config = {"from_attributes": True}
