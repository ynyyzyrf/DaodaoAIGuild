"""RoomMessage model — 房間消息（docs/3.3.md §二十八-§三十）。

- sender 可為 user 或 agent（sender_type + sender_user_id / sender_agent_id 二選一）
- reply_to_message_id 關聯原消息（Agent 回 @ 的消息）
- mentioned_agent_ids 存後端解析出的 @agent 內部 id 清單（僅供查詢 / audit；
  真正的觸發判斷在 service 層的 Trigger Policy）
"""
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RoomMessage(Base):
    __tablename__ = "room_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # public-facing ID，例如 "msg_5f8a2c9d1e3b4f6a"
    message_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_type: Mapped[str] = mapped_column(
        Enum("user", "agent", name="message_sender_type"), nullable=False
    )
    sender_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    sender_agent_id: Mapped[int | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Agent 回 @ 消息時關聯原消息；人回人也可以帶 reply_to
    reply_to_message_id: Mapped[int | None] = mapped_column(
        ForeignKey("room_messages.id", ondelete="SET NULL"), nullable=True
    )
    # 後端解析出的 @agent 內部 id 清單
    mentioned_agent_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<RoomMessage id={self.id} room={self.room_id} sender={self.sender_type}>"
