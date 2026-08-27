"""DeviceCode model — Device Authorization Grant 的短生命週期記錄。

設計重點：
- ``device_code``（Hermes 持有，server-to-server 走 TLS）與 ``verification_token``
  （瀏覽器 URL fragment 持有）完全分離；兩者皆為 32 bytes 隨機，只存 SHA256。
- 兩者 hash 都 UNIQUE 約束，保證一次性使用。
- 狀態機：pending → authorized → consumed（happy path）；pending → expired / denied
"""
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.mysql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DeviceCode(Base):
    __tablename__ = "device_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # SHA256(device_code)；plaintext 不存
    device_code_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    # SHA256(verification_token)；plaintext 不存
    verification_token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    # v0.1 永遠是 'hermes'
    agent_type: Mapped[str] = mapped_column(String(32), nullable=False, default="hermes")
    # Hermes 建議的名字（user 可於授權頁改）
    suggested_name: Mapped[str] = mapped_column(String(64), nullable=False)
    # 裝置名稱，例如 "MAG-PC"
    device_name: Mapped[str] = mapped_column(String(64), nullable=False)
    # 裝置指紋，例如 "sha256:abc..."；v0.1 只記錄不主動告警
    device_fingerprint: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(
            "pending",
            "authorized",
            "consumed",
            "expired",
            "denied",
            name="device_code_status",
        ),
        nullable=False,
        default="pending",
    )
    # 授權後填入（owner 從 user session 取得）
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # 授權後填入（指向新建的 agents row）
    agent_id: Mapped[int | None] = mapped_column(
        ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    # 申請的權限範圍，例如 ["join_approved_rooms", "read_approved_rooms", "reply_when_mentioned"]
    requested_scopes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # 預設 created_at + 10 分鐘
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    authorized_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Hermes 成功 poll 過 credential 之後填入
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<DeviceCode id={self.id} status={self.status}>"
