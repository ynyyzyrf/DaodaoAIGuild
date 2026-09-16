from app.services.question_assistant import QUESTION_ASSISTANT_SETTING_KEY


async def test_question_assistant_creates_answer_when_enabled(client, auth_headers, monkeypatch):
    import app.services.question_assistant as assistant_service

    monkeypatch.setattr(assistant_service.get_settings(), "dify_question_assistant_api_key", "test-key")

    async def fake_call_dify_chatflow(**kwargs):
        assert kwargs["api_base"] == "https://ai-dashboard.solarifyai.com/v1"
        assert "Daostore 怎么使用" in kwargs["query"]
        return "可以先从问题场景、工具配置和报错信息三步排查。"

    monkeypatch.setattr(assistant_service, "_call_dify_chatflow", fake_call_dify_chatflow)

    resp = await client.post(
        "/api/v1/questions",
        json={
            "title": "Daostore 怎么使用",
            "description": "我想知道 daostore 怎么使用",
            "tools": ["Daostore"],
        },
        headers=auth_headers,
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["answer_count"] == 1
    assert data["answers"][0]["content"] == "可以先从问题场景、工具配置和报错信息三步排查。"
    assert data["answers"][0]["author"]["username"] == "question_assistant"
    assert data["answers"][0]["author"]["display_name"] == "回答小助手"


async def test_question_assistant_disabled_by_admin_setting(client, auth_headers, db, monkeypatch):
    import app.services.question_assistant as assistant_service
    from app.models.platform_setting import PlatformSetting

    monkeypatch.setattr(assistant_service.get_settings(), "dify_question_assistant_api_key", "test-key")
    called = False

    async def fake_call_dify_chatflow(**kwargs):
        nonlocal called
        called = True
        return "不应该生成"

    monkeypatch.setattr(assistant_service, "_call_dify_chatflow", fake_call_dify_chatflow)

    async with db() as session:
        session.add(
            PlatformSetting(
                key=QUESTION_ASSISTANT_SETTING_KEY,
                value={
                    "enabled": False,
                    "api_base": "https://ai-dashboard.solarifyai.com/v1",
                    "assistant_display_name": "回答小助手",
                },
            )
        )
        await session.commit()

    resp = await client.post(
        "/api/v1/questions",
        json={"title": "关闭时不生成回答"},
        headers=auth_headers,
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["answer_count"] == 0
    assert data["answers"] == []
    assert called is False


async def test_admin_can_update_question_assistant_settings(client, admin_headers, monkeypatch):
    import app.api.routes.admin.settings as settings_route

    monkeypatch.setattr(settings_route.get_settings(), "dify_question_assistant_api_key", "test-key")

    resp = await client.patch(
        "/api/v1/admin/settings/question-assistant",
        headers=admin_headers,
        json={
            "enabled": False,
        },
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["enabled"] is False
    assert data["api_base"] == "https://ai-dashboard.solarifyai.com/v1"
    assert data["api_key_configured"] is True
