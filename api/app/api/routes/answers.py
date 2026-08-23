from fastapi import APIRouter

from app.api.deps import CurrentUserDep, SessionDep
from app.core.exceptions import ApiError
from app.repositories.answer import AnswerRepository
from app.schemas.common import ApiResponse
from app.schemas.question import ToggleResponse
from app.services import reactions

router = APIRouter(prefix="/answers", tags=["answers"])


@router.post("/{answer_id}/vote", response_model=ApiResponse[ToggleResponse])
async def vote_answer(answer_id: int, session: SessionDep, current_user: CurrentUserDep):
    if await AnswerRepository(session).get_by_id(answer_id) is None:
        raise ApiError(code=40002, message="回答不存在", status_code=404)
    result = await reactions.toggle_vote(session, current_user.id, "answer", answer_id)
    return ApiResponse(data=result)


@router.post("/{answer_id}/favorite", response_model=ApiResponse[ToggleResponse])
async def favorite_answer(answer_id: int, session: SessionDep, current_user: CurrentUserDep):
    if await AnswerRepository(session).get_by_id(answer_id) is None:
        raise ApiError(code=40002, message="回答不存在", status_code=404)
    result = await reactions.toggle_favorite(session, current_user.id, "answer", answer_id)
    return ApiResponse(data=result)
