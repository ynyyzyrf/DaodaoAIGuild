from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep, SessionDep
from app.schemas.common import ApiResponse, Paginated
from app.schemas.order import (
    AssignFde,
    DemandOrderCreate,
    DemandOrderOut,
    OrderClaimCreate,
    OrderDeliveryAccept,
    OrderDeliveryCreate,
    OrderDeliveryOut,
    OrderQuoteCreate,
    OrderQuoteOut,
    OrderReviewCreate,
    OrderWorkStatusUpdate,
)
from app.services.order import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])
opportunities_router = APIRouter(prefix="/opportunities", tags=["opportunities"])
company_orders_router = APIRouter(prefix="/companies/{company_id}/orders", tags=["company-orders"])


@router.post("", response_model=ApiResponse[DemandOrderOut])
async def create_order(payload: DemandOrderCreate, session: SessionDep, current_user: CurrentUserDep):
    service = OrderService(session)
    order = await service.create_order(current_user, payload)
    return ApiResponse(data=await service.to_order_out(order))


@router.get("/me", response_model=ApiResponse[Paginated[DemandOrderOut]])
async def list_my_orders(
    session: SessionDep,
    current_user: CurrentUserDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    items, total = await OrderService(session).list_my_orders(current_user, page, page_size)
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@router.get("/{order_id}", response_model=ApiResponse[DemandOrderOut])
async def get_my_order(order_id: int, session: SessionDep, current_user: CurrentUserDep):
    service = OrderService(session)
    order = await service.get_my_order(order_id, current_user)
    return ApiResponse(data=await service.to_order_out(order))


@router.post("/{order_id}/submit", response_model=ApiResponse[DemandOrderOut])
async def submit_order(order_id: int, session: SessionDep, current_user: CurrentUserDep):
    service = OrderService(session)
    order = await service.submit_order(order_id, current_user)
    return ApiResponse(data=await service.to_order_out(order))


@router.post("/{order_id}/claims", response_model=ApiResponse[DemandOrderOut])
async def create_order_claim(
    order_id: int,
    payload: OrderClaimCreate,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = OrderService(session)
    order = await service.create_claim(order_id, current_user, payload.company_id, payload.claim_note)
    return ApiResponse(data=await service.to_order_out(order))


@router.post("/{order_id}/confirm-quote", response_model=ApiResponse[DemandOrderOut])
async def confirm_quote(order_id: int, session: SessionDep, current_user: CurrentUserDep):
    service = OrderService(session)
    order = await service.confirm_quote(order_id, current_user)
    return ApiResponse(data=await service.to_order_out(order))


@router.post("/{order_id}/accept-delivery", response_model=ApiResponse[DemandOrderOut])
async def accept_delivery(
    order_id: int,
    payload: OrderDeliveryAccept,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = OrderService(session)
    order = await service.accept_delivery(order_id, current_user, payload.acceptance_note)
    return ApiResponse(data=await service.to_order_out(order))


@router.post("/{order_id}/work-status", response_model=ApiResponse[DemandOrderOut])
async def update_work_status(
    order_id: int,
    payload: OrderWorkStatusUpdate,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = OrderService(session)
    order = await service.update_work_status(order_id, current_user, payload.status)
    return ApiResponse(data=await service.to_order_out(order))


@router.post("/{order_id}/reviews", response_model=ApiResponse[DemandOrderOut])
async def create_order_review(
    order_id: int,
    payload: OrderReviewCreate,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = OrderService(session)
    order = await service.create_review(order_id, current_user, payload)
    return ApiResponse(data=await service.to_order_out(order))


@opportunities_router.get("", response_model=ApiResponse[Paginated[DemandOrderOut]])
async def list_opportunities(
    session: SessionDep,
    _: CurrentUserDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    items, total = await OrderService(session).list_opportunities(page, page_size)
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@company_orders_router.post("/{order_id}/assign-fde", response_model=ApiResponse[DemandOrderOut])
async def assign_fde(
    company_id: int,
    order_id: int,
    payload: AssignFde,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = OrderService(session)
    order = await service.assign_fde(company_id, order_id, current_user, payload.fde_user_id)
    return ApiResponse(data=await service.to_order_out(order))


@company_orders_router.get("", response_model=ApiResponse[Paginated[DemandOrderOut]])
async def list_company_orders(
    company_id: int,
    session: SessionDep,
    current_user: CurrentUserDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
):
    service = OrderService(session)
    items, total = await service.list_company_orders(company_id, current_user, page, page_size, status)
    return ApiResponse(data=Paginated(items=items, total=total, page=page, page_size=page_size))


@company_orders_router.post("/{order_id}/quotes", response_model=ApiResponse[OrderQuoteOut])
async def create_quote(
    company_id: int,
    order_id: int,
    payload: OrderQuoteCreate,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = OrderService(session)
    quote = await service.create_quote(company_id, order_id, current_user, payload)
    return ApiResponse(data=await service.to_quote_out(quote))


@company_orders_router.post("/{order_id}/deliveries", response_model=ApiResponse[OrderDeliveryOut])
async def create_delivery(
    company_id: int,
    order_id: int,
    payload: OrderDeliveryCreate,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    service = OrderService(session)
    delivery = await service.create_delivery(
        company_id, order_id, current_user, payload.summary, payload.deliverable_urls
    )
    return ApiResponse(data=await service.to_delivery_out(delivery))
