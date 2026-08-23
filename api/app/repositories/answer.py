from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.question import Question


class AnswerRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, *, question_id: int, author_id: int, content: str) -> Answer:
        answer = Answer(question_id=question_id, author_id=author_id, content=content)
        self.session.add(answer)
        await self.session.commit()
        await self.session.refresh(answer)
        return answer

    async def get_by_id(self, answer_id: int) -> Answer | None:
        return await self.session.get(Answer, answer_id)

    async def list_by_question(self, question_id: int) -> list[Answer]:
        stmt = (
            select(Answer)
            .where(Answer.question_id == question_id)
            .order_by(Answer.is_accepted.desc(), Answer.created_at.asc())
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def accept(self, question_id: int, answer_id: int) -> None:
        # DB 存 naive UTC（server_default=func.now()），这里用 naive UTC 对齐
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.session.execute(
            update(Answer)
            .where(Answer.question_id == question_id)
            .values(is_accepted=False, accepted_at=None)
        )
        await self.session.execute(
            update(Answer)
            .where(Answer.id == answer_id)
            .values(is_accepted=True, accepted_at=now)
        )
        await self.session.commit()

    async def count_batch(self, question_ids: list[int]) -> dict[int, int]:
        if not question_ids:
            return {}
        stmt = (
            select(Answer.question_id, func.count())
            .where(Answer.question_id.in_(question_ids))
            .group_by(Answer.question_id)
        )
        return {qid: cnt for qid, cnt in (await self.session.execute(stmt)).all()}

    async def recent_accepted(self, limit: int = 10) -> list[tuple[Answer, Question]]:
        """首页 feed：最近被采纳的回答，join 问题拿标题/匿名标记。

        按实际采纳时间（accepted_at）倒序；历史采纳过的旧行 accepted_at 为空，
        用 coalesce 回退到回答创建时间兜底。返回 [(answer, question)]。
        """
        stmt = (
            select(Answer, Question)
            .join(Question, Question.id == Answer.question_id)
            .where(Answer.is_accepted.is_(True))
            .order_by(func.coalesce(Answer.accepted_at, Answer.created_at).desc())
            .limit(limit)
        )
        return list((await self.session.execute(stmt)).all())
