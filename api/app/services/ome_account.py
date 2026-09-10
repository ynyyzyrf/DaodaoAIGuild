import asyncio
import json
import re
import secrets
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.core.security import hash_password
from app.models.user import User
from app.repositories.user import UserRepository


def _first_text(data: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = data.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _employee_payload(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ApiError(code=41004, message="OMEACCOUNT 用户资料格式不正确", status_code=401)
    for key in ("data", "result", "employee", "user"):
        nested = raw.get(key)
        if isinstance(nested, dict):
            return nested
    return raw


def _safe_username(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_.@-]+", "_", value.strip()).strip("._-")
    return normalized[:56] or "user"


def _build_employee_info_request(token: str) -> Request:
    settings = get_settings()
    if not settings.ome_external_api_base:
        raise ApiError(code=41004, message="OMEACCOUNT 后端校验未配置", status_code=500)

    base = settings.ome_external_api_base.rstrip("/") + "/"
    endpoint = settings.ome_employee_info_endpoint.lstrip("/")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    if settings.ome_language:
        headers["language"] = settings.ome_language
        headers["Accept-Language"] = settings.ome_language
    if settings.ome_tenant_id:
        headers["tenant-id"] = settings.ome_tenant_id
    if settings.ome_platform:
        headers["platform"] = settings.ome_platform
    return Request(urljoin(base, endpoint), headers=headers, method="GET")


def _fetch_employee_info_sync(token: str) -> dict[str, Any]:
    settings = get_settings()
    request = _build_employee_info_request(token)
    try:
        with urlopen(request, timeout=settings.ome_request_timeout_seconds) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as err:
        raise ApiError(code=41004, message="OMEACCOUNT token 校验失败", status_code=401) from err
    except URLError as err:
        raise ApiError(code=50012, message="OMEACCOUNT 服务暂时不可用", status_code=502) from err
    except TimeoutError as err:
        raise ApiError(code=50012, message="OMEACCOUNT 服务请求超时", status_code=502) from err

    try:
        body = json.loads(raw)
    except json.JSONDecodeError as err:
        raise ApiError(code=41004, message="OMEACCOUNT 返回格式不正确", status_code=401) from err
    return _employee_payload(body)


async def fetch_employee_info(token: str) -> dict[str, Any]:
    return await asyncio.to_thread(_fetch_employee_info_sync, token)


async def resolve_ome_user(session: AsyncSession, token: str) -> User:
    if not token.strip():
        raise ApiError(code=41001, message="未登录", status_code=401)

    employee = await fetch_employee_info(token)
    raw_identity = _first_text(
        employee,
        (
            "username",
            "userName",
            "account",
            "accountName",
            "email",
            "employeeNo",
            "employeeCode",
            "employeeId",
            "id",
            "mobile",
            "phone",
        ),
    )
    if not raw_identity:
        raise ApiError(code=41004, message="OMEACCOUNT 用户资料缺少唯一标识", status_code=401)

    username = f"ome_{_safe_username(raw_identity)}"[:64]
    display_name = (
        _first_text(
            employee,
            ("displayName", "display_name", "nickName", "nickname", "name", "realName", "employeeName"),
        )
        or raw_identity
    )[:64]
    avatar_url = _first_text(employee, ("avatarUrl", "avatar_url", "avatar", "headImg", "headImage"))[:512]

    repo = UserRepository(session)
    user = await repo.get_by_username(username)
    if user is None:
        user = User(
            username=username,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            display_name=display_name,
            avatar_url=avatar_url,
            is_active=True,
        )
        session.add(user)
    else:
        user.display_name = display_name or user.display_name
        if avatar_url:
            user.avatar_url = avatar_url
    await session.commit()
    await session.refresh(user)
    return user
