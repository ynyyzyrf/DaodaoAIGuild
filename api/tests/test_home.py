import re

ANON_RE = re.compile(r"^龍蝦騎士\d+號$")


async def test_feed_returns_mixed_activity(client, auth_headers, auth_headers_bob, approve_tutorial):
    # alice 提问，bob 回答且 alice 采纳（→ rescue）；alice 再发一个教程（→ tutorial）
    # 另外发一个未采纳的问题（→ question，避免与 rescue 去重）
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    a = await client.post(
        f"/api/v1/questions/{qid}/answers", json={"content": "回答"}, headers=auth_headers_bob
    )
    await client.post(
        f"/api/v1/questions/{qid}/accept",
        json={"answer_id": a.json()["data"]["id"]},
        headers=auth_headers,
    )
    tut = await client.post(
        "/api/v1/tutorials",
        json={"title": "教程", "content": "内容", "category": "AI Agent"},
        headers=auth_headers,
    )
    await approve_tutorial(tut.json()["data"]["id"])
    await client.post(
        "/api/v1/questions", json={"title": "未采纳的问题"}, headers=auth_headers
    )

    resp = await client.get("/api/v1/home/feed?limit=10")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert isinstance(data, list)

    kinds = {item["kind"] for item in data}
    assert "question" in kinds
    assert "tutorial" in kinds
    assert "rescue" in kinds

    # 字段齐全
    for item in data:
        assert item["kind"] in ("question", "tutorial", "rescue")
        assert item["title"]
        assert "author" in item
        assert item["created_at"]

    # rescue 标题即原问题标题，id 即问题 id
    rescue = next(item for item in data if item["kind"] == "rescue")
    assert rescue["title"] == "问题"
    assert rescue["id"] == qid
    assert rescue["slug"] == ""

    # tutorial 带 slug 供前端跳转
    tutorial = next(item for item in data if item["kind"] == "tutorial")
    assert tutorial["slug"]


async def test_feed_anonymous_question_masked(client, auth_headers):
    await client.post(
        "/api/v1/questions", json={"title": "匿名动态", "is_anonymous": True}, headers=auth_headers
    )
    resp = await client.get("/api/v1/home/feed?limit=10")
    data = resp.json()["data"]
    anon = next(item for item in data if item["kind"] == "question")
    assert ANON_RE.match(anon["author"]["display_name"])
    assert anon["author"]["username"] == ""


async def test_feed_dedup_rescue_wins(client, auth_headers, auth_headers_bob):
    # 同一问题既被「question」又「rescue」收录时，只保留 rescue，避免标题重复
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    a = await client.post(
        f"/api/v1/questions/{qid}/answers", json={"content": "回答"}, headers=auth_headers_bob
    )
    await client.post(
        f"/api/v1/questions/{qid}/accept",
        json={"answer_id": a.json()["data"]["id"]},
        headers=auth_headers,
    )
    resp = await client.get("/api/v1/home/feed?limit=10")
    data = resp.json()["data"]
    same_title = [item for item in data if item["title"] == "问题"]
    assert len(same_title) == 1
    assert same_title[0]["kind"] == "rescue"


async def test_feed_anonymous_self_answered_rescue_masked(client, auth_headers):
    # 匿名提问者自答自采：rescue 项必须同样走掩码，不泄露真实身份
    q = await client.post(
        "/api/v1/questions", json={"title": "匿名问题", "is_anonymous": True}, headers=auth_headers
    )
    qid = q.json()["data"]["id"]
    a = await client.post(
        f"/api/v1/questions/{qid}/answers", json={"content": "自答"}, headers=auth_headers
    )
    await client.post(
        f"/api/v1/questions/{qid}/accept",
        json={"answer_id": a.json()["data"]["id"]},
        headers=auth_headers,
    )
    resp = await client.get("/api/v1/home/feed?limit=10")
    data = resp.json()["data"]
    rescue = next(item for item in data if item["kind"] == "rescue")
    assert rescue["title"] == "匿名问题"
    assert ANON_RE.match(rescue["author"]["display_name"])
    assert rescue["author"]["username"] == ""


async def test_feed_rescue_other_knight_not_masked(client, auth_headers, auth_headers_bob):
    # 其他骑士救援匿名问题不应被掩码（那是他的救援成就）
    q = await client.post(
        "/api/v1/questions", json={"title": "匿名问题", "is_anonymous": True}, headers=auth_headers
    )
    qid = q.json()["data"]["id"]
    a = await client.post(
        f"/api/v1/questions/{qid}/answers", json={"content": "救援"}, headers=auth_headers_bob
    )
    await client.post(
        f"/api/v1/questions/{qid}/accept",
        json={"answer_id": a.json()["data"]["id"]},
        headers=auth_headers,
    )
    resp = await client.get("/api/v1/home/feed?limit=10")
    data = resp.json()["data"]
    rescue = next(item for item in data if item["kind"] == "rescue")
    assert rescue["author"]["username"] == "bob"
    assert rescue["author"]["display_name"] == "管理员"


async def test_feed_limit(client, auth_headers):
    for i in range(3):
        await client.post("/api/v1/questions", json={"title": f"问题{i}"}, headers=auth_headers)
    resp = await client.get("/api/v1/home/feed?limit=2")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 2


async def test_feed_empty(client):
    resp = await client.get("/api/v1/home/feed")
    assert resp.status_code == 200
    assert resp.json()["data"] == []
