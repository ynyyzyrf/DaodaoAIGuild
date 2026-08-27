"""HumanHub — 人類瀏覽器的 WSS 訂閱管理（Phase B）。

人類前端連 ``/api/v1/ws/rooms`` 後可訂閱多個房間；有新訊息 / Agent 回覆 /
Typing 時，server 對所有訂閱該房間的連線廣播。

與 ConnectionManager（Agent 端）分離：Agent 是「1 Agent 1 連線」，人類可以
開多個 tab（多條連線）。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class HumanConnection:
    connection_id: str
    user_id: int
    websocket: WebSocket
    # 訂閱的 room 內部 id
    subscribed_rooms: set[int] = field(default_factory=set)


class HumanHub:
    def __init__(self) -> None:
        self._by_connection: dict[str, HumanConnection] = {}

    def register(self, *, connection_id: str, user_id: int, websocket: WebSocket) -> HumanConnection:
        conn = HumanConnection(connection_id=connection_id, user_id=user_id, websocket=websocket)
        self._by_connection[connection_id] = conn
        return conn

    def unsubscribe(self, connection_id: str) -> None:
        self._by_connection.pop(connection_id, None)

    def subscribe_to_rooms(self, connection_id: str, room_ids: list[int]) -> None:
        conn = self._by_connection.get(connection_id)
        if conn is not None:
            conn.subscribed_rooms.update(room_ids)

    def unsubscribe_from_rooms(self, connection_id: str, room_ids: list[int]) -> None:
        conn = self._by_connection.get(connection_id)
        if conn is not None:
            conn.subscribed_rooms.difference_update(room_ids)

    async def broadcast_to_room(self, room_id: int, event: dict) -> None:
        """對所有訂閱該 room 的連線推送事件。單條失敗不影響其他連線。"""
        for conn in list(self._by_connection.values()):
            if room_id not in conn.subscribed_rooms:
                continue
            try:
                await conn.websocket.send_json(event)
            except Exception as err:  # noqa: BLE001
                logger.warning("human ws send failed conn=%s: %s", conn.connection_id, err)
                self.unsubscribe(conn.connection_id)


hub = HumanHub()
