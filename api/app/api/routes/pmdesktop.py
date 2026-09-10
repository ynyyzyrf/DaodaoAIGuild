from fastapi import APIRouter, Query

from app.api.deps import CurrentUserDep
from app.schemas.common import ApiResponse, Paginated
from app.schemas.pmdesktop import PmDesktopProductOut
from app.services.pmdesktop import PmDesktopClient

router = APIRouter(prefix="/pmdesktop", tags=["pmdesktop"])


@router.get("/products", response_model=ApiResponse[Paginated[PmDesktopProductOut]])
async def list_products(
    _: CurrentUserDep,
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
):
    result = await PmDesktopClient().list_products(search=search, page=page, page_size=page_size)
    items = [PmDesktopProductOut(**item) for item in result["items"] if item.get("id") and item.get("name")]
    return ApiResponse(
        data=Paginated(
            items=items,
            total=result["total"],
            page=result["page"],
            page_size=result["page_size"],
        )
    )
