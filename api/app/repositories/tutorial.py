from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tutorial import Tutorial
from app.repositories.tag import slugify


class TutorialRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        author_id: int,
        title: str,
        summary: str,
        content: str,
        category: str,
    ) -> Tutorial:
        tutorial = Tutorial(
            author_id=author_id,
            title=title,
            slug=await self._unique_slug(title),
            summary=summary,
            content=content,
            category=category,
        )
        self.session.add(tutorial)
        await self.session.commit()
        await self.session.refresh(tutorial)
        return tutorial

    async def _unique_slug(self, title: str) -> str:
        base = slugify(title)
        slug = base
        n = 2
        while await self.get_by_slug(slug) is not None:
            slug = f"{base}-{n}"
            n += 1
        return slug

    async def get_by_id(self, tutorial_id: int) -> Tutorial | None:
        return await self.session.get(Tutorial, tutorial_id)

    async def get_by_slug(self, slug: str) -> Tutorial | None:
        stmt = select(Tutorial).where(Tutorial.slug == slug)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def recent(self, limit: int = 10) -> list[Tutorial]:
        """首页 feed：最近发布的已发布教程。"""
        stmt = (
            select(Tutorial)
            .where(Tutorial.status == "published")
            .order_by(Tutorial.created_at.desc())
            .limit(limit)
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_by_author(self, author_id: int, limit: int = 5) -> list[Tutorial]:
        stmt = (
            select(Tutorial)
            .where(Tutorial.author_id == author_id)
            .order_by(Tutorial.created_at.desc())
            .limit(limit)
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def list(
        self,
        *,
        page: int,
        page_size: int,
        category: str | None = None,
        author_id: int | None = None,
    ) -> tuple[list[Tutorial], int]:
        """前台列表：默认只展示 published；传 author_id 时展示该作者全部状态（本人草稿可见）。"""
        stmt = select(Tutorial)
        if author_id is not None:
            stmt = stmt.where(
                (Tutorial.author_id == author_id) | (Tutorial.status == "published")
            )
        else:
            stmt = stmt.where(Tutorial.status == "published")
        if category:
            stmt = stmt.where(Tutorial.category == category)

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

        stmt = stmt.order_by(Tutorial.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total

    async def increment_view(self, tutorial: Tutorial) -> None:
        tutorial.view_count += 1
        await self.session.commit()
        await self.session.refresh(tutorial)
