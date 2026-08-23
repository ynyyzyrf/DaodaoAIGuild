"""add gamification: users.exp / users.current_title_code + unlock tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-21

"""
import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("exp", sa.Integer(), nullable=False, server_default=sa.text("0")))
    op.add_column("users", sa.Column("current_title_code", sa.String(50), nullable=True))

    op.create_table(
        "user_achievements",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("achievement_code", sa.String(50), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "achievement_code", name="uq_user_achievement"),
    )
    op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"])

    op.create_table(
        "user_titles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title_code", sa.String(50), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "title_code", name="uq_user_title"),
    )
    op.create_index("ix_user_titles_user_id", "user_titles", ["user_id"])

    op.create_table(
        "user_equipment",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("equipment_code", sa.String(50), nullable=False),
        sa.Column("is_equipped", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("unlocked_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "equipment_code", name="uq_user_equipment"),
    )
    op.create_index("ix_user_equipment_user_id", "user_equipment", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_equipment_user_id", table_name="user_equipment")
    op.drop_table("user_equipment")
    op.drop_index("ix_user_titles_user_id", table_name="user_titles")
    op.drop_table("user_titles")
    op.drop_index("ix_user_achievements_user_id", table_name="user_achievements")
    op.drop_table("user_achievements")
    op.drop_column("users", "current_title_code")
    op.drop_column("users", "exp")
