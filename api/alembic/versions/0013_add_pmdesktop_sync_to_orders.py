"""add pmdesktop sync to orders

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-09
"""
import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("demand_orders")}
    indexes = {index["name"] for index in inspector.get_indexes("demand_orders")}

    if "pmdesktop_product_id" not in columns:
        op.add_column(
            "demand_orders",
            sa.Column("pmdesktop_product_id", sa.String(length=128), nullable=False, server_default=""),
        )
    if "pmdesktop_sync_status" not in columns:
        op.add_column(
            "demand_orders",
            sa.Column("pmdesktop_sync_status", sa.String(length=24), nullable=False, server_default="pending"),
        )
    if "pmdesktop_requirement_id" not in columns:
        op.add_column(
            "demand_orders",
            sa.Column("pmdesktop_requirement_id", sa.String(length=128), nullable=False, server_default=""),
        )
    if "pmdesktop_user_voice_id" not in columns:
        op.add_column(
            "demand_orders",
            sa.Column("pmdesktop_user_voice_id", sa.String(length=128), nullable=False, server_default=""),
        )
    if "pmdesktop_sync_error" not in columns:
        op.add_column("demand_orders", sa.Column("pmdesktop_sync_error", sa.Text(), nullable=True))
        op.execute(sa.text("UPDATE demand_orders SET pmdesktop_sync_error = '' WHERE pmdesktop_sync_error IS NULL"))
        op.alter_column("demand_orders", "pmdesktop_sync_error", existing_type=sa.Text(), nullable=False)
    if "pmdesktop_synced_at" not in columns:
        op.add_column("demand_orders", sa.Column("pmdesktop_synced_at", sa.DateTime(), nullable=True))
    if "ix_demand_orders_pmdesktop_product_id" not in indexes:
        op.create_index("ix_demand_orders_pmdesktop_product_id", "demand_orders", ["pmdesktop_product_id"])
    if "ix_demand_orders_pmdesktop_sync_status" not in indexes:
        op.create_index("ix_demand_orders_pmdesktop_sync_status", "demand_orders", ["pmdesktop_sync_status"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("demand_orders")}
    indexes = {index["name"] for index in inspector.get_indexes("demand_orders")}

    if "ix_demand_orders_pmdesktop_sync_status" in indexes:
        op.drop_index("ix_demand_orders_pmdesktop_sync_status", table_name="demand_orders")
    if "ix_demand_orders_pmdesktop_product_id" in indexes:
        op.drop_index("ix_demand_orders_pmdesktop_product_id", table_name="demand_orders")
    for column_name in (
        "pmdesktop_synced_at",
        "pmdesktop_sync_error",
        "pmdesktop_user_voice_id",
        "pmdesktop_requirement_id",
        "pmdesktop_sync_status",
        "pmdesktop_product_id",
    ):
        if column_name in columns:
            op.drop_column("demand_orders", column_name)
