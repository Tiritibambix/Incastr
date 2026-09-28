"""add unique index on videos(user_id, filepath)

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-28 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Defensively dedupe any pre-existing (user_id, filepath) collisions, keeping the most recent row
    op.execute(
        sa.text(
            """
            DELETE FROM videos
            WHERE id NOT IN (
                SELECT id FROM (
                    SELECT id, ROW_NUMBER() OVER (
                        PARTITION BY user_id, filepath ORDER BY created_at DESC
                    ) AS rn
                    FROM videos
                ) ranked
                WHERE rn = 1
            )
            """
        )
    )
    op.create_index(
        "ix_videos_user_id_filepath", "videos", ["user_id", "filepath"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_videos_user_id_filepath", table_name="videos")
