from fastapi import APIRouter, Query

from app.api.deps import AdminDep, SessionDep
from app.schemas.common import ApiResponse, Paginated
from app.schemas.solution import EnterpriseSolutionOut, EnterpriseSolutionReview
from app.services.admin_audit import AdminAuditService
from app.services.solution import EnterpriseSolutionService

router = APIRouter(prefix="/admin/solutions", tags=["admin-solutions"])


@router.get("", response_model=ApiResponse[Paginated[EnterpriseSolutionOut]])
async def list_solutions(
    session: SessionDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, pattern="^(draft|pending|approved|rejected)$"),
):
    items, total = await EnterpriseSolutionService(session).list_admin_solutions(page, page_size, status)
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@router.post("/{solution_id}/review", response_model=ApiResponse[EnterpriseSolutionOut])
async def review_solution(
    solution_id: int,
    payload: EnterpriseSolutionReview,
    session: SessionDep,
    admin: AdminDep,
):
    service = EnterpriseSolutionService(session)
    solution = await service.review_solution(solution_id, admin, payload.status, payload.reason)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="solution.review",
        target_type="enterprise_solution",
        target_id=solution.id,
        after_value={"status": solution.status},
        reason=payload.reason,
    )
    return ApiResponse(data=service.to_out(solution))
