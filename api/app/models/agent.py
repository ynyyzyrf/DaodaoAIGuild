"""Agent model — 本地 Runtime 對應的 Agent Identity（docs/3.3.md §四十三）。

v0.1 規則：
- 1 Runtime = 1 Agent（不做多 Device 共用抽象）
- agent_id 為 public-facing ID（``agt_xxxxxxxxx`` 格式），與內部 int id 分離
- 預設 visibility = 'only_me'（文件 §十七）
"""
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # public-facing ID，例如 "agt_5f8a2c9d1e3b4f6a"
    agent_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # v0.1 永遠是 'hermes'；保留欄位給未來其他 Agent Type
    agent_type: Mapped[str] = mapped_column(String(32), nullable=False, default="hermes")
    # 使用者於授權頁確認的名字
    display_name: Mapped[str] = mapped_column(String(64), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("pending", "online", "offline", "revoked", name="agent_status"),
        nullable=False,
        default="pending",
    )
    # 預設 only_me，文件 §十七
    visibility: Mapped[str] = mapped_column(
        Enum("only_me", "specific_users", "friends", "nobody", name="agent_visibility"),
        nullable=False,
        default="only_me",
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Agent id={self.id} agent_id={self.agent_id} status={self.status}>"
