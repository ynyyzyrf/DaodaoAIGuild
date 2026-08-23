"""管理后台用户管理路由（docs/3.2.md §5.3）。"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Query

from app.api.deps import AdminDep, SessionDep
from app.core.exceptions import ApiError
from app.models.user import User
from app.schemas.admin import (
    AdminUserDetail,
    AdminUserOut,
    AdminUserUpdate,
    PaginatedUsers,
    ResetPasswordOut,
)
from app.schemas.common import ApiResponse, Paginated
from app.services.admin_audit import AdminAuditService
from app.services.admin_user import AdminUserService

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


def _user_before(user) -> dict:
    return {
        "is_active": user.is_active,
        "level": user.level,
        "reputation": user.reputation,
        "is_verified_fde": user.is_verified_fde,
    }


@router.get("", response_model=ApiResponse[PaginatedUsers])
async def list_users(
    session: SessionDep,
    _: AdminDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    level: int | None = None,
    is_active: bool | None = None,
    is_admin: bool | None = None,
    active_days: int | None = Query(None, description="近 N 日活跃"),
    q: str | None = None,
):
    active_since = datetime.utcnow() - timedelta(days=active_days) if active_days else None
    items, total = await AdminUserService(session).list_users(
        page=page,
        page_size=page_size,
        level=level,
        is_active=is_active,
        is_admin=is_admin,
        active_since=active_since,
        q=q,
    )
    return ApiResponse(
        data=Paginated(
            items=[AdminUserOut.model_validate(u) for u in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/{user_id}", response_model=ApiResponse[AdminUserDetail])
async def get_user(user_id: int, session: SessionDep, _: AdminDep):
    user, stats = await AdminUserService(session).get_detail(user_id)
    if user is None:
        raise ApiError(code=40002, message="用户不存在", status_code=404)
    detail = AdminUserDetail(**AdminUserOut.model_validate(user).model_dump(), **stats)
    return ApiResponse(data=detail)


@router.patch("/{user_id}", response_model=ApiResponse[AdminUserOut])
async def update_user(
    user_id: int, payload: AdminUserUpdate, session: SessionDep, admin: AdminDep
):
    user = await session.get(User, user_id)
    if user is None:
        raise ApiError(code=40002, message="用户不存在", status_code=404)
    before = _user_before(user)
    user = await AdminUserService(session).update_user(
        user,
        is_active=payload.is_active,
        level=payload.level,
        reputation=payload.reputation,
        is_verified_fde=payload.is_verified_fde,
    )
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="user.update",
        target_type="user",
        target_id=user.id,
        before_value=before,
        after_value=_user_before(user),
        reason=payload.reason,
    )
    return ApiResponse(data=AdminUserOut.model_validate(user))


@router.post("/{user_id}/reset-password", response_model=ApiResponse[ResetPasswordOut])
async def reset_password(user_id: int, session: SessionDep, admin: AdminDep):
    user = await session.get(User, user_id)
    if user is None:
        raise ApiError(code=40002, message="用户不存在", status_code=404)
    new_password = await AdminUserService(session).reset_password(user)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="user.reset_password",
        target_type="user",
        target_id=user.id,
        reason=f"重置密码：{user.username}",
    )
    return ApiResponse(data=ResetPasswordOut(username=user.username, new_password=new_password))


@router.post("/{user_id}/soft-delete", response_model=ApiResponse[AdminUserOut])
async def soft_delete_user(
    user_id: int, payload: AdminUserUpdate, session: SessionDep, admin: AdminDep
):
    user = await session.get(User, user_id)
    if user is None:
        raise ApiError(code=40002, message="用户不存在", status_code=404)
    if user.is_admin:
        raise ApiError(code=42002, message="不能删除管理员账号", status_code=403)
    before = _user_before(user)
    user = await AdminUserService(session).soft_delete(user)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="user.soft_delete",
        target_type="user",
        target_id=user.id,
        before_value=before,
        after_value=_user_before(user),
        reason=payload.reason,
    )
    return ApiResponse(data=AdminUserOut.model_validate(user))
