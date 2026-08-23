"""add answers.accepted_at（采纳时间，供本週救援/feed 按实际救援时间排序）

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-22

"""
import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("answers", sa.Column("accepted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("answers", "accepted_at")
