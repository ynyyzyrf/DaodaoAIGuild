"""Homepage demand chat proxy backed by Dify."""

import json
from typing import Any, Literal

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserDep
from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessageIn(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    conversation_id: str | None = None
    intent_confirmed: bool = False
    requirement: "RequirementDraft | None" = None


class ChatMessageOut(BaseModel):
    answer: str
    conversation_id: str | None = None
    message_id: str | None = None
    action: Literal["open_requirement_form"] | None = None
    requirement_draft: "RequirementDraft | None" = None


class RequirementDraft(BaseModel):
    enterprise_name: str = Field("", max_length=128)
    contact_name: str = Field("", max_length=64)
    contact_email: str = Field("", max_length=128)
    product_name: str = Field("", max_length=128)
    title: str = Field("", max_length=160)
    description: str = ""
    business_background: str = ""
    deliverable_expectation: str = ""
    budget_note: str = ""
    expected_delivery_at: str | None = None


class RequirementIntentResult(BaseModel):
    intent: str = ""
    requirement_draft: RequirementDraft = Field(default_factory=RequirementDraft)


ChatMessageIn.model_rebuild()
ChatMessageOut.model_rebuild()


@router.post("/messages", response_model=ApiResponse[ChatMessageOut])
async def create_chat_message(payload: ChatMessageIn, current_user: CurrentUserDep):
    settings = get_settings()
    if not settings.dify_chat_api_key:
        raise ApiError(code=50020, message="Dify 聊天服务未配置", status_code=500)

    api_base = settings.dify_chat_api_base.rstrip("/")
    user_name = (current_user.display_name or current_user.username).strip()

    if not payload.intent_confirmed:
        intent_result = await _detect_requirement_intent(
            api_base=api_base,
            api_key=settings.dify_requirement_intent_api_key,
            query=payload.query,
            user=user_name,
            timeout=settings.dify_chat_request_timeout_seconds,
        )
        if intent_result.intent == "submit_requirement":
            return ApiResponse(
                data=ChatMessageOut(
                    answer="我先幫你把這條信息整理成正式需求，請確認後再提交。",
                    action="open_requirement_form",
                    requirement_draft=intent_result.requirement_draft,
                )
            )

    body = {
        "inputs": {
            "username": user_name,
            "display_name": user_name,
            "requirement": payload.requirement.model_dump() if payload.requirement else None,
        },
        "query": _build_confirmed_requirement_query(payload.query, payload.requirement)
        if payload.intent_confirmed and payload.requirement
        else payload.query,
        "response_mode": "blocking",
        "user": user_name,
    }
    if payload.conversation_id:
        body["conversation_id"] = payload.conversation_id

    try:
        data = await _call_dify_chat_message(
            api_base=api_base,
            api_key=settings.dify_chat_api_key,
            body=body,
            timeout=settings.dify_chat_request_timeout_seconds,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:300] if exc.response is not None else ""
        raise ApiError(code=50021, message=f"Dify 聊天服务返回异常：{detail}", status_code=502) from exc
    except httpx.HTTPError as exc:
        raise ApiError(code=50022, message="Dify 聊天服务暂时不可用", status_code=502) from exc

    return ApiResponse(
        data=_build_chat_message_out(
            answer=data.get("answer") or "",
            conversation_id=data.get("conversation_id"),
            message_id=data.get("message_id"),
        )
    )


async def _call_dify_chat_message(
    *,
    api_base: str,
    api_key: str,
    body: dict[str, Any],
    timeout: int,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{api_base}/chat-messages",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        response.raise_for_status()
    data = response.json()
    return data if isinstance(data, dict) else {}


async def _detect_requirement_intent(
    *,
    api_base: str,
    api_key: str,
    query: str,
    user: str,
    timeout: int,
) -> RequirementIntentResult:
    if not api_key.strip():
        return RequirementIntentResult()

    try:
        outputs = await _call_dify_workflow(
            api_base=api_base,
            api_key=api_key,
            inputs={"query": query},
            user=user,
            timeout=timeout,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:300] if exc.response is not None else ""
        raise ApiError(code=50023, message=f"Dify 意图识别返回异常：{detail}", status_code=502) from exc
    except httpx.HTTPError as exc:
        raise ApiError(code=50024, message="Dify 意图识别服务暂时不可用", status_code=502) from exc

    draft_data = _normalize_requirement_draft(
        _pick_mapping(outputs, "requirement_draft", "extracted", "requirement", "fields")
    )
    return RequirementIntentResult(
        intent=str(outputs.get("intent") or outputs.get("action") or "").strip(),
        requirement_draft=RequirementDraft(**draft_data),
    )


async def _call_dify_workflow(
    *,
    api_base: str,
    api_key: str,
    inputs: dict[str, Any],
    user: str,
    timeout: int,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{api_base}/workflows/run",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "inputs": inputs,
                "response_mode": "blocking",
                "user": user,
            },
        )
        response.raise_for_status()

    data = response.json()
    outputs = data.get("data", {}).get("outputs", data.get("outputs", {}))
    return outputs if isinstance(outputs, dict) else {}


def _pick_mapping(source: dict[str, Any], *keys: str) -> dict[str, Any]:
    for key in keys:
        value = source.get(key)
        if isinstance(value, dict):
            return value
    return {}


def _normalize_requirement_draft(value: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    aliases = {
        "business_background": ("business_background", "background"),
        "deliverable_expectation": ("deliverable_expectation", "expected_result"),
        "budget_note": ("budget_note", "budget"),
        "expected_delivery_at": ("expected_delivery_at", "deadline"),
    }
    for key in RequirementDraft.model_fields:
        source_keys = aliases.get(key, (key,))
        item = next((value.get(source_key) for source_key in source_keys if value.get(source_key) is not None), None)
        if key == "expected_delivery_at":
            result[key] = str(item).strip() if item is not None else None
        else:
            result[key] = str(item).strip() if item is not None else ""
    return result


def _build_chat_message_out(*, answer: str, conversation_id: str | None, message_id: str | None) -> ChatMessageOut:
    action_payload = _parse_action_answer(answer)
    if action_payload.get("action") == "open_requirement_form":
        draft_data = _normalize_requirement_draft(
            _pick_mapping(action_payload, "requirement_draft", "draft", "extracted", "requirement", "fields")
        )
        return ChatMessageOut(
            answer=str(action_payload.get("message") or "我先幫你把這條信息整理成正式需求，請確認後再提交。"),
            conversation_id=conversation_id,
            message_id=message_id,
            action="open_requirement_form",
            requirement_draft=RequirementDraft(**draft_data),
        )

    return ChatMessageOut(answer=answer, conversation_id=conversation_id, message_id=message_id)


def _parse_action_answer(answer: str) -> dict[str, Any]:
    text = answer.strip()
    if not text.startswith("{"):
        return {}
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    if parsed.get("type") != "action" and not parsed.get("action"):
        return {}
    return parsed


def _build_confirmed_requirement_query(query: str, requirement: RequirementDraft | None) -> str:
    if requirement is None:
        return query

    fields = requirement.model_dump()
    lines = [
        "用户已确认提交一条正式企业需求，请基于以下完整信息继续处理，并在当前聊天中返回下一步建议。",
        "",
        f"原始表达：{query}",
        "",
        "需求信息：",
    ]
    labels = {
        "enterprise_name": "企业名称",
        "contact_name": "联系人",
        "contact_email": "联系邮箱",
        "product_name": "关联产品/系统",
        "title": "需求标题",
        "description": "需求说明",
        "business_background": "业务背景",
        "deliverable_expectation": "期望交付物",
        "budget_note": "预算说明",
        "expected_delivery_at": "期望交付时间",
    }
    for key, label in labels.items():
        value = fields.get(key)
        if value:
            lines.append(f"- {label}：{value}")
    return "\n".join(lines)
