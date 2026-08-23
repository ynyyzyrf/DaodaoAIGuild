"""内容审核路由（docs/3.2.md §5.4）。"""
from fastapi import APIRouter, Query

from app.api.deps import AdminDep, SessionDep
from app.schemas.admin import (
    ModerationAction,
    ModerationDetailOut,
    ModerationItemOut,
    PaginatedModeration,
)
from app.schemas.common import ApiResponse, Paginated
from app.services.admin_audit import AdminAuditService
from app.services.moderation import ModerationService

router = APIRouter(prefix="/admin/moderation", tags=["admin-moderation"])


@router.get("", response_model=ApiResponse[PaginatedModeration])
async def list_moderation_queue(
    session: SessionDep,
    _: AdminDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    target_type: str | None = None,
    status: str | None = None,
):
    items, total = await ModerationService(session).list_queue(
        page=page, page_size=page_size, target_type=target_type, status=status
    )
    return ApiResponse(
        data=Paginated(
            items=[ModerationItemOut(**i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/{target_type}/{target_id}", response_model=ApiResponse[ModerationDetailOut])
async def get_moderation_detail(
    target_type: str, target_id: int, session: SessionDep, _: AdminDep
):
    detail = await ModerationService(session).get_detail(target_type, target_id)
    return ApiResponse(data=ModerationDetailOut(**detail))


@router.post("/{target_type}/{target_id}/approve", response_model=ApiResponse[dict])
async def approve_content(
    target_type: str, target_id: int, payload: ModerationAction, session: SessionDep, admin: AdminDep
):
    result = await ModerationService(session).approve(target_type, target_id)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action=f"moderation.approve.{target_type}",
        target_type=target_type,
        target_id=target_id,
        before_value=result["before"],
        after_value=result["after"],
        reason=payload.reason,
    )
    return ApiResponse(data=result["after"])


@router.post("/{target_type}/{target_id}/hide", response_model=ApiResponse[dict])
async def hide_content(
    target_type: str, target_id: int, payload: ModerationAction, session: SessionDep, admin: AdminDep
):
    result = await ModerationService(session).hide(target_type, target_id)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action=f"moderation.hide.{target_type}",
        target_type=target_type,
        target_id=target_id,
        before_value=result["before"],
        after_value=result["after"],
        reason=payload.reason,
    )
    return ApiResponse(data=result["after"])


@router.post("/{target_type}/{target_id}/delete", response_model=ApiResponse[dict])
async def delete_content(
    target_type: str, target_id: int, payload: ModerationAction, session: SessionDep, admin: AdminDep
):
    result = await ModerationService(session).delete(target_type, target_id)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action=f"moderation.delete.{target_type}",
        target_type=target_type,
        target_id=target_id,
        before_value=result["before"],
        after_value=result["after"],
        reason=payload.reason,
    )
    return ApiResponse(data=result["after"])


@router.post("/{target_type}/{target_id}/reject", response_model=ApiResponse[dict])
async def reject_content(
    target_type: str, target_id: int, payload: ModerationAction, session: SessionDep, admin: AdminDep
):
    result = await ModerationService(session).reject(target_type, target_id)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action=f"moderation.reject.{target_type}",
        target_type=target_type,
        target_id=target_id,
        before_value=result["before"],
        after_value=result["after"],
        reason=payload.reason,
    )
    return ApiResponse(data=result["after"])
