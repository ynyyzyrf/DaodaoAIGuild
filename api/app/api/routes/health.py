from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import SessionDep
from app.schemas.common import ApiResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=ApiResponse[dict])
async def health(session: SessionDep):
    await session.execute(text("SELECT 1"))
    return ApiResponse(data={"status": "ok"})
