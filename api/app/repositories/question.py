from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.models.tag import Tag, Taggable


class QuestionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        author_id: int,
        title: str,
        description: str = "",
        scenario: str = "",
        tools: list | None = None,
        error_info: str = "",
        is_anonymous: bool = False,
    ) -> Question:
        question = Question(
            author_id=author_id,
            title=title,
            description=description,
            scenario=scenario,
            tools=tools or [],
            error_info=error_info,
            is_anonymous=is_anonymous,
        )
        self.session.add(question)
        await self.session.commit()
        await self.session.refresh(question)
        return question

    async def get_by_id(self, question_id: int) -> Question | None:
        return await self.session.get(Question, question_id)

    async def recent(self, limit: int = 10) -> list[Question]:
        """首页 feed：最近发布的问题。"""
        stmt = select(Question).order_by(Question.created_at.desc()).limit(limit)
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_by_author(self, author_id: int, limit: int = 5) -> list[Question]:
        stmt = (
            select(Question)
            .where(Question.author_id == author_id)
            .order_by(Question.created_at.desc())
            .limit(limit)
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def list(
        self,
        *,
        page: int,
        page_size: int,
        tag: str | None = None,
        status: str | None = None,
    ) -> tuple[list[Question], int]:
        stmt = select(Question)
        if tag:
            tag_subq = (
                select(Taggable.target_id)
                .join(Tag, Tag.id == Taggable.tag_id)
                .where(Taggable.target_type == "question", Tag.slug == tag)
            )
            stmt = stmt.where(Question.id.in_(tag_subq))
        if status:
            stmt = stmt.where(Question.status == status)

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

        stmt = stmt.order_by(Question.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total

    async def increment_view(self, question: Question) -> None:
        question.view_count += 1
        await self.session.commit()
        # `updated_at` 带 onupdate=func.now()，UPDATE 提交后会被标记过期，
        # 必须显式 refresh，否则后续访问会触发 async 外的懒加载（MissingGreenlet）。
        await self.session.refresh(question)
