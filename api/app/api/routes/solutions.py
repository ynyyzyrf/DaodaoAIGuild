from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, SessionDep
from app.schemas.common import ApiResponse, Paginated
from app.schemas.solution import EnterpriseSolutionCreate, EnterpriseSolutionOut
from app.services.solution import EnterpriseSolutionService

router = APIRouter(prefix="/solutions", tags=["solutions"])


@router.get("", response_model=ApiResponse[Paginated[EnterpriseSolutionOut]])
async def list_solutions(
    session: SessionDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = None,
    category: str | None = None,
    industry: str | None = None,
    scenario: str | None = None,
    sort: str = Query("recommended", pattern="^(recommended|cases)$"),
):
    items, total = await EnterpriseSolutionService(session).list_public_solutions(
        page=page,
        page_size=page_size,
        q=q,
        category=category,
        industry=industry,
        scenario=scenario,
        sort=sort,
    )
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@router.get("/home", response_model=ApiResponse[list[EnterpriseSolutionOut]])
async def list_home_solutions(session: SessionDep, limit: int = Query(3, ge=1, le=12)):
    return ApiResponse(data=await EnterpriseSolutionService(session).list_home_solutions(limit))


@router.get("/{solution_id}", response_model=ApiResponse[EnterpriseSolutionOut])
async def get_solution(solution_id: int, session: SessionDep):
    return ApiResponse(data=await EnterpriseSolutionService(session).get_public_solution(solution_id))


company_router = APIRouter(prefix="/companies/{company_id}/solutions", tags=["company-solutions"])


@company_router.get("", response_model=ApiResponse[Paginated[EnterpriseSolutionOut]])
async def list_company_solutions(
    company_id: int,
    session: SessionDep,
    current_user: CurrentUserDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    items, total = await EnterpriseSolutionService(session).list_company_solutions(
        company_id, current_user, page, page_size
    )
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@company_router.post("", response_model=ApiResponse[EnterpriseSolutionOut])
async def create_company_solution(
    company_id: int,
    payload: EnterpriseSolutionCreate,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = EnterpriseSolutionService(session)
    solution = await service.create_solution(company_id, current_user, payload)
    return ApiResponse(data=service.to_out(solution))


@company_router.post("/{solution_id}/submit", response_model=ApiResponse[EnterpriseSolutionOut])
async def submit_company_solution(
    company_id: int,
    solution_id: int,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = EnterpriseSolutionService(session)
    solution = await service.submit_solution(company_id, solution_id, current_user)
    return ApiResponse(data=service.to_out(solution))
