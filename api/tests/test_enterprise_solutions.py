import pytest


async def _login(client, username: str, password: str = "pass1234") -> dict[str, str]:
    resp = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['data']['access_token']}"}


async def _create_approved_company(client, owner_headers, admin_headers, name: str = "Solution Consulting") -> dict:
    draft = await client.post(
        "/api/v1/companies",
        json={"name": name, "contact_name": "Owner", "contact_email": "owner@example.com"},
        headers=owner_headers,
    )
    assert draft.status_code == 200
    company_id = draft.json()["data"]["id"]
    submit = await client.post(f"/api/v1/companies/{company_id}/submit", headers=owner_headers)
    assert submit.status_code == 200
    approved = await client.post(
        f"/api/v1/admin/companies/{company_id}/review",
        json={"status": "approved", "reason": "资料完整"},
        headers=admin_headers,
    )
    assert approved.status_code == 200
    return approved.json()["data"]


async def _submit_solution(client, company_id: int, owner_headers) -> dict:
    draft = await client.post(
        f"/api/v1/companies/{company_id}/solutions",
        json={
            "title": "智能客服知识库",
            "subtitle": "把客服 FAQ、产品资料和历史工单整理成可追溯问答。",
            "category": "企业知识库",
            "industry": "零售",
            "scenario": "客服提效",
            "delivery_cycle": "2-4 周",
            "budget_range": "5000 coin 起",
            "cover_image_url": "/banners/banner-2.png?v=20260828",
            "tags": ["RAG", "知识库", "客服"],
            "case_count": 3,
        },
        headers=owner_headers,
    )
    assert draft.status_code == 200
    solution_id = draft.json()["data"]["id"]
    submitted = await client.post(
        f"/api/v1/companies/{company_id}/solutions/{solution_id}/submit",
        headers=owner_headers,
    )
    assert submitted.status_code == 200
    return submitted.json()["data"]


@pytest.mark.asyncio
async def test_pending_company_solution_is_hidden_from_public_lists(client, seed_user, admin_headers):
    """Catches: exposing consulting-company submitted solutions before admin approval."""
    await seed_user(username="owner", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    company = await _create_approved_company(client, owner_headers, admin_headers)

    pending = await _submit_solution(client, company["id"], owner_headers)
    assert pending["status"] == "pending"

    public_list = await client.get("/api/v1/solutions")
    assert public_list.status_code == 200
    assert public_list.json()["data"]["items"] == []

    home_list = await client.get("/api/v1/solutions/home")
    assert home_list.status_code == 200
    assert home_list.json()["data"] == []


@pytest.mark.asyncio
async def test_admin_approved_company_solution_appears_in_public_and_home_lists(
    client, seed_user, admin_headers
):
    """Catches: approving a solution without publishing it to the enterprise solution shelf."""
    await seed_user(username="owner", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    company = await _create_approved_company(client, owner_headers, admin_headers)
    pending = await _submit_solution(client, company["id"], owner_headers)

    approved = await client.post(
        f"/api/v1/admin/solutions/{pending['id']}/review",
        json={"status": "approved", "reason": "案例真实，可上架首页"},
        headers=admin_headers,
    )
    assert approved.status_code == 200
    assert approved.json()["data"]["status"] == "approved"

    public_list = await client.get("/api/v1/solutions")
    assert public_list.status_code == 200
    public_items = public_list.json()["data"]["items"]
    assert [item["title"] for item in public_items] == ["智能客服知识库"]
    assert public_items[0]["company_name"] == company["name"]
    assert public_items[0]["budget_range"] == "5000 coin 起"

    home_list = await client.get("/api/v1/solutions/home")
    assert home_list.status_code == 200
    assert [item["title"] for item in home_list.json()["data"]] == ["智能客服知识库"]

    detail = await client.get(f"/api/v1/solutions/{pending['id']}")
    assert detail.status_code == 200
    detail_data = detail.json()["data"]
    assert detail_data["title"] == "智能客服知识库"
    assert detail_data["company_name"] == company["name"]
    assert detail_data["category"] == "企业知识库"
    assert detail_data["industry"] == "零售"
    assert detail_data["scenario"] == "客服提效"
    assert detail_data["delivery_cycle"] == "2-4 周"
    assert detail_data["budget_range"] == "5000 coin 起"
    assert detail_data["tags"] == ["RAG", "知识库", "客服"]


@pytest.mark.asyncio
async def test_pending_company_solution_detail_is_not_public(client, seed_user, admin_headers):
    await seed_user(username="owner", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    company = await _create_approved_company(client, owner_headers, admin_headers)
    pending = await _submit_solution(client, company["id"], owner_headers)

    detail = await client.get(f"/api/v1/solutions/{pending['id']}")
    assert detail.status_code == 404
