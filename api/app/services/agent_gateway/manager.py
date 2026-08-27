"""ConnectionManager — 單 process 內 in-memory WSS 連線追蹤（docs/3.3.md §十二、§二十二）。

設計：
- 假設單 worker（Round 2 Q1 鎖定），in-memory dict 足夠。
- 1 Agent 同時只允許 1 active WSS（Round 3 Q2 鎖定），新連線進來時 kick 舊連線。
- 5 秒 grace：給舊連線時間優雅關閉；逾時強制 close。
- ``last_seen_at`` 寫入 DB 採節流策略：只在 connect / disconnect 時寫，避免每 30s 寫 100 個 row。
- 提供背景 watchdog：掃描逾時 heartbeat 並標記離線。
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import from_naive_utc, to_naive_utc, utc_now
from app.services.agent_gateway.events import agent_disconnected_event

logger = logging.getLogger(__name__)


# 心跳 / grace / watchdog 設定（Round 4 micro-decisions 9.4 / 9.5 / 9.6）
HEARTBEAT_INTERVAL_SECONDS = 30
HEARTBEAT_TIMEOUT_SECONDS = 90  # 3 倍間隔
KICK_GRACE_SECONDS = 5
WATCHDOG_SCAN_INTERVAL = 30


def _utcnow() -> datetime:
    """ConnectionState 內部時間：tz-aware UTC。

    只用在 in-memory dataclass（ConnectionState.connected_at / last_heartbeat_at），
    **不**寫 DB。DB 寫入走 ``to_naive_utc(...)``。
    取代舊的 naive 版本：合約 `date-time` 要求 aware，endpoint
    ``GET /agent/me/status`` 直接 serialize 這兩個欄位。
    """
    return utc_now()


@dataclass
class ConnectionState:
    """單一 active WSS 連線的狀態。"""

    agent_id: int  # internal int id
    agent_public_id: str  # agt_xxx
    owner_id: int
    websocket: WebSocket
    connection_id: str
    connected_at: datetime
    last_heartbeat_at: datetime
    # DB session 引用由 register 時注入，供 disconnect 時寫回 status
    _session_factory: AsyncSession | None = field(default=None, repr=False, compare=False)


class ConnectionManager:
    """單 process 內的 in-memory WSS 狀態。

    公開 API 設計為 Phase B/C 擴展時不會破壞介面：
    - register / unregister / get / is_online / online_agent_ids
    - send_to_agent（Phase B 用於 room event 路由）
    - shutdown（server stop 時清理）
    """

    def __init__(self) -> None:
        # agent_internal_id → state
        self._by_agent: dict[int, ConnectionState] = {}
        # connection_id → state（debug / metrics 用）
        self._by_connection: dict[str, ConnectionState] = {}
        # kick 中的舊連線（5 秒 grace 內），給客戶端時間優雅關閉
        self._pending_kick: dict[str, asyncio.Task] = {}
        self._watchdog_task: asyncio.Task | None = None
        self._shutdown = False

    # ── 連線生命週期 ──────────────────────────────────────────────────────

    async def register(
        self,
        *,
        agent_id: int,
        agent_public_id: str,
        owner_id: int,
        websocket: WebSocket,
        session: AsyncSession,
    ) -> ConnectionState:
        """註冊新連線。若同 agent 已有 active 連線，先 kick 舊的。

        回傳新連線的 ConnectionState。
        """
        existing = self._by_agent.get(agent_id)
        if existing is not None:
            await self._kick_existing(existing, grace_seconds=0)

        state = ConnectionState(
            agent_id=agent_id,
            agent_public_id=agent_public_id,
            owner_id=owner_id,
            websocket=websocket,
            connection_id=str(uuid4()),
            connected_at=_utcnow(),
            last_heartbeat_at=_utcnow(),
        )
        self._by_agent[agent_id] = state
        self._by_connection[state.connection_id] = state
        logger.info(
            "WSS register agent_public_id=%s connection_id=%s online=%d",
            agent_public_id,
            state.connection_id,
            len(self._by_agent),
        )
        return state

    async def _kick_existing(self, state: ConnectionState, *, grace_seconds: int) -> None:
        """發 disconnect event 給舊連線，給 grace 時間優雅關閉。"""
        try:
            await state.websocket.send_json(
                agent_disconnected_event(reason="kicked_by_new_connection")
            )
        except Exception as err:  # noqa: BLE001
            logger.debug("kick send_json failed: %s", err)

        # 啟動 grace task，逾時強制 close
        async def _force_close() -> None:
            await asyncio.sleep(grace_seconds)
            try:
                await state.websocket.close(code=1000)
            except Exception:  # noqa: BLE001
                pass
            self.unregister(state.agent_id)
            self._pending_kick.pop(state.connection_id, None)

        task = asyncio.create_task(_force_close())
        self._pending_kick[state.connection_id] = task

    def unregister(self, agent_id: int) -> None:
        state = self._by_agent.pop(agent_id, None)
        if state is None:
            return
        self._by_connection.pop(state.connection_id, None)
        # 若 grace task 還在跑，cancel 掉（連線已正常關閉）
        task = self._pending_kick.pop(state.connection_id, None)
        if task and not task.done():
            task.cancel()
        logger.info(
            "WSS unregister agent_public_id=%s online=%d",
            state.agent_public_id,
            len(self._by_agent),
        )

    def touch_heartbeat(self, agent_id: int) -> None:
        state = self._by_agent.get(agent_id)
        if state is not None:
            state.last_heartbeat_at = _utcnow()

    # ── 查詢 / 路由 ──────────────────────────────────────────────────────

    def get(self, agent_id: int) -> ConnectionState | None:
        return self._by_agent.get(agent_id)

    def is_online(self, agent_id: int) -> bool:
        return agent_id in self._by_agent

    def online_agent_ids(self) -> list[int]:
        return list(self._by_agent.keys())

    async def send_to_agent(self, agent_id: int, event: dict) -> bool:
        """Phase B 將用於 room event 路由。回傳是否送達。"""
        state = self._by_agent.get(agent_id)
        if state is None:
            return False
        try:
            await state.websocket.send_json(event)
            return True
        except Exception as err:  # noqa: BLE001
            logger.warning("send_to_agent failed agent=%s: %s", agent_id, err)
            self.unregister(agent_id)
            return False

    # ── 背景 watchdog ────────────────────────────────────────────────────

    def start_watchdog(self) -> None:
        """由 FastAPI startup event 呼叫。"""
        if self._watchdog_task is None or self._watchdog_task.done():
            self._watchdog_task = asyncio.create_task(self._watchdog_loop())
            self._shutdown = False

    async def stop_watchdog(self) -> None:
        self._shutdown = True
        if self._watchdog_task is not None:
            self._watchdog_task.cancel()
            try:
                await self._watchdog_task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass

    async def _watchdog_loop(self) -> None:
        """每 30s 掃描逾時心跳；逾時 → 標記 offline + 斷線。"""
        while not self._shutdown:
            try:
                await asyncio.sleep(WATCHDOG_SCAN_INTERVAL)
                await self._scan_stale_connections()
            except asyncio.CancelledError:
                break
            except Exception as err:  # noqa: BLE001
                logger.exception("watchdog loop error: %s", err)

    async def _scan_stale_connections(self) -> None:
        now = _utcnow()
        stale: list[ConnectionState] = []
        for state in list(self._by_agent.values()):
            elapsed = (now - state.last_heartbeat_at).total_seconds()
            if elapsed > HEARTBEAT_TIMEOUT_SECONDS:
                stale.append(state)

        for state in stale:
            logger.warning(
                "agent heartbeat timeout agent_public_id=%s elapsed=%.0fs",
                state.agent_public_id,
                (now - state.last_heartbeat_at).total_seconds(),
            )
            try:
                await state.websocket.send_json(
                    agent_disconnected_event(reason="heartbeat_timeout")
                )
                await state.websocket.close(code=1000)
            except Exception:  # noqa: BLE001
                pass
            self.unregister(state.agent_id)
            # DB 狀態更新由呼叫端在卸下後觸發（這裡只做 in-memory 清理）


# 全域單例
manager = ConnectionManager()
