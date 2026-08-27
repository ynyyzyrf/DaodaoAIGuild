"""Agent Room 對外契約（docs/3.3.md §二十五-§三十）。

本檔案定義所有 REST endpoint 與 WSS event 的 Pydantic 契約。
這是「Contract-first」邊界（Round 3 Q3 鎖定）——未來接 A2A / Matrix Adapter 時
只需做事件翻譯，本檔案保持穩定。
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── /agent/device/start ───────────────────────────────────────────────────


class DeviceStartRequest(BaseModel):
    agent_type: Literal["hermes"] = "hermes"
    suggested_name: str = Field(..., min_length=1, max_length=64)
    device_name: str = Field(..., min_length=1, max_length=64)
    device_fingerprint: str | None = Field(default=None, max_length=128)
    scopes: list[str] = Field(
        default_factory=lambda: [
            "join_approved_rooms",
            "read_approved_rooms",
            "reply_when_mentioned",
        ]
    )


class DeviceStartResponse(BaseModel):
    device_code: str
    verification_url: str
    expires_in: int  # 秒


# ── /agent/device/info (browser) ──────────────────────────────────────────


class DeviceInfoRequest(BaseModel):
    verification_token: str


class DeviceInfoResponse(BaseModel):
    agent_type: Literal["hermes"]
    suggested_name: str
    device_name: str
    scopes: list[str]
    expires_in: int


# ── /agent/device/authorize (browser) ─────────────────────────────────────


class DeviceAuthorizeRequest(BaseModel):
    verification_token: str
    agent_name: str = Field(..., min_length=1, max_length=64)


class DeviceAuthorizeResponse(BaseModel):
    agent_id: str  # public id (agt_xxx)
    display_name: str
    status: Literal["pending", "online", "offline"]


# ── /agent/device/deny ────────────────────────────────────────────────────


class DeviceDenyRequest(BaseModel):
    verification_token: str


# ── /agent/device/{device_code}/poll (Hermes) ─────────────────────────────


class CredentialPayload(BaseModel):
    agent_id: str
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    token_type: Literal["Bearer"] = "Bearer"


class DevicePollResponse(BaseModel):
    status: Literal["pending", "authorized", "expired", "denied", "consumed"]
    expires_in: int | None = None  # pending 時回傳剩餘秒數
    credential: CredentialPayload | None = None  # authorized 時回傳


# ── /agent/credential/refresh ─────────────────────────────────────────────


class CredentialRefreshRequest(BaseModel):
    refresh_token: str


class CredentialRefreshResponse(BaseModel):
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime


# ── /agent/credential (DELETE, self revoke) ───────────────────────────────
# body 為空，使用 Agent access token 認證


# ── /agents (user-facing list) ────────────────────────────────────────────


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str  # public id
    owner_id: int
    agent_type: str
    display_name: str
    avatar_url: str | None
    status: str
    visibility: str
    last_seen_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AgentListResponse(BaseModel):
    items: list[AgentOut]


class AgentDetailResponse(AgentOut):
    """Agent 詳情額外帶連線資訊（v0.1 簡化版：只多 device_name 與 online bool）。"""

    device_name: str | None = None
    is_online: bool = False
    last_heartbeat_at: datetime | None = None


class AgentStatusResponse(BaseModel):
    """Agent self status resolved from bearer credential identity."""

    agent_id: str
    online: bool
    connected_at: datetime | None = None
    last_heartbeat_at: datetime | None = None
