"""add share_name, share_enabled, share_expires_at to videos

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-28 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("videos", sa.Column("share_name", sa.String(), nullable=True))
    op.add_column("videos", sa.Column("share_enabled", sa.Boolean(), nullable=False, server_default="1"))
    op.add_column("videos", sa.Column("share_expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("videos", "share_expires_at")
    op.drop_column("videos", "share_enabled")
    op.drop_column("videos", "share_name")
