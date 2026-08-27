"""Room 對外契約（docs/3.3.md §十四-§十六、§二十八-§三十）。"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ── /rooms (create / list) ────────────────────────────────────────────────


class RoomCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    description: str = Field(default="", max_length=255)


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str  # public id (room_xxx)
    name: str
    description: str
    owner_id: int
    privacy: str
    created_at: datetime
    updated_at: datetime


class RoomListResponse(BaseModel):
    items: list[RoomOut]


# ── /rooms/{id} (detail) ──────────────────────────────────────────────────


class RoomMemberOut(BaseModel):
    """房間成員（人 / Agent 統一呈現）。"""

    type: Literal["user", "agent"]
    id: str  # user: str(id)；agent: agent_id
    name: str
    avatar_url: str | None = None
    role: str
    is_online: bool = False
    is_owner: bool = False


class RoomDetailOut(RoomOut):
    members: list[RoomMemberOut] = []
    is_member: bool = True
    is_owner: bool = False


# ── /rooms/{id}/messages ──────────────────────────────────────────────────


class RoomMessageCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    reply_to_message_id: str | None = None  # public msg_xxx


class MessageSenderOut(BaseModel):
    type: Literal["user", "agent"]
    id: str
    name: str
    avatar_url: str | None = None


class RoomMessageOut(BaseModel):
    id: str  # public msg_xxx
    room_id: str
    sender: MessageSenderOut
    content: str
    reply_to_message_id: str | None = None
    mentioned_agent_ids: list[int] = []
    created_at: datetime


class RoomMessageListResponse(BaseModel):
    items: list[RoomMessageOut]


# ── /rooms/{id}/invite-agent ──────────────────────────────────────────────


class InviteAgentRequest(BaseModel):
    agent_id: str = Field(..., min_length=1)  # agt_xxx


# ── /rooms/{id}/leave ─────────────────────────────────────────────────────
# body 為空


# ── WSS 事件契約（server ↔ 前端 / agent） ───────────────────────────────


class WsRoomMessageEvent(BaseModel):
    type: Literal["room.message"] = "room.message"
    room_id: str
    message_id: str
    sender: MessageSenderOut
    content: str
    reply_to_message_id: str | None = None
    mentioned_agent_ids: list[int] = []
    created_at: datetime
