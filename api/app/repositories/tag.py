import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question
from app.models.tag import Tag, Taggable


def slugify(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9一-鿿_-]+", "-", name).strip("-")
    return name or "tag"


class TagRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create(self, name: str) -> Tag:
        slug = slugify(name)
        result = await self.session.execute(select(Tag).where(Tag.slug == slug))
        tag = result.scalar_one_or_none()
        if tag is None:
            tag = Tag(name=name, slug=slug)
            self.session.add(tag)
            await self.session.flush()
        return tag

    async def assign_tags(self, target_type: str, target_id: int, names: list[str]) -> None:
        for name in names:
            tag = await self.get_or_create(name)
            existing = await self.session.execute(
                select(Taggable).where(
                    Taggable.tag_id == tag.id,
                    Taggable.target_type == target_type,
                    Taggable.target_id == target_id,
                )
            )
            if existing.scalar_one_or_none() is None:
                self.session.add(Taggable(tag_id=tag.id, target_type=target_type, target_id=target_id))
        await self.session.commit()

    async def tags_for(self, target_type: str, target_id: int) -> list[str]:
        stmt = (
            select(Tag.name)
            .join(Taggable, Taggable.tag_id == Tag.id)
            .where(Taggable.target_type == target_type, Taggable.target_id == target_id)
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def tags_for_batch(self, target_type: str, target_ids: list[int]) -> dict[int, list[str]]:
        if not target_ids:
            return {}
        stmt = (
            select(Taggable.target_id, Tag.name)
            .join(Tag, Tag.id == Taggable.tag_id)
            .where(Taggable.target_type == target_type, Taggable.target_id.in_(target_ids))
        )
        result: dict[int, list[str]] = {}
        for target_id, name in (await self.session.execute(stmt)).all():
            result.setdefault(target_id, []).append(name)
        return result

    async def list_all(self) -> list[Tag]:
        stmt = select(Tag).order_by(Tag.name)
        return list((await self.session.execute(stmt)).scalars().all())

    async def top_tags_by_author(
        self, author_ids: list[int], limit_per_user: int = 3
    ) -> dict[int, list[str]]:
        """排行榜擅長領域：每位作者问题 tag 按出现次数降序取前 N 个。"""
        if not author_ids:
            return {}
        stmt = (
            select(Question.author_id, Tag.name, func.count(Tag.id))
            .join(Taggable, Taggable.target_id == Question.id)
            .join(Tag, Tag.id == Taggable.tag_id)
            .where(Taggable.target_type == "question", Question.author_id.in_(author_ids))
            .group_by(Question.author_id, Tag.name)
            # count 相同按 tag 名兜底，保证同计数时顺序确定
            .order_by(Question.author_id, func.count(Tag.id).desc(), Tag.name.asc())
        )
        result: dict[int, list[str]] = {}
        for author_id, name, _ in (await self.session.execute(stmt)).all():
            bucket = result.setdefault(author_id, [])
            if len(bucket) < limit_per_user:
                bucket.append(name)
        return result
