"""管理后台用户管理服务（docs/3.2.md §5.3）。"""
import secrets
import string
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import to_naive_utc, utc_now
from app.core.security import hash_password
from app.models.answer import Answer
from app.models.company import CompanyMember
from app.models.question import Question
from app.models.tutorial import Tutorial
from app.models.user import User


def _gen_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


class AdminUserService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_users(
        self,
        *,
        page: int,
        page_size: int,
        level: int | None = None,
        is_active: bool | None = None,
        is_admin: bool | None = None,
        active_since: datetime | None = None,
        q: str | None = None,
    ) -> tuple[list[User], int]:
        stmt = select(User)
        if level is not None:
            stmt = stmt.where(User.level == level)
        if is_active is not None:
            stmt = stmt.where(User.is_active.is_(is_active))
        if is_admin is not None:
            stmt = stmt.where(User.is_admin.is_(is_admin))
        if active_since is not None:
            stmt = stmt.where(User.updated_at >= active_since)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(User.username.like(like), User.display_name.like(like)))

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total

    async def get_detail(self, user_id: int) -> tuple[User | None, dict[str, int]]:
        user = await self.session.get(User, user_id)
        if user is None:
            return None, {}

        async def _count(stmt) -> int:
            return (await self.session.execute(stmt)).scalar_one()

        stats = {
            "questions_count": await _count(
                select(func.count()).select_from(Question).where(Question.author_id == user_id)
            ),
            "answers_count": await _count(
                select(func.count()).select_from(Answer).where(Answer.author_id == user_id)
            ),
            "tutorials_count": await _count(
                select(func.count()).select_from(Tutorial).where(Tutorial.author_id == user_id)
            ),
            "accepted_count": await _count(
                select(func.count())
                .select_from(Answer)
                .where(Answer.author_id == user_id, Answer.is_accepted.is_(True))
            ),
        }
        return user, stats

    async def update_user(
        self,
        user: User,
        *,
        is_active: bool | None = None,
        level: int | None = None,
        reputation: int | None = None,
        is_verified_fde: bool | None = None,
    ) -> User:
        if is_active is not None:
            user.is_active = is_active
        if level is not None:
            user.level = level
        if reputation is not None:
            user.reputation = reputation
        if is_verified_fde is not None:
            user.is_verified_fde = is_verified_fde
            if is_verified_fde:
                await self._activate_single_company_role_as_fde(user.id)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def _activate_single_company_role_as_fde(self, user_id: int) -> None:
        active = (
            await self.session.execute(
                select(CompanyMember).where(
                    CompanyMember.user_id == user_id,
                    CompanyMember.fde_status == "active",
                )
            )
        ).scalar_one_or_none()
        if active is not None:
            return

        result = await self.session.execute(
            select(CompanyMember).where(
                CompanyMember.user_id == user_id,
                CompanyMember.company_role.in_(["owner", "admin"]),
            )
        )
        role_members = list(result.scalars().all())
        if len(role_members) != 1:
            return

        member = role_members[0]
        if member.fde_status != "none":
            return
        member.fde_status = "active"
        member.fde_joined_at = member.fde_joined_at or to_naive_utc(utc_now())
        member.fde_exited_at = None

    async def reset_password(self, user: User) -> str:
        new_password = _gen_password()
        user.password_hash = hash_password(new_password)
        await self.session.commit()
        return new_password

    async def soft_delete(self, user: User) -> User:
        """软删除：匿名化身份字段，停用账号，保留记录。"""
        user.display_name = f"已注销用户{user.id}"
        user.avatar_url = ""
        user.bio = ""
        user.is_active = False
        await self.session.commit()
        await self.session.refresh(user)
        return user
