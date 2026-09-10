from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, SessionDep
from app.schemas.common import ApiResponse, Paginated
from app.schemas.company import (
    CompanyAdminAdd,
    CompanyCreate,
    CompanyJoinRequestOut,
    CompanyJoinRequestWithUserOut,
    CompanyMyStateOut,
    CompanyOut,
)
from app.services.company import CompanyService

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=ApiResponse[Paginated[CompanyOut]])
async def list_companies(
    session: SessionDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    items, total = await CompanyService(session).list_approved_companies(page, page_size)
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@router.post("", response_model=ApiResponse[CompanyOut])
async def create_company(payload: CompanyCreate, session: SessionDep, current_user: CurrentUserDep):
    service = CompanyService(session)
    company = await service.create_company(current_user, payload)
    return ApiResponse(data=await service.to_out(company))


@router.post("/{company_id}/submit", response_model=ApiResponse[CompanyOut])
async def submit_company(company_id: int, session: SessionDep, current_user: CurrentUserDep):
    service = CompanyService(session)
    company = await service.submit_company(company_id, current_user)
    return ApiResponse(data=await service.to_out(company))


@router.get("/me/state", response_model=ApiResponse[CompanyMyStateOut])
async def get_my_company_state(session: SessionDep, current_user: CurrentUserDep):
    return ApiResponse(data=await CompanyService(session).get_my_state(current_user.id))


@router.get("/{company_id}", response_model=ApiResponse[CompanyOut])
async def get_company(company_id: int, session: SessionDep):
    return ApiResponse(data=await CompanyService(session).get_company_out(company_id))


@router.post("/{company_id}/admins", response_model=ApiResponse[CompanyOut])
async def add_company_admin(
    company_id: int,
    payload: CompanyAdminAdd,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = CompanyService(session)
    await service.add_admin(company_id, current_user, payload.user_id)
    return ApiResponse(data=await service.get_company_out(company_id))


@router.post("/{company_id}/join-requests", response_model=ApiResponse[CompanyJoinRequestOut])
async def create_join_request(company_id: int, session: SessionDep, current_user: CurrentUserDep):
    req = await CompanyService(session).create_join_request(company_id, current_user)
    return ApiResponse(data=CompanyJoinRequestOut.model_validate(req))


@router.get("/{company_id}/join-requests", response_model=ApiResponse[list[CompanyJoinRequestWithUserOut]])
async def list_join_requests(
    company_id: int,
    session: SessionDep,
    current_user: CurrentUserDep,
    status: str | None = Query("pending"),
):
    return ApiResponse(data=await CompanyService(session).list_join_requests(company_id, current_user, status))


@router.post("/{company_id}/join-requests/{request_id}/approve", response_model=ApiResponse[dict])
async def approve_join_request(
    company_id: int,
    request_id: int,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = CompanyService(session)
    member = await service.approve_join_request(company_id, request_id, current_user)
    return ApiResponse(
        data={
            "id": member.id,
            "company_id": member.company_id,
            "user_id": member.user_id,
            "status": member.fde_status,
        }
    )


@router.post("/{company_id}/join-requests/{request_id}/reject", response_model=ApiResponse[CompanyJoinRequestOut])
async def reject_join_request(
    company_id: int,
    request_id: int,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    req = await CompanyService(session).reject_join_request(company_id, request_id, current_user)
    return ApiResponse(data=CompanyJoinRequestOut.model_validate(req))


@router.post("/{company_id}/members/{user_id}/release", response_model=ApiResponse[dict])
async def release_fde_belonging(
    company_id: int,
    user_id: int,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    member = await CompanyService(session).release_fde_belonging(company_id, user_id, current_user)
    return ApiResponse(
        data={
            "id": member.id,
            "company_id": member.company_id,
            "user_id": member.user_id,
            "status": member.fde_status,
            "company_role": member.company_role,
        }
    )
