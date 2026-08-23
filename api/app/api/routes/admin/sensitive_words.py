"""敏感词管理 CRUD + 批量导入（docs/3.2.md §4.3）。"""
from fastapi import APIRouter, Query

from app.api.deps import AdminDep, SessionDep
from app.core.exceptions import ApiError
from app.models.admin import SensitiveWord
from app.schemas.admin import (
    PaginatedSensitiveWords,
    SensitiveWordCreate,
    SensitiveWordImport,
    SensitiveWordOut,
    SensitiveWordUpdate,
)
from app.schemas.common import ApiResponse, Paginated
from app.services.admin_audit import AdminAuditService
from app.services.sensitive import SensitiveWordRepository

router = APIRouter(prefix="/admin/sensitive-words", tags=["admin-sensitive"])


@router.get("", response_model=ApiResponse[PaginatedSensitiveWords])
async def list_sensitive_words(
    session: SessionDep,
    _: AdminDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: bool | None = None,
):
    items, total = await SensitiveWordRepository(session).list(
        page=page, page_size=page_size, is_active=is_active
    )
    return ApiResponse(
        data=Paginated(
            items=[SensitiveWordOut.model_validate(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post("", response_model=ApiResponse[SensitiveWordOut])
async def create_sensitive_word(
    payload: SensitiveWordCreate, session: SessionDep, admin: AdminDep
):
    repo = SensitiveWordRepository(session)
    if await repo.get_by_word(payload.word) is not None:
        raise ApiError(code=50001, message="敏感词已存在", status_code=400)
    sw = await repo.create(
        word=payload.word,
        category=payload.category,
        action=payload.action,
        created_by=admin.id,
    )
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="sensitive_word.create",
        target_type="sensitive_word",
        target_id=sw.id,
        after_value={"word": sw.word, "action": sw.action, "category": sw.category},
        reason=f"新增敏感词：{sw.word}",
    )
    return ApiResponse(data=SensitiveWordOut.model_validate(sw))


@router.patch("/{word_id}", response_model=ApiResponse[SensitiveWordOut])
async def update_sensitive_word(
    word_id: int,
    payload: SensitiveWordUpdate,
    session: SessionDep,
    admin: AdminDep,
):
    repo = SensitiveWordRepository(session)
    sw = await session.get(SensitiveWord, word_id)
    if sw is None:
        raise ApiError(code=40002, message="敏感词不存在", status_code=404)
    before = {"word": sw.word, "action": sw.action, "category": sw.category, "is_active": sw.is_active}
    sw = await repo.update(
        sw, category=payload.category, action=payload.action, is_active=payload.is_active
    )
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="sensitive_word.update",
        target_type="sensitive_word",
        target_id=sw.id,
        before_value=before,
        after_value={"word": sw.word, "action": sw.action, "category": sw.category, "is_active": sw.is_active},
        reason=f"修改敏感词：{sw.word}",
    )
    return ApiResponse(data=SensitiveWordOut.model_validate(sw))


@router.delete("/{word_id}", response_model=ApiResponse[dict])
async def delete_sensitive_word(word_id: int, session: SessionDep, admin: AdminDep):
    sw = await session.get(SensitiveWord, word_id)
    if sw is None:
        raise ApiError(code=40002, message="敏感词不存在", status_code=404)
    word = sw.word
    await SensitiveWordRepository(session).delete(sw)
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="sensitive_word.delete",
        target_type="sensitive_word",
        target_id=word_id,
        before_value={"word": word},
        reason=f"删除敏感词：{word}",
    )
    return ApiResponse(data={"status": "ok"})


@router.post("/import", response_model=ApiResponse[dict])
async def import_sensitive_words(
    payload: SensitiveWordImport, session: SessionDep, admin: AdminDep
):
    repo = SensitiveWordRepository(session)
    # 去重 + 去空白
    words = list({w.strip() for w in payload.words if w.strip()})
    added = await repo.bulk_create(
        words=words, category=payload.category, action=payload.action, created_by=admin.id
    )
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="sensitive_word.import",
        target_type="sensitive_word",
        after_value={"imported": added, "total_input": len(words)},
        reason=f"批量导入敏感词，新增 {added} 条",
    )
    return ApiResponse(data={"added": added, "duplicates": len(words) - added})
