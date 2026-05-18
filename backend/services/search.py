from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models.tag import Tag, video_tags
from backend.models.video import Video


async def search_videos(
    db: AsyncSession,
    user_id: str,
    q: str | None = None,
    field: str | None = None,
    visibility: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[Video]:
    stmt = (
        select(Video)
        .where(Video.user_id == user_id, ~Video.is_missing)
        .options(selectinload(Video.tags))
    )

    if visibility:
        stmt = stmt.where(Video.visibility == visibility)

    if q:
        pattern = f"%{q}%"
        if field == "title":
            stmt = stmt.where(Video.title.ilike(pattern))
        elif field == "description":
            stmt = stmt.where(Video.description.ilike(pattern))
        elif field == "category":
            stmt = stmt.where(Video.category.ilike(pattern))
        elif field == "tags":
            stmt = stmt.join(video_tags, Video.id == video_tags.c.video_id).join(
                Tag, Tag.id == video_tags.c.tag_id
            ).where(Tag.name.ilike(pattern))
        else:
            stmt = stmt.outerjoin(video_tags, Video.id == video_tags.c.video_id).outerjoin(
                Tag, Tag.id == video_tags.c.tag_id
            ).where(
                or_(
                    Video.title.ilike(pattern),
                    Video.description.ilike(pattern),
                    Video.category.ilike(pattern),
                    Tag.name.ilike(pattern),
                )
            ).distinct()

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())
