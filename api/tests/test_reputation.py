from app.services.reputation import LEVEL_NAMES, level_for_reputation


def test_level_thresholds():
    assert level_for_reputation(0) == 1
    assert level_for_reputation(29) == 1
    assert level_for_reputation(30) == 2
    assert level_for_reputation(99) == 2
    assert level_for_reputation(100) == 3
    assert level_for_reputation(299) == 3
    assert level_for_reputation(300) == 4
    assert level_for_reputation(800) == 5
    assert level_for_reputation(9999) == 5
    assert LEVEL_NAMES[1] == "小龍蝦"
    assert LEVEL_NAMES[5] == "龍蝦領主"


async def _user_id(client, username="alice", password="pass1234") -> int:
    login = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    return login.json()["data"]["user"]["id"]


async def _reputation(client, user_id: int) -> int:
    resp = await client.get(f"/api/v1/users/{user_id}")
    return resp.json()["data"]["reputation"]


async def test_question_created_adds_reputation(client, auth_headers):
    alice_id = await _user_id(client)
    await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    assert await _reputation(client, alice_id) == 2


async def test_answer_and_accept_add_reputation(client, auth_headers, auth_headers_bob):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    a = await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答案"}, headers=auth_headers_bob)
    aid = a.json()["data"]["id"]
    bob_id = await _user_id(client, "bob")
    assert await _reputation(client, bob_id) == 5  # answer_created

    await client.post(f"/api/v1/questions/{qid}/accept", json={"answer_id": aid}, headers=auth_headers)
    assert await _reputation(client, bob_id) == 25  # +20 answer_accepted


async def test_vote_and_favorite_award_author(client, auth_headers, auth_headers_bob):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    alice_id = await _user_id(client)
    assert await _reputation(client, alice_id) == 2  # question_created

    await client.post(f"/api/v1/questions/{qid}/vote", headers=auth_headers_bob)
    assert await _reputation(client, alice_id) == 3  # +1 content_voted

    await client.post(f"/api/v1/questions/{qid}/favorite", headers=auth_headers_bob)
    assert await _reputation(client, alice_id) == 6  # +3 content_favorited


async def test_self_vote_no_reputation(client, auth_headers):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    alice_id = await _user_id(client)
    await client.post(f"/api/v1/questions/{qid}/vote", headers=auth_headers)
    assert await _reputation(client, alice_id) == 2  # 自投不给声望


async def test_tutorial_created_adds_reputation(client, auth_headers):
    alice_id = await _user_id(client)
    await client.post(
        "/api/v1/tutorials",
        json={"title": "教程", "summary": "s", "content": "c", "category": "AI Agent"},
        headers=auth_headers,
    )
    assert await _reputation(client, alice_id) == 10
