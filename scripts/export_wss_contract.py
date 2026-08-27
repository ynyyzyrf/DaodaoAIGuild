"""Export daostore-fde WSS contract -> lobster-sdk/contracts/wss.generated.json.

S2-6: Server owns the Lobster Agent WSS wire format. This script emits a
deterministic snapshot consumed by lobster-sdk contract tests.

Usage:
    python scripts/export_wss_contract.py [--out PATH]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
API_DIR = SCRIPT_DIR.parent / "api"
WORKSPACE = SCRIPT_DIR.parent.parent
DEFAULT_OUT = WORKSPACE / "lobster-sdk" / "contracts" / "wss.generated.json"

if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.services.agent_gateway.events import (
    agent_connected_event,
    agent_disconnected_event,
    agent_heartbeat_ack,
    error_event,
    room_message_event,
)


def _field(kind: str, *, required: bool = True, nullable: bool = False) -> dict[str, Any]:
    return {"kind": kind, "required": required, "nullable": nullable}


def build_contract() -> dict[str, Any]:
    """Return the canonical v0.1 WSS contract snapshot."""
    server_to_agent = {
        "agent.connected": {
            "fields": {
                "type": _field("literal:agent.connected"),
                "agent_id": _field("string"),
                "server_time": _field("datetime"),
                "heartbeat_interval": _field("integer"),
            },
            "example": agent_connected_event(
                agent_id="agt_contract",
                server_time="2026-08-26T10:00:00Z",
                heartbeat_interval=30,
            ),
        },
        "agent.heartbeat_ack": {
            "fields": {
                "type": _field("literal:agent.heartbeat_ack"),
                "server_time": _field("datetime"),
            },
            "example": agent_heartbeat_ack(server_time="2026-08-26T10:00:30Z"),
        },
        "agent.disconnected": {
            "fields": {
                "type": _field("literal:agent.disconnected"),
                "reason": _field(
                    "enum:kicked_by_new_connection,user_disconnect,credential_revoked,heartbeat_timeout"
                ),
            },
            "example": agent_disconnected_event(reason="kicked_by_new_connection"),
        },
        "error": {
            "fields": {
                "type": _field("literal:error"),
                "code": _field("string"),
                "message": _field("string"),
            },
            "example": error_event(code="unknown_event", message="event type is not supported"),
        },
        "room.message": {
            "fields": {
                "type": _field("literal:room.message"),
                "room_id": _field("string"),
                "message_id": _field("string"),
                "sender": _field("object:RoomMessageSender"),
                "content": _field("string"),
                "reply_to_message_id": _field("string", nullable=True),
                "mentioned_agent_ids": _field("array:integer"),
                "created_at": _field("datetime"),
            },
            "nested": {
                "RoomMessageSender": {
                    "type": _field("enum:user,agent"),
                    "id": _field("string"),
                    "name": _field("string"),
                    "avatar_url": _field("string", required=False, nullable=True),
                }
            },
            "example": room_message_event(
                room_id="room_contract",
                message_id="msg_contract",
                sender={
                    "type": "user",
                    "id": "1",
                    "name": "Alice",
                    "avatar_url": None,
                },
                content="@Hermes hello",
                reply_to_message_id=None,
                mentioned_agent_ids=[101],
                created_at="2026-08-26T10:01:00Z",
            ),
        },
    }

    agent_to_server = {
        "agent.heartbeat": {
            "fields": {"type": _field("literal:agent.heartbeat")},
            "example": {"type": "agent.heartbeat"},
        },
        "room.reply": {
            "fields": {
                "type": _field("literal:room.reply"),
                "room_id": _field("string"),
                "reply_to": _field("string"),
                "content": _field("string"),
            },
            "example": {
                "type": "room.reply",
                "room_id": "room_contract",
                "reply_to": "msg_contract",
                "content": "Hello from Hermes",
            },
        },
        "room.typing": {
            "fields": {
                "type": _field("literal:room.typing"),
                "room_id": _field("string"),
                "status": _field("boolean"),
            },
            "example": {"type": "room.typing", "room_id": "room_contract", "status": True},
        },
    }

    return {
        "version": "0.1",
        "source": "daostore-fde/api/app/services/agent_gateway/events.py",
        "server_to_agent": server_to_agent,
        "agent_to_server": agent_to_server,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    contract = build_contract()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(contract, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        "exported WSS contract "
        f"({len(contract['server_to_agent'])} server_to_agent, "
        f"{len(contract['agent_to_server'])} agent_to_server) -> {args.out}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
