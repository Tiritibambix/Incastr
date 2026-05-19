"""add enabled and expires_at to category_shares

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-19 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("category_shares", sa.Column("enabled", sa.Boolean(), nullable=False, server_default="1"))
    op.add_column("category_shares", sa.Column("expires_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("category_shares", "expires_at")
    op.drop_column("category_shares", "enabled")
