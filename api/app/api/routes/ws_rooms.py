"""人類瀏覽器 WSS — 房間即時消息訂閱（docs/3.3.md §二十）。

- Path: ``/api/v1/ws/rooms``
- Auth: ``Authorization: Bearer <user_token>``（一般用戶 JWT）
- 連上後發 ``{"type":"room.subscribe","room_ids":["room_xxx"]}`` 訂閱
- Server 對訂閱者即時廣播 ``room.message`` / ``room.typing``
"""
from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.security import decode_access_token
from app.db.session import async_session_factory
from app.repositories.room import RoomRepository
from app.services.agent_gateway.hub import hub

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["ws-rooms"])


@router.websocket("/rooms")
async def ws_rooms(websocket: WebSocket) -> None:
    """人類瀏覽器連線：訂閱房間後收到即時消息。

    認證（二選一）：
    - ``Authorization: Bearer <token>`` header（非瀏覽器 client，如測試腳本）
    - ``Sec-WebSocket-Protocol`` subprotocol（瀏覽器 WebSocket 無法自訂 header，
      改用 subprotocol 帶 token，RFC 6455 標準做法）
    """
    # 1. 認證：優先 Authorization header，其次 Sec-WebSocket-Protocol
    auth = websocket.headers.get("authorization") or ""
    echo_subprotocol = None
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    else:
        protocols = [
            p.strip()
            for p in websocket.headers.get("sec-websocket-protocol", "").split(",")
            if p.strip()
        ]
        # 瀏覽器 subprotocol 直接放 JWT（以 eyJ 開頭）
        token = next((p for p in protocols if p.startswith("eyJ")), "")
        echo_subprotocol = token or None

    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        payload = decode_access_token(token)
    except Exception:  # noqa: BLE001
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user_id = int(payload.get("sub"))

    await websocket.accept(subprotocol=echo_subprotocol)
    conn_id = str(uuid4())
    hub.register(connection_id=conn_id, user_id=user_id, websocket=websocket)

    try:
        while True:
            event = await websocket.receive_json()
            etype = event.get("type")

            if etype == "room.subscribe":
                requested = event.get("room_ids") or []
                internal_ids: list[int] = []
                # 只訂閱「使用者確為成員」的房間（權限檢查）
                async with async_session_factory() as session:
                    repo = RoomRepository(session)
                    for public_id in requested:
                        room = await repo.get_by_public_id(public_id)
                        if room is not None and await repo.is_user_member(room.id, user_id):
                            internal_ids.append(room.id)
                hub.subscribe_to_rooms(conn_id, internal_ids)
                await websocket.send_json(
                    {"type": "room.subscribed", "room_ids": requested, "ok": True}
                )

            elif etype == "room.unsubscribe":
                requested = event.get("room_ids") or []
                internal_ids: list[int] = []
                async with async_session_factory() as session:
                    repo = RoomRepository(session)
                    for public_id in requested:
                        room = await repo.get_by_public_id(public_id)
                        if room is not None:
                            internal_ids.append(room.id)
                hub.unsubscribe_from_rooms(conn_id, internal_ids)

            elif etype == "ping":
                await websocket.send_json({"type": "pong"})

            else:
                await websocket.send_json(
                    {"type": "error", "code": "unknown_event", "message": f"unknown event '{etype}'"}
                )
    except WebSocketDisconnect:
        logger.info("human ws disconnect conn=%s", conn_id)
    except Exception as err:  # noqa: BLE001
        logger.exception("ws_rooms error: %s", err)
    finally:
        hub.unsubscribe(conn_id)
