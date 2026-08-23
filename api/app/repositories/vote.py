from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vote import Vote


class VoteRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: int, target_type: str, target_id: int) -> Vote | None:
        stmt = select(Vote).where(
            Vote.user_id == user_id,
            Vote.target_type == target_type,
            Vote.target_id == target_id,
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def add(self, user_id: int, target_type: str, target_id: int) -> Vote:
        vote = Vote(user_id=user_id, target_type=target_type, target_id=target_id, value=1)
        self.session.add(vote)
        await self.session.commit()
        return vote

    async def remove(self, vote: Vote) -> None:
        await self.session.delete(vote)
        await self.session.commit()

    async def count(self, target_type: str, target_id: int) -> int:
        stmt = select(func.count()).select_from(Vote).where(
            Vote.target_type == target_type, Vote.target_id == target_id
        )
        return (await self.session.execute(stmt)).scalar_one()

    async def count_batch(self, target_type: str, target_ids: list[int]) -> dict[int, int]:
        if not target_ids:
            return {}
        stmt = (
            select(Vote.target_id, func.count())
            .where(Vote.target_type == target_type, Vote.target_id.in_(target_ids))
            .group_by(Vote.target_id)
        )
        return {tid: cnt for tid, cnt in (await self.session.execute(stmt)).all()}
