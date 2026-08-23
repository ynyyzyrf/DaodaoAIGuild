"""内容审核服务（docs/3.2.md §4 / §5.4）。

审核对象：question / answer / tutorial
- question/answer：先发后审，被举报或敏感词命中才进队列
- tutorial：预审，新建默认 pending，必须管理员通过才 published
"""
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ApiError
from app.models.admin import ContentReport
from app.models.answer import Answer
from app.models.question import Question
from app.models.tutorial import Tutorial
from app.models.user import User
from app.services.sensitive import scan_text

TARGET_QUESTION = "question"
TARGET_ANSWER = "answer"
TARGET_TUTORIAL = "tutorial"
VALID_TARGETS = {TARGET_QUESTION, TARGET_ANSWER, TARGET_TUTORIAL}


class ModerationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ---------- 列表 ----------

    async def list_queue(
        self,
        *,
        page: int,
        page_size: int,
        target_type: str | None = None,
        status: str | None = None,
    ) -> tuple[list[dict], int]:
        """聚合查询待审核内容。MVP 简化：分别查三类再合并排序。"""
        # tutorial pending（预审）
        tutorials = []
        if target_type in (None, TARGET_TUTORIAL):
            t_stmt = select(Tutorial)
            if status:
                t_stmt = t_stmt.where(Tutorial.status == status)
            else:
                # 默认只看待审 + 被隐藏
                t_stmt = t_stmt.where(Tutorial.status.in_(["pending", "hidden"]))
            tutorials = list((await self.session.execute(t_stmt.order_by(Tutorial.created_at.desc()))).scalars().all())

        # 被举报的 question / answer
        reports_map: dict[tuple[str, int], list[ContentReport]] = {}
        report_stmt = select(ContentReport).where(ContentReport.status == "pending")
        reports = list((await self.session.execute(report_stmt)).scalars().all())
        for r in reports:
            reports_map.setdefault((r.target_type, r.target_id), []).append(r)

        items: list[dict] = []
        # tutorial 项
        author_ids = {t.author_id for t in tutorials}
        authors = await self._batch_users(author_ids)
        for t in tutorials:
            trigger = "pre_review" if t.status == "pending" else "report"
            items.append({
                "id": 0,  # 占位，前端用 target_type+target_id 定位
                "target_type": TARGET_TUTORIAL,
                "target_id": t.id,
                "title": t.title,
                "author_id": t.author_id,
                "author_name": authors.get(t.author_id, "").display_name if authors.get(t.author_id) else "",
                "status": t.status,
                "trigger_reason": trigger,
                "created_at": t.created_at,
                "view_count": t.view_count,
                "like_count": 0,
                "report_count": len(reports_map.get((TARGET_TUTORIAL, t.id), [])),
                "matched_words": [],
            })

        # question / answer 举报项
        if target_type in (None, TARGET_QUESTION):
            q_ids = [tid for (ttype, tid) in reports_map if ttype == TARGET_QUESTION]
            if q_ids:
                qs = list((await self.session.execute(
                    select(Question).where(Question.id.in_(q_ids))
                )).scalars().all())
                q_authors = await self._batch_users({q.author_id for q in qs})
                for q in qs:
                    reports_q = reports_map.get((TARGET_QUESTION, q.id), [])
                    matched = await scan_text(self.session, f"{q.title} {q.description}")
                    items.append({
                        "id": 0,
                        "target_type": TARGET_QUESTION,
                        "target_id": q.id,
                        "title": q.title,
                        "author_id": q.author_id,
                        "author_name": q_authors.get(q.author_id, "").display_name if q_authors.get(q.author_id) else "",
                        "status": q.status,
                        "trigger_reason": "report",
                        "created_at": q.created_at,
                        "view_count": q.view_count,
                        "like_count": 0,
                        "report_count": len(reports_q),
                        "matched_words": matched.get("warn", []) + matched.get("auto_hide", []),
                    })

        if target_type in (None, TARGET_ANSWER):
            a_ids = [tid for (ttype, tid) in reports_map if ttype == TARGET_ANSWER]
            if a_ids:
                ans = list((await self.session.execute(
                    select(Answer).where(Answer.id.in_(a_ids))
                )).scalars().all())
                a_authors = await self._batch_users({a.author_id for a in ans})
                for a in ans:
                    reports_a = reports_map.get((TARGET_ANSWER, a.id), [])
                    matched = await scan_text(self.session, a.content)
                    items.append({
                        "id": 0,
                        "target_type": TARGET_ANSWER,
                        "target_id": a.id,
                        "title": a.content[:80],
                        "author_id": a.author_id,
                        "author_name": a_authors.get(a.author_id, "").display_name if a_authors.get(a.author_id) else "",
                        "status": "open",
                        "trigger_reason": "report",
                        "created_at": a.created_at,
                        "view_count": 0,
                        "like_count": 0,
                        "report_count": len(reports_a),
                        "matched_words": matched.get("warn", []) + matched.get("auto_hide", []),
                    })

        items.sort(key=lambda x: x["created_at"], reverse=True)
        total = len(items)
        start = (page - 1) * page_size
        return items[start : start + page_size], total

    async def get_detail(self, target_type: str, target_id: int) -> dict:
        if target_type not in VALID_TARGETS:
            raise ApiError(code=40001, message="非法的内容类型", status_code=400)

        if target_type == TARGET_TUTORIAL:
            t = await self.session.get(Tutorial, target_id)
            if t is None:
                raise ApiError(code=40002, message="内容不存在", status_code=404)
            author = await self.session.get(User, t.author_id)
            matched = await scan_text(self.session, f"{t.title} {t.summary} {t.content}")
            return {
                "target_type": TARGET_TUTORIAL,
                "target_id": t.id,
                "title": t.title,
                "content": t.content,
                "author_id": t.author_id,
                "author_name": author.display_name if author else "",
                "status": t.status,
                "created_at": t.created_at,
                "trigger_reason": "pre_review" if t.status == "pending" else "report",
                "reports": [],
                "matched_words": matched.get("warn", []) + matched.get("auto_hide", []),
            }

        if target_type == TARGET_QUESTION:
            q = await self.session.get(Question, target_id)
            if q is None:
                raise ApiError(code=40002, message="内容不存在", status_code=404)
            author = await self.session.get(User, q.author_id)
            reports = await self._reports_for(TARGET_QUESTION, q.id)
            matched = await scan_text(self.session, f"{q.title} {q.description}")
            return {
                "target_type": TARGET_QUESTION,
                "target_id": q.id,
                "title": q.title,
                "content": q.description,
                "author_id": q.author_id,
                "author_name": author.display_name if author else "",
                "status": q.status,
                "created_at": q.created_at,
                "trigger_reason": "report",
                "reports": reports,
                "matched_words": matched.get("warn", []) + matched.get("auto_hide", []),
            }

        # answer
        a = await self.session.get(Answer, target_id)
        if a is None:
            raise ApiError(code=40002, message="内容不存在", status_code=404)
        author = await self.session.get(User, a.author_id)
        reports = await self._reports_for(TARGET_ANSWER, a.id)
        matched = await scan_text(self.session, a.content)
        return {
            "target_type": TARGET_ANSWER,
            "target_id": a.id,
            "title": a.content[:80],
            "content": a.content,
            "author_id": a.author_id,
            "author_name": author.display_name if author else "",
            "status": "open",
            "created_at": a.created_at,
            "trigger_reason": "report",
            "reports": reports,
            "matched_words": matched.get("warn", []) + matched.get("auto_hide", []),
        }

    # ---------- 操作 ----------

    async def approve(self, target_type: str, target_id: int) -> dict:
        """通过：tutorial → published；question/answer → 标记举报为 handled。"""
        if target_type == TARGET_TUTORIAL:
            t = await self.session.get(Tutorial, target_id)
            if t is None:
                raise ApiError(code=40002, message="内容不存在", status_code=404)
            before = {"status": t.status}
            t.status = "published"
            await self.session.commit()
            await self._resolve_reports(target_type, target_id)
            return {"before": before, "after": {"status": t.status}}
        # question/answer 通过 = 举报 dismissed
        await self._resolve_reports(target_type, target_id, dismissed=True)
        return {"before": {}, "after": {"reports": "dismissed"}}

    async def hide(self, target_type: str, target_id: int) -> dict:
        """隐藏：tutorial → hidden；question/answer MVP 暂不实现隐藏态，软删。"""
        if target_type == TARGET_TUTORIAL:
            t = await self.session.get(Tutorial, target_id)
            if t is None:
                raise ApiError(code=40002, message="内容不存在", status_code=404)
            before = {"status": t.status}
            t.status = "hidden"
            await self.session.commit()
            await self._resolve_reports(target_type, target_id)
            return {"before": before, "after": {"status": t.status}}
        # question / answer：MVP 用软删除（deleted_at 不存在，这里改 status）
        # 简化：question 有 status，可设 closed；answer 无 status，仅处理举报
        if target_type == TARGET_QUESTION:
            q = await self.session.get(Question, target_id)
            if q is None:
                raise ApiError(code=40002, message="内容不存在", status_code=404)
            before = {"status": q.status}
            q.status = "closed"
            await self.session.commit()
            await self._resolve_reports(target_type, target_id)
            return {"before": before, "after": {"status": q.status}}
        # answer 无独立状态，仅标记举报处理
        await self._resolve_reports(target_type, target_id)
        return {"before": {}, "after": {"reports": "handled"}}

    async def delete(self, target_type: str, target_id: int) -> dict:
        """软删除：从对应表删除（MVP 无 deleted_at，直接 delete；保留 audit 记录）。"""
        model_map = {TARGET_QUESTION: Question, TARGET_ANSWER: Answer, TARGET_TUTORIAL: Tutorial}
        obj = await self.session.get(model_map[target_type], target_id)
        if obj is None:
            raise ApiError(code=40002, message="内容不存在", status_code=404)
        before = {"status": getattr(obj, "status", "n/a")}
        await self.session.delete(obj)
        await self.session.commit()
        await self._resolve_reports(target_type, target_id)
        return {"before": before, "after": {"deleted": True}}

    async def reject(self, target_type: str, target_id: int) -> dict:
        """打回（仅教程）：status → draft，用户可重新提交。"""
        if target_type != TARGET_TUTORIAL:
            raise ApiError(code=40001, message="只有教程可以打回", status_code=400)
        t = await self.session.get(Tutorial, target_id)
        if t is None:
            raise ApiError(code=40002, message="内容不存在", status_code=404)
        before = {"status": t.status}
        t.status = "draft"
        await self.session.commit()
        return {"before": before, "after": {"status": t.status}}

    # ---------- 内部 ----------

    async def _batch_users(self, user_ids: set[int]) -> dict[int, User]:
        if not user_ids:
            return {}
        rows = await self.session.execute(select(User).where(User.id.in_(list(user_ids))))
        return {u.id: u for u in rows.scalars().all()}

    async def _reports_for(self, target_type: str, target_id: int) -> list[dict]:
        stmt = select(ContentReport).where(
            ContentReport.target_type == target_type, ContentReport.target_id == target_id
        )
        reports = list((await self.session.execute(stmt)).scalars().all())
        reporter_ids = {r.reporter_id for r in reports}
        reporters = await self._batch_users(reporter_ids)
        return [
            {
                "reporter_id": r.reporter_id,
                "reporter_name": reporters.get(r.reporter_id, "").display_name if reporters.get(r.reporter_id) else "",
                "reason": r.reason or "",
                "created_at": r.created_at.isoformat(),
            }
            for r in reports
        ]

    async def _resolve_reports(
        self, target_type: str, target_id: int, *, dismissed: bool = False
    ) -> None:
        stmt = select(ContentReport).where(
            ContentReport.target_type == target_type,
            ContentReport.target_id == target_id,
            ContentReport.status == "pending",
        )
        reports = list((await self.session.execute(stmt)).scalars().all())
        for r in reports:
            r.status = "dismissed" if dismissed else "handled"
            r.handled_at = datetime.utcnow()
        if reports:
            await self.session.commit()
