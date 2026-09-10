from fastapi import APIRouter, Query

from app.api.deps import AdminDep, SessionDep
from app.schemas.common import ApiResponse, Paginated
from app.schemas.order import DemandOrderOut, DemandOrderReview, OrderClaimSelect, OrderSettle, SimulatedPaymentMark
from app.services.admin_audit import AdminAuditService
from app.services.order import OrderService

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])


@router.get("", response_model=ApiResponse[Paginated[DemandOrderOut]])
async def list_orders(
    session: SessionDep,
    _: AdminDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
):
    items, total = await OrderService(session).list_admin_orders(page, page_size, status)
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@router.post("/{order_id}/review", response_model=ApiResponse[DemandOrderOut])
async def review_order(order_id: int, payload: DemandOrderReview, session: SessionDep, admin: AdminDep):
    service = OrderService(session)
    order = await service.review_order(order_id, admin, payload.status, payload.reason)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="order.review",
        target_type="demand_order",
        target_id=order.id,
        after_value={"status": order.status},
        reason=payload.reason,
    )
    return ApiResponse(data=await service.to_order_out(order))


@router.post("/{order_id}/select-claim", response_model=ApiResponse[DemandOrderOut])
async def select_claim(order_id: int, payload: OrderClaimSelect, session: SessionDep, admin: AdminDep):
    service = OrderService(session)
    order = await service.select_claim(order_id, payload.claim_id)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="order.select_claim",
        target_type="demand_order",
        target_id=order.id,
        after_value={"status": order.status, "claimed_company_id": order.claimed_company_id},
        reason="select consulting company claim",
    )
    return ApiResponse(data=await service.to_order_out(order))


@router.post("/{order_id}/simulate-payment", response_model=ApiResponse[DemandOrderOut])
async def simulate_payment(order_id: int, payload: SimulatedPaymentMark, session: SessionDep, admin: AdminDep):
    service = OrderService(session)
    order = await service.simulate_payment(order_id, admin, payload.note)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="order.simulate_payment",
        target_type="demand_order",
        target_id=order.id,
        after_value={"status": order.status},
        reason=payload.note or "simulate payment",
    )
    return ApiResponse(data=await service.to_order_out(order))


@router.post("/{order_id}/settle", response_model=ApiResponse[DemandOrderOut])
async def settle_order(order_id: int, payload: OrderSettle, session: SessionDep, admin: AdminDep):
    service = OrderService(session)
    order = await service.settle_order(order_id, payload.note)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="order.settle",
        target_type="demand_order",
        target_id=order.id,
        after_value={"status": order.status},
        reason=payload.note or "settle order",
    )
    return ApiResponse(data=await service.to_order_out(order))
