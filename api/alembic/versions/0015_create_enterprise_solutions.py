"""create enterprise solutions

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-15
"""
import sqlalchemy as sa

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "enterprise_solutions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("creator_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("subtitle", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("industry", sa.String(length=64), nullable=False),
        sa.Column("scenario", sa.String(length=64), nullable=False),
        sa.Column("delivery_cycle", sa.String(length=64), nullable=False),
        sa.Column("budget_range", sa.String(length=64), nullable=False),
        sa.Column("cover_image_url", sa.String(length=512), nullable=False),
        sa.Column("tags", sa.Text(), nullable=False),
        sa.Column("case_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("review_note", sa.Text(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_enterprise_solutions_category", "enterprise_solutions", ["category"])
    op.create_index("ix_enterprise_solutions_company_id", "enterprise_solutions", ["company_id"])
    op.create_index("ix_enterprise_solutions_creator_id", "enterprise_solutions", ["creator_id"])
    op.create_index("ix_enterprise_solutions_industry", "enterprise_solutions", ["industry"])
    op.create_index("ix_enterprise_solutions_scenario", "enterprise_solutions", ["scenario"])
    op.create_index("ix_enterprise_solutions_status", "enterprise_solutions", ["status"])
    op.create_index("ix_enterprise_solutions_title", "enterprise_solutions", ["title"])


def downgrade() -> None:
    op.drop_index("ix_enterprise_solutions_title", table_name="enterprise_solutions")
    op.drop_index("ix_enterprise_solutions_status", table_name="enterprise_solutions")
    op.drop_index("ix_enterprise_solutions_scenario", table_name="enterprise_solutions")
    op.drop_index("ix_enterprise_solutions_industry", table_name="enterprise_solutions")
    op.drop_index("ix_enterprise_solutions_creator_id", table_name="enterprise_solutions")
    op.drop_index("ix_enterprise_solutions_company_id", table_name="enterprise_solutions")
    op.drop_index("ix_enterprise_solutions_category", table_name="enterprise_solutions")
    op.drop_table("enterprise_solutions")
