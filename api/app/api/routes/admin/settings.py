from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.api.deps import AdminDep, SessionDep
from app.core.config import get_settings
from app.schemas.common import ApiResponse
from app.services.admin_audit import AdminAuditService
from app.services.question_assistant import (
    get_question_assistant_settings,
    update_question_assistant_settings,
)

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])


class QuestionAssistantSettingsOut(BaseModel):
    enabled: bool
    api_base: str
    assistant_display_name: str
    api_key_configured: bool


class QuestionAssistantSettingsUpdate(BaseModel):
    enabled: bool


def _settings_out(value: dict) -> QuestionAssistantSettingsOut:
    app_settings = get_settings()
    return QuestionAssistantSettingsOut(
        enabled=bool(value["enabled"]),
        api_base=str(value["api_base"]),
        assistant_display_name=str(value["assistant_display_name"]),
        api_key_configured=bool(app_settings.dify_question_assistant_api_key.strip()),
    )


@router.get("/question-assistant", response_model=ApiResponse[QuestionAssistantSettingsOut])
async def get_question_assistant_config(session: SessionDep, _: AdminDep):
    value = await get_question_assistant_settings(session)
    return ApiResponse(data=_settings_out(value))


@router.patch("/question-assistant", response_model=ApiResponse[QuestionAssistantSettingsOut])
async def update_question_assistant_config(
    payload: QuestionAssistantSettingsUpdate,
    session: SessionDep,
    admin: AdminDep,
    request: Request,
):
    before = await get_question_assistant_settings(session)
    value = await update_question_assistant_settings(
        session,
        enabled=payload.enabled,
        updated_by=admin.id,
    )
    await AdminAuditService(session).log(
        admin_id=admin.id,
        action="settings.question_assistant.update",
        target_type="platform_setting",
        target_id=None,
        before_value=before,
        after_value=value,
        reason=f"{'开启' if payload.enabled else '关闭'}问题广场回答小助手",
        ip=request.client.host if request.client else None,
    )
    return ApiResponse(data=_settings_out(value))
