from fastapi import APIRouter

from app.api.deps import SessionDep
from app.repositories.tag import TagRepository
from app.schemas.common import ApiResponse
from app.schemas.tag import TagOut

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=ApiResponse[list[TagOut]])
async def list_tags(session: SessionDep):
    tags = await TagRepository(session).list_all()
    return ApiResponse(data=[TagOut(id=t.id, name=t.name, slug=t.slug) for t in tags])
