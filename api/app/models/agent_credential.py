"""AgentCredential model — 1 Agent 同時只有一份有效 Credential。

- access_jti / refresh_jti 為 NULL = 未發放或已撤銷；撤銷 = 把 jti 設 NULL。
- Rotation：refresh 成功後舊 refresh_jti 設 NULL、新 jti 寫入；不需要 revoked_jtis 表。
- UNIQUE(agent_id) 在 DB 層強制 1:1。
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AgentCredential(Base):
    __tablename__ = "agent_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[int] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    # 當前有效的 access token jti；NULL = 未發放或已撤銷
    access_jti: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    access_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 當前有效的 refresh token jti；同 NULL 規則
    refresh_jti: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    refresh_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 累計輪換次數（debug / 異常偵測用）
    refresh_rotation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 裝置名稱，例如 "MAG-PC"
    device_name: Mapped[str] = mapped_column(String(64), nullable=False)
    # 裝置指紋，例如 "sha256:abc..."；v0.1 只記錄不主動告警
    device_fingerprint: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # 最近一次 refresh 或 WSS 認證時間
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    # 撤銷時間；NULL = 未撤銷
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 撤銷原因：user_disconnect / rotation / admin_revoke / superseded
    revoked_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)

    def __repr__(self) -> str:
        return f"<AgentCredential id={self.id} agent_id={self.agent_id}>"
