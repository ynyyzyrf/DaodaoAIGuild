import random
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.question import Question
from app.models.tutorial import Tutorial
from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_username(self, username: str) -> User | None:
        result = await self.session.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def get_batch(self, user_ids: list[int]) -> dict[int, User]:
        if not user_ids:
            return {}
        result = await self.session.execute(select(User).where(User.id.in_(user_ids)))
        return {u.id: u for u in result.scalars().all()}

    async def create(
        self,
        *,
        username: str,
        password_hash: str,
        display_name: str = "",
        is_admin: bool = False,
    ) -> User:
        user = User(
            username=username,
            password_hash=password_hash,
            display_name=display_name,
            is_admin=is_admin,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def ensure_anon_number(self, user: User) -> int:
        """首次匿名发言时为用户生成稳定的随机匿名号（1000-99999），与用户 id 无关。"""
        if user.anon_number is not None:
            return user.anon_number
        for _ in range(20):
            candidate = random.randint(1000, 99999)
            exists = await self.session.execute(select(User.id).where(User.anon_number == candidate))
            if exists.scalar_one_or_none() is None:
                user.anon_number = candidate
                await self.session.commit()
                await self.session.refresh(user)
                return candidate
        raise ValueError("匿名号生成失败，请重试")

    async def top_by_reputation(self, limit: int = 20) -> list[User]:
        stmt = select(User).order_by(User.reputation.desc(), User.id.asc()).limit(limit)
        return list((await self.session.execute(stmt)).scalars().all())

    async def top_by_tutorial_count(self, limit: int = 20) -> list[tuple[User, int]]:
        """排行榜 metric=tutorial：按已发布教程数量降序。返回 [(user, count)]。"""
        stmt = (
            select(User, func.count(Tutorial.id))
            .join(Tutorial, Tutorial.author_id == User.id)
            .where(Tutorial.status == "published")
            .group_by(User.id)
            .order_by(func.count(Tutorial.id).desc(), User.id.asc())
            .limit(limit)
        )
        return list((await self.session.execute(stmt)).all())

    async def top_by_rescue_count(
        self, limit: int = 20, since: datetime | None = None
    ) -> list[tuple[User, int]]:
        """排行榜 metric=rescue：按被采纳回答数降序，可限定时间窗口（本週）。

        窗口按实际采纳时间 accepted_at 过滤（而非回答创建时间 created_at）。
        返回 [(user, count)]。
        """
        stmt = (
            select(User, func.count(Answer.id))
            .join(Answer, Answer.author_id == User.id)
            .where(Answer.is_accepted.is_(True))
            .group_by(User.id)
            .order_by(func.count(Answer.id).desc(), User.id.asc())
            .limit(limit)
        )
        if since is not None:
            stmt = stmt.where(Answer.accepted_at >= since)
        return list((await self.session.execute(stmt)).all())

    async def get_profile_stats(self, user_id: int) -> dict[str, int]:
        async def _count(stmt) -> int:
            return (await self.session.execute(stmt)).scalar_one()

        questions_count = await _count(
            select(func.count()).select_from(Question).where(Question.author_id == user_id)
        )
        answers_count = await _count(
            select(func.count()).select_from(Answer).where(Answer.author_id == user_id)
        )
        tutorials_count = await _count(
            select(func.count()).select_from(Tutorial).where(Tutorial.author_id == user_id)
        )
        accepted_count = await _count(
            select(func.count()).select_from(Answer).where(
                Answer.author_id == user_id, Answer.is_accepted.is_(True)
            )
        )
        return {
            "questions_count": questions_count,
            "answers_count": answers_count,
            "tutorials_count": tutorials_count,
            "accepted_count": accepted_count,
        }

    async def list_content_ids(self, user_id: int) -> dict[str, list[int]]:
        """某骑士发布的 question/answer/tutorial 内容 id 列表（用于统计收到的赞/收藏）。"""
        questions = await self.session.execute(select(Question.id).where(Question.author_id == user_id))
        answers = await self.session.execute(select(Answer.id).where(Answer.author_id == user_id))
        tutorials = await self.session.execute(select(Tutorial.id).where(Tutorial.author_id == user_id))
        return {
            "question": list(questions.scalars().all()),
            "answer": list(answers.scalars().all()),
            "tutorial": list(tutorials.scalars().all()),
        }
