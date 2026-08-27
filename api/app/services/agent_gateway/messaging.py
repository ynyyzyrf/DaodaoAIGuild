"""MessageRouter — 房間消息的編排層（docs/3.3.md §二十、§三十七）。

職責：
1. 人類發消息 → 存庫 → 解析 @mention → Trigger Policy → 推給被觸發的線上 Agent → 廣播給人類訂閱者
2. Agent 回覆（room.reply）→ 驗證成員資格 → 存庫 → 廣播給人類訂閱者
3. Agent Typing → 廣播給人類訂閱者

權限邊界（§三十七）：Agent 只能收到它「已加入房間」裡被 @ 的消息。
路由前一律檢查 agent 是否為該 room 的成員。
"""
from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.room import Room
from app.models.user import User
from app.repositories.agent import AgentRepository
from app.repositories.room import RoomRepository
from app.services.agent_gateway.events import room_message_event, room_typing_event
from app.services.agent_gateway.hub import hub
from app.services.agent_gateway.manager import manager
from app.services.agent_gateway.mention import parse_mentions
from app.services.agent_gateway.policy import apply_trigger_policy

logger = logging.getLogger(__name__)


def _sender_payload(obj: User | Agent) -> dict:
    if isinstance(obj, Agent):
        return {
            "type": "agent",
            "id": obj.agent_id,
            "name": obj.display_name,
            "avatar_url": obj.avatar_url,
        }
    return {
        "type": "user",
        "id": str(obj.id),
        "name": obj.display_name or obj.username,
        "avatar_url": obj.avatar_url,
    }


class MessageRouter:
    """單次請求的 Router 實例，持有 session。"""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.room_repo = RoomRepository(session)
        self.agent_repo = AgentRepository(session)

    async def _room_agents(self, room_id: int) -> list[Agent]:
        members = await self.room_repo.list_agent_members(room_id)
        agents: list[Agent] = []
        for m in members:
            agent = await self.agent_repo.get_by_id(m.member_id)
            if agent is not None:
                agents.append(agent)
        return agents

    async def route_user_message(
        self,
        *,
        room: Room,
        sender_user: User,
        content: str,
        reply_to_message_id: int | None = None,
    ):
        """人類發消息：存庫 + 觸發被 @ 的 Agent + 廣播。"""
        agents_in_room = await self._room_agents(room.id)
        mentioned = parse_mentions(content, agents_in_room)
        mentioned_ids = [a.id for a in mentioned]

        msg = await self.room_repo.create_message(
            room_id=room.id,
            sender_type="user",
            sender_user_id=sender_user.id,
            sender_agent_id=None,
            content=content,
            reply_to_message_id=reply_to_message_id,
            mentioned_agent_ids=mentioned_ids,
        )

        # Trigger Policy：人類 @Agent → 觸發
        triggered = apply_trigger_policy(sender_type="user", mentioned_agents=mentioned)

        event = room_message_event(
            room_id=room.room_id,
            message_id=msg.message_id,
            sender=_sender_payload(sender_user),
            content=content,
            reply_to_message_id=(
                await self._public_msg_id(reply_to_message_id) if reply_to_message_id else None
            ),
            mentioned_agent_ids=mentioned_ids,
            created_at=msg.created_at.isoformat() + "Z",
        )

        # 推給被觸發的線上 Agent
        for agent in triggered:
            if manager.is_online(agent.id):
                ok = await manager.send_to_agent(agent.id, event)
                if not ok:
                    logger.warning("room.message 未送達 agent=%s", agent.agent_id)

        # 廣播給人類訂閱者
        await hub.broadcast_to_room(room.id, event)

        return msg

    async def route_agent_reply(
        self, *, agent: Agent, room_public_id: str, reply_to_public_id: str, content: str
    ):
        """Agent 回覆：驗證成員 + 存庫 + 廣播給人類（不觸發其他 Agent，防 loop）。"""
        room = await self.room_repo.get_by_public_id(room_public_id)
        if room is None:
            return None, "room not found"
        if not await self.room_repo.is_agent_member(room.id, agent.id):
            return None, "agent is not a member of this room"

        reply_to = await self.room_repo.get_message_by_public_id(reply_to_public_id)
        if reply_to is None or reply_to.room_id != room.id:
            return None, "reply_to not found"

        msg = await self.room_repo.create_message(
            room_id=room.id,
            sender_type="agent",
            sender_user_id=None,
            sender_agent_id=agent.id,
            content=content,
            reply_to_message_id=reply_to.id,
            mentioned_agent_ids=[],
        )

        event = room_message_event(
            room_id=room.room_id,
            message_id=msg.message_id,
            sender=_sender_payload(agent),
            content=content,
            reply_to_message_id=reply_to_public_id,
            mentioned_agent_ids=[],
            created_at=msg.created_at.isoformat() + "Z",
        )
        await hub.broadcast_to_room(room.id, event)
        return msg, None

    async def route_agent_typing(self, *, agent: Agent, room_public_id: str, status: bool) -> bool:
        """Agent Typing 廣播給人類訂閱者。回傳是否該 room 存在且為成員。"""
        room = await self.room_repo.get_by_public_id(room_public_id)
        if room is None or not await self.room_repo.is_agent_member(room.id, agent.id):
            return False
        await hub.broadcast_to_room(
            room.id,
            room_typing_event(room_id=room.room_id, agent_name=agent.display_name, status=status),
        )
        return True

    async def _public_msg_id(self, internal_id: int) -> str | None:
        msg = await self.room_repo.get_message_by_id(internal_id)
        return msg.message_id if msg else None
