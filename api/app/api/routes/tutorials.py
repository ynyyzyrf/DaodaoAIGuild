from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, SessionDep
from app.core.exceptions import ApiError
from app.repositories.tutorial import TutorialRepository
from app.schemas.common import ApiResponse, Paginated
from app.schemas.question import ToggleResponse
from app.schemas.tutorial import TutorialCreate, TutorialDetailOut, TutorialOut
from app.services import tutorial as tutorial_service

router = APIRouter(prefix="/tutorials", tags=["tutorials"])

CATEGORIES = [
    "AI Agent",
    "FDE 落地",
    "RAG 检索增强",
    "提示词工程",
    "工作流自动化",
    "部署与运维",
    "多模态",
    "案例复盘",
]


@router.get("/categories", response_model=ApiResponse[list[str]])
async def list_categories():
    return ApiResponse(data=CATEGORIES)


@router.get("", response_model=ApiResponse[Paginated[TutorialOut]])
async def list_tutorials(
    session: SessionDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = None,
):
    items, total = await tutorial_service.list_tutorials(session, page, page_size, category=category)
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@router.post("", response_model=ApiResponse[TutorialDetailOut])
async def create_tutorial(payload: TutorialCreate, session: SessionDep, current_user: CurrentUserDep):
    out = await tutorial_service.create_tutorial(session, current_user.id, payload)
    return ApiResponse(data=out)


@router.get("/{slug}", response_model=ApiResponse[TutorialDetailOut])
async def get_tutorial(slug: str, session: SessionDep):
    out = await tutorial_service.get_tutorial_detail(session, slug)
    return ApiResponse(data=out)


@router.post("/{tutorial_id}/like", response_model=ApiResponse[ToggleResponse])
async def like_tutorial(tutorial_id: int, session: SessionDep, current_user: CurrentUserDep):
    if await TutorialRepository(session).get_by_id(tutorial_id) is None:
        raise ApiError(code=40002, message="教程不存在", status_code=404)
    result = await tutorial_service.toggle_like(session, current_user.id, tutorial_id)
    return ApiResponse(data=result)
