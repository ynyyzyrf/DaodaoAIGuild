"""add tutorial external video fields

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-16

"""
import sqlalchemy as sa

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tutorials", sa.Column("video_url", sa.Text(), nullable=True))
    op.add_column("tutorials", sa.Column("video_provider", sa.String(32), nullable=True))
    op.add_column("tutorials", sa.Column("video_embed_url", sa.Text(), nullable=True))
    op.add_column("tutorials", sa.Column("video_title", sa.String(255), nullable=True))
    op.add_column("tutorials", sa.Column("video_thumbnail_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tutorials", "video_thumbnail_url")
    op.drop_column("tutorials", "video_title")
    op.drop_column("tutorials", "video_embed_url")
    op.drop_column("tutorials", "video_provider")
    op.drop_column("tutorials", "video_url")
