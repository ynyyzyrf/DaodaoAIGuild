"""Lobster Agent Protocol v0.1 事件合約（docs/3.3.md §二十六-§三十、§四十一）。

本模組只定義「事件合約」——server 與 Agent 之間透過 WSS 交換的 JSON 訊息格式。
未來接 A2A / Matrix Adapter 時，內部訊息 ↔ 外部協議的轉換層是 Adapter 的職責，
本合約保持穩定不動（Contract-first 原則，Round 3 Q3 鎖定）。
"""
from __future__ import annotations

from typing import Any, Literal

# ── Server → Agent ────────────────────────────────────────────────────────


def agent_connected_event(
    *, agent_id: str, server_time: str, heartbeat_interval: int
) -> dict[str, Any]:
    return {
        "type": "agent.connected",
        "agent_id": agent_id,
        "server_time": server_time,
        "heartbeat_interval": heartbeat_interval,
    }


def agent_heartbeat_ack(*, server_time: str) -> dict[str, Any]:
    return {
        "type": "agent.heartbeat_ack",
        "server_time": server_time,
    }


def agent_disconnected_event(
    *, reason: Literal["kicked_by_new_connection", "user_disconnect", "credential_revoked", "heartbeat_timeout"]
) -> dict[str, Any]:
    return {
        "type": "agent.disconnected",
        "reason": reason,
    }


def error_event(*, code: str, message: str) -> dict[str, Any]:
    """Server-side 對 Agent 發出的錯誤事件（不影響 WSS 連線）。"""
    return {
        "type": "error",
        "code": code,
        "message": message,
    }


# ── Room 事件（Phase B）────────────────────────────────────────────────────


def room_message_event(
    *,
    room_id: str,
    message_id: str,
    sender: dict[str, Any],
    content: str,
    reply_to_message_id: str | None,
    mentioned_agent_ids: list[int],
    created_at: str,
) -> dict[str, Any]:
    """Server → 人類 / Agent：房間新消息（docs/3.3.md §二十八）。"""
    return {
        "type": "room.message",
        "room_id": room_id,
        "message_id": message_id,
        "sender": sender,
        "content": content,
        "reply_to_message_id": reply_to_message_id,
        "mentioned_agent_ids": mentioned_agent_ids,
        "created_at": created_at,
    }


def room_typing_event(*, room_id: str, agent_name: str, status: bool) -> dict[str, Any]:
    """Server → 人類：Agent 正在思考 / 停止思考（docs/3.3.md §二十九）。"""
    return {
        "type": "room.typing",
        "room_id": room_id,
        "agent_name": agent_name,
        "status": status,
    }


# ── Agent → Server ────────────────────────────────────────────────────────


HEARTBEAT_TYPE = "agent.heartbeat"
"""Client 端週期性發送，server 會以 agent.heartbeat_ack 回應。"""


def is_heartbeat(event: dict[str, Any]) -> bool:
    return event.get("type") == HEARTBEAT_TYPE
