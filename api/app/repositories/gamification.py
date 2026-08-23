from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification import UserAchievement, UserEquipment, UserTitle


class GamificationRepository:
    """解锁记录（成就/称号/装备）查询与写入。目录数据在 services/gamification.py。"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def achievement_rows(self, user_id: int) -> dict[str, datetime]:
        stmt = select(UserAchievement.achievement_code, UserAchievement.unlocked_at).where(
            UserAchievement.user_id == user_id
        )
        return {code: ts for code, ts in (await self.session.execute(stmt)).all()}

    async def title_rows(self, user_id: int) -> dict[str, datetime]:
        stmt = select(UserTitle.title_code, UserTitle.unlocked_at).where(
            UserTitle.user_id == user_id
        )
        return {code: ts for code, ts in (await self.session.execute(stmt)).all()}

    async def equipment_rows(self, user_id: int) -> dict[str, UserEquipment]:
        stmt = select(UserEquipment).where(UserEquipment.user_id == user_id)
        return {row.equipment_code: row for row in (await self.session.execute(stmt)).scalars().all()}

    async def grant_achievement(self, user_id: int, code: str) -> None:
        self.session.add(UserAchievement(user_id=user_id, achievement_code=code))

    async def grant_title(self, user_id: int, code: str) -> None:
        self.session.add(UserTitle(user_id=user_id, title_code=code))

    async def grant_equipment(self, user_id: int, code: str) -> None:
        self.session.add(UserEquipment(user_id=user_id, equipment_code=code))

    async def set_equipped(self, user_id: int, code: str, equipped: bool) -> None:
        await self.session.execute(
            update(UserEquipment)
            .where(UserEquipment.user_id == user_id, UserEquipment.equipment_code == code)
            .values(is_equipped=equipped)
        )

    async def recent_unlocks(self, user_id: int, limit: int = 6) -> list[dict[str, datetime | str]]:
        """最近解锁：三张表按 unlocked_at 合并倒序取前 N。"""
        rows: list[dict[str, datetime | str]] = []
        for kind, model, code_col in (
            ("achievement", UserAchievement, UserAchievement.achievement_code),
            ("title", UserTitle, UserTitle.title_code),
            ("equipment", UserEquipment, UserEquipment.equipment_code),
        ):
            stmt = (
                select(code_col, model.unlocked_at)
                .where(model.user_id == user_id)
                .order_by(model.unlocked_at.desc())
                .limit(limit)
            )
            rows.extend(
                {"kind": kind, "code": c, "unlocked_at": ts}
                for c, ts in (await self.session.execute(stmt)).all()
            )
        rows.sort(key=lambda r: r["unlocked_at"], reverse=True)
        return rows[:limit]
