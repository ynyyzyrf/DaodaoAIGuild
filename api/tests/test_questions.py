async def test_create_question(client, auth_headers):
    resp = await client.post(
        "/api/v1/questions",
        json={
            "title": "OpenClaw 无法连接企业微信",
            "description": "401 Unauthorized",
            "tools": ["Docker", "OpenClaw"],
            "tags": ["agent", "企业微信"],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["title"] == "OpenClaw 无法连接企业微信"
    assert data["author"]["username"] == "alice"
    assert "agent" in data["tags"]
    assert data["answer_count"] == 0


async def test_create_question_requires_auth(client):
    resp = await client.post("/api/v1/questions", json={"title": "x"})
    assert resp.status_code == 401
    assert resp.json()["code"] == 41001


async def test_list_questions(client, auth_headers):
    for i in range(3):
        await client.post("/api/v1/questions", json={"title": f"问题{i}"}, headers=auth_headers)
    resp = await client.get("/api/v1/questions")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 3
    assert len(data["items"]) == 3


async def test_get_question_detail(client, auth_headers):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    resp = await client.get(f"/api/v1/questions/{qid}")
    assert resp.status_code == 200
    assert resp.json()["data"]["view_count"] == 1


async def test_create_answer(client, auth_headers, auth_headers_bob):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    resp = await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答案"}, headers=auth_headers_bob)
    assert resp.status_code == 200
    assert resp.json()["data"]["content"] == "答案"
    assert resp.json()["data"]["author"]["username"] == "bob"


async def test_accept_answer_author_only(client, auth_headers, auth_headers_bob):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    a = await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答案"}, headers=auth_headers_bob)
    aid = a.json()["data"]["id"]
    # 非作者采纳 → 403
    resp = await client.post(f"/api/v1/questions/{qid}/accept", json={"answer_id": aid}, headers=auth_headers_bob)
    assert resp.status_code == 403
    # 作者采纳 → 成功
    resp = await client.post(f"/api/v1/questions/{qid}/accept", json={"answer_id": aid}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["code"] == 0


async def test_vote_answer_toggle(client, auth_headers, auth_headers_bob):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    a = await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答案"}, headers=auth_headers_bob)
    aid = a.json()["data"]["id"]
    r1 = await client.post(f"/api/v1/answers/{aid}/vote", headers=auth_headers)
    assert r1.json()["data"]["active"] is True
    assert r1.json()["data"]["count"] == 1
    r2 = await client.post(f"/api/v1/answers/{aid}/vote", headers=auth_headers)
    assert r2.json()["data"]["active"] is False
    assert r2.json()["data"]["count"] == 0


async def test_favorite_question_toggle(client, auth_headers):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    r1 = await client.post(f"/api/v1/questions/{qid}/favorite", headers=auth_headers)
    assert r1.json()["data"]["active"] is True
    r2 = await client.post(f"/api/v1/questions/{qid}/favorite", headers=auth_headers)
    assert r2.json()["data"]["active"] is False


async def test_list_tags(client, auth_headers):
    await client.post("/api/v1/questions", json={"title": "问题", "tags": ["agent", "企业微信"]}, headers=auth_headers)
    resp = await client.get("/api/v1/tags")
    assert resp.status_code == 200
    names = [t["name"] for t in resp.json()["data"]]
    assert "agent" in names
    assert "企业微信" in names
