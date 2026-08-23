from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, SessionDep
from app.core.exceptions import ApiError
from app.repositories.question import QuestionRepository
from app.schemas.common import ApiResponse, Paginated
from app.schemas.question import AcceptRequest, AnswerCreate, AnswerOut, QuestionCreate, QuestionOut, ToggleResponse
from app.services import question as question_service
from app.services import reactions

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("", response_model=ApiResponse[Paginated[QuestionOut]])
async def list_questions(
    session: SessionDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tag: str | None = None,
    status: str | None = None,
):
    items, total = await question_service.list_questions(session, page, page_size, tag=tag, status=status)
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@router.post("", response_model=ApiResponse[QuestionOut])
async def create_question(payload: QuestionCreate, session: SessionDep, current_user: CurrentUserDep):
    out = await question_service.create_question(session, current_user.id, payload)
    return ApiResponse(data=out)


@router.get("/{question_id}", response_model=ApiResponse[QuestionOut])
async def get_question(question_id: int, session: SessionDep):
    out = await question_service.get_question_detail(session, question_id)
    return ApiResponse(data=out)


@router.post("/{question_id}/answers", response_model=ApiResponse[AnswerOut])
async def create_answer(question_id: int, payload: AnswerCreate, session: SessionDep, current_user: CurrentUserDep):
    out = await question_service.create_answer(session, question_id, current_user.id, payload.content)
    return ApiResponse(data=out)


@router.post("/{question_id}/accept", response_model=ApiResponse[dict])
async def accept_answer(question_id: int, payload: AcceptRequest, session: SessionDep, current_user: CurrentUserDep):
    await question_service.accept_answer(session, question_id, payload.answer_id, current_user)
    return ApiResponse(data={"status": "ok"})


@router.post("/{question_id}/vote", response_model=ApiResponse[ToggleResponse])
async def vote_question(question_id: int, session: SessionDep, current_user: CurrentUserDep):
    if await QuestionRepository(session).get_by_id(question_id) is None:
        raise ApiError(code=40002, message="问题不存在", status_code=404)
    result = await reactions.toggle_vote(session, current_user.id, "question", question_id)
    return ApiResponse(data=result)


@router.post("/{question_id}/favorite", response_model=ApiResponse[ToggleResponse])
async def favorite_question(question_id: int, session: SessionDep, current_user: CurrentUserDep):
    if await QuestionRepository(session).get_by_id(question_id) is None:
        raise ApiError(code=40002, message="问题不存在", status_code=404)
    result = await reactions.toggle_favorite(session, current_user.id, "question", question_id)
    return ApiResponse(data=result)
