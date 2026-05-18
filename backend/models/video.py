import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base
from backend.models.tag import video_tags

if TYPE_CHECKING:
    from backend.models.folder import Folder
    from backend.models.tag import Tag
    from backend.models.user import User


class Visibility(str, enum.Enum):
    private = "private"
    public = "public"
    unlisted = "unlisted"


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    folder_id: Mapped[str] = mapped_column(String, ForeignKey("folders.id"), nullable=False)
    filepath: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    visibility: Mapped[Visibility] = mapped_column(SAEnum(Visibility), default=Visibility.private)
    share_token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    thumbnail_path: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String, nullable=True)
    is_missing: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="videos")
    folder: Mapped["Folder"] = relationship("Folder", back_populates="videos")
    tags: Mapped[list["Tag"]] = relationship("Tag", secondary=video_tags, back_populates="videos")
