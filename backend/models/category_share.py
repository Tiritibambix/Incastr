import secrets
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class CategoryShare(Base):
    __tablename__ = "category_shares"
    __table_args__ = (UniqueConstraint("user_id", "category"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False,
                                       default=lambda: secrets.token_urlsafe(32))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def is_valid(self) -> bool:
        if not self.enabled:
            return False
        if self.expires_at and self.expires_at < datetime.utcnow():
            return False
        return True
