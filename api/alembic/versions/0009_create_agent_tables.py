"""create agent tables for Lobster Agent Connection v0.1 (docs/3.3.md)

建立三張表（單一 migration 保證原子性）：

- ``agents``：本地 Runtime 對應的 Agent Identity。
  v0.1 規則：1 Runtime = 1 Agent；不做多 Device 共用同一 Agent 抽象。

- ``agent_credentials``：1 Agent 同時只有一份有效 Credential。
  access_jti / refresh_jti 為 NULL = 未發放或已撤銷；rotation 透過把舊 jti
  設 NULL 並寫入新 jti 完成，不需要 revoked_jtis 表。

- ``device_codes``：Device Authorization Grant 的短生命週期記錄。
  device_code（Hermes 持有，server-to-server 走 TLS）與
  verification_token（瀏覽器 URL fragment 持有）完全分離；兩者都只存 SHA256。

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-25
"""
import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── agents ────────────────────────────────────────────────────────────
    op.create_table(
        "agents",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("agent_id", sa.String(32), nullable=False),
        sa.Column("owner_id", sa.Integer, nullable=False),
        sa.Column("agent_type", sa.String(32), nullable=False, server_default="hermes"),
        sa.Column("display_name", sa.String(64), nullable=False),
        sa.Column("avatar_url", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "online", "offline", "revoked", name="agent_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "visibility",
            sa.Enum("only_me", "specific_users", "friends", "nobody", name="agent_visibility"),
            nullable=False,
            server_default="only_me",
        ),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("agent_id", name="uq_agents_agent_id"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name="fk_agents_owner", ondelete="CASCADE"),
    )
    op.create_index("ix_agents_owner_status", "agents", ["owner_id", "status"])
    op.create_index("ix_agents_status_last_seen", "agents", ["status", "last_seen_at"])

    # ── agent_credentials ────────────────────────────────────────────────
    op.create_table(
        "agent_credentials",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("agent_id", sa.Integer, nullable=False),
        sa.Column("access_jti", sa.String(64), nullable=True),
        sa.Column("access_expires_at", sa.DateTime(), nullable=True),
        sa.Column("refresh_jti", sa.String(64), nullable=True),
        sa.Column("refresh_expires_at", sa.DateTime(), nullable=True),
        sa.Column("refresh_rotation_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("device_name", sa.String(64), nullable=False),
        sa.Column("device_fingerprint", sa.String(128), nullable=True),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_reason", sa.String(64), nullable=True),
        sa.UniqueConstraint("agent_id", name="uq_creds_agent"),
        sa.UniqueConstraint("access_jti", name="uq_creds_access_jti"),
        sa.UniqueConstraint("refresh_jti", name="uq_creds_refresh_jti"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], name="fk_creds_agent", ondelete="CASCADE"),
    )
    op.create_index("ix_creds_refresh_expires", "agent_credentials", ["refresh_expires_at"])

    # ── device_codes ─────────────────────────────────────────────────────
    op.create_table(
        "device_codes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("device_code_hash", sa.String(128), nullable=False),
        sa.Column("verification_token_hash", sa.String(128), nullable=False),
        sa.Column("agent_type", sa.String(32), nullable=False, server_default="hermes"),
        sa.Column("suggested_name", sa.String(64), nullable=False),
        sa.Column("device_name", sa.String(64), nullable=False),
        sa.Column("device_fingerprint", sa.String(128), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "authorized",
                "consumed",
                "expired",
                "denied",
                name="device_code_status",
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("agent_id", sa.Integer(), nullable=True),
        sa.Column("requested_scopes", sa.JSON(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("authorized_at", sa.DateTime(), nullable=True),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("device_code_hash", name="uq_device_code_hash"),
        sa.UniqueConstraint("verification_token_hash", name="uq_verification_token_hash"),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name="fk_device_codes_owner", ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["agent_id"], ["agents.id"], name="fk_device_codes_agent", ondelete="SET NULL"
        ),
    )
    op.create_index("ix_device_codes_status_expires", "device_codes", ["status", "expires_at"])
    op.create_index("ix_device_codes_owner", "device_codes", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_device_codes_owner", table_name="device_codes")
    op.drop_index("ix_device_codes_status_expires", table_name="device_codes")
    op.drop_table("device_codes")
    op.drop_index("ix_creds_refresh_expires", table_name="agent_credentials")
    op.drop_table("agent_credentials")
    op.drop_index("ix_agents_status_last_seen", table_name="agents")
    op.drop_index("ix_agents_owner_status", table_name="agents")
    op.drop_table("agents")
