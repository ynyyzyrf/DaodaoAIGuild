"""仪表板聚合数据（docs/3.2.md §5.2）。"""
from datetime import datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import exists, func, select

from app.api.deps import AdminDep, SessionDep
from app.models.answer import Answer
from app.models.company import Company, CompanyJoinRequest, CompanyMember
from app.models.mission import Mission
from app.models.order import DemandOrder, OrderClaim
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

    order_statuses = [
        "pending_review",
        "opportunity_pool",
        "claimed",
        "requirement_following",
        "quoted",
        "confirmed",
        "pending_payment",
        "paid",
        "delivering",
        "pending_acceptance",
        "accepted",
        "settled",
        "rated",
    ]
    order_pipeline = {
        status: await _count(select(func.count()).select_from(DemandOrder).where(DemandOrder.status == status))
        for status in order_statuses
    }
    claim_exists = exists().where(OrderClaim.order_id == DemandOrder.id)
    platform_actions = {
        "requirement_reviews": order_pipeline["pending_review"],
        "claim_confirmations": order_pipeline["opportunity_pool"],
        "simulated_payments": order_pipeline["pending_payment"],
        "settlements": order_pipeline["accepted"],
    }

    supply_readiness = {
        "approved_companies": await _count(
            select(func.count()).select_from(Company).where(Company.status == "approved")
        ),
        "active_lobster_knights": await _count(
            select(func.count()).select_from(CompanyMember).where(CompanyMember.fde_status == "active")
        ),
        "companies_with_lobster_knights": await _count(
            select(func.count(func.distinct(CompanyMember.company_id))).where(CompanyMember.fde_status == "active")
        ),
        "pending_join_requests": await _count(
            select(func.count()).select_from(CompanyJoinRequest).where(CompanyJoinRequest.status == "pending")
        ),
    }

    hours_48 = now - timedelta(hours=48)
    days_3 = now - timedelta(days=3)
    hours_24 = now - timedelta(hours=24)
    fulfillment_alerts = {
        "pending_reviews_over_24h": await _count(
            select(func.count()).select_from(DemandOrder).where(
                DemandOrder.status == "pending_review",
                DemandOrder.updated_at < hours_24,
            )
        ),
        "opportunities_without_claim_48h": await _count(
            select(func.count()).select_from(DemandOrder).where(
                DemandOrder.status == "opportunity_pool",
                DemandOrder.updated_at < hours_48,
                ~claim_exists,
            )
        ),
        "claimed_without_fde_3d": await _count(
            select(func.count()).select_from(DemandOrder).where(
                DemandOrder.status == "claimed",
                DemandOrder.assigned_fde_user_id.is_(None),
                DemandOrder.updated_at < days_3,
            )
        ),
        "quoted_unconfirmed_48h": await _count(
            select(func.count()).select_from(DemandOrder).where(
                DemandOrder.status == "quoted",
                DemandOrder.updated_at < hours_48,
            )
        ),
        "accepted_unsettled_24h": await _count(
            select(func.count()).select_from(DemandOrder).where(
                DemandOrder.status == "accepted",
                DemandOrder.updated_at < hours_24,
            )
        ),
    }

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
            order_pipeline=order_pipeline,
            platform_actions=platform_actions,
            supply_readiness=supply_readiness,
            fulfillment_alerts=fulfillment_alerts,
        )
    )
