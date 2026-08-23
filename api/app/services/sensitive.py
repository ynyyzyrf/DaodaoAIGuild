"""敏感词服务（docs/3.2.md §4.3）。

- 命中策略：warn（标红警告，内容仍发布）/ auto_hide（自动隐藏，进审核队列）
- 匹配方式：MVP 用正则简单匹配；后续可换 AC 自动机
- 缓存：敏感词列表进程内缓存（lru_cache），改词后清缓存
"""
from __future__ import annotations

import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import SensitiveWord

_CACHE: dict[str, list[tuple[str, str]]] | None = None  # {action: [(word, pattern)]}


def _invalidate_cache() -> None:
    global _CACHE
    _CACHE = None


async def _load_cache(session: AsyncSession) -> dict[str, list[tuple[str, str]]]:
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    stmt = select(SensitiveWord.word, SensitiveWord.action).where(SensitiveWord.is_active.is_(True))
    rows = (await session.execute(stmt)).all()
    cache: dict[str, list[tuple[str, str]]] = {"warn": [], "auto_hide": []}
    for word, action in rows:
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        cache[action].append((word, pattern))
    _CACHE = cache
    return cache


async def scan_text(session: AsyncSession, text: str) -> dict[str, list[str]]:
    """扫描文本，返回 {action: [命中的词]}。text 为空返回空 dict。"""
    if not text:
        return {"warn": [], "auto_hide": []}
    cache = await _load_cache(session)
    result: dict[str, list[str]] = {"warn": [], "auto_hide": []}
    for action in ("warn", "auto_hide"):
        for word, pattern in cache[action]:
            if pattern.search(text):
                result[action].append(word)
    return result


class SensitiveWordRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(
        self, *, page: int, page_size: int, is_active: bool | None = None
    ) -> tuple[list[SensitiveWord], int]:
        stmt = select(SensitiveWord)
        if is_active is not None:
            stmt = stmt.where(SensitiveWord.is_active.is_(is_active))
        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(SensitiveWord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total

    async def get_by_word(self, word: str) -> SensitiveWord | None:
        return (
            await self.session.execute(select(SensitiveWord).where(SensitiveWord.word == word))
        ).scalar_one_or_none()

    async def create(
        self, *, word: str, category: str | None, action: str, created_by: int
    ) -> SensitiveWord:
        sw = SensitiveWord(word=word, category=category, action=action, created_by=created_by)
        self.session.add(sw)
        await self.session.commit()
        await self.session.refresh(sw)
        _invalidate_cache()
        return sw

    async def update(
        self, sw: SensitiveWord, *, category: str | None, action: str | None, is_active: bool | None
    ) -> SensitiveWord:
        if category is not None:
            sw.category = category
        if action is not None:
            sw.action = action
        if is_active is not None:
            sw.is_active = is_active
        await self.session.commit()
        await self.session.refresh(sw)
        _invalidate_cache()
        return sw

    async def delete(self, sw: SensitiveWord) -> None:
        await self.session.delete(sw)
        await self.session.commit()
        _invalidate_cache()

    async def bulk_create(
        self, *, words: list[str], category: str | None, action: str, created_by: int
    ) -> int:
        """批量导入：跳过已存在的词，返回新增数量。"""
        existing = set(
            (await self.session.execute(
                select(SensitiveWord.word).where(SensitiveWord.word.in_(words))
            )).scalars().all()
        )
        new_words = [w for w in words if w and w not in existing]
        for w in new_words:
            self.session.add(
                SensitiveWord(word=w, category=category, action=action, created_by=created_by)
            )
        if new_words:
            await self.session.commit()
        _invalidate_cache()
        return len(new_words)
