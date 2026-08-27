"""Room REST endpoints — Phase B（docs/3.3.md §十四-§十六、§二十）。

端點（均掛在 /api/v1 之下，需 User session）：

- POST /rooms                      建立 Private 房間
- GET  /rooms                      我的房間列表
- GET  /rooms/{room_id}            房間詳情（成員）
- POST /rooms/{room_id}/agents     邀請 Agent（room 成員可邀請 public agent）
- POST /rooms/{room_id}/messages   發消息（人發；@Agent 觸發）
- GET  /rooms/{room_id}/messages   拉取消息歷史（成員）
"""
from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserDep, SessionDep
from app.core.exceptions import ApiError
from app.models.room import Room
from app.models.room_message import RoomMessage
from app.models.user import User
from app.repositories.agent import AgentRepository
from app.repositories.room import RoomRepository
from app.schemas.common import ApiResponse
from app.schemas.room import (
    InviteAgentRequest,
    MessageSenderOut,
    RoomCreateRequest,
    RoomDetailOut,
    RoomListResponse,
    RoomMemberOut,
    RoomMessageCreateRequest,
    RoomMessageListResponse,
    RoomMessageOut,
    RoomOut,
)
from app.services.agent_gateway import manager
from app.services.agent_gateway.messaging import MessageRouter

router = APIRouter(prefix="/rooms", tags=["rooms"])


# ── 工具 ──────────────────────────────────────────────────────────────────


async def _get_room_or_404(session: AsyncSession, room_public_id: str) -> Room:
    room = await RoomRepository(session).get_by_public_id(room_public_id)
    if room is None:
        raise ApiError(code=51001, message="房间不存在", status_code=404)
    return room


def _room_out(room: Room) -> RoomOut:
    """Room → RoomOut（id 用 public room_id，不用內部 int）。"""
    return RoomOut(
        id=room.room_id,
        name=room.name,
        description=room.description,
        owner_id=room.owner_id,
        privacy=room.privacy,
        created_at=room.created_at,
        updated_at=room.updated_at,
    )


async def _require_member(
    session: AsyncSession, room: Room, user: User
) -> None:
    repo = RoomRepository(session)
    if not await repo.is_user_member(room.id, user.id):
        raise ApiError(code=51002, message="你不是这个房间的成员", status_code=403)


async def _message_sender(msg: RoomMessage, session: AsyncSession) -> MessageSenderOut:
    if msg.sender_type == "agent":
        agent = await AgentRepository(session).get_by_id(msg.sender_agent_id)
        if agent is not None:
            return MessageSenderOut(
                type="agent",
                id=agent.agent_id,
                name=agent.display_name,
                avatar_url=agent.avatar_url,
            )
    user = await AgentRepository(session).session.get(User, msg.sender_user_id)
    if user is not None:
        return MessageSenderOut(
            type="user",
            id=str(user.id),
            name=user.display_name or user.username,
            avatar_url=user.avatar_url,
        )
    return MessageSenderOut(type="user", id="0", name="已刪除用戶")


async def _message_out(msg: RoomMessage, session: AsyncSession) -> RoomMessageOut:
    reply_to_public = None
    if msg.reply_to_message_id:
        target = await RoomRepository(session).get_message_by_id(msg.reply_to_message_id)
        if target is not None:
            reply_to_public = target.message_id
    return RoomMessageOut(
        id=msg.message_id,
        room_id=(await RoomRepository(session).get_by_id(msg.room_id)).room_id,
        sender=await _message_sender(msg, session),
        content=msg.content,
        reply_to_message_id=reply_to_public,
        mentioned_agent_ids=msg.mentioned_agent_ids or [],
        created_at=msg.created_at,
    )


async def _member_payload(
    session: AsyncSession,
    room_id: int,
    member_type: str,
    member_id: int,
    role: str,
) -> RoomMemberOut:
    if member_type == "agent":
        agent = await AgentRepository(session).get_by_id(member_id)
        if agent is None:
            return RoomMemberOut(type="agent", id="", name="已刪除", role=role)
        return RoomMemberOut(
            type="agent",
            id=agent.agent_id,
            name=agent.display_name,
            avatar_url=agent.avatar_url,
            role=role,
            is_online=manager.is_online(agent.id),
            is_owner=(role == "owner"),
        )
    user = await AgentRepository(session).session.get(User, member_id)
    if user is None:
        return RoomMemberOut(type="user", id="", name="已刪除", role=role)
    return RoomMemberOut(
        type="user",
        id=str(user.id),
        name=user.display_name or user.username,
        avatar_url=user.avatar_url,
        role=role,
        is_online=True,
        is_owner=(role == "owner"),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post("", response_model=ApiResponse[RoomOut])
async def create_room(
    payload: RoomCreateRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[RoomOut]:
    """建立 Private 房間，並把 owner 加為成員。"""
    repo = RoomRepository(session)
    room = await repo.create(owner_id=current_user.id, name=payload.name, description=payload.description)
    await repo.add_member(
        room_id=room.id, member_type="user", member_id=current_user.id, role="owner"
    )
    return ApiResponse(data=_room_out(room))


@router.get("", response_model=ApiResponse[RoomListResponse])
async def list_rooms(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[RoomListResponse]:
    """我的房間列表。"""
    repo = RoomRepository(session)
    rooms = await repo.list_by_user(current_user.id)
    return ApiResponse(data=RoomListResponse(items=[_room_out(r) for r in rooms]))


@router.get("/{room_id}", response_model=ApiResponse[RoomDetailOut])
async def get_room(
    room_id: str,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[RoomDetailOut]:
    """房間詳情（含成員）。僅成員可看。"""
    room = await _get_room_or_404(session, room_id)
    await _require_member(session, room, current_user)

    repo = RoomRepository(session)
    members = await repo.list_members(room.id)
    member_payloads = [
        await _member_payload(session, room.id, m.member_type, m.member_id, m.role)
        for m in members
    ]
    base = _room_out(room)
    return ApiResponse(
        data=RoomDetailOut(
            **base.model_dump(),
            members=member_payloads,
            is_member=True,
            is_owner=(room.owner_id == current_user.id),
        )
    )


@router.post("/{room_id}/agents", response_model=ApiResponse[RoomMemberOut])
async def invite_agent(
    room_id: str,
    payload: InviteAgentRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[RoomMemberOut]:
    """邀請 Agent 加入房間。

    v0.2 最小上線流：room 成員可邀請已存在的 public Agent 直接加入。
    owner 審批流留給公開 beta 前補充；Agent 仍只會在 active member 且被 @ 時觸發。
    """
    room = await _get_room_or_404(session, room_id)
    await _require_member(session, room, current_user)

    repo = RoomRepository(session)
    agent = await AgentRepository(session).get_by_public_id(payload.agent_id)
    if agent is None:
        raise ApiError(code=51003, message="Agent 不存在", status_code=404)
    if await repo.is_agent_member(room.id, agent.id):
        raise ApiError(code=51005, message="该 Agent 已在房间中", status_code=409)

    member = await repo.add_member(
        room_id=room.id,
        member_type="agent",
        member_id=agent.id,
        role="member",
        invited_by=current_user.id,
    )
    return ApiResponse(
        data=await _member_payload(session, room.id, "agent", agent.id, member.role)
    )


@router.post("/{room_id}/messages", response_model=ApiResponse[RoomMessageOut])
async def send_message(
    room_id: str,
    payload: RoomMessageCreateRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[RoomMessageOut]:
    """發消息。內容 @AgentName 時觸發對應 Agent（後端解析 + Trigger Policy）。"""
    room = await _get_room_or_404(session, room_id)
    await _require_member(session, room, current_user)

    reply_to_internal = None
    if payload.reply_to_message_id:
        target = await RoomRepository(session).get_message_by_public_id(
            payload.reply_to_message_id
        )
        if target is None or target.room_id != room.id:
            raise ApiError(code=51006, message="回复的消息不存在", status_code=404)
        reply_to_internal = target.id

    router = MessageRouter(session)
    msg = await router.route_user_message(
        room=room,
        sender_user=current_user,
        content=payload.content,
        reply_to_message_id=reply_to_internal,
    )
    return ApiResponse(data=await _message_out(msg, session))


@router.get("/{room_id}/messages", response_model=ApiResponse[RoomMessageListResponse])
async def list_messages(
    room_id: str,
    session: SessionDep,
    current_user: CurrentUserDep,
    limit: int = Query(100, ge=1, le=200),
    before_message_id: str | None = Query(None),
) -> ApiResponse[RoomMessageListResponse]:
    """拉取消息歷史（按時間正序）。"""
    room = await _get_room_or_404(session, room_id)
    await _require_member(session, room, current_user)

    repo = RoomRepository(session)
    before_internal = None
    if before_message_id:
        before_msg = await repo.get_message_by_public_id(before_message_id)
        if before_msg is not None:
            before_internal = before_msg.id

    msgs = await repo.list_messages(room.id, limit=limit, before_id=before_internal)
    items = [await _message_out(m, session) for m in msgs]
    return ApiResponse(data=RoomMessageListResponse(items=items))


@router.post("/{room_id}/leave", response_model=ApiResponse[dict])
async def leave_room(
    room_id: str,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[dict]:
    """離開房間（owner 離開視為刪除，v0.1 不支援）。"""
    room = await _get_room_or_404(session, room_id)
    if room.owner_id == current_user.id:
        raise ApiError(code=51007, message="Owner 不能离开自己的房间（v0.1）", status_code=400)
    repo = RoomRepository(session)
    member = await repo.get_member(room_id=room.id, member_type="user", member_id=current_user.id)
    if member is not None:
        member.status = "removed"
        await session.commit()
    return ApiResponse(data={"ok": True})
