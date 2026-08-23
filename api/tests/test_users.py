async def _user_id(client, username="alice", password="pass1234") -> int:
    login = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    return login.json()["data"]["user"]["id"]


async def test_profile_stats(client, auth_headers, auth_headers_bob):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    a1 = await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答1"}, headers=auth_headers_bob)
    await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答2"}, headers=auth_headers_bob)
    await client.post(
        f"/api/v1/questions/{qid}/accept",
        json={"answer_id": a1.json()["data"]["id"]},
        headers=auth_headers,
    )

    bob_id = await _user_id(client, "bob")
    resp = await client.get(f"/api/v1/users/{bob_id}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["questions_count"] == 0
    assert data["answers_count"] == 2
    assert data["accepted_count"] == 1
    assert data["tutorials_count"] == 0
    # 基础身份字段仍存在
    assert data["username"] == "bob"
    assert data["reputation"] == 30  # 两条回答 +5/+5，一条被采纳 +20


async def test_profile_stats_for_question_author(client, auth_headers, auth_headers_bob):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答"}, headers=auth_headers_bob)
    await client.post(
        "/api/v1/tutorials",
        json={"title": "教程", "content": "内容", "category": "AI Agent"},
        headers=auth_headers,
    )
    alice_id = await _user_id(client)
    resp = await client.get(f"/api/v1/users/{alice_id}")
    data = resp.json()["data"]
    assert data["questions_count"] == 1
    assert data["answers_count"] == 0
    assert data["tutorials_count"] == 1


async def test_leaderboard_order(client, auth_headers, auth_headers_bob):
    await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)  # alice +2
    await client.post(
        "/api/v1/tutorials",
        json={"title": "教程", "content": "内容", "category": "AI Agent"},
        headers=auth_headers_bob,  # bob +10
    )
    resp = await client.get("/api/v1/users/leaderboard")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data[0]["username"] == "bob"
    assert data[0]["reputation"] == 10
    assert data[1]["username"] == "alice"


async def test_leaderboard_metric_tutorial(client, auth_headers, auth_headers_bob, approve_tutorial):
    ids = []
    for _ in range(2):
        r = await client.post(
            "/api/v1/tutorials",
            json={"title": "教程", "content": "内容", "category": "AI Agent"},
            headers=auth_headers_bob,
        )
        ids.append(r.json()["data"]["id"])
    r = await client.post(
        "/api/v1/tutorials",
        json={"title": "教程", "content": "内容", "category": "AI Agent"},
        headers=auth_headers,
    )
    ids.append(r.json()["data"]["id"])
    for tid in ids:
        await approve_tutorial(tid)
    resp = await client.get("/api/v1/users/leaderboard?metric=tutorial")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data[0]["username"] == "bob"
    assert data[0]["metric_value"] == 2
    assert isinstance(data[0]["top_tags"], list)


async def test_leaderboard_metric_rescue(client, auth_headers, auth_headers_bob):
    for _ in range(2):
        q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
        qid = q.json()["data"]["id"]
        a = await client.post(
            f"/api/v1/questions/{qid}/answers", json={"content": "答"}, headers=auth_headers_bob
        )
        await client.post(
            f"/api/v1/questions/{qid}/accept",
            json={"answer_id": a.json()["data"]["id"]},
            headers=auth_headers,
        )
    resp = await client.get("/api/v1/users/leaderboard?metric=rescue")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data[0]["username"] == "bob"
    assert data[0]["metric_value"] == 2


async def test_leaderboard_default_reputation_has_new_fields(client, auth_headers, auth_headers_bob):
    resp = await client.get("/api/v1/users/leaderboard")
    data = resp.json()["data"]
    # 默认 metric=reputation，兼容旧字段并带新字段
    assert all("metric_value" in item for item in data)
    assert all("top_tags" in item for item in data)
    assert data[0]["metric_value"] == data[0]["reputation"]
    assert data[0]["username"] == resp.json()["data"][0]["username"]


async def test_leaderboard_rescue_window_uses_accepted_at(
    client, auth_headers, auth_headers_bob, db
):
    # 「本週救援」按实际采纳时间 accepted_at 过滤：窗口内采纳的计入，8 天前采纳的不计
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import update

    from app.models.answer import Answer

    q1 = await client.post("/api/v1/questions", json={"title": "问题1"}, headers=auth_headers)
    q1id = q1.json()["data"]["id"]
    a1 = await client.post(
        f"/api/v1/questions/{q1id}/answers", json={"content": "答"}, headers=auth_headers_bob
    )
    await client.post(
        f"/api/v1/questions/{q1id}/accept",
        json={"answer_id": a1.json()["data"]["id"]},
        headers=auth_headers,
    )

    q2 = await client.post("/api/v1/questions", json={"title": "问题2"}, headers=auth_headers)
    q2id = q2.json()["data"]["id"]
    a2 = await client.post(
        f"/api/v1/questions/{q2id}/answers", json={"content": "答"}, headers=auth_headers_bob
    )
    await client.post(
        f"/api/v1/questions/{q2id}/accept",
        json={"answer_id": a2.json()["data"]["id"]},
        headers=auth_headers,
    )

    # 把第二条的 accepted_at 改为 8 天前（本周窗口外），即便它是最近创建的
    old = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=8)
    async with db() as session:
        await session.execute(update(Answer).where(Answer.id == a2.json()["data"]["id"]).values(accepted_at=old))
        await session.commit()

    resp = await client.get("/api/v1/users/leaderboard?metric=rescue")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data[0]["username"] == "bob"
    assert data[0]["metric_value"] == 1


async def test_leaderboard_tutorial_only_counts_published(client, auth_headers, auth_headers_bob, db, approve_tutorial):
    # 教程贡献只统计 published 状态，草稿/下架不计入
    from sqlalchemy import select, update

    from app.models.tutorial import Tutorial

    ids = []
    for _ in range(2):
        r = await client.post(
            "/api/v1/tutorials",
            json={"title": "教程", "content": "内容", "category": "AI Agent"},
            headers=auth_headers_bob,
        )
        ids.append(r.json()["data"]["id"])
    for tid in ids:
        await approve_tutorial(tid)
    bob_id = await _user_id(client, "bob")
    async with db() as session:
        one = (
            await session.execute(
                select(Tutorial.id).where(Tutorial.author_id == bob_id).order_by(Tutorial.id).limit(1)
            )
        ).scalar_one()
        await session.execute(update(Tutorial).where(Tutorial.id == one).values(status="draft"))
        await session.commit()

    resp = await client.get("/api/v1/users/leaderboard?metric=tutorial")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data[0]["username"] == "bob"
    assert data[0]["metric_value"] == 1


async def test_leaderboard_top_tags_limited_to_3(client, auth_headers):
    # 擅長領域最多取 3 个 tag；同计数时按 tag 名升序，顺序确定
    for tag in ["python", "langgraph", "rag", "agent"]:
        await client.post(
            "/api/v1/questions", json={"title": f"问题-{tag}", "tags": [tag]}, headers=auth_headers
        )
    resp = await client.get("/api/v1/users/leaderboard")
    assert resp.status_code == 200
    data = resp.json()["data"]
    alice = next(item for item in data if item["username"] == "alice")
    assert len(alice["top_tags"]) == 3
    # count 全为 1 时按 name 升序 → agent / langgraph / python
    assert alice["top_tags"] == ["agent", "langgraph", "python"]
