from typing import Annotated

from fastapi import Depends
from fastapi.security import APIKeyHeader
from sqlalchemy import select

from app.api.deps import SessionDep
from app.core.datetime_utils import to_naive_utc, utc_now
from app.core.exceptions import ApiError
from app.core.external_api_security import hash_external_api_key
from app.models.external_api import ExternalApiKey
from app.models.user import User

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


class ExternalApiPrincipal:
    def __init__(self, key: ExternalApiKey, owner: User):
        self.key = key
        self.owner = owner

    def require_scope(self, scope: str) -> None:
        if scope not in (self.key.scopes or []):
            raise ApiError(code=42021, message="API Key 权限不足", status_code=403)


async def require_external_api_key(
    session: SessionDep, api_key: str | None = Depends(api_key_header)
) -> ExternalApiPrincipal:
    if not api_key:
        raise ApiError(code=41021, message="缺少 API Key", status_code=401)
    result = await session.execute(
        select(ExternalApiKey).where(
            ExternalApiKey.key_hash == hash_external_api_key(api_key),
            ExternalApiKey.status == "active",
        )
    )
    key = result.scalar_one_or_none()
    if key is None:
        raise ApiError(code=41022, message="无效 API Key", status_code=401)
    if key.expires_at is not None and key.expires_at <= to_naive_utc(utc_now()):
        raise ApiError(code=41024, message="API Key 已过期", status_code=401)
    owner = await session.get(User, key.owner_user_id)
    if owner is None or not owner.is_active:
        raise ApiError(code=41023, message="API Key 绑定用户不可用", status_code=401)
    return ExternalApiPrincipal(key, owner)


ExternalApiKeyDep = Annotated[ExternalApiPrincipal, Depends(require_external_api_key)]
