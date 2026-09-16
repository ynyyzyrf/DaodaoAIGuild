async def test_chat_opens_requirement_form_when_intent_workflow_detects_submit(client, auth_headers, monkeypatch):
    import app.api.routes.chat as chat_route

    monkeypatch.setattr(chat_route.get_settings(), "dify_chat_api_key", "chat-key")
    monkeypatch.setattr(chat_route.get_settings(), "dify_requirement_intent_api_key", "intent-key")

    async def fake_call_dify_workflow(**kwargs):
        assert kwargs["api_key"] == "intent-key"
        assert kwargs["inputs"]["query"] == "我想交一個需求，想做經銷商開發 Agent"
        return {
            "intent": "submit_requirement",
            "requirement_draft": {
                "title": "經銷商開發 Agent",
                "description": "想做經銷商開發 Agent",
                "product_name": "經銷商開發",
            },
        }

    async def fake_call_dify_chat_message(**kwargs):
        raise AssertionError("submit_requirement intent should not call the main chat agent yet")

    monkeypatch.setattr(chat_route, "_call_dify_workflow", fake_call_dify_workflow)
    monkeypatch.setattr(chat_route, "_call_dify_chat_message", fake_call_dify_chat_message)

    resp = await client.post(
        "/api/v1/chat/messages",
        headers=auth_headers,
        json={"query": "我想交一個需求，想做經銷商開發 Agent"},
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["action"] == "open_requirement_form"
    assert data["requirement_draft"]["title"] == "經銷商開發 Agent"
    assert data["requirement_draft"]["description"] == "想做經銷商開發 Agent"


async def test_chat_confirmed_requirement_goes_to_main_agent(client, auth_headers, monkeypatch):
    import app.api.routes.chat as chat_route

    monkeypatch.setattr(chat_route.get_settings(), "dify_chat_api_key", "chat-key")
    monkeypatch.setattr(chat_route.get_settings(), "dify_requirement_intent_api_key", "intent-key")

    called = {}

    async def fake_call_dify_workflow(**kwargs):
        raise AssertionError("confirmed requirement should skip intent detection")

    async def fake_call_dify_chat_message(**kwargs):
        called["body"] = kwargs["body"]
        return {
            "answer": "需求已收到，下一步會梳理經銷商畫像與數據來源。",
            "conversation_id": "conv_123",
            "message_id": "msg_123",
        }

    monkeypatch.setattr(chat_route, "_call_dify_workflow", fake_call_dify_workflow)
    monkeypatch.setattr(chat_route, "_call_dify_chat_message", fake_call_dify_chat_message)

    resp = await client.post(
        "/api/v1/chat/messages",
        headers=auth_headers,
        json={
            "query": "確認提交需求：經銷商開發 Agent",
            "intent_confirmed": True,
            "requirement": {
                "enterprise_name": "MAG",
                "contact_name": "MAG",
                "contact_email": "mag@example.com",
                "product_name": "經銷商開發",
                "title": "經銷商開發 Agent",
                "description": "幫銷售團隊尋找、評估、跟進經銷商。",
                "business_background": "目前靠人工整理線索。",
                "deliverable_expectation": "Agent 原型與可追溯線索表。",
                "budget_note": "",
                "expected_delivery_at": None,
            },
        },
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["answer"] == "需求已收到，下一步會梳理經銷商畫像與數據來源。"
    body = called["body"]
    assert body["inputs"]["requirement"]["title"] == "經銷商開發 Agent"
    assert "用户已确认提交一条正式企业需求" in body["query"]
    assert "經銷商開發 Agent" in body["query"]


async def test_chat_parses_action_json_from_main_agent_answer(client, auth_headers, monkeypatch):
    import json

    import app.api.routes.chat as chat_route

    monkeypatch.setattr(chat_route.get_settings(), "dify_chat_api_key", "chat-key")
    monkeypatch.setattr(chat_route.get_settings(), "dify_requirement_intent_api_key", "")

    async def fake_call_dify_chat_message(**kwargs):
        return {
            "answer": json.dumps(
                {
                    "type": "action",
                    "action": "open_requirement_form",
                    "intent": "submit_requirement",
                    "message": "我識別到你想提交一個需求，請確認並補充下面的資訊。",
                    "draft": {
                        "title": "交需求",
                        "background": "",
                        "description": "",
                        "expected_result": "",
                        "deadline": "",
                        "budget": "",
                        "supplement": "",
                    },
                },
                ensure_ascii=False,
            ),
            "conversation_id": "conv_action",
            "message_id": "msg_action",
        }

    monkeypatch.setattr(chat_route, "_call_dify_chat_message", fake_call_dify_chat_message)

    resp = await client.post(
        "/api/v1/chat/messages",
        headers=auth_headers,
        json={"query": "我想交需求"},
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["answer"] == "我識別到你想提交一個需求，請確認並補充下面的資訊。"
    assert data["action"] == "open_requirement_form"
    assert data["conversation_id"] == "conv_action"
    assert data["message_id"] == "msg_action"
    assert data["requirement_draft"]["title"] == "交需求"
    assert data["requirement_draft"]["business_background"] == ""
    assert data["requirement_draft"]["deliverable_expectation"] == ""
