from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth import decode_token
from backend.models.category_share import CategoryShare
from backend.models.user import User
from backend.models.video import Video, Visibility


async def resolve_video_access(
    video_id: str,
    db: AsyncSession,
    credentials: HTTPAuthorizationCredentials | None = None,
    token: str | None = None,
    cat_token: str | None = None,
    share_token: str | None = None,
) -> Video | None:
    """Resolve a video the caller may access, or None if no access path matches.

    Checked in order: owner JWT (bearer header or query token, used by <video>/<img>
    tags that cannot send an Authorization header), category-share token, unlisted
    share token, then public visibility.
    """
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
        cs_result = await db.execute(select(CategoryShare).where(CategoryShare.token == cat_token))
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

    if video is None and share_token:
        result = await db.execute(
            select(Video).where(
                Video.id == video_id,
                Video.share_token == share_token,
                Video.visibility == Visibility.unlisted,
            )
        )
        video = result.scalar_one_or_none()

    if video is None:
        result = await db.execute(
            select(Video).where(Video.id == video_id, Video.visibility == Visibility.public)
        )
        video = result.scalar_one_or_none()

    return video
