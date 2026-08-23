"""任务管理路由（docs/3.2.md §5.5）。"""
from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import AdminDep, SessionDep
from app.core.exceptions import ApiError
from app.models.mission import Mission
from app.models.user import User
from app.schemas.admin import AdminMissionOut, AdminMissionUpdate, PaginatedMissions
from app.schemas.common import ApiResponse, Paginated
from app.services.admin_audit import AdminAuditService

router = APIRouter(prefix="/admin/missions", tags=["admin-missions"])


@router.get("", response_model=ApiResponse[PaginatedMissions])
async def list_missions(
    session: SessionDep,
    _: AdminDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    difficulty: str | None = None,
):
    stmt = select(Mission)
    if status:
        stmt = stmt.where(Mission.status == status)
    if difficulty:
        stmt = stmt.where(Mission.difficulty == difficulty)
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    stmt = stmt.order_by(Mission.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list((await session.execute(stmt)).scalars().all())
    return ApiResponse(
        data=Paginated(
            items=[AdminMissionOut.model_validate(m) for m in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/{mission_id}", response_model=ApiResponse[AdminMissionOut])
async def get_mission(mission_id: int, session: SessionDep, _: AdminDep):
    m = await session.get(Mission, mission_id)
    if m is None:
        raise ApiError(code=40002, message="任务不存在", status_code=404)
    return ApiResponse(data=AdminMissionOut.model_validate(m))


@router.patch("/{mission_id}", response_model=ApiResponse[AdminMissionOut])
async def update_mission(
    mission_id: int, payload: AdminMissionUpdate, session: SessionDep, admin: AdminDep
):
    m = await session.get(Mission, mission_id)
    if m is None:
        raise ApiError(code=40002, message="任务不存在", status_code=404)
    before = {"status": m.status, "assignee_id": m.assignee_id, "reward": m.reward}
    if payload.status is not None:
        m.status = payload.status
    if payload.assignee_id is not None:
        assignee = await session.get(User, payload.assignee_id)
        if assignee is None:
            raise ApiError(code=40002, message="接单用户不存在", status_code=404)
        m.assignee_id = payload.assignee_id
    if payload.reward is not None:
        m.reward = payload.reward
    await session.commit()
    await session.refresh(m)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="mission.update",
        target_type="mission",
        target_id=m.id,
        before_value=before,
        after_value={"status": m.status, "assignee_id": m.assignee_id, "reward": m.reward},
        reason=payload.reason,
    )
    return ApiResponse(data=AdminMissionOut.model_validate(m))
