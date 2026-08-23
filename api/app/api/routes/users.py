from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, SessionDep
from app.core.exceptions import ApiError
from app.repositories.tag import TagRepository
from app.repositories.user import UserRepository
from app.schemas.common import ApiResponse
from app.schemas.gamification import TitleSetRequest
from app.schemas.question import QuestionOut
from app.schemas.tutorial import TutorialOut
from app.schemas.user import LeaderboardOut, MeOut, UserOut, UserProfileOut
from app.services import gamification
from app.services import question as question_service
from app.services import tutorial as tutorial_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/leaderboard", response_model=ApiResponse[list[LeaderboardOut]])
async def leaderboard(
    session: SessionDep,
    metric: str = Query("reputation", pattern="^(reputation|tutorial|rescue)$"),
    limit: int = Query(8, ge=1, le=50),
):
    """騎士排行榜：按 metric 排序取前 N 名。

    - reputation: 總聲望（声望降序，默认）
    - tutorial:   教程貢獻（教程数量降序）
    - rescue:     本週救援（近 7 天被采纳回答数降序）
    """
    repo = UserRepository(session)
    if metric == "tutorial":
        rows = await repo.top_by_tutorial_count(limit)
    elif metric == "rescue":
        # DB 存的是 naive UTC（server_default=func.now()），这里也用 naive UTC 对齐
        since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)
        rows = await repo.top_by_rescue_count(limit, since)
    else:
        users = await repo.top_by_reputation(limit)
        rows = [(u, u.reputation) for u in users]

    author_ids = [u.id for u, _ in rows]
    top_tags = await TagRepository(session).top_tags_by_author(author_ids, limit_per_user=3)

    outs = [
        LeaderboardOut(
            **UserOut.model_validate(u).model_dump(),
            metric_value=value,
            top_tags=top_tags.get(u.id, []),
        )
        for u, value in rows
    ]
    return ApiResponse(data=outs)


@router.get("/me", response_model=ApiResponse[MeOut])
async def get_me(session: SessionDep, current_user: CurrentUserDep):
    """本人视角：完整游戏化档案 + 最近解锁提示。"""
    profile = await gamification.build_profile(session, current_user, include_recent=True)
    return ApiResponse(data=profile)


@router.post("/me/title", response_model=ApiResponse[MeOut])
async def set_me_title(payload: TitleSetRequest, session: SessionDep, current_user: CurrentUserDep):
    """设置当前展示称号。"""
    await gamification.set_current_title(session, current_user, payload.title_code)
    profile = await gamification.build_profile(session, current_user, include_recent=True)
    return ApiResponse(data=profile)


@router.post("/me/equipment/{equipment_code}/equip", response_model=ApiResponse[MeOut])
async def equip_me(equipment_code: str, session: SessionDep, current_user: CurrentUserDep):
    """穿戴装备（同槽位互斥）。"""
    await gamification.equip(session, current_user, equipment_code)
    profile = await gamification.build_profile(session, current_user, include_recent=True)
    return ApiResponse(data=profile)


@router.post("/me/equipment/{equipment_code}/unequip", response_model=ApiResponse[MeOut])
async def unequip_me(equipment_code: str, session: SessionDep, current_user: CurrentUserDep):
    """卸下装备。"""
    await gamification.unequip(session, current_user, equipment_code)
    profile = await gamification.build_profile(session, current_user, include_recent=True)
    return ApiResponse(data=profile)


@router.get("/{user_id}", response_model=ApiResponse[UserProfileOut])
async def get_user(user_id: int, session: SessionDep):
    user = await UserRepository(session).get_by_id(user_id)
    if user is None:
        raise ApiError(code=40002, message="用户不存在", status_code=404)
    return ApiResponse(data=await gamification.build_profile(session, user))


@router.get("/{user_id}/questions", response_model=ApiResponse[list[QuestionOut]])
async def get_user_questions(user_id: int, session: SessionDep, limit: int = Query(5, ge=1, le=20)):
    if await UserRepository(session).get_by_id(user_id) is None:
        raise ApiError(code=40002, message="用户不存在", status_code=404)
    items = await question_service.list_questions_by_author(session, user_id, limit)
    return ApiResponse(data=items)


@router.get("/{user_id}/tutorials", response_model=ApiResponse[list[TutorialOut]])
async def get_user_tutorials(user_id: int, session: SessionDep, limit: int = Query(5, ge=1, le=20)):
    if await UserRepository(session).get_by_id(user_id) is None:
        raise ApiError(code=40002, message="用户不存在", status_code=404)
    items = await tutorial_service.list_tutorials_by_author(session, user_id, limit)
    return ApiResponse(data=items)
