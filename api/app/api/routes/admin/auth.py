"""管理后台登录 / 登出 / 当前管理员信息（docs/3.2.md §5.1）。"""
from fastapi import APIRouter, Request

from app.api.deps import AdminDep, SessionDep
from app.core.exceptions import ApiError
from app.schemas.admin import AdminLoginRequest, AdminLoginResponse, AdminUserOut
from app.schemas.common import ApiResponse
from app.services import admin_auth

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


def _client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/login", response_model=ApiResponse[AdminLoginResponse])
async def admin_login(payload: AdminLoginRequest, request: Request, session: SessionDep):
    """管理后台登录：校验 is_admin + 登录锁定。"""
    ip = _client_ip(request)
    user, message_or_token = await admin_auth.admin_authenticate(
        session, payload.username, payload.password, ip=ip
    )
    if user is None:
        # message_or_token 此时是错误信息
        raise ApiError(code=41003, message=message_or_token, status_code=401)
    return ApiResponse(
        data=AdminLoginResponse(
            access_token=message_or_token,
            user=AdminUserOut.model_validate(user),
        )
    )


@router.get("/me", response_model=ApiResponse[AdminUserOut])
async def admin_me(current_user: AdminDep):
    return ApiResponse(data=AdminUserOut.model_validate(current_user))
