"""仪表板聚合数据（docs/3.2.md §5.2）。"""
from datetime import datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import AdminDep, SessionDep
from app.models.answer import Answer
from app.models.mission import Mission
from app.models.question import Question
from app.models.tutorial import Tutorial
from app.models.user import User
from app.schemas.admin import DashboardOut
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])


@router.get("", response_model=ApiResponse[DashboardOut])
async def get_dashboard(session: SessionDep, _: AdminDep):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    days_7 = now - timedelta(days=7)
    days_30 = now - timedelta(days=30)

    async def _count(stmt) -> int:
        return (await session.execute(stmt)).scalar_one()

    pending_tutorials = await _count(
        select(func.count()).select_from(Tutorial).where(Tutorial.status == "pending")
    )
    today_new_questions = await _count(
        select(func.count()).select_from(Question).where(Question.created_at >= today_start)
    )
    today_new_answers = await _count(
        select(func.count()).select_from(Answer).where(Answer.created_at >= today_start)
    )
    today_new_tutorials = await _count(
        select(func.count()).select_from(Tutorial).where(Tutorial.created_at >= today_start)
    )
    in_progress_missions = await _count(
        select(func.count()).select_from(Mission).where(Mission.status == "in_progress")
    )
    # 近 7 日活跃骑士：有发问/回答/教程的 distinct user
    active_q = select(Question.author_id).where(Question.created_at >= days_7)
    active_a = select(Answer.author_id).where(Answer.created_at >= days_7)
    active_t = select(Tutorial.author_id).where(Tutorial.created_at >= days_7)
    active_union = select(func.distinct(active_q.union(active_a, active_t).subquery().c.author_id))
    active_knights_7d = (await session.execute(select(func.count()).select_from(active_union.subquery()))).scalar_one()

    # 30 日趋势
    trend_rows = []
    for i in range(29, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        q = await _count(select(func.count()).select_from(Question).where(
            Question.created_at >= day_start, Question.created_at < day_end
        ))
        a = await _count(select(func.count()).select_from(Answer).where(
            Answer.created_at >= day_start, Answer.created_at < day_end
        ))
        t = await _count(select(func.count()).select_from(Tutorial).where(
            Tutorial.created_at >= day_start, Tutorial.created_at < day_end
        ))
        trend_rows.append({"date": day_start.strftime("%Y-%m-%d"), "questions": q, "answers": a, "tutorials": t})

    # 异常预警
    day_1 = now - timedelta(days=1)
    zero_answer_questions = await _count(
        select(func.count()).select_from(Question).where(
            Question.created_at >= day_1, Question.view_count == 0
        )
    )
    overdue = now - timedelta(days=7)
    overdue_missions = await _count(
        select(func.count()).select_from(Mission).where(
            Mission.status == "in_progress", Mission.updated_at < overdue
        )
    )

    return ApiResponse(
        data=DashboardOut(
            pending_tutorials=pending_tutorials,
            today_new_questions=today_new_questions,
            today_new_answers=today_new_answers,
            today_new_tutorials=today_new_tutorials,
            in_progress_missions=in_progress_missions,
            active_knights_7d=active_knights_7d,
            trend=trend_rows,
            alerts={
                "zero_answer_questions": zero_answer_questions,
                "overdue_missions": overdue_missions,
            },
        )
    )
