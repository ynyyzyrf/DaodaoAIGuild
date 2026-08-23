async def test_create_tutorial(client, auth_headers):
    resp = await client.post(
        "/api/v1/tutorials",
        json={
            "title": "从零搭建企业微信 AI 客服",
            "summary": "一步步接入 OpenClaw",
            "content": "# 教程\n\n这是 **Markdown** 内容。",
            "category": "FDE 落地",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    data = body["data"]
    assert data["title"] == "从零搭建企业微信 AI 客服"
    assert data["content"].startswith("# 教程")
    assert data["author"]["username"] == "alice"
    assert data["slug"]
    # V3.2：新教程默认 pending（预审），未通过前不在前台列表
    assert data["status"] == "pending"


async def test_create_tutorial_requires_auth(client):
    resp = await client.post(
        "/api/v1/tutorials",
        json={"title": "x", "content": "y", "category": "AI Agent"},
    )
    assert resp.status_code == 401


async def test_list_categories(client):
    resp = await client.get("/api/v1/tutorials/categories")
    assert resp.status_code == 200
    assert "AI Agent" in resp.json()["data"]


async def test_list_tutorials(client, auth_headers, approve_tutorial):
    ids = []
    for i in range(3):
        r = await client.post(
            "/api/v1/tutorials",
            json={"title": f"教程{i}", "content": f"内容{i}", "category": "AI Agent"},
            headers=auth_headers,
        )
        ids.append(r.json()["data"]["id"])
    for tid in ids:
        await approve_tutorial(tid)
    resp = await client.get("/api/v1/tutorials")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 3
    assert len(data["items"]) == 3
    # 列表不含正文
    assert "content" not in data["items"][0]


async def test_list_tutorials_filter_by_category(client, auth_headers, approve_tutorial):
    r1 = await client.post(
        "/api/v1/tutorials",
        json={"title": "A", "content": "x", "category": "AI Agent"},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/tutorials",
        json={"title": "B", "content": "y", "category": "RAG 检索增强"},
        headers=auth_headers,
    )
    await approve_tutorial(r1.json()["data"]["id"])
    resp = await client.get("/api/v1/tutorials", params={"category": "AI Agent"})
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["title"] == "A"


async def test_list_tutorials_excludes_pending(client, auth_headers):
    """V3.2 预审：未通过的 pending 教程不出现在前台列表。"""
    await client.post(
        "/api/v1/tutorials",
        json={"title": "待审教程", "content": "x", "category": "AI Agent"},
        headers=auth_headers,
    )
    resp = await client.get("/api/v1/tutorials")
    data = resp.json()["data"]
    assert data["total"] == 0


async def test_get_tutorial_detail(client, auth_headers):
    created = await client.post(
        "/api/v1/tutorials",
        json={"title": "我的教程", "content": "正文内容", "category": "AI Agent"},
        headers=auth_headers,
    )
    slug = created.json()["data"]["slug"]
    resp = await client.get(f"/api/v1/tutorials/{slug}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["view_count"] == 1
    assert data["content"] == "正文内容"


async def test_get_tutorial_not_found(client):
    resp = await client.get("/api/v1/tutorials/not-exists")
    assert resp.status_code == 404


async def test_like_tutorial_toggle(client, auth_headers):
    created = await client.post(
        "/api/v1/tutorials",
        json={"title": "教程", "content": "内容", "category": "AI Agent"},
        headers=auth_headers,
    )
    tid = created.json()["data"]["id"]
    r1 = await client.post(f"/api/v1/tutorials/{tid}/like", headers=auth_headers)
    assert r1.json()["data"]["active"] is True
    assert r1.json()["data"]["count"] == 1
    r2 = await client.post(f"/api/v1/tutorials/{tid}/like", headers=auth_headers)
    assert r2.json()["data"]["active"] is False
    assert r2.json()["data"]["count"] == 0
