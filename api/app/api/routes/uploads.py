from fastapi import APIRouter, File, UploadFile

from app.api.deps import CurrentUserDep, SessionDep
from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.repositories.attachment import AttachmentRepository
from app.schemas.common import ApiResponse
from app.schemas.upload import UploadOut
from app.services.storage import LocalStorageBackend, detect_kind

router = APIRouter(prefix="/uploads", tags=["uploads"])

_settings = get_settings()

_KIND_MAX_SIZE = {
    "image": _settings.max_image_size,
    "video": _settings.max_video_size,
    "file": _settings.max_file_size,
    "log": _settings.max_log_size,
}


@router.post("", response_model=ApiResponse[UploadOut])
async def upload_file(
    session: SessionDep,
    current_user: CurrentUserDep,
    file: UploadFile = File(...),  # noqa: B008
):
    """上传图片/视频/文件，落盘后记录 attachments（暂不绑定目标，由内容创建时 link）。"""
    content = await file.read()
    if not content:
        raise ApiError(code=42202, message="空文件", status_code=400)
    kind = detect_kind(file.filename or "", file.content_type or "")
    max_size = _KIND_MAX_SIZE.get(kind, _settings.max_file_size)
    if len(content) > max_size:
        raise ApiError(code=42201, message="文件超过大小限制", status_code=413)

    url = LocalStorageBackend().save(content, file.filename or "", file.content_type or "")
    att = await AttachmentRepository(session).create(
        uploader_id=current_user.id,
        kind=kind,
        url=url,
        size=len(content),
        mime_type=file.content_type or "",
    )
    return ApiResponse(
        data=UploadOut(url=att.url, kind=att.kind, size=att.size, mime_type=att.mime_type)
    )
