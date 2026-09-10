"""create order fulfillment tables

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-08
"""
import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "demand_orders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("creator_id", sa.Integer(), nullable=False),
        sa.Column("enterprise_name", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("contact_name", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("contact_email", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("product_name", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("budget_amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("budget_note", sa.Text(), nullable=False),
        sa.Column("expected_delivery_at", sa.DateTime(), nullable=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("business_background", sa.Text(), nullable=False),
        sa.Column("deliverable_expectation", sa.Text(), nullable=False),
        sa.Column("attachments", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("review_note", sa.Text(), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("claimed_company_id", sa.Integer(), nullable=True),
        sa.Column("assigned_fde_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["claimed_company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["assigned_fde_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_demand_orders_assigned_fde_user_id", "demand_orders", ["assigned_fde_user_id"])
    op.create_index("ix_demand_orders_claimed_company_id", "demand_orders", ["claimed_company_id"])
    op.create_index("ix_demand_orders_creator_id", "demand_orders", ["creator_id"])
    op.create_index("ix_demand_orders_status", "demand_orders", ["status"])

    op.create_table(
        "order_claims",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("operator_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="interested"),
        sa.Column("claim_note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["operator_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["demand_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id", "company_id", name="uq_order_claims_order_company"),
    )
    op.create_index("ix_order_claims_company_id", "order_claims", ["company_id"])
    op.create_index("ix_order_claims_operator_user_id", "order_claims", ["operator_user_id"])
    op.create_index("ix_order_claims_order_id", "order_claims", ["order_id"])
    op.create_index("ix_order_claims_status", "order_claims", ["status"])

    op.create_table(
        "order_quotes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=16), nullable=False, server_default="CNY"),
        sa.Column("start_at", sa.DateTime(), nullable=True),
        sa.Column("delivery_at", sa.DateTime(), nullable=True),
        sa.Column("scope", sa.Text(), nullable=False),
        sa.Column("deliverables", sa.Text(), nullable=False),
        sa.Column("exclusions", sa.Text(), nullable=False),
        sa.Column("risks", sa.Text(), nullable=False),
        sa.Column("enterprise_dependencies", sa.Text(), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="submitted"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["demand_orders.id"]),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_quotes_company_id", "order_quotes", ["company_id"])
    op.create_index("ix_order_quotes_order_id", "order_quotes", ["order_id"])
    op.create_index("ix_order_quotes_owner_user_id", "order_quotes", ["owner_user_id"])
    op.create_index("ix_order_quotes_status", "order_quotes", ["status"])

    op.create_table(
        "order_payments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=16), nullable=False, server_default="CNY"),
        sa.Column("method", sa.String(length=24), nullable=False, server_default="simulated"),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.Column("operated_by", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["operated_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["demand_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_payments_order_id", "order_payments", ["order_id"])
    op.create_index("ix_order_payments_status", "order_payments", ["status"])

    op.create_table(
        "order_deliveries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("submitted_by", sa.Integer(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("deliverable_urls", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="submitted"),
        sa.Column("acceptance_note", sa.Text(), nullable=False),
        sa.Column("accepted_by", sa.Integer(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["accepted_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["demand_orders.id"]),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_deliveries_company_id", "order_deliveries", ["company_id"])
    op.create_index("ix_order_deliveries_order_id", "order_deliveries", ["order_id"])
    op.create_index("ix_order_deliveries_status", "order_deliveries", ["status"])

    op.create_table(
        "order_reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), nullable=False),
        sa.Column("reviewer_role", sa.String(length=32), nullable=False, server_default="enterprise"),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["demand_orders.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_reviews_order_id", "order_reviews", ["order_id"])
    op.create_index("ix_order_reviews_reviewer_id", "order_reviews", ["reviewer_id"])

    op.create_table(
        "fde_project_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("fde_user_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("project_title", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("product_name", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("role", sa.String(length=64), nullable=False, server_default="assigned_fde"),
        sa.Column("skill_tags", sa.Text(), nullable=False),
        sa.Column("enterprise_score", sa.Integer(), nullable=True),
        sa.Column("company_score", sa.Integer(), nullable=True),
        sa.Column("is_public_case", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["fde_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["demand_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fde_project_records_company_id", "fde_project_records", ["company_id"])
    op.create_index("ix_fde_project_records_fde_user_id", "fde_project_records", ["fde_user_id"])
    op.create_index("ix_fde_project_records_order_id", "fde_project_records", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_fde_project_records_order_id", table_name="fde_project_records")
    op.drop_index("ix_fde_project_records_fde_user_id", table_name="fde_project_records")
    op.drop_index("ix_fde_project_records_company_id", table_name="fde_project_records")
    op.drop_table("fde_project_records")

    op.drop_index("ix_order_reviews_reviewer_id", table_name="order_reviews")
    op.drop_index("ix_order_reviews_order_id", table_name="order_reviews")
    op.drop_table("order_reviews")

    op.drop_index("ix_order_deliveries_status", table_name="order_deliveries")
    op.drop_index("ix_order_deliveries_order_id", table_name="order_deliveries")
    op.drop_index("ix_order_deliveries_company_id", table_name="order_deliveries")
    op.drop_table("order_deliveries")

    op.drop_index("ix_order_payments_status", table_name="order_payments")
    op.drop_index("ix_order_payments_order_id", table_name="order_payments")
    op.drop_table("order_payments")

    op.drop_index("ix_order_quotes_status", table_name="order_quotes")
    op.drop_index("ix_order_quotes_owner_user_id", table_name="order_quotes")
    op.drop_index("ix_order_quotes_order_id", table_name="order_quotes")
    op.drop_index("ix_order_quotes_company_id", table_name="order_quotes")
    op.drop_table("order_quotes")

    op.drop_index("ix_order_claims_status", table_name="order_claims")
    op.drop_index("ix_order_claims_order_id", table_name="order_claims")
    op.drop_index("ix_order_claims_operator_user_id", table_name="order_claims")
    op.drop_index("ix_order_claims_company_id", table_name="order_claims")
    op.drop_table("order_claims")

    op.drop_index("ix_demand_orders_status", table_name="demand_orders")
    op.drop_index("ix_demand_orders_creator_id", table_name="demand_orders")
    op.drop_index("ix_demand_orders_claimed_company_id", table_name="demand_orders")
    op.drop_index("ix_demand_orders_assigned_fde_user_id", table_name="demand_orders")
    op.drop_table("demand_orders")
