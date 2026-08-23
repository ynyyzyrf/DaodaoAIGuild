from fastapi import APIRouter, Query

from app.api.deps import SessionDep
from app.repositories.answer import AnswerRepository
from app.repositories.question import QuestionRepository
from app.repositories.tutorial import TutorialRepository
from app.repositories.user import UserRepository
from app.schemas.common import ApiResponse
from app.schemas.feed import FeedItemOut
from app.schemas.user import masked_author

router = APIRouter(prefix="/home", tags=["home"])


@router.get("/feed", response_model=ApiResponse[list[FeedItemOut]])
async def feed(session: SessionDep, limit: int = Query(6, ge=1, le=20)):
    """首页「社區正在發生」：聚合最近的问题 / 教程 / 被采纳回答，按时间倒序取前 N 条。"""
    q_repo = QuestionRepository(session)
    t_repo = TutorialRepository(session)
    a_repo = AnswerRepository(session)

    questions = await q_repo.recent(limit)
    tutorials = await t_repo.recent(limit)
    accepted = await a_repo.recent_accepted(limit)

    raw = []
    for q in questions:
        raw.append(
            {
                "created_at": q.created_at,
                "kind": "question",
                "id": q.id,
                "slug": "",
                "title": q.title,
                "author_id": q.author_id,
                "is_anonymous": q.is_anonymous,
            }
        )
    for t in tutorials:
        raw.append(
            {
                "created_at": t.created_at,
                "kind": "tutorial",
                "id": t.id,
                "slug": t.slug,
                "title": t.title,
                "author_id": t.author_id,
                "is_anonymous": False,
            }
        )
    for a, q in accepted:
        raw.append(
            {
                # 显示实际采纳时间；历史采纳的旧行 accepted_at 为空，回退到回答创建时间
                "created_at": a.accepted_at or a.created_at,
                "kind": "rescue",
                "id": q.id,
                "slug": "",
                "title": q.title,
                "author_id": a.author_id,
                # 仅当匿名提问者自答并自采时掩码；其他骑士救援匿名问题应正常展示身份
                "is_anonymous": q.is_anonymous and a.author_id == q.author_id,
            }
        )

    # 同一问题既在「question」又在「rescue」出现时，rescue 更具体（含采纳动作），保留 rescue 去重
    rescue_ids = {item["id"] for item in raw if item["kind"] == "rescue"}
    raw = [item for item in raw if item["kind"] != "question" or item["id"] not in rescue_ids]

    raw.sort(key=lambda item: item["created_at"], reverse=True)
    raw = raw[:limit]

    author_ids = list({item["author_id"] for item in raw})
    authors = await UserRepository(session).get_batch(author_ids)

    items = [
        FeedItemOut(
            kind=item["kind"],
            id=item["id"],
            slug=item["slug"],
            title=item["title"],
            author=masked_author(authors.get(item["author_id"]), item["is_anonymous"]),
            created_at=item["created_at"],
        )
        for item in raw
    ]
    return ApiResponse(data=items)
