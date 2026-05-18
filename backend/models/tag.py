import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base

if TYPE_CHECKING:
    from backend.models.user import User
    from backend.models.video import Video


video_tags = Table(
    "video_tags",
    Base.metadata,
    Column("video_id", String, ForeignKey("videos.id"), primary_key=True),
    Column("tag_id", String, ForeignKey("tags.id"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="tags")
    videos: Mapped[list["Video"]] = relationship("Video", secondary=video_tags, back_populates="tags")
