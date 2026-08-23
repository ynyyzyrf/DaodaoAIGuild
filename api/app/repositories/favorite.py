from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.favorite import Favorite


class FavoriteRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: int, target_type: str, target_id: int) -> Favorite | None:
        stmt = select(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.target_type == target_type,
            Favorite.target_id == target_id,
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def add(self, user_id: int, target_type: str, target_id: int) -> Favorite:
        fav = Favorite(user_id=user_id, target_type=target_type, target_id=target_id)
        self.session.add(fav)
        await self.session.commit()
        return fav

    async def remove(self, fav: Favorite) -> None:
        await self.session.delete(fav)
        await self.session.commit()

    async def count(self, target_type: str, target_id: int) -> int:
        stmt = select(func.count()).select_from(Favorite).where(
            Favorite.target_type == target_type, Favorite.target_id == target_id
        )
        return (await self.session.execute(stmt)).scalar_one()

    async def count_batch(self, target_type: str, target_ids: list[int]) -> dict[int, int]:
        if not target_ids:
            return {}
        stmt = (
            select(Favorite.target_id, func.count())
            .where(Favorite.target_type == target_type, Favorite.target_id.in_(target_ids))
            .group_by(Favorite.target_id)
        )
        return {tid: cnt for tid, cnt in (await self.session.execute(stmt)).all()}
