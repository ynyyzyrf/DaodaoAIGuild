from fastapi import APIRouter, Request

from app.api.external_deps import ExternalApiKeyDep
from app.api.deps import SessionDep
from app.core.datetime_utils import to_naive_utc, utc_now
from app.models.external_api import ExternalApiLog
from app.schemas.common import ApiResponse
from app.schemas.order import DemandOrderCreate, ExternalOrderCreateOut
from app.services.order import OrderService

router = APIRouter(prefix="/orders", tags=["external-orders"])


@router.post(
    "",
    response_model=ApiResponse[ExternalOrderCreateOut],
    summary="Create External Order",
    description=(
        "Create a DaoStore demand order from an external system and submit it "
        "to platform review. This does not sync to PMDesktop yet; PMDesktop "
        "sync happens later after a consulting company claims the order and "
        "assigns an FDE."
    ),
)
async def create_external_order(
    payload: DemandOrderCreate,
    request: Request,
    session: SessionDep,
    principal: ExternalApiKeyDep,
):
    principal.require_scope("orders:write")
    service = OrderService(session)
    order = await service.create_order(principal.owner, payload)
    order = await service.submit_order(order.id, principal.owner)
    principal.key.last_used_at = to_naive_utc(utc_now())
    session.add(
        ExternalApiLog(
            api_key_id=principal.key.id,
            method=request.method,
            path=request.url.path,
            status_code=200,
            request_id=request.headers.get("X-Request-ID"),
            idempotency_key=request.headers.get("Idempotency-Key"),
            ip=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
        )
    )
    await session.commit()
    await session.refresh(order)
    return ApiResponse(data=ExternalOrderCreateOut.model_validate(order))
