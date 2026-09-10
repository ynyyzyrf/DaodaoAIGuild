from fastapi import APIRouter
from fastapi import Query

from app.api.deps import AdminDep, SessionDep
from app.schemas.common import ApiResponse, Paginated
from app.schemas.company import CompanyOut, CompanyReview
from app.services.admin_audit import AdminAuditService
from app.services.company import CompanyService

router = APIRouter(prefix="/admin/companies", tags=["admin-companies"])


@router.get("", response_model=ApiResponse[Paginated[CompanyOut]])
async def list_companies(
    session: SessionDep,
    _: AdminDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, pattern="^(draft|pending|requires_changes|approved|rejected)$"),
):
    items, total = await CompanyService(session).list_companies_for_admin(page, page_size, status)
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@router.post("/{company_id}/review", response_model=ApiResponse[CompanyOut])
async def review_company(company_id: int, payload: CompanyReview, session: SessionDep, admin: AdminDep):
    service = CompanyService(session)
    company = await service.review_company(company_id, admin, payload.status, payload.reason)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="company.review",
        target_type="company",
        target_id=company.id,
        after_value={"status": company.status},
        reason=payload.reason,
    )
    return ApiResponse(data=await service.to_out(company))
