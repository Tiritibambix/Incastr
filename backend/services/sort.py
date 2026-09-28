from sqlalchemy import Select
from sqlalchemy.sql.elements import ColumnElement

from backend.models.video import Video

SORT_OPTIONS: dict[str, ColumnElement] = {
    "date_desc": Video.created_at.desc(),
    "date_asc": Video.created_at.asc(),
    "duration_desc": Video.duration_seconds.desc(),
    "duration_asc": Video.duration_seconds.asc(),
    "title_asc": Video.title.asc(),
}


def apply_sort(stmt: Select, sort: str | None) -> Select:
    """Order a Video query, defaulting to newest-first for an unknown or missing sort key."""
    return stmt.order_by(SORT_OPTIONS.get(sort or "date_desc", SORT_OPTIONS["date_desc"]))
