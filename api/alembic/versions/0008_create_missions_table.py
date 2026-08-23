"""create missions table（龍蝦任務大廳，V3.2 管理后台 M5 依赖）

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-23
"""
import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "missions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("tech_requirements", sa.JSON(), nullable=False, server_default=sa.text("(JSON_ARRAY())")),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default=sa.text("'medium'")),
        sa.Column("reward", sa.String(255), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'open'")),
        sa.Column("creator_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_missions_creator_id", "missions", ["creator_id"])
    op.create_index("ix_missions_assignee_id", "missions", ["assignee_id"])
    op.create_index("ix_missions_status", "missions", ["status"])


def downgrade() -> None:
    op.drop_index("ix_missions_status", table_name="missions")
    op.drop_index("ix_missions_assignee_id", table_name="missions")
    op.drop_index("ix_missions_creator_id", table_name="missions")
    op.drop_table("missions")
