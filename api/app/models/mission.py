"""龍蝦任務大廳 missions 表（docs/TECH-DESIGN.md §4.2 / docs/2.0.md §15）。

V3.2 管理后台 M5 需要 missions 表，但此前未落地，本次补建。
状态机：open → in_progress → delivered → closed
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tech_requirements: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    reward: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    # 状态机：open → in_progress → delivered → closed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
