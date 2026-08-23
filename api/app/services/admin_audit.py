"""管理后台稽核日志服务（docs/3.2.md §5.6）。

设计：手动写入（非中间件自动捕获）。原因：
1. 中间件需在响应后读取 body，异步流处理易出错
2. 手动方式可精准记录 before/after，业务语义清晰
3. 每个写操作显式调用 log()，不会漏记

所有 /api/v1/admin/* 路由的写操作必须调用 AdminAuditService.log()。
"""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import AdminAuditLog


class AdminAuditService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def log(
        self,
        *,
        admin_id: int,
        action: str,
        target_type: str,
        target_id: int | None = None,
        before_value: dict | None = None,
        after_value: dict | None = None,
        reason: str,
        ip: str | None = None,
    ) -> AdminAuditLog:
        entry = AdminAuditLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before_value=_safe_json(before_value),
            after_value=_safe_json(after_value),
            reason=reason,
            ip=ip,
        )
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return entry

    async def list(
        self,
        *,
        page: int,
        page_size: int,
        admin_id: int | None = None,
        target_type: str | None = None,
    ) -> tuple[list[AdminAuditLog], int]:
        from sqlalchemy import func

        stmt = select(AdminAuditLog)
        if admin_id is not None:
            stmt = stmt.where(AdminAuditLog.admin_id == admin_id)
        if target_type:
            stmt = stmt.where(AdminAuditLog.target_type == target_type)

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(AdminAuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total


def _safe_json(value: Any) -> dict | None:
    """确保 before/after 可被 JSON 列存储：过滤不可序列化对象。"""
    if value is None:
        return None
    try:
        import json

        return json.loads(json.dumps(value, default=str, ensure_ascii=False))
    except (TypeError, ValueError):
        return {"_raw": str(value)}
