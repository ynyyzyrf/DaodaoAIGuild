from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApiError
from app.models.tutorial import Tutorial
from app.repositories.tutorial import TutorialRepository
from app.repositories.user import UserRepository
from app.repositories.vote import VoteRepository
from app.schemas.question import ToggleResponse
from app.schemas.tutorial import TutorialCreate, TutorialDetailOut, TutorialOut
from app.schemas.user import UserOut
from app.services import reactions
from app.services.gamification import process_event


def _tutorial_out(t: Tutorial, author, like_count: int) -> TutorialOut:
    return TutorialOut(
        id=t.id,
        author_id=t.author_id,
        title=t.title,
        slug=t.slug,
        summary=t.summary,
        category=t.category,
        status=t.status,
        view_count=t.view_count,
        like_count=like_count,
        created_at=t.created_at,
        updated_at=t.updated_at,
        author=UserOut.model_validate(author) if author else None,
    )


def _tutorial_detail_out(t: Tutorial, author, like_count: int) -> TutorialDetailOut:
    return TutorialDetailOut(
        id=t.id,
        author_id=t.author_id,
        title=t.title,
        slug=t.slug,
        summary=t.summary,
        content=t.content,
        category=t.category,
        status=t.status,
        view_count=t.view_count,
        like_count=like_count,
        created_at=t.created_at,
        updated_at=t.updated_at,
        author=UserOut.model_validate(author) if author else None,
    )


async def create_tutorial(session: AsyncSession, author_id: int, payload: TutorialCreate) -> TutorialDetailOut:
    t = await TutorialRepository(session).create(
        author_id=author_id,
        title=payload.title,
        summary=payload.summary,
        content=payload.content,
        category=payload.category,
    )
    author = await UserRepository(session).get_by_id(author_id)
    await process_event(session, author_id, "tutorial_created")
    return _tutorial_detail_out(t, author, 0)


async def list_tutorials(
    session: AsyncSession,
    page: int,
    page_size: int,
    category: str | None = None,
) -> tuple[list[TutorialOut], int]:
    items, total = await TutorialRepository(session).list(page=page, page_size=page_size, category=category)
    ids = [t.id for t in items]
    author_ids = list({t.author_id for t in items})
    authors = await UserRepository(session).get_batch(author_ids)
    like_map = await VoteRepository(session).count_batch("tutorial", ids)
    outs = [_tutorial_out(t, authors.get(t.author_id), like_map.get(t.id, 0)) for t in items]
    return outs, total


async def list_tutorials_by_author(
    session: AsyncSession, author_id: int, limit: int = 5
) -> list[TutorialOut]:
    """个人页：某骑士最近发布的教程。"""
    items = await TutorialRepository(session).list_by_author(author_id, limit)
    ids = [t.id for t in items]
    author = await UserRepository(session).get_by_id(author_id)
    like_map = await VoteRepository(session).count_batch("tutorial", ids)
    return [_tutorial_out(t, author, like_map.get(t.id, 0)) for t in items]


async def get_tutorial_detail(session: AsyncSession, slug: str) -> TutorialDetailOut:
    t = await TutorialRepository(session).get_by_slug(slug)
    if t is None:
        raise ApiError(code=40002, message="教程不存在", status_code=404)
    await TutorialRepository(session).increment_view(t)
    author = await UserRepository(session).get_by_id(t.author_id)
    like_count = await VoteRepository(session).count("tutorial", t.id)
    return _tutorial_detail_out(t, author, like_count)


async def toggle_like(session: AsyncSession, user_id: int, tutorial_id: int) -> ToggleResponse:
    t = await TutorialRepository(session).get_by_id(tutorial_id)
    if t is None:
        raise ApiError(code=40002, message="教程不存在", status_code=404)
    return await reactions.toggle_vote(session, user_id, "tutorial", tutorial_id)
