"""Room 模組的 Repository（rooms / room_members / room_messages）。"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.agent_security import generate_public_message_id, generate_public_room_id
from app.models.room import Room
from app.models.room_member import RoomMember
from app.models.room_message import RoomMessage


class RoomRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── rooms ────────────────────────────────────────────────────────────

    async def get_by_id(self, room_id: int) -> Room | None:
        return await self.session.get(Room, room_id)

    async def get_by_public_id(self, public_id: str) -> Room | None:
        result = await self.session.execute(select(Room).where(Room.room_id == public_id))
        return result.scalar_one_or_none()

    async def create(
        self, *, owner_id: int, name: str, description: str = ""
    ) -> Room:
        for _ in range(5):
            public_id = generate_public_room_id()
            existing = await self.get_by_public_id(public_id)
            if existing is None:
                break
        else:
            raise RuntimeError("failed to generate unique room_id after 5 attempts")

        room = Room(
            room_id=public_id,
            name=name,
            description=description,
            owner_id=owner_id,
            privacy="private",
        )
        self.session.add(room)
        await self.session.commit()
        await self.session.refresh(room)
        return room

    async def list_by_user(self, user_id: int) -> list[Room]:
        """當前使用者是成員（含 owner）的房間列表。"""
        stmt = (
            select(Room)
            .join(RoomMember, RoomMember.room_id == Room.id)
            .where(
                RoomMember.member_type == "user",
                RoomMember.member_id == user_id,
                RoomMember.status == "active",
            )
            .order_by(Room.updated_at.desc())
        )
        return list((await self.session.execute(stmt)).scalars().all())

    # ── room_members ─────────────────────────────────────────────────────

    async def add_member(
        self,
        *,
        room_id: int,
        member_type: str,
        member_id: int,
        role: str = "member",
        invited_by: int | None = None,
    ) -> RoomMember:
        member = RoomMember(
            room_id=room_id,
            member_type=member_type,
            member_id=member_id,
            role=role,
            invited_by=invited_by,
            status="active",
        )
        self.session.add(member)
        await self.session.commit()
        await self.session.refresh(member)
        return member

    async def get_member(
        self, *, room_id: int, member_type: str, member_id: int
    ) -> RoomMember | None:
        result = await self.session.execute(
            select(RoomMember).where(
                RoomMember.room_id == room_id,
                RoomMember.member_type == member_type,
                RoomMember.member_id == member_id,
                RoomMember.status == "active",
            )
        )
        return result.scalar_one_or_none()

    async def list_members(self, room_id: int) -> list[RoomMember]:
        result = await self.session.execute(
            select(RoomMember)
            .where(RoomMember.room_id == room_id, RoomMember.status == "active")
            .order_by(RoomMember.role.asc(), RoomMember.id.asc())
        )
        return list(result.scalars().all())

    async def list_agent_members(self, room_id: int) -> list[RoomMember]:
        result = await self.session.execute(
            select(RoomMember).where(
                RoomMember.room_id == room_id,
                RoomMember.member_type == "agent",
                RoomMember.status == "active",
            )
        )
        return list(result.scalars().all())

    async def is_user_member(self, room_id: int, user_id: int) -> bool:
        member = await self.get_member(room_id=room_id, member_type="user", member_id=user_id)
        return member is not None

    async def is_agent_member(self, room_id: int, agent_id: int) -> bool:
        member = await self.get_member(room_id=room_id, member_type="agent", member_id=agent_id)
        return member is not None

    # ── room_messages ────────────────────────────────────────────────────

    async def get_message_by_id(self, message_id: int) -> RoomMessage | None:
        return await self.session.get(RoomMessage, message_id)

    async def get_message_by_public_id(self, public_id: str) -> RoomMessage | None:
        result = await self.session.execute(
            select(RoomMessage).where(RoomMessage.message_id == public_id)
        )
        return result.scalar_one_or_none()

    async def create_message(
        self,
        *,
        room_id: int,
        sender_type: str,
        sender_user_id: int | None,
        sender_agent_id: int | None,
        content: str,
        reply_to_message_id: int | None = None,
        mentioned_agent_ids: list[int] | None = None,
    ) -> RoomMessage:
        for _ in range(5):
            public_id = generate_public_message_id()
            existing = await self.get_message_by_public_id(public_id)
            if existing is None:
                break
        else:
            raise RuntimeError("failed to generate unique message_id after 5 attempts")

        msg = RoomMessage(
            message_id=public_id,
            room_id=room_id,
            sender_type=sender_type,
            sender_user_id=sender_user_id,
            sender_agent_id=sender_agent_id,
            content=content,
            reply_to_message_id=reply_to_message_id,
            mentioned_agent_ids=mentioned_agent_ids,
        )
        self.session.add(msg)
        await self.session.commit()
        await self.session.refresh(msg)
        return msg

    async def list_messages(
        self, room_id: int, *, limit: int = 100, before_id: int | None = None
    ) -> list[RoomMessage]:
        """依時間倒序取最近 limit 筆，回傳時再反轉為正序。"""
        stmt = select(RoomMessage).where(RoomMessage.room_id == room_id)
        if before_id is not None:
            stmt = stmt.where(RoomMessage.id < before_id)
        stmt = stmt.order_by(RoomMessage.id.desc()).limit(limit)
        rows = list((await self.session.execute(stmt)).scalars().all())
        rows.reverse()
        return rows
