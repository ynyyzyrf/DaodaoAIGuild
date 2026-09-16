"""Question square assistant backed by Dify chatflow."""

import logging
from uuid import uuid4

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.question import Question
from app.models.user import User
from app.repositories.answer import AnswerRepository
from app.repositories.platform_setting import PlatformSettingRepository
from app.repositories.user import UserRepository

logger = logging.getLogger(__name__)

QUESTION_ASSISTANT_SETTING_KEY = "question_assistant"
ASSISTANT_USERNAME = "question_assistant"
DEFAULT_QUESTION_ASSISTANT_SETTINGS = {
    "enabled": True,
    "api_base": "https://ai-dashboard.solarifyai.com/v1",
    "assistant_display_name": "回答小助手",
}


async def get_question_assistant_settings(session: AsyncSession) -> dict:
    setting = await PlatformSettingRepository(session).get(QUESTION_ASSISTANT_SETTING_KEY)
    value = setting.value if setting is not None and isinstance(setting.value, dict) else {}
    return {**DEFAULT_QUESTION_ASSISTANT_SETTINGS, **value}


async def update_question_assistant_settings(
    session: AsyncSession,
    *,
    enabled: bool,
    updated_by: int,
) -> dict:
    current = await get_question_assistant_settings(session)
    value = {
        "enabled": enabled,
        "api_base": current["api_base"],
        "assistant_display_name": current["assistant_display_name"],
    }
    setting = await PlatformSettingRepository(session).upsert(
        QUESTION_ASSISTANT_SETTING_KEY,
        value,
        updated_by=updated_by,
    )
    return {**DEFAULT_QUESTION_ASSISTANT_SETTINGS, **setting.value}


async def maybe_answer_question(session: AsyncSession, question: Question, author: User | None) -> None:
    settings = await get_question_assistant_settings(session)
    if not settings["enabled"]:
        return

    app_settings = get_settings()
    api_key = app_settings.dify_question_assistant_api_key.strip()
    if not api_key:
        logger.info("Question assistant skipped: Dify API key is not configured")
        return

    assistant = await _ensure_assistant_user(session, settings["assistant_display_name"])
    query = _compose_query(question)
    user_name = author.display_name or author.username if author else f"user-{question.author_id}"

    try:
        answer = await _call_dify_chatflow(
            api_base=settings["api_base"],
            api_key=api_key,
            query=query,
            user=user_name,
            question=question,
        )
    except Exception as exc:
        logger.warning("Question assistant failed for question %s: %s", question.id, exc)
        return

    if answer.strip():
        await AnswerRepository(session).create(
            question_id=question.id,
            author_id=assistant.id,
            content=answer.strip(),
        )


async def _ensure_assistant_user(session: AsyncSession, display_name: str) -> User:
    repo = UserRepository(session)
    existing = await repo.get_by_username(ASSISTANT_USERNAME)
    if existing is not None:
        if existing.display_name != display_name:
            existing.display_name = display_name
            await session.commit()
            await session.refresh(existing)
        return existing

    assistant = User(
        username=ASSISTANT_USERNAME,
        password_hash=hash_password(f"question-assistant-{uuid4()}"),
        display_name=display_name,
        bio="問題廣場自動回答助手",
        is_active=False,
    )
    session.add(assistant)
    await session.commit()
    await session.refresh(assistant)
    return assistant


async def _call_dify_chatflow(
    *,
    api_base: str,
    api_key: str,
    query: str,
    user: str,
    question: Question,
) -> str:
    body = {
        "inputs": {
            "question_id": str(question.id),
            "question_title": question.title,
            "question_description": question.description,
            "question_scenario": question.scenario,
            "question_tools": ", ".join(question.tools or []),
            "question_error_info": question.error_info,
        },
        "query": query,
        "response_mode": "blocking",
        "user": user,
    }
    timeout = get_settings().dify_chat_request_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{api_base.rstrip('/')}/chat-messages",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        response.raise_for_status()
    data = response.json()
    return str(data.get("answer") or "")


def _compose_query(question: Question) -> str:
    parts = [
        f"請回答 DaoStore 問題廣場的新問題：{question.title}",
        f"場景：{question.scenario}" if question.scenario else "",
        f"涉及工具：{', '.join(question.tools or [])}" if question.tools else "",
        f"描述：\n{question.description}" if question.description else "",
        f"報錯信息：\n{question.error_info}" if question.error_info else "",
    ]
    return "\n\n".join(part for part in parts if part)
