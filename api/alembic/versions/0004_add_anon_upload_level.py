"""add anon_number to users, is_anonymous to questions, create attachments table

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-21

"""
import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("anon_number", sa.Integer(), nullable=True))
    op.create_index("uq_users_anon_number", "users", ["anon_number"], unique=True)

    op.add_column("questions", sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("uploader_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("url", sa.String(512), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=True),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_attachments_uploader_id", "attachments", ["uploader_id"])
    op.create_index("ix_attachments_target", "attachments", ["target_type", "target_id"])


def downgrade() -> None:
    op.drop_table("attachments")
    op.drop_column("questions", "is_anonymous")
    op.drop_index("uq_users_anon_number", table_name="users")
    op.drop_column("users", "anon_number")
