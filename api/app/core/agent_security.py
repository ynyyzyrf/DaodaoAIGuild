"""Agent JWT 安全工具（docs/3.3.md v0.1）。

設計：
- 獨立 secret（``AGENT_JWT_SECRET``），與用戶 JWT 完全分離。
- access token 短效（預設 24h），refresh token 90d。
- jti 寫入 ``agent_credentials.access_jti`` / ``refresh_jti``，NULL = 未發放或已撤銷。
- Rotation：refresh 成功後舊 jti 設 NULL、新 jti 寫入。
"""
from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.core.config import get_settings


@dataclass(frozen=True)
class AgentTokenPair:
    """一對 access + refresh token 與其到期時間。"""

    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    access_jti: str
    refresh_jti: str


# ── Token 生成 ────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(UTC)


def generate_public_agent_id() -> str:
    """產生 public-facing Agent ID，格式 ``agt_xxxxxxxxx``（12 個 URL-safe 字符）。"""
    return "agt_" + secrets.token_urlsafe(9)


def generate_public_room_id() -> str:
    """產生 public-facing Room ID，格式 ``room_xxxxxxxxx``。"""
    return "room_" + secrets.token_urlsafe(9)


def generate_public_message_id() -> str:
    """產生 public-facing Message ID，格式 ``msg_xxxxxxxxx``。"""
    return "msg_" + secrets.token_urlsafe(9)


def generate_device_code() -> str:
    """Hermes 持有的 device_code，server-to-server 走 TLS。"""
    return "dev_" + secrets.token_urlsafe(32)


def generate_verification_token() -> str:
    """瀏覽器持有的 verification_token，只出現在 URL fragment 內。"""
    return "v_" + secrets.token_urlsafe(32)


def hash_secret(plain: str) -> str:
    """device_code / verification_token 的雜湊儲存（不存明文）。"""
    import hashlib

    return hashlib.sha256(plain.encode("utf-8")).hexdigest()


def create_agent_access_token(
    *,
    agent_public_id: str,
    owner_id: int,
    agent_type: str,
    jti: str | None = None,
    expires_at: datetime | None = None,
) -> tuple[str, str, datetime]:
    """簽發 access token，回傳 (token, jti, expires_at)。"""
    settings = get_settings()
    now = _now()
    if expires_at is None:
        expires_at = now + timedelta(hours=settings.agent_access_token_expire_hours)
    if jti is None:
        jti = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "sub": agent_public_id,
        "type": "agent_access",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "owner_id": owner_id,
        "agent_type": agent_type,
    }
    token = jwt.encode(payload, settings.agent_jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def create_agent_refresh_token(
    *,
    agent_public_id: str,
    jti: str | None = None,
    expires_at: datetime | None = None,
) -> tuple[str, str, datetime]:
    """簽發 refresh token，回傳 (token, jti, expires_at)。"""
    settings = get_settings()
    now = _now()
    if expires_at is None:
        expires_at = now + timedelta(days=settings.agent_refresh_token_expire_days)
    if jti is None:
        jti = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "sub": agent_public_id,
        "type": "agent_refresh",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.agent_jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def create_agent_token_pair(
    *, agent_public_id: str, owner_id: int, agent_type: str
) -> AgentTokenPair:
    """同時簽發 access + refresh。"""
    access_token, access_jti, access_expires_at = create_agent_access_token(
        agent_public_id=agent_public_id,
        owner_id=owner_id,
        agent_type=agent_type,
    )
    refresh_token, refresh_jti, refresh_expires_at = create_agent_refresh_token(
        agent_public_id=agent_public_id
    )
    return AgentTokenPair(
        access_token=access_token,
        access_expires_at=access_expires_at,
        refresh_token=refresh_token,
        refresh_expires_at=refresh_expires_at,
        access_jti=access_jti,
        refresh_jti=refresh_jti,
    )


# ── Token 驗證 ────────────────────────────────────────────────────────────


class AgentTokenError(Exception):
    """Agent token 驗證失敗（簽章錯誤、過期、jti 已被撤銷等）。"""


def decode_agent_token(token: str, *, expected_type: str) -> dict[str, Any]:
    """解碼並驗證 Agent JWT。``expected_type`` = ``"agent_access"`` 或 ``"agent_refresh"``。

    只做 signature + exp 驗證；jti 是否仍在 ``agent_credentials`` 對應欄位由呼叫端查 DB。
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.agent_jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as err:
        raise AgentTokenError("token expired") from err
    except jwt.PyJWTError as err:
        raise AgentTokenError("invalid token") from err

    if payload.get("type") != expected_type:
        raise AgentTokenError(f"unexpected token type: {payload.get('type')}")
    if not payload.get("jti") or not payload.get("sub"):
        raise AgentTokenError("token missing jti/sub")
    return payload
