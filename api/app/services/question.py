from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApiError
from app.models.question import Question
from app.models.user import User
from app.repositories.answer import AnswerRepository
from app.repositories.attachment import AttachmentRepository
from app.repositories.question import QuestionRepository
from app.repositories.tag import TagRepository
from app.repositories.user import UserRepository
from app.repositories.vote import VoteRepository
from app.schemas.question import AnswerOut, QuestionCreate, QuestionOut
from app.schemas.upload import AttachmentOut
from app.schemas.user import UserOut, masked_author
from app.services.gamification import process_event


def _answer_out(a, author, vote_count: int) -> AnswerOut:
    return AnswerOut(
        id=a.id,
        question_id=a.question_id,
        author_id=a.author_id,
        content=a.content,
        is_accepted=a.is_accepted,
        created_at=a.created_at,
        updated_at=a.updated_at,
        author=UserOut.model_validate(author) if author else None,
        vote_count=vote_count,
    )


def _question_out(q, author, tags, answer_count, vote_count, answers, attachments) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        author_id=q.author_id,
        title=q.title,
        description=q.description,
        scenario=q.scenario,
        tools=q.tools,
        error_info=q.error_info,
        status=q.status,
        is_anonymous=q.is_anonymous,
        view_count=q.view_count,
        created_at=q.created_at,
        updated_at=q.updated_at,
        author=masked_author(author, q.is_anonymous),
        tags=tags,
        answer_count=answer_count,
        vote_count=vote_count,
        answers=answers,
        attachments=attachments,
    )


async def _build_detail(session: AsyncSession, q: Question) -> QuestionOut:
    author = await UserRepository(session).get_by_id(q.author_id)
    tags = await TagRepository(session).tags_for("question", q.id)
    vote_count = await VoteRepository(session).count("question", q.id)
    answers = await AnswerRepository(session).list_by_question(q.id)
    attachments = await AttachmentRepository(session).list_by_target("question", q.id)
    answer_outs = []
    for a in answers:
        a_author = await UserRepository(session).get_by_id(a.author_id)
        a_vote = await VoteRepository(session).count("answer", a.id)
        answer_outs.append(_answer_out(a, a_author, a_vote))
    return _question_out(
        q,
        author,
        tags,
        len(answers),
        vote_count,
        answer_outs,
        [AttachmentOut.model_validate(x) for x in attachments],
    )


async def create_question(session: AsyncSession, author_id: int, payload: QuestionCreate) -> QuestionOut:
    if payload.is_anonymous:
        user = await UserRepository(session).get_by_id(author_id)
        if user is not None:
            await UserRepository(session).ensure_anon_number(user)
    q = await QuestionRepository(session).create(
        author_id=author_id,
        title=payload.title,
        description=payload.description,
        scenario=payload.scenario,
        tools=payload.tools,
        error_info=payload.error_info,
        is_anonymous=payload.is_anonymous,
    )
    if payload.tags:
        await TagRepository(session).assign_tags("question", q.id, payload.tags)
    if payload.attachments:
        await AttachmentRepository(session).link(
            payload.attachments, target_type="question", target_id=q.id
        )
    await process_event(session, author_id, "question_created")
    return await _build_detail(session, q)


async def list_questions(
    session: AsyncSession,
    page: int,
    page_size: int,
    tag: str | None = None,
    status: str | None = None,
) -> tuple[list[QuestionOut], int]:
    items, total = await QuestionRepository(session).list(
        page=page, page_size=page_size, tag=tag, status=status
    )
    ids = [q.id for q in items]
    author_ids = list({q.author_id for q in items})
    authors = await UserRepository(session).get_batch(author_ids)
    tags_map = await TagRepository(session).tags_for_batch("question", ids)
    vote_map = await VoteRepository(session).count_batch("question", ids)
    answer_map = await AnswerRepository(session).count_batch(ids)
    outs = [
        _question_out(
            q,
            authors.get(q.author_id),
            tags_map.get(q.id, []),
            answer_map.get(q.id, 0),
            vote_map.get(q.id, 0),
            [],
            [],
        )
        for q in items
    ]
    return outs, total


async def list_questions_by_author(
    session: AsyncSession, author_id: int, limit: int = 5
) -> list[QuestionOut]:
    """个人页：某骑士最近发布的问题（列表摘要，不含附件/回答）。"""
    items = await QuestionRepository(session).list_by_author(author_id, limit)
    ids = [q.id for q in items]
    authors = await UserRepository(session).get_batch([author_id])
    tags_map = await TagRepository(session).tags_for_batch("question", ids)
    vote_map = await VoteRepository(session).count_batch("question", ids)
    answer_map = await AnswerRepository(session).count_batch(ids)
    return [
        _question_out(
            q,
            authors.get(q.author_id),
            tags_map.get(q.id, []),
            answer_map.get(q.id, 0),
            vote_map.get(q.id, 0),
            [],
            [],
        )
        for q in items
    ]


async def get_question_detail(session: AsyncSession, question_id: int, increment_view: bool = True) -> QuestionOut:
    q = await QuestionRepository(session).get_by_id(question_id)
    if q is None:
        raise ApiError(code=40002, message="问题不存在", status_code=404)
    if increment_view:
        await QuestionRepository(session).increment_view(q)
    return await _build_detail(session, q)


async def create_answer(session: AsyncSession, question_id: int, author_id: int, content: str) -> AnswerOut:
    q = await QuestionRepository(session).get_by_id(question_id)
    if q is None:
        raise ApiError(code=40002, message="问题不存在", status_code=404)
    a = await AnswerRepository(session).create(question_id=question_id, author_id=author_id, content=content)
    author = await UserRepository(session).get_by_id(author_id)
    await process_event(session, author_id, "answer_created")
    return _answer_out(a, author, 0)


async def accept_answer(session: AsyncSession, question_id: int, answer_id: int, current_user: User) -> None:
    q = await QuestionRepository(session).get_by_id(question_id)
    if q is None:
        raise ApiError(code=40002, message="问题不存在", status_code=404)
    if q.author_id != current_user.id:
        raise ApiError(code=42001, message="只有问题作者可以采纳回答", status_code=403)
    answer = await AnswerRepository(session).get_by_id(answer_id)
    if answer is None or answer.question_id != question_id:
        raise ApiError(code=40002, message="回答不存在", status_code=404)
    await AnswerRepository(session).accept(question_id, answer_id)
    q.status = "resolved"
    await session.commit()
    await process_event(session, answer.author_id, "answer_accepted")
