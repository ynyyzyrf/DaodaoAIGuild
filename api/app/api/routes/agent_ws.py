"""Agent WSS endpoint — Phase A 連線入口（docs/3.3.md §十、§二十二、§二十七）。

- Path: ``/api/v1/agent/ws``
- Auth: ``Authorization: Bearer <agent_access_token>`` header
- Server 接受後發送 ``agent.connected`` 事件
- Client 週期性發 ``agent.heartbeat``；server 回 ``agent.heartbeat_ack``
- Server 透過 ``agent.disconnected`` 事件主動結束（user disconnect / kicked / heartbeat timeout）
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.datetime_utils import to_naive_utc

from app.core.agent_security import AgentTokenError, decode_agent_token
from app.db.session import async_session_factory
from app.repositories.agent import AgentRepository
from app.services.agent_gateway import manager
from app.services.agent_gateway.events import (
    HEARTBEAT_TYPE,
    agent_connected_event,
    agent_heartbeat_ack,
)
from app.services.agent_gateway.messaging import MessageRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent-ws"])


@router.websocket("/ws")
async def agent_ws(websocket: WebSocket) -> None:
    """Agent 升級握手 + 後續事件處理。"""

    # 1. 認證：從 header 拿 Bearer token
    auth = websocket.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    token = auth[7:].strip()
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = decode_agent_token(token, expected_type="agent_access")
    except AgentTokenError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    agent_public_id = payload.get("sub")
    jti = payload.get("jti")
    if not agent_public_id or not jti:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 2. 查 DB 確認 jti 仍是當前 access_jti 且 agent 未撤銷
    async with async_session_factory() as session:
        repo = AgentRepository(session)
        cred = await repo.get_credential_by_access_jti(jti)
        if cred is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        agent = await repo.get_by_id(cred.agent_id)
        if agent is None or agent.agent_id != agent_public_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        if agent.status == "revoked":
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # 3. 接受 WS
        await websocket.accept()

        # 4. 註冊到 ConnectionManager（會 kick 舊連線若有）
        state = await manager.register(
            agent_id=agent.id,
            agent_public_id=agent.agent_id,
            owner_id=agent.owner_id,
            websocket=websocket,
            session=session,
        )

        # 5. 標記 online
        await repo.mark_online(agent.id)
        cred.last_used_at = to_naive_utc(datetime.now(timezone.utc))
        await session.commit()

        server_time = datetime.now(timezone.utc).isoformat()
        await websocket.send_json(
            agent_connected_event(
                agent_id=agent.agent_id,
                server_time=server_time,
                heartbeat_interval=30,
            )
        )

    # 6. 事件迴圈
    try:
        while True:
            event = await websocket.receive_json()
            etype = event.get("type")

            if etype == HEARTBEAT_TYPE:
                manager.touch_heartbeat(state.agent_id)
                await websocket.send_json(
                    agent_heartbeat_ack(server_time=datetime.now(timezone.utc).isoformat())
                )

            elif etype == "room.reply":
                # Agent 回覆房間消息（docs/3.3.md §三十）
                room_id = event.get("room_id")
                reply_to = event.get("reply_to")
                content = event.get("content")
                if not room_id or not reply_to or not content:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "code": "bad_reply",
                            "message": "room_id/reply_to/content are required",
                        }
                    )
                    continue
                async with async_session_factory() as session:
                    agent = await AgentRepository(session).get_by_id(state.agent_id)
                    if agent is None:
                        await websocket.send_json(
                            {"type": "error", "code": "agent_not_found", "message": "agent missing"}
                        )
                        continue
                    router = MessageRouter(session)
                    _msg, err = await router.route_agent_reply(
                        agent=agent,
                        room_public_id=room_id,
                        reply_to_public_id=reply_to,
                        content=content,
                    )
                    if err:
                        await websocket.send_json(
                            {"type": "error", "code": "reply_failed", "message": err}
                        )

            elif etype == "room.typing":
                # Agent 打字狀態（docs/3.3.md §二十九）
                room_id = event.get("room_id")
                status_flag = bool(event.get("status", True))
                if not room_id:
                    await websocket.send_json(
                        {"type": "error", "code": "bad_typing", "message": "room_id required"}
                    )
                    continue
                async with async_session_factory() as session:
                    agent = await AgentRepository(session).get_by_id(state.agent_id)
                    if agent is not None:
                        router = MessageRouter(session)
                        await router.route_agent_typing(
                            agent=agent, room_public_id=room_id, status=status_flag
                        )

            else:
                # v0.1 對未知事件回 error
                await websocket.send_json(
                    {
                        "type": "error",
                        "code": "unknown_event",
                        "message": f"event type '{etype}' not supported in v0.1",
                    }
                )
    except WebSocketDisconnect:
        logger.info("agent disconnected (client close) agent_public_id=%s", agent_public_id)
    except Exception as err:  # noqa: BLE001
        logger.exception("agent_ws error: %s", err)
    finally:
        # 7. 清理：標記 offline（不論原因），卸載 manager
        manager.unregister(state.agent_id)
        try:
            async with async_session_factory() as cleanup_session:
                cleanup_repo = AgentRepository(cleanup_session)
                await cleanup_repo.mark_offline(state.agent_id)
        except Exception as err:  # noqa: BLE001
            logger.warning("mark_offline failed: %s", err)
