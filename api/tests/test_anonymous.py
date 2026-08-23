import re

ANON_RE = re.compile(r"^龍蝦騎士\d+號$")


async def test_create_anonymous_question_masks_author(client, auth_headers):
    resp = await client.post(
        "/api/v1/questions",
        json={"title": "匿名问题", "is_anonymous": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_anonymous"] is True
    author = data["author"]
    assert ANON_RE.match(author["display_name"])
    assert author["username"] == ""
    assert author["avatar_url"] == ""
    assert author["level"] == 0
    assert author["reputation"] == 0
    assert author["is_admin"] is False


async def test_anon_number_stable_per_user(client, auth_headers):
    r1 = await client.post(
        "/api/v1/questions", json={"title": "a", "is_anonymous": True}, headers=auth_headers
    )
    r2 = await client.post(
        "/api/v1/questions", json={"title": "b", "is_anonymous": True}, headers=auth_headers
    )
    d1 = r1.json()["data"]["author"]["display_name"]
    d2 = r2.json()["data"]["author"]["display_name"]
    assert d1 == d2


async def test_normal_question_not_masked(client, auth_headers):
    resp = await client.post("/api/v1/questions", json={"title": "普通问题"}, headers=auth_headers)
    data = resp.json()["data"]
    assert data["is_anonymous"] is False
    assert data["author"]["username"] == "alice"


async def test_anonymous_list_masked(client, auth_headers):
    await client.post(
        "/api/v1/questions", json={"title": "匿名单条", "is_anonymous": True}, headers=auth_headers
    )
    resp = await client.get("/api/v1/questions")
    item = resp.json()["data"]["items"][0]
    assert ANON_RE.match(item["author"]["display_name"])
    assert item["author"]["username"] == ""
