from app.models.user import User
from app.services import order as order_service_module
from app.services.pmdesktop import PmDesktopClient


async def _login(client, username: str, password: str = "pass1234") -> dict[str, str]:
    resp = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_user(seed_user, username: str, *, is_admin: bool = False) -> User:
    return await seed_user(username=username, password="pass1234", is_admin=is_admin)


async def _create_approved_company(client, seed_user, admin_headers, name: str = "Alpha Consulting") -> dict:
    await _create_user(seed_user, "company_owner")
    owner_headers = await _login(client, "company_owner")
    draft = await client.post(
        "/api/v1/companies",
        headers=owner_headers,
        json={
            "name": name,
            "description": "AI delivery consulting company",
            "service_fields": "AI Coding, Agent, Automation",
            "strengths": "Enterprise delivery",
        },
    )
    assert draft.status_code == 200
    company_id = draft.json()["data"]["id"]
    submit = await client.post(f"/api/v1/companies/{company_id}/submit", headers=owner_headers)
    assert submit.status_code == 200
    review = await client.post(
        f"/api/v1/admin/companies/{company_id}/review",
        headers=admin_headers,
        json={"status": "approved", "reason": "qualified"},
    )
    assert review.status_code == 200
    return review.json()["data"]


async def _create_active_fde_for_company(client, db, seed_user, company_id: int) -> tuple[User, dict[str, str]]:
    fde = await _create_user(seed_user, "assigned_fde")
    async with db() as session:
        stored = await session.get(User, fde.id)
        stored.is_verified_fde = True
        await session.commit()
    fde_headers = await _login(client, "assigned_fde")
    join = await client.post(f"/api/v1/companies/{company_id}/join-requests", headers=fde_headers)
    assert join.status_code == 200
    owner_headers = await _login(client, "company_owner")
    approve = await client.post(
        f"/api/v1/companies/{company_id}/join-requests/{join.json()['data']['id']}/approve",
        headers=owner_headers,
    )
    assert approve.status_code == 200
    return fde, fde_headers


async def _create_claimed_order(
    client, seed_user, admin_headers, auth_headers, payload: dict | None = None
) -> tuple[dict, dict, dict[str, str]]:
    company = await _create_approved_company(client, seed_user, admin_headers)
    owner_headers = await _login(client, "company_owner")
    created = await client.post("/api/v1/orders", headers=auth_headers, json=payload or _order_payload())
    order_id = created.json()["data"]["id"]
    await client.post(f"/api/v1/orders/{order_id}/submit", headers=auth_headers)
    await client.post(
        f"/api/v1/admin/orders/{order_id}/review",
        headers=admin_headers,
        json={"status": "approved", "reason": "ready"},
    )
    claim = await client.post(
        f"/api/v1/orders/{order_id}/claims",
        headers=owner_headers,
        json={"company_id": company["id"], "claim_note": "We can deliver this."},
    )
    assert claim.status_code == 200
    return claim.json()["data"], company, owner_headers


def _order_payload() -> dict:
    return {
        "enterprise_name": "Blue Ocean Ltd",
        "contact_name": "MAG",
        "contact_email": "mag@example.com",
        "product_name": "DaoStore",
        "budget_amount": 30000,
        "budget_note": "MVP budget",
        "expected_delivery_at": "2026-11-30T00:00:00",
        "title": "Build an internal AI workflow assistant",
        "description": "Need an AI assistant to route weekly report tasks.",
        "business_background": "The team currently coordinates delivery manually.",
        "deliverable_expectation": "A usable MVP and handover document.",
    }


async def test_enterprise_order_review_to_opportunity_pool(client, auth_headers, admin_headers):
    """Catches: approved demand orders not becoming visible opportunities."""
    create = await client.post("/api/v1/orders", headers=auth_headers, json=_order_payload())

    assert create.status_code == 200
    order = create.json()["data"]
    assert order["status"] == "draft"

    submit = await client.post(f"/api/v1/orders/{order['id']}/submit", headers=auth_headers)
    assert submit.status_code == 200
    assert submit.json()["data"]["status"] == "pending_review"

    review = await client.post(
        f"/api/v1/admin/orders/{order['id']}/review",
        headers=admin_headers,
        json={"status": "approved", "reason": "complete enough for opportunity pool"},
    )
    assert review.status_code == 200
    assert review.json()["data"]["status"] == "opportunity_pool"

    opportunities = await client.get("/api/v1/opportunities", headers=auth_headers)
    assert opportunities.status_code == 200
    items = opportunities.json()["data"]["items"]
    assert [item["id"] for item in items] == [order["id"]]


async def test_user_can_list_pmdesktop_products_for_order_submission(client, auth_headers, monkeypatch):
    """Catches: the order form having no backend-safe way to load PM Desktop products."""
    try:
        from app.api.routes import pmdesktop as pmdesktop_route_module
    except ImportError:
        pmdesktop_route_module = None

    if pmdesktop_route_module is not None:
        async def fake_list_products(self, search=None, page=1, page_size=100):
            return {
                "items": [
                    {"id": "prod_42", "name": "PM Desktop Product", "status": "ACTIVE"},
                    {"id": "prod_43", "name": "Voice Inbox", "status": "PLANNING"},
                ],
                "total": 2,
                "page": page,
                "page_size": page_size,
            }

        monkeypatch.setattr(pmdesktop_route_module.PmDesktopClient, "list_products", fake_list_products)

    resp = await client.get("/api/v1/pmdesktop/products", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["items"] == [
        {"id": "prod_42", "name": "PM Desktop Product", "status": "ACTIVE"},
        {"id": "prod_43", "name": "Voice Inbox", "status": "PLANNING"},
    ]


async def test_pmdesktop_products_route_accepts_data_list_response(client, auth_headers, monkeypatch):
    """Catches: PM Desktop product responses using data[] being normalized as an empty list."""
    from app.services.pmdesktop import PmDesktopClient

    async def fake_request(self, method, path, **kwargs):
        return {
            "data": [{"id": "prod_data", "name": "Data Wrapped Product", "status": "ACTIVE"}],
            "total": 1,
            "page": 1,
            "pageSize": 2,
        }

    monkeypatch.setattr(PmDesktopClient, "_request", fake_request)

    resp = await client.get("/api/v1/pmdesktop/products?page_size=2", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["items"] == [{"id": "prod_data", "name": "Data Wrapped Product", "status": "ACTIVE"}]
    assert data["total"] == 1


async def test_pmdesktop_user_voice_payload_marks_daostore_order_source(monkeypatch):
    """Catches: unscoped PM Desktop sync failing to mark DaoStore orders as group user voices."""
    sent = {}

    async def fake_request(self, method, path, **kwargs):
        sent["method"] = method
        sent["path"] = path
        sent["json"] = kwargs["json"]
        return {"data": {"id": "voice_from_test"}}

    monkeypatch.setattr(PmDesktopClient, "_request", fake_request)
    order = type(
        "OrderStub",
        (),
        {
            "title": "Need a workflow assistant",
            "description": "Route weekly report tasks.",
            "business_background": "Manual coordination today.",
            "deliverable_expectation": "MVP and handover.",
            "enterprise_name": "Blue Ocean Ltd",
            "contact_name": "MAG",
            "contact_email": "mag@example.com",
        },
    )()

    await PmDesktopClient().create_user_voice(order)

    assert sent["method"] == "POST"
    assert sent["path"] == "/api/user-voices"
    assert sent["json"]["category"] == "需求"
    assert sent["json"]["source"] == "MANUAL"
    assert "productId" not in sent["json"]
    assert sent["json"]["description"].startswith("这是从 DaoStore 过来的订单。")


async def test_assigning_fde_to_product_order_syncs_to_pmdesktop_requirement(
    client, auth_headers, admin_headers, seed_user, db, monkeypatch
):
    """Catches: product-scoped demand syncing before the consulting company assigns a follower."""
    sync_calls = []

    async def fake_sync(order):
        sync_calls.append(
            {
                "id": order.id,
                "product_id": order.pmdesktop_product_id,
                "title": order.title,
            }
        )
        order.pmdesktop_sync_status = "synced"
        order.pmdesktop_requirement_id = "pm_req_123"

    monkeypatch.setattr(order_service_module, "sync_order_to_pmdesktop", fake_sync, raising=False)

    order, company, owner_headers = await _create_claimed_order(
        client,
        seed_user,
        admin_headers,
        auth_headers,
        {**_order_payload(), "pmdesktop_product_id": "prod_42", "product_name": "PM Desktop Product"},
    )
    fde, _ = await _create_active_fde_for_company(client, db, seed_user, company["id"])

    assert sync_calls == []

    assign = await client.post(
        f"/api/v1/companies/{company['id']}/orders/{order['id']}/assign-fde",
        headers=owner_headers,
        json={"fde_user_id": fde.id},
    )

    assert assign.status_code == 200
    assigned_order = assign.json()["data"]
    assert sync_calls == [
        {"id": order["id"], "product_id": "prod_42", "title": "Build an internal AI workflow assistant"}
    ]
    assert assigned_order["status"] == "requirement_following"
    assert assigned_order["pmdesktop_sync_status"] == "synced"
    assert assigned_order["pmdesktop_requirement_id"] == "pm_req_123"


async def test_assigning_fde_to_order_without_product_syncs_to_pmdesktop_user_voice(
    client, auth_headers, admin_headers, seed_user, db, monkeypatch
):
    """Catches: unscoped demand syncing before the consulting company assigns a follower."""
    sync_calls = []

    async def fake_sync(order):
        sync_calls.append({"id": order.id, "product_id": order.pmdesktop_product_id})
        order.pmdesktop_sync_status = "synced"
        order.pmdesktop_user_voice_id = "voice_456"

    monkeypatch.setattr(order_service_module, "sync_order_to_pmdesktop", fake_sync, raising=False)

    order, company, owner_headers = await _create_claimed_order(
        client,
        seed_user,
        admin_headers,
        auth_headers,
        {**_order_payload(), "pmdesktop_product_id": "", "product_name": ""},
    )
    fde, _ = await _create_active_fde_for_company(client, db, seed_user, company["id"])

    assert sync_calls == []

    assign = await client.post(
        f"/api/v1/companies/{company['id']}/orders/{order['id']}/assign-fde",
        headers=owner_headers,
        json={"fde_user_id": fde.id},
    )

    assert assign.status_code == 200
    assigned_order = assign.json()["data"]
    assert sync_calls == [{"id": order["id"], "product_id": ""}]
    assert assigned_order["status"] == "requirement_following"
    assert assigned_order["pmdesktop_sync_status"] == "synced"
    assert assigned_order["pmdesktop_user_voice_id"] == "voice_456"


async def test_order_creator_can_view_detail_but_other_user_cannot(client, auth_headers, seed_user):
    """Catches: my-order list linking to a missing or unprotected detail endpoint."""
    created = await client.post("/api/v1/orders", headers=auth_headers, json=_order_payload())
    assert created.status_code == 200
    order = created.json()["data"]

    detail = await client.get(f"/api/v1/orders/{order['id']}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["id"] == order["id"]
    assert detail.json()["data"]["title"] == order["title"]

    await _create_user(seed_user, "other_enterprise")
    other_headers = await _login(client, "other_enterprise")
    forbidden = await client.get(f"/api/v1/orders/{order['id']}", headers=other_headers)
    assert forbidden.status_code == 403


async def test_approved_company_claim_directly_marks_order_claimed(client, auth_headers, admin_headers, seed_user):
    """Catches: a company claim staying as only an interest instead of direct order acceptance."""
    company = await _create_approved_company(client, seed_user, admin_headers)
    owner_headers = await _login(client, "company_owner")
    created = await client.post("/api/v1/orders", headers=auth_headers, json=_order_payload())
    order_id = created.json()["data"]["id"]
    await client.post(f"/api/v1/orders/{order_id}/submit", headers=auth_headers)
    await client.post(
        f"/api/v1/admin/orders/{order_id}/review",
        headers=admin_headers,
        json={"status": "approved", "reason": "ready"},
    )

    claim = await client.post(
        f"/api/v1/orders/{order_id}/claims",
        headers=owner_headers,
        json={"company_id": company["id"], "claim_note": "We can deliver this with our FDE team."},
    )
    assert claim.status_code == 200
    claimed_order = claim.json()["data"]
    assert claimed_order["status"] == "claimed"
    assert claimed_order["claimed_company_id"] == company["id"]
    assert claimed_order["claimed_company_name"] == company["name"]

    detail = await client.get(f"/api/v1/orders/{order_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["data"]["status"] == "claimed"
    assert detail.json()["data"]["claimed_company_name"] == company["name"]

    my_orders = await client.get("/api/v1/orders/me", headers=auth_headers)
    assert my_orders.status_code == 200
    assert my_orders.json()["data"]["items"][0]["claimed_company_name"] == company["name"]


async def test_company_quotes_and_admin_simulates_payment(
    client, auth_headers, admin_headers, seed_user, db, monkeypatch
):
    """Catches: confirmed quotes failing to create a payable simulated payment state."""
    async def fake_sync(order):
        order.pmdesktop_sync_status = "synced"

    monkeypatch.setattr(order_service_module, "sync_order_to_pmdesktop", fake_sync, raising=False)

    order, company, owner_headers = await _create_claimed_order(client, seed_user, admin_headers, auth_headers)
    fde, _ = await _create_active_fde_for_company(client, db, seed_user, company["id"])

    assign = await client.post(
        f"/api/v1/companies/{company['id']}/orders/{order['id']}/assign-fde",
        headers=owner_headers,
        json={"fde_user_id": fde.id},
    )
    assert assign.status_code == 200
    assert assign.json()["data"]["status"] == "requirement_following"
    assert assign.json()["data"]["assigned_fde_user_id"] == fde.id

    quote = await client.post(
        f"/api/v1/companies/{company['id']}/orders/{order['id']}/quotes",
        headers=owner_headers,
        json={
            "amount": 30000,
            "currency": "CNY",
            "start_at": "2026-10-01T00:00:00",
            "delivery_at": "2026-11-30T00:00:00",
            "scope": "Build and hand over the workflow assistant MVP.",
            "deliverables": "MVP, deployment notes, handover document",
            "risks": "Enterprise data access may delay delivery.",
            "enterprise_dependencies": "Provide source materials and reviewers.",
        },
    )
    assert quote.status_code == 200
    assert quote.json()["data"]["status"] == "submitted"

    confirm = await client.post(f"/api/v1/orders/{order['id']}/confirm-quote", headers=auth_headers)
    assert confirm.status_code == 200
    assert confirm.json()["data"]["status"] == "pending_payment"

    paid = await client.post(
        f"/api/v1/admin/orders/{order['id']}/simulate-payment",
        headers=admin_headers,
        json={"note": "offline payment confirmed"},
    )
    assert paid.status_code == 200
    assert paid.json()["data"]["status"] == "paid"


async def test_company_operator_lists_claimed_orders_for_fde_assignment(
    client, auth_headers, admin_headers, seed_user
):
    """Catches: consulting companies accepting orders but having no company-side assignment queue."""
    order, company, owner_headers = await _create_claimed_order(client, seed_user, admin_headers, auth_headers)

    listed = await client.get(f"/api/v1/companies/{company['id']}/orders?status=claimed", headers=owner_headers)

    assert listed.status_code == 200
    data = listed.json()["data"]
    assert data["items"][0]["id"] == order["id"]
    assert data["items"][0]["status"] == "claimed"
    assert data["items"][0]["claimed_company_id"] == company["id"]


async def test_delivery_acceptance_settlement_and_rating_create_fde_record(
    client, auth_headers, admin_headers, seed_user, db, monkeypatch
):
    """Catches: settled orders not creating a reusable FDE project record."""
    async def fake_sync(order):
        order.pmdesktop_sync_status = "synced"

    monkeypatch.setattr(order_service_module, "sync_order_to_pmdesktop", fake_sync, raising=False)

    order, company, owner_headers = await _create_claimed_order(client, seed_user, admin_headers, auth_headers)
    fde, _ = await _create_active_fde_for_company(client, db, seed_user, company["id"])
    await client.post(
        f"/api/v1/companies/{company['id']}/orders/{order['id']}/assign-fde",
        headers=owner_headers,
        json={"fde_user_id": fde.id},
    )
    await client.post(
        f"/api/v1/companies/{company['id']}/orders/{order['id']}/quotes",
        headers=owner_headers,
        json={"amount": 30000, "scope": "MVP delivery", "deliverables": "Working MVP"},
    )
    await client.post(f"/api/v1/orders/{order['id']}/confirm-quote", headers=auth_headers)
    await client.post(f"/api/v1/admin/orders/{order['id']}/simulate-payment", headers=admin_headers, json={"note": ""})

    delivery = await client.post(
        f"/api/v1/companies/{company['id']}/orders/{order['id']}/deliveries",
        headers=owner_headers,
        json={"summary": "MVP delivered for acceptance.", "deliverable_urls": "https://example.com/demo"},
    )
    assert delivery.status_code == 200
    assert delivery.json()["data"]["status"] == "submitted"

    accepted = await client.post(
        f"/api/v1/orders/{order['id']}/accept-delivery",
        headers=auth_headers,
        json={"acceptance_note": "Accepted for MVP scope."},
    )
    assert accepted.status_code == 200
    assert accepted.json()["data"]["status"] == "accepted"

    settled = await client.post(
        f"/api/v1/admin/orders/{order['id']}/settle",
        headers=admin_headers,
        json={"note": "settled without split for MVP"},
    )
    assert settled.status_code == 200
    assert settled.json()["data"]["status"] == "settled"

    rating = await client.post(
        f"/api/v1/orders/{order['id']}/reviews",
        headers=auth_headers,
        json={
            "target_type": "fde",
            "target_id": fde.id,
            "score": 5,
            "content": "Strong delivery and clear handover.",
            "is_public": True,
        },
    )
    assert rating.status_code == 200
    assert rating.json()["data"]["status"] == "rated"

    records = await client.get(f"/api/v1/users/{fde.id}/project-records", headers=auth_headers)
    assert records.status_code == 200
    items = records.json()["data"]
    assert len(items) == 1
    assert items[0]["order_id"] == order["id"]
    assert items[0]["company_id"] == company["id"]
    assert items[0]["enterprise_score"] == 5
