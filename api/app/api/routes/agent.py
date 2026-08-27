"""Agent Room REST endpoints — Phase A（docs/3.3.md §七-§九、§三十一-§三十三）。

端點清單（均掛在 ``/api/v1`` prefix 之下）：

未認證（Hermes 端）：
- POST /agent/device/start                 發起 Device Authorization Grant
- GET  /agent/device/{device_code}/poll    Hermes 輪詢

需 User session（瀏覽器端）：
- POST /agent/device/info                  查詢待授權詳情
- POST /agent/device/authorize             確認授權
- POST /agent/device/deny                  拒絕
- GET  /agents                             我的 Agent 列表
- GET  /agents/{agent_id}                  Agent 詳情
- POST /agents/{agent_id}/disconnect       撤銷連線

需 Agent access token（Hermes WSS 之外的 REST）：
- POST /agent/credential/refresh           換新 access + refresh
- DELETE /agent/credential                 自我撤銷
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Path

from app.api.deps import CredentialsDep, CurrentUserDep, SessionDep
from app.core.agent_security import (
    AgentTokenError,
    create_agent_token_pair,
    decode_agent_token,
    generate_device_code,
    generate_verification_token,
    hash_secret,
)
from app.core.config import get_settings
from app.core.datetime_utils import from_naive_utc, to_naive_utc, utc_now
from app.core.exceptions import ApiError
from app.models.agent_credential import AgentCredential
from app.repositories.agent import AgentRepository
from app.schemas.agent import (
    AgentDetailResponse,
    AgentListResponse,
    AgentOut,
    AgentStatusResponse,
    CredentialPayload,
    CredentialRefreshRequest,
    CredentialRefreshResponse,
    DeviceAuthorizeRequest,
    DeviceAuthorizeResponse,
    DeviceDenyRequest,
    DeviceInfoRequest,
    DeviceInfoResponse,
    DevicePollResponse,
    DeviceStartRequest,
    DeviceStartResponse,
)
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/agent", tags=["agent"])


# ── 工具 ──────────────────────────────────────────────────────────────────


def _get_cred_or_none(cred: AgentCredential | None) -> AgentCredential:
    if cred is None:
        raise ApiError(code=50001, message="Agent credential not initialized", status_code=500)
    return cred


async def _get_agent_by_access_token(
    *,
    credentials: CredentialsDep,
    session: SessionDep,
):
    if credentials is None:
        raise ApiError(code=50014, message="agent access token required", status_code=401)
    try:
        decoded = decode_agent_token(credentials.credentials, expected_type="agent_access")
    except AgentTokenError as err:
        raise ApiError(code=50010, message=str(err), status_code=401) from err

    repo = AgentRepository(session)
    cred = await repo.get_credential_by_access_jti(decoded["jti"])
    if cred is None:
        raise ApiError(code=50011, message="agent credential revoked or rotated", status_code=401)

    agent = await repo.get_by_id(cred.agent_id)
    if agent is None or agent.agent_id != decoded["sub"] or agent.status == "revoked":
        raise ApiError(code=50012, message="agent mismatch", status_code=401)
    return agent


# ── 未認證（Hermes 端） ───────────────────────────────────────────────────


@router.post("/device/start", response_model=ApiResponse[DeviceStartResponse])
async def device_start(
    payload: DeviceStartRequest,
    session: SessionDep,
) -> ApiResponse[DeviceStartResponse]:
    """Hermes 發起 Device Authorization Grant。

    產生兩個獨立 secret：
    - device_code：給 Hermes 輪詢用（server-to-server 走 TLS）
    - verification_token：給瀏覽器用，只放在 URL fragment 內

    注意：本 endpoint 不返回 verification_token 明文，只放在 verification_url 的
    fragment 裡（瀏覽器從不送達 server，符合「不可兌換 secret 不進 URL path/query」規則）。
    """
    settings = get_settings()
    device_code = generate_device_code()
    verification_token = generate_verification_token()

    # device_code.expires_at 是 DB naive column，invariant: naive = UTC
    expires_at = to_naive_utc(
        utc_now() + timedelta(minutes=settings.agent_device_code_expire_minutes)
    )

    repo = AgentRepository(session)
    await repo.create_device_code(
        device_code_hash=hash_secret(device_code),
        verification_token_hash=hash_secret(verification_token),
        suggested_name=payload.suggested_name,
        device_name=payload.device_name,
        device_fingerprint=payload.device_fingerprint,
        expires_at=expires_at,
        agent_type=payload.agent_type,
        requested_scopes=payload.scopes,
    )

    verification_url = f"{settings.public_base_url}/agent/verify#vt={verification_token}"

    return ApiResponse(
        data=DeviceStartResponse(
            device_code=device_code,
            verification_url=verification_url,
            expires_in=settings.agent_device_code_expire_minutes * 60,
        )
    )


@router.get("/device/{device_code}/poll", response_model=ApiResponse[DevicePollResponse])
async def device_poll(
    device_code: str = Path(..., min_length=4),
    session: SessionDep = None,  # type: ignore[assignment]
) -> ApiResponse[DevicePollResponse]:
    """Hermes 輪詢授權狀態。

    - pending → 回傳 expires_in
    - authorized → 首次回傳 credential，標記 consumed，後續 poll 同 device_code → consumed
    - expired / denied → 終態
    """
    repo = AgentRepository(session)
    dc_hash = hash_secret(device_code)
    dc = await repo.get_device_code_by_hash(dc_hash)
    if dc is None:
        raise ApiError(code=50002, message="device_code not found", status_code=404)

    now = utc_now()
    # 讀 DB 後 normalize to aware，後續比較 / 序列化都一致
    expires_at_aware = from_naive_utc(dc.expires_at)
    remaining = int((expires_at_aware - now).total_seconds()) if expires_at_aware else 0

    if dc.status == "pending":
        if remaining <= 0:
            # 過期了但 status 還沒被 cron 標記；這裡直接回 expired
            await repo.update_device_code_status(dc, status="expired")
            return ApiResponse(data=DevicePollResponse(status="expired"))
        return ApiResponse(data=DevicePollResponse(status="pending", expires_in=remaining))

    if dc.status == "expired" or dc.status == "denied":
        return ApiResponse(data=DevicePollResponse(status=dc.status))

    if dc.status == "consumed":
        # 已領過 credential，不可重複領
        return ApiResponse(data=DevicePollResponse(status="consumed"))

    if dc.status == "authorized":
        if dc.agent_id is None or dc.owner_id is None:
            raise ApiError(code=50003, message="device_code authorized but missing linkage", status_code=500)
        agent = await repo.get_by_id(dc.agent_id)
        if agent is None:
            raise ApiError(code=50003, message="agent not found", status_code=500)
        cred = await repo.get_credential(agent.id)
        cred = _get_cred_or_none(cred)

        # 簽發 access + refresh
        pair = create_agent_token_pair(
            agent_public_id=agent.agent_id,
            owner_id=agent.owner_id,
            agent_type=agent.agent_type,
        )
        await repo.update_jtis(
            cred=cred,
            access_jti=pair.access_jti,
            access_expires_at=to_naive_utc(pair.access_expires_at),
            refresh_jti=pair.refresh_jti,
            refresh_expires_at=to_naive_utc(pair.refresh_expires_at),
        )
        await repo.update_device_code_status(dc, status="consumed")
        # 同步 last_used_at
        cred.last_used_at = to_naive_utc(utc_now())
        await session.commit()

        payload = CredentialPayload(
            agent_id=agent.agent_id,
            access_token=pair.access_token,
            access_expires_at=pair.access_expires_at,
            refresh_token=pair.refresh_token,
            refresh_expires_at=pair.refresh_expires_at,
        )
        return ApiResponse(
            data=DevicePollResponse(
                status="authorized",
                credential=payload,
            )
        )

    # 不應走到這
    raise ApiError(code=50004, message=f"unexpected device_code status: {dc.status}", status_code=500)


# ── 需 User session（瀏覽器端） ───────────────────────────────────────────


@router.post("/device/info", response_model=ApiResponse[DeviceInfoResponse])
async def device_info(
    payload: DeviceInfoRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[DeviceInfoResponse]:
    """瀏覽器查詢待授權詳情。

    失敗：
    - 404: token 不存在
    - 410: token 過期 / 已使用 / 已拒絕
    """
    repo = AgentRepository(session)
    vt_hash = hash_secret(payload.verification_token)
    dc = await repo.get_device_code_by_verification_hash(vt_hash)
    if dc is None:
        raise ApiError(code=50005, message="verification_token not found", status_code=404)

    now = utc_now()
    if dc.status in ("consumed", "expired", "denied"):
        raise ApiError(code=50006, message=f"verification_token {dc.status}", status_code=410)
    if dc.status != "pending":
        raise ApiError(code=50006, message=f"verification_token {dc.status}", status_code=410)
    expires_at_aware = from_naive_utc(dc.expires_at)
    if expires_at_aware is not None and expires_at_aware <= now:
        await repo.update_device_code_status(dc, status="expired")
        raise ApiError(code=50006, message="verification_token expired", status_code=410)

    remaining = int((expires_at_aware - now).total_seconds()) if expires_at_aware else 0
    return ApiResponse(
        data=DeviceInfoResponse(
            agent_type="hermes",  # v0.1 永遠 hermes
            suggested_name=dc.suggested_name,
            device_name=dc.device_name,
            scopes=dc.requested_scopes or [],
            expires_in=remaining,
        )
    )


@router.post("/device/authorize", response_model=ApiResponse[DeviceAuthorizeResponse])
async def device_authorize(
    payload: DeviceAuthorizeRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[DeviceAuthorizeResponse]:
    """瀏覽器確認授權 → 建立 Agent + Credential（Credential 此時 jti=NULL，等 Hermes poll 才發）。

    安全規則：此 endpoint 不會把任何 token 寫進回應——token 只透過 device_code poll 交給 Hermes。
    """
    repo = AgentRepository(session)
    vt_hash = hash_secret(payload.verification_token)
    dc = await repo.get_device_code_by_verification_hash(vt_hash)
    if dc is None:
        raise ApiError(code=50005, message="verification_token not found", status_code=404)
    if dc.status != "pending":
        raise ApiError(code=50006, message=f"verification_token {dc.status}", status_code=410)
    expires_at_aware = from_naive_utc(dc.expires_at)
    if expires_at_aware is not None and expires_at_aware <= utc_now():
        await repo.update_device_code_status(dc, status="expired")
        raise ApiError(code=50006, message="verification_token expired", status_code=410)

    # 建立 Agent
    agent = await repo.create(
        owner_id=current_user.id,
        display_name=payload.agent_name,
        agent_type=dc.agent_type,
    )
    # 建立 Credential（jti 留空，等 poll 時填；fingerprint 從 device_code 帶過來）
    await repo.create_credential(
        agent_id=agent.id,
        device_name=dc.device_name,
        device_fingerprint=dc.device_fingerprint,
    )
    # 標記 device_code 為 authorized
    await repo.update_device_code_status(
        dc, status="authorized", owner_id=current_user.id, agent_id=agent.id
    )

    return ApiResponse(
        data=DeviceAuthorizeResponse(
            agent_id=agent.agent_id,
            display_name=agent.display_name,
            status=agent.status,
        )
    )


@router.post("/device/deny", response_model=ApiResponse[dict])
async def device_deny(
    payload: DeviceDenyRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[dict]:
    """瀏覽器拒絕授權。"""
    repo = AgentRepository(session)
    vt_hash = hash_secret(payload.verification_token)
    dc = await repo.get_device_code_by_verification_hash(vt_hash)
    if dc is None:
        raise ApiError(code=50005, message="verification_token not found", status_code=404)
    if dc.status == "pending":
        await repo.update_device_code_status(dc, status="denied")
    return ApiResponse(data={"ok": True})


# ── 需 Agent access token ────────────────────────────────────────────────


@router.get("/me/status", response_model=ApiResponse[AgentStatusResponse])
async def agent_me_status(
    session: SessionDep,
    credentials: CredentialsDep,
) -> ApiResponse[AgentStatusResponse]:
    """Agent self status.

    Identity is resolved exclusively from the Bearer agent access token. The
    endpoint does not accept a caller-supplied agent_id for lookup.
    """
    agent = await _get_agent_by_access_token(credentials=credentials, session=session)

    from app.services.agent_gateway import manager

    state = manager.get(agent.id)
    return ApiResponse(
        data=AgentStatusResponse(
            agent_id=agent.agent_id,
            online=state is not None,
            connected_at=state.connected_at if state is not None else None,
            last_heartbeat_at=state.last_heartbeat_at if state is not None else None,
        )
    )


@router.post("/credential/refresh", response_model=ApiResponse[CredentialRefreshResponse])
async def credential_refresh(
    payload: CredentialRefreshRequest,
    session: SessionDep,
) -> ApiResponse[CredentialRefreshResponse]:
    """Refresh token rotation。"""
    try:
        decoded = decode_agent_token(payload.refresh_token, expected_type="agent_refresh")
    except AgentTokenError as err:
        raise ApiError(code=50010, message=str(err), status_code=401) from err

    jti = decoded["jti"]
    agent_public_id = decoded["sub"]
    repo = AgentRepository(session)
    cred = await repo.get_credential_by_refresh_jti(jti)
    if cred is None:
        # jti 不在 DB → 已被 rotation 取代或撤銷
        raise ApiError(code=50011, message="refresh_token revoked or rotated", status_code=401)

    agent = await repo.get_by_id(cred.agent_id)
    if agent is None or agent.agent_id != agent_public_id:
        raise ApiError(code=50012, message="agent mismatch", status_code=401)

    # Rotation：產生新一對，把舊 refresh_jti 設 NULL
    from app.core.agent_security import (
        create_agent_access_token,
        create_agent_refresh_token,
    )

    new_access, new_access_jti, new_access_exp = create_agent_access_token(
        agent_public_id=agent.agent_id,
        owner_id=agent.owner_id,
        agent_type=agent.agent_type,
    )
    new_refresh, new_refresh_jti, new_refresh_exp = create_agent_refresh_token(
        agent_public_id=agent.agent_id
    )
    await repo.rotate_refresh(
        cred=cred,
        new_access_jti=new_access_jti,
        new_access_expires_at=to_naive_utc(new_access_exp),
        new_refresh_jti=new_refresh_jti,
        new_refresh_expires_at=to_naive_utc(new_refresh_exp),
    )
    return ApiResponse(
        data=CredentialRefreshResponse(
            access_token=new_access,
            access_expires_at=new_access_exp,
            refresh_token=new_refresh,
            refresh_expires_at=new_refresh_exp,
        )
    )


@router.delete("/credential", response_model=ApiResponse[dict])
async def revoke_self_credential(
    session: SessionDep,
    credentials: CredentialsDep,
) -> ApiResponse[dict]:
    """Agent 自我撤銷 Credential。

    Identity is resolved from the Bearer agent access token; caller-supplied
    agent_id is intentionally not accepted.
    """
    repo = AgentRepository(session)
    agent = await _get_agent_by_access_token(credentials=credentials, session=session)

    await repo.disconnect(agent.id, reason="credential_revoked")

    from app.services.agent_gateway import manager

    state = manager.get(agent.id)
    if state is not None:
        try:
            from app.services.agent_gateway.events import agent_disconnected_event

            await state.websocket.send_json(
                agent_disconnected_event(reason="credential_revoked")
            )
            await state.websocket.close(code=1000)
        except Exception:  # noqa: BLE001
            pass
        manager.unregister(agent.id)

    return ApiResponse(data={"ok": True})


# ── User-facing Agent 管理 ───────────────────────────────────────────────


agents_router = APIRouter(prefix="/agents", tags=["agents"])


@agents_router.get("", response_model=ApiResponse[AgentListResponse])
async def list_my_agents(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[AgentListResponse]:
    """我的 Agent 列表。"""
    repo = AgentRepository(session)
    agents = await repo.list_by_owner(current_user.id)
    items = [
        AgentOut(
            id=a.agent_id,
            owner_id=a.owner_id,
            agent_type=a.agent_type,
            display_name=a.display_name,
            avatar_url=a.avatar_url,
            status=a.status,
            visibility=a.visibility,
            last_seen_at=a.last_seen_at,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in agents
    ]
    return ApiResponse(data=AgentListResponse(items=items))


@agents_router.get("/{agent_id}", response_model=ApiResponse[AgentDetailResponse])
async def get_agent(
    agent_id: str,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[AgentDetailResponse]:
    """Agent 詳情。"""
    repo = AgentRepository(session)
    agent = await repo.get_by_public_id(agent_id)
    if agent is None or agent.owner_id != current_user.id:
        raise ApiError(code=50020, message="agent not found", status_code=404)
    cred = await repo.get_credential(agent.id)
    is_online = False
    from app.services.agent_gateway import manager

    is_online = manager.is_online(agent.id)
    return ApiResponse(
        data=AgentDetailResponse(
            id=agent.agent_id,
            owner_id=agent.owner_id,
            agent_type=agent.agent_type,
            display_name=agent.display_name,
            avatar_url=agent.avatar_url,
            status=agent.status,
            visibility=agent.visibility,
            last_seen_at=agent.last_seen_at,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
            device_name=cred.device_name if cred else None,
            is_online=is_online,
        )
    )


@agents_router.post("/{agent_id}/disconnect", response_model=ApiResponse[dict])
async def disconnect_agent(
    agent_id: str,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ApiResponse[dict]:
    """User 主動中斷 Agent 連線。撤銷 credential + 設 offline + 關閉 WSS。"""
    repo = AgentRepository(session)
    agent = await repo.get_by_public_id(agent_id)
    if agent is None or agent.owner_id != current_user.id:
        raise ApiError(code=50020, message="agent not found", status_code=404)

    await repo.disconnect(agent.id, reason="user_disconnect")

    # 通知 ConnectionManager 關閉 WSS（如果有 active 連線）
    from app.services.agent_gateway import manager

    state = manager.get(agent.id)
    if state is not None:
        try:
            from app.services.agent_gateway.events import agent_disconnected_event

            await state.websocket.send_json(agent_disconnected_event(reason="user_disconnect"))
            await state.websocket.close(code=1000)
        except Exception:  # noqa: BLE001
            pass
        manager.unregister(agent.id)

    return ApiResponse(data={"ok": True})
