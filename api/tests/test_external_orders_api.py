from datetime import UTC, datetime, timedelta

import pytest

from app.core.external_api_security import hash_external_api_key
from app.models.external_api import ExternalApiKey, ExternalApiLog


@pytest.mark.asyncio
async def test_external_order_create_requires_api_key(client):
    resp = await client.post(
        "/api/open/v1/orders",
        json={
            "enterprise_name": "Globex",
            "title": "Build an AI support workflow",
            "description": "Need a customer-service triage workflow.",
        },
    )

    assert resp.status_code == 401
    assert resp.json()["code"] == 41021


@pytest.mark.asyncio
async def test_external_order_create_rejects_invalid_api_key(client):
    resp = await client.post(
        "/api/open/v1/orders",
        json={
            "enterprise_name": "Globex",
            "title": "Build an AI support workflow",
        },
        headers={"X-API-Key": "dsk_test_missing"},
    )

    assert resp.status_code == 401
    assert resp.json()["code"] == 41022


@pytest.mark.asyncio
async def test_external_order_create_requires_orders_write_scope(client, db, seed_user):
    owner = await seed_user(username="external-readonly", password="pass1234", is_admin=False)
    raw_key = "dsk_test_readonly_key"
    async with db() as session:
        session.add(
            ExternalApiKey(
                name="Read-only integration",
                key_prefix="dsk_test",
                key_hash=hash_external_api_key(raw_key),
                owner_user_id=owner.id,
                scopes=["orders:read"],
                status="active",
                created_by=owner.id,
            )
        )
        await session.commit()

    resp = await client.post(
        "/api/open/v1/orders",
        json={
            "enterprise_name": "Globex",
            "title": "Build an AI support workflow",
        },
        headers={"X-API-Key": raw_key},
    )

    assert resp.status_code == 403
    assert resp.json()["code"] == 42021


@pytest.mark.asyncio
async def test_external_order_create_rejects_expired_api_key(client, db, seed_user):
    owner = await seed_user(username="external-expired", password="pass1234", is_admin=False)
    raw_key = "dsk_test_expired_key"
    async with db() as session:
        session.add(
            ExternalApiKey(
                name="Expired integration",
                key_prefix="dsk_test",
                key_hash=hash_external_api_key(raw_key),
                owner_user_id=owner.id,
                scopes=["orders:write"],
                status="active",
                expires_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1),
                created_by=owner.id,
            )
        )
        await session.commit()

    resp = await client.post(
        "/api/open/v1/orders",
        json={
            "enterprise_name": "Globex",
            "title": "Build an AI support workflow",
        },
        headers={"X-API-Key": raw_key},
    )

    assert resp.status_code == 401
    assert resp.json()["code"] == 41024


@pytest.mark.asyncio
async def test_external_order_create_with_valid_api_key_enters_review_queue(client, db, seed_user):
    owner = await seed_user(username="external-owner", password="pass1234", is_admin=False)
    raw_key = "dsk_test_valid_order_key"
    async with db() as session:
        session.add(
            ExternalApiKey(
                name="CRM integration",
                key_prefix="dsk_test",
                key_hash=hash_external_api_key(raw_key),
                owner_user_id=owner.id,
                scopes=["orders:write"],
                status="active",
                created_by=owner.id,
            )
        )
        await session.commit()

    resp = await client.post(
        "/api/open/v1/orders",
        json={
            "enterprise_name": "Globex",
            "contact_name": "Ada",
            "contact_email": "ada@example.com",
            "title": "Build an AI support workflow",
            "description": "Need a customer-service triage workflow.",
            "budget_amount": 20000,
        },
        headers={"X-API-Key": raw_key},
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert set(data) == {
        "id",
        "enterprise_name",
        "contact_name",
        "contact_email",
        "title",
        "status",
        "next_step",
        "created_at",
    }
    assert data["enterprise_name"] == "Globex"
    assert data["title"] == "Build an AI support workflow"
    assert data["status"] == "pending_review"
    assert data["next_step"] == "platform_review"
    assert "pmdesktop_sync_status" not in data
    assert "pmdesktop_requirement_id" not in data
    assert "reviewed_by" not in data
    assert "claimed_company_id" not in data

    async with db() as session:
        logs = (await session.execute(ExternalApiLog.__table__.select())).mappings().all()
    assert len(logs) == 1
    assert logs[0]["path"] == "/api/open/v1/orders"
    assert logs[0]["status_code"] == 200
