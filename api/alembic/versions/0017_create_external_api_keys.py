"""create external api keys

Revision ID: 0017
Revises: 0016
Create Date: 2026-09-16
"""
import sqlalchemy as sa

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "external_api_keys",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("key_prefix", sa.String(length=32), nullable=False),
        sa.Column("key_hash", sa.String(length=128), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_hash"),
    )
    op.create_index("ix_external_api_keys_company_id", "external_api_keys", ["company_id"])
    op.create_index("ix_external_api_keys_key_prefix", "external_api_keys", ["key_prefix"])
    op.create_index("ix_external_api_keys_owner_user_id", "external_api_keys", ["owner_user_id"])
    op.create_index("ix_external_api_keys_status", "external_api_keys", ["status"])

    op.create_table(
        "external_api_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("api_key_id", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=12), nullable=False),
        sa.Column("path", sa.String(length=255), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("error_code", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["api_key_id"], ["external_api_keys.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_external_api_logs_api_key_id", "external_api_logs", ["api_key_id"])


def downgrade() -> None:
    op.drop_index("ix_external_api_logs_api_key_id", table_name="external_api_logs")
    op.drop_table("external_api_logs")
    op.drop_index("ix_external_api_keys_status", table_name="external_api_keys")
    op.drop_index("ix_external_api_keys_owner_user_id", table_name="external_api_keys")
    op.drop_index("ix_external_api_keys_key_prefix", table_name="external_api_keys")
    op.drop_index("ix_external_api_keys_company_id", table_name="external_api_keys")
    op.drop_table("external_api_keys")
