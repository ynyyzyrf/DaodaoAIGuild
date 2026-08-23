"""稽核日志查询（docs/3.2.md §5.6）。只读，不可删改。"""
from fastapi import APIRouter, Query

from app.api.deps import AdminDep, SessionDep
from app.schemas.admin import AuditLogOut, PaginatedAuditLogs
from app.schemas.common import ApiResponse, Paginated
from app.services.admin_audit import AdminAuditService

router = APIRouter(prefix="/admin/audit-logs", tags=["admin-audit"])


@router.get("", response_model=ApiResponse[PaginatedAuditLogs])
async def list_audit_logs(
    session: SessionDep,
    _: AdminDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin_id: int | None = None,
    target_type: str | None = None,
):
    service = AdminAuditService(session)
    items, total = await service.list(
        page=page, page_size=page_size, admin_id=admin_id, target_type=target_type
    )
    return ApiResponse(
        data=Paginated(
            items=[AuditLogOut.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )
