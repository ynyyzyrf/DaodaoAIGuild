"""create company and organization relationship tables

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-27
"""
import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("applicant_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("logo_url", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("contact_name", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("contact_email", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("service_fields", sa.Text(), nullable=False),
        sa.Column("strengths", sa.Text(), nullable=False),
        sa.Column("cases", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="draft"),
        sa.Column("review_note", sa.Text(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["applicant_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_companies_applicant_id", "companies", ["applicant_id"])
    op.create_index("ix_companies_name", "companies", ["name"])
    op.create_index("ix_companies_status", "companies", ["status"])

    op.create_table(
        "company_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_role", sa.String(length=16), nullable=False, server_default="none"),
        sa.Column("fde_status", sa.String(length=16), nullable=False, server_default="none"),
        sa.Column("role_started_at", sa.DateTime(), nullable=True),
        sa.Column("fde_joined_at", sa.DateTime(), nullable=True),
        sa.Column("fde_exited_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "user_id", name="uq_company_members_company_user"),
    )
    op.create_index("ix_company_members_company_id", "company_members", ["company_id"])
    op.create_index("ix_company_members_fde_status", "company_members", ["fde_status"])
    op.create_index("ix_company_members_user_id", "company_members", ["user_id"])

    op.create_table(
        "company_join_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("requested_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.Column("processed_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["processed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_company_join_requests_company_id", "company_join_requests", ["company_id"])
    op.create_index("ix_company_join_requests_status", "company_join_requests", ["status"])
    op.create_index("ix_company_join_requests_user_id", "company_join_requests", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_company_join_requests_user_id", table_name="company_join_requests")
    op.drop_index("ix_company_join_requests_status", table_name="company_join_requests")
    op.drop_index("ix_company_join_requests_company_id", table_name="company_join_requests")
    op.drop_table("company_join_requests")

    op.drop_index("ix_company_members_user_id", table_name="company_members")
    op.drop_index("ix_company_members_fde_status", table_name="company_members")
    op.drop_index("ix_company_members_company_id", table_name="company_members")
    op.drop_table("company_members")

    op.drop_index("ix_companies_status", table_name="companies")
    op.drop_index("ix_companies_name", table_name="companies")
    op.drop_index("ix_companies_applicant_id", table_name="companies")
    op.drop_table("companies")
