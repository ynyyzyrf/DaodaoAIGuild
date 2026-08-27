"""RoomMember model — 房間成員，人（user）與 Agent 共用（docs/3.3.md §十五-§十六）。

member_type 區分對象類型，member_id 存 user_id 或 agent_id。
UNIQUE(room_id, member_type, member_id) 保證同房間同對象不能重複加入。

M7 pilot：room 成員可邀請已存在的 public Agent，直接 active；
owner 審批流保留給公開 beta 前補充。
"""
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RoomMember(Base):
    __tablename__ = "room_members"
    __table_args__ = (
        UniqueConstraint("room_id", "member_type", "member_id", name="uq_room_member"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_type: Mapped[str] = mapped_column(
        Enum("user", "agent", name="room_member_type"), nullable=False
    )
    # member_type='user' → users.id；'agent' → agents.id
    member_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    role: Mapped[str] = mapped_column(
        Enum("owner", "member", name="room_member_role"), nullable=False, default="member"
    )
    invited_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        Enum("active", "pending", "removed", name="room_member_status"),
        nullable=False,
        default="active",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<RoomMember room={self.room_id} type={self.member_type} id={self.member_id}>"
