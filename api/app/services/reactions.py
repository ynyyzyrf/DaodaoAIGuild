from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.answer import AnswerRepository
from app.repositories.favorite import FavoriteRepository
from app.repositories.question import QuestionRepository
from app.repositories.tutorial import TutorialRepository
from app.repositories.vote import VoteRepository
from app.schemas.question import ToggleResponse
from app.services.gamification import process_event


async def _resolve_author_id(session: AsyncSession, target_type: str, target_id: int) -> int | None:
    """按 target 解析内容作者 id，仅支持 question/answer/tutorial。"""
    if target_type == "question":
        obj = await QuestionRepository(session).get_by_id(target_id)
    elif target_type == "answer":
        obj = await AnswerRepository(session).get_by_id(target_id)
    elif target_type == "tutorial":
        obj = await TutorialRepository(session).get_by_id(target_id)
    else:
        return None
    return obj.author_id if obj is not None else None


async def toggle_vote(session: AsyncSession, user_id: int, target_type: str, target_id: int) -> ToggleResponse:
    repo = VoteRepository(session)
    existing = await repo.get(user_id, target_type, target_id)
    if existing:
        await repo.remove(existing)
        active = False
    else:
        await repo.add(user_id, target_type, target_id)
        active = True
        author_id = await _resolve_author_id(session, target_type, target_id)
        if author_id is not None and author_id != user_id:
            await process_event(session, author_id, "content_voted")
    count = await repo.count(target_type, target_id)
    return ToggleResponse(active=active, count=count)


async def toggle_favorite(session: AsyncSession, user_id: int, target_type: str, target_id: int) -> ToggleResponse:
    repo = FavoriteRepository(session)
    existing = await repo.get(user_id, target_type, target_id)
    if existing:
        await repo.remove(existing)
        active = False
    else:
        await repo.add(user_id, target_type, target_id)
        active = True
        author_id = await _resolve_author_id(session, target_type, target_id)
        if author_id is not None and author_id != user_id:
            await process_event(session, author_id, "content_favorited")
    count = await repo.count(target_type, target_id)
    return ToggleResponse(active=active, count=count)
