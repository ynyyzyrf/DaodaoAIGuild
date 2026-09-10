import pytest


@pytest.fixture(autouse=True)
def clear_admin_login_locks():
    from app.services import admin_auth

    admin_auth._LOCKS.clear()


async def _login(client, username: str, password: str = "pass1234") -> dict[str, str]:
    resp = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['data']['access_token']}"}


async def _create_approved_company(client, owner_headers, admin_headers, name: str = "ABC Consulting") -> dict:
    draft = await client.post(
        "/api/v1/companies",
        json={"name": name, "contact_name": "Owner", "contact_email": "owner@example.com"},
        headers=owner_headers,
    )
    assert draft.status_code == 200
    company_id = draft.json()["data"]["id"]

    submit = await client.post(f"/api/v1/companies/{company_id}/submit", headers=owner_headers)
    assert submit.status_code == 200
    assert submit.json()["data"]["status"] == "pending"

    approved = await client.post(
        f"/api/v1/admin/companies/{company_id}/review",
        json={"status": "approved", "reason": "资料完整"},
        headers=admin_headers,
    )
    assert approved.status_code == 200
    return approved.json()["data"]


@pytest.mark.asyncio
async def test_company_approval_creates_exactly_one_owner(client, seed_user, admin_headers):
    """Catches: approving company without creating the applicant as the sole Owner."""
    await seed_user(username="owner", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")

    company = await _create_approved_company(client, owner_headers, admin_headers)

    assert company["status"] == "approved"
    assert company["members"]["owner"]["username"] == "owner"
    assert company["members"]["admins"] == []
    assert company["members"]["lobster_knights"] == []
    assert company["lobster_knight_count"] == 0


@pytest.mark.asyncio
async def test_verified_fde_applicant_becomes_active_owner_lobster_knight(
    client, seed_user, admin_headers
):
    """Catches: approving a verified FDE applicant as Owner without active same-company belonging."""
    owner = await seed_user(username="owner", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    mark = await client.patch(
        f"/api/v1/admin/users/{owner.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )
    assert mark.status_code == 200

    company = await _create_approved_company(client, owner_headers, admin_headers)

    assert company["members"]["owner"]["username"] == "owner"
    assert [member["username"] for member in company["members"]["lobster_knights"]] == ["owner"]
    assert company["lobster_knight_count"] == 1


@pytest.mark.asyncio
async def test_fde_join_request_approval_creates_lobster_knight_belonging(
    client, seed_user, admin_headers
):
    """Catches: approving a join request without creating active FDE formal belonging."""
    await seed_user(username="owner", password="pass1234", is_admin=False)
    fde = await seed_user(username="knight", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    knight_headers = await _login(client, "knight")
    company = await _create_approved_company(client, owner_headers, admin_headers)

    mark = await client.patch(
        f"/api/v1/admin/users/{fde.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )
    assert mark.status_code == 200

    join = await client.post(f"/api/v1/companies/{company['id']}/join-requests", headers=knight_headers)
    assert join.status_code == 200
    request_id = join.json()["data"]["id"]

    approved = await client.post(
        f"/api/v1/companies/{company['id']}/join-requests/{request_id}/approve",
        headers=owner_headers,
    )
    assert approved.status_code == 200
    assert approved.json()["data"]["status"] == "active"

    detail = await client.get(f"/api/v1/companies/{company['id']}")
    assert detail.status_code == 200
    data = detail.json()["data"]
    assert data["lobster_knight_count"] == 1
    assert data["members"]["lobster_knights"][0]["username"] == "knight"
    assert data["members"]["owner"]["username"] == "owner"


@pytest.mark.asyncio
async def test_fde_cannot_have_two_pending_join_requests(client, seed_user, admin_headers):
    """Catches: allowing concurrent pending FDE join requests."""
    await seed_user(username="owner_a", password="pass1234", is_admin=False)
    await seed_user(username="owner_b", password="pass1234", is_admin=False)
    fde = await seed_user(username="knight", password="pass1234", is_admin=False)
    owner_a_headers = await _login(client, "owner_a")
    owner_b_headers = await _login(client, "owner_b")
    knight_headers = await _login(client, "knight")
    company_a = await _create_approved_company(client, owner_a_headers, admin_headers, "A Consulting")
    company_b = await _create_approved_company(client, owner_b_headers, admin_headers, "B Consulting")
    await client.patch(
        f"/api/v1/admin/users/{fde.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )

    first = await client.post(f"/api/v1/companies/{company_a['id']}/join-requests", headers=knight_headers)
    assert first.status_code == 200

    second = await client.post(f"/api/v1/companies/{company_b['id']}/join-requests", headers=knight_headers)
    assert second.status_code == 409
    assert "待处理" in second.json()["message"]


@pytest.mark.asyncio
async def test_company_role_blocks_lobster_knight_belonging_to_other_company(
    client, seed_user, admin_headers
):
    """Catches: letting a company Admin formally belong as a Lobster Knight to another company."""
    await seed_user(username="owner_a", password="pass1234", is_admin=False)
    await seed_user(username="owner_b", password="pass1234", is_admin=False)
    candidate = await seed_user(username="candidate", password="pass1234", is_admin=False)
    owner_a_headers = await _login(client, "owner_a")
    owner_b_headers = await _login(client, "owner_b")
    candidate_headers = await _login(client, "candidate")
    company_a = await _create_approved_company(client, owner_a_headers, admin_headers, "A Consulting")
    company_b = await _create_approved_company(client, owner_b_headers, admin_headers, "B Consulting")
    await client.patch(
        f"/api/v1/admin/users/{candidate.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )

    add_admin = await client.post(
        f"/api/v1/companies/{company_a['id']}/admins",
        json={"user_id": candidate.id},
        headers=owner_a_headers,
    )
    assert add_admin.status_code == 200

    join_other = await client.post(
        f"/api/v1/companies/{company_b['id']}/join-requests",
        headers=candidate_headers,
    )
    assert join_other.status_code == 409
    assert "同一家公司" in join_other.json()["message"]


@pytest.mark.asyncio
async def test_rejected_company_can_be_revised_and_resubmitted(client, seed_user, admin_headers):
    """Catches: treating rejected onboarding as terminal and forcing a new Company."""
    await seed_user(username="owner", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")

    draft = await client.post(
        "/api/v1/companies",
        json={"name": "Needs Work", "contact_name": "Owner", "contact_email": "owner@example.com"},
        headers=owner_headers,
    )
    company_id = draft.json()["data"]["id"]
    await client.post(f"/api/v1/companies/{company_id}/submit", headers=owner_headers)
    rejected = await client.post(
        f"/api/v1/admin/companies/{company_id}/review",
        json={"status": "rejected", "reason": "资料不足"},
        headers=admin_headers,
    )
    assert rejected.status_code == 200
    assert rejected.json()["data"]["status"] == "rejected"

    resubmit = await client.post(f"/api/v1/companies/{company_id}/submit", headers=owner_headers)
    assert resubmit.status_code == 200
    assert resubmit.json()["data"]["id"] == company_id
    assert resubmit.json()["data"]["status"] == "pending"


@pytest.mark.asyncio
async def test_public_company_list_only_shows_approved_companies(client, seed_user, admin_headers):
    """Catches: exposing draft or rejected onboarding records in the public company directory."""
    await seed_user(username="owner_a", password="pass1234", is_admin=False)
    await seed_user(username="owner_b", password="pass1234", is_admin=False)
    owner_a_headers = await _login(client, "owner_a")
    owner_b_headers = await _login(client, "owner_b")
    approved = await _create_approved_company(client, owner_a_headers, admin_headers, "Approved Co")

    draft = await client.post(
        "/api/v1/companies",
        json={"name": "Draft Co", "contact_name": "Owner", "contact_email": "owner@example.com"},
        headers=owner_b_headers,
    )
    assert draft.status_code == 200

    listing = await client.get("/api/v1/companies")
    assert listing.status_code == 200
    names = [c["name"] for c in listing.json()["data"]["items"]]
    assert names == [approved["name"]]


@pytest.mark.asyncio
async def test_admin_can_list_companies_by_status(client, seed_user, admin_headers):
    await seed_user(username="owner_a", password="pass1234", is_admin=False)
    await seed_user(username="owner_b", password="pass1234", is_admin=False)
    await seed_user(username="owner_c", password="pass1234", is_admin=False)
    owner_a_headers = await _login(client, "owner_a")
    owner_b_headers = await _login(client, "owner_b")
    owner_c_headers = await _login(client, "owner_c")

    approved = await _create_approved_company(client, owner_a_headers, admin_headers, "Approved Co")
    pending = await client.post(
        "/api/v1/companies",
        json={"name": "Pending Co", "contact_name": "Owner", "contact_email": "owner@example.com"},
        headers=owner_b_headers,
    )
    assert pending.status_code == 200
    await client.post(f"/api/v1/companies/{pending.json()['data']['id']}/submit", headers=owner_b_headers)
    draft = await client.post(
        "/api/v1/companies",
        json={"name": "Draft Co", "contact_name": "Owner", "contact_email": "owner@example.com"},
        headers=owner_c_headers,
    )
    assert draft.status_code == 200

    pending_list = await client.get("/api/v1/admin/companies?status=pending", headers=admin_headers)
    assert pending_list.status_code == 200
    assert [item["name"] for item in pending_list.json()["data"]["items"]] == ["Pending Co"]

    all_list = await client.get("/api/v1/admin/companies", headers=admin_headers)
    assert all_list.status_code == 200
    names = {item["name"] for item in all_list.json()["data"]["items"]}
    assert {approved["name"], "Pending Co", "Draft Co"}.issubset(names)


@pytest.mark.asyncio
async def test_my_company_state_shows_pending_join_request(client, seed_user, admin_headers):
    await seed_user(username="owner", password="pass1234", is_admin=False)
    fde = await seed_user(username="knight", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    knight_headers = await _login(client, "knight")
    company = await _create_approved_company(client, owner_headers, admin_headers)
    await client.patch(
        f"/api/v1/admin/users/{fde.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )

    join = await client.post(f"/api/v1/companies/{company['id']}/join-requests", headers=knight_headers)
    assert join.status_code == 200

    resp = await client.get("/api/v1/companies/me/state", headers=knight_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["pending_join_request"]["company_id"] == company["id"]
    assert data["active_company"] is None


@pytest.mark.asyncio
async def test_my_company_state_shows_active_company_after_approval(client, seed_user, admin_headers):
    await seed_user(username="owner", password="pass1234", is_admin=False)
    fde = await seed_user(username="knight", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    knight_headers = await _login(client, "knight")
    company = await _create_approved_company(client, owner_headers, admin_headers)
    await client.patch(
        f"/api/v1/admin/users/{fde.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )
    join = await client.post(f"/api/v1/companies/{company['id']}/join-requests", headers=knight_headers)
    assert join.status_code == 200
    request_id = join.json()["data"]["id"]
    approved = await client.post(
        f"/api/v1/companies/{company['id']}/join-requests/{request_id}/approve",
        headers=owner_headers,
    )
    assert approved.status_code == 200

    resp = await client.get("/api/v1/companies/me/state", headers=knight_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["active_company"]["id"] == company["id"]
    assert data["pending_join_request"] is None


@pytest.mark.asyncio
async def test_my_company_state_shows_managed_companies_for_owner(client, seed_user, admin_headers):
    await seed_user(username="owner", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    company = await _create_approved_company(client, owner_headers, admin_headers)

    resp = await client.get("/api/v1/companies/me/state", headers=owner_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert [item["id"] for item in data["managed_companies"]] == [company["id"]]
    assert data["managed_companies"][0]["members"]["owner"]["username"] == "owner"


@pytest.mark.asyncio
async def test_marking_company_owner_as_fde_makes_them_assignable_lobster_knight(
    client, seed_user, admin_headers
):
    """Catches: a verified FDE owner missing from the company Lobster Knight picker."""
    owner = await seed_user(username="owner", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    company = await _create_approved_company(client, owner_headers, admin_headers)

    mark = await client.patch(
        f"/api/v1/admin/users/{owner.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )
    assert mark.status_code == 200

    detail = await client.get(f"/api/v1/companies/{company['id']}")
    assert detail.status_code == 200
    data = detail.json()["data"]
    assert data["members"]["owner"]["username"] == "owner"
    assert [member["username"] for member in data["members"]["lobster_knights"]] == ["owner"]
    assert data["lobster_knight_count"] == 1


@pytest.mark.asyncio
async def test_owner_can_list_pending_join_requests_and_non_member_cannot(client, seed_user, admin_headers):
    await seed_user(username="owner", password="pass1234", is_admin=False)
    fde = await seed_user(username="knight", password="pass1234", is_admin=False)
    await seed_user(username="stranger", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    knight_headers = await _login(client, "knight")
    stranger_headers = await _login(client, "stranger")
    company = await _create_approved_company(client, owner_headers, admin_headers)
    await client.patch(
        f"/api/v1/admin/users/{fde.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )
    join = await client.post(f"/api/v1/companies/{company['id']}/join-requests", headers=knight_headers)
    assert join.status_code == 200

    listing = await client.get(f"/api/v1/companies/{company['id']}/join-requests", headers=owner_headers)
    assert listing.status_code == 200
    items = listing.json()["data"]
    assert len(items) == 1
    assert items[0]["company_id"] == company["id"]
    assert items[0]["user"]["username"] == "knight"

    forbidden = await client.get(f"/api/v1/companies/{company['id']}/join-requests", headers=stranger_headers)
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_release_lobster_knight_keeps_company_admin_role(client, seed_user, admin_headers):
    """Catches: releasing FDE belonging accidentally removing Company Role."""
    owner = await seed_user(username="owner", password="pass1234", is_admin=False)
    fde = await seed_user(username="knight", password="pass1234", is_admin=False)
    owner_headers = await _login(client, "owner")
    knight_headers = await _login(client, "knight")
    company = await _create_approved_company(client, owner_headers, admin_headers)
    await client.patch(
        f"/api/v1/admin/users/{fde.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )
    await client.patch(
        f"/api/v1/admin/users/{owner.id}",
        json={"is_verified_fde": True, "reason": "人工确认"},
        headers=admin_headers,
    )

    join = await client.post(f"/api/v1/companies/{company['id']}/join-requests", headers=knight_headers)
    request_id = join.json()["data"]["id"]
    await client.post(f"/api/v1/companies/{company['id']}/join-requests/{request_id}/approve", headers=owner_headers)

    make_admin = await client.post(
        f"/api/v1/companies/{company['id']}/admins",
        json={"user_id": fde.id},
        headers=owner_headers,
    )
    assert make_admin.status_code == 200

    self_release = await client.post(f"/api/v1/companies/{company['id']}/members/{fde.id}/release", headers=knight_headers)
    assert self_release.status_code == 403

    release = await client.post(f"/api/v1/companies/{company['id']}/members/{fde.id}/release", headers=owner_headers)
    assert release.status_code == 200

    detail = await client.get(f"/api/v1/companies/{company['id']}")
    data = detail.json()["data"]
    assert data["lobster_knight_count"] == 1
    assert [member["username"] for member in data["members"]["lobster_knights"]] == ["owner"]
    assert data["members"]["admins"][0]["username"] == "knight"
