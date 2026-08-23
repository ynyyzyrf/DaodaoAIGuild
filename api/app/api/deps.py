from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApiError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.repositories.user import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)

SessionDep = Annotated[AsyncSession, Depends(get_db)]
CredentialsDep = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


async def get_current_user(session: SessionDep, credentials: CredentialsDep) -> User:
    if credentials is None:
        raise ApiError(code=41001, message="未登录", status_code=401)
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError as err:
        raise ApiError(code=41002, message="令牌已过期", status_code=401) from err
    except jwt.PyJWTError as err:
        raise ApiError(code=41001, message="无效令牌", status_code=401) from err

    user_id = int(payload.get("sub"))
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None or not user.is_active:
        raise ApiError(code=41001, message="用户不存在或已禁用", status_code=401)
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


async def require_admin(current_user: CurrentUserDep) -> User:
    if not current_user.is_admin:
        raise ApiError(code=42001, message="无权限", status_code=403)
    return current_user


AdminDep = Annotated[User, Depends(require_admin)]
