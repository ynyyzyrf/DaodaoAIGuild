"""create room tables for Lobster Agent Connection v0.1 Phase B (docs/3.3.md)

三張表：

- ``rooms``：Private 協作空間。v0.1 只支持 private（邀請制），public 留後續版本。

- ``room_members``：房間成員，人（user）與 Agent 共用一張表。
  member_type 區分，member_id 存 user_id 或 agent_id；
  UNIQUE(room_id, member_type, member_id) 保證「同房間同對象不能重複加入」。

- ``room_messages``：房間消息。sender 可為 user 或 agent；
  reply_to_message_id 關聯原消息（Agent 回 @ 的消息）；
  mentioned_agent_ids 存後端解析出的 @agent 清單（純查詢用，觸發判斷在 service 層）。

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-25
"""
import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── rooms ─────────────────────────────────────────────────────────────
    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("room_id", sa.String(32), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("description", sa.String(255), nullable=False, server_default=""),
        sa.Column("owner_id", sa.Integer, nullable=False),
        sa.Column(
            "privacy",
            sa.Enum("private", name="room_privacy"),
            nullable=False,
            server_default="private",
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("room_id", name="uq_rooms_room_id"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name="fk_rooms_owner", ondelete="CASCADE"),
    )
    op.create_index("ix_rooms_owner", "rooms", ["owner_id"])

    # ── room_members ──────────────────────────────────────────────────────
    op.create_table(
        "room_members",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("room_id", sa.Integer, nullable=False),
        sa.Column("member_type", sa.Enum("user", "agent", name="room_member_type"), nullable=False),
        sa.Column("member_id", sa.Integer, nullable=False),  # user_id 或 agent_id
        sa.Column("role", sa.Enum("owner", "member", name="room_member_role"), nullable=False, server_default="member"),
        sa.Column("invited_by", sa.Integer, nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "pending", "removed", name="room_member_status"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("room_id", "member_type", "member_id", name="uq_room_member"),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], name="fk_members_room", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], name="fk_members_inviter", ondelete="SET NULL"),
    )
    op.create_index("ix_room_members_room", "room_members", ["room_id"])
    op.create_index("ix_room_members_member", "room_members", ["member_type", "member_id"])

    # ── room_messages ─────────────────────────────────────────────────────
    op.create_table(
        "room_messages",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("message_id", sa.String(32), nullable=False),
        sa.Column("room_id", sa.Integer, nullable=False),
        sa.Column("sender_type", sa.Enum("user", "agent", name="message_sender_type"), nullable=False),
        sa.Column("sender_user_id", sa.Integer, nullable=True),
        sa.Column("sender_agent_id", sa.Integer, nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("reply_to_message_id", sa.Integer, nullable=True),
        sa.Column("mentioned_agent_ids", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("message_id", name="uq_messages_message_id"),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], name="fk_messages_room", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"], name="fk_messages_user", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["sender_agent_id"], ["agents.id"], name="fk_messages_agent", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["reply_to_message_id"], ["room_messages.id"], name="fk_messages_reply_to", ondelete="SET NULL"
        ),
    )
    op.create_index("ix_room_messages_room", "room_messages", ["room_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_room_messages_room", table_name="room_messages")
    op.drop_table("room_messages")
    op.drop_index("ix_room_members_member", table_name="room_members")
    op.drop_index("ix_room_members_room", table_name="room_members")
    op.drop_table("room_members")
    op.drop_index("ix_rooms_owner", table_name="rooms")
    op.drop_table("rooms")
