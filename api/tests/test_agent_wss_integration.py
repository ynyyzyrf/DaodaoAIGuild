from __future__ import annotations

import asyncio
import time
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.routes import agent_ws as agent_ws_routes
from app.api.routes import ws_rooms as ws_rooms_routes
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User
from app.services.agent_gateway import manager
from app.services.agent_gateway.hub import hub


async def _create_test_db(db_url: str):
    engine = create_async_engine(
        db_url,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return engine, session_factory


async def _seed_user(session_factory, *, username: str, password: str) -> None:
    async with session_factory() as session:
        session.add(
            User(
                username=username,
                password_hash=hash_password(password),
                display_name=username.title(),
                is_admin=False,
            )
        )
        await session.commit()


@pytest.fixture
def live_client(monkeypatch, tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 's2_7_integration.db'}"
    engine, session_factory = asyncio.run(_create_test_db(db_url))

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(agent_ws_routes, "async_session_factory", session_factory)
    monkeypatch.setattr(ws_rooms_routes, "async_session_factory", session_factory)
    manager._by_agent.clear()
    manager._by_connection.clear()
    manager._pending_kick.clear()
    hub._by_connection.clear()

    with TestClient(app) as client:
        asyncio.run(_seed_user(session_factory, username="alice", password="pass1234"))
        asyncio.run(_seed_user(session_factory, username="bob", password="pass1234"))
        login = client.post(
            "/api/v1/auth/login", json={"username": "alice", "password": "pass1234"}
        )
        assert login.status_code == 200
        token = login.json()["data"]["access_token"]
        yield client, {"Authorization": f"Bearer {token}"}

    app.dependency_overrides.clear()
    manager._by_agent.clear()
    manager._by_connection.clear()
    manager._pending_kick.clear()
    hub._by_connection.clear()
    asyncio.run(engine.dispose())


def _verification_token(verification_url: str) -> str:
    fragment = urlparse(verification_url).fragment
    values = parse_qs(fragment).get("vt")
    assert values and values[0]
    return values[0]


def _authorize_agent(client: TestClient, auth_headers: dict[str, str], *, name: str) -> dict:
    start = client.post(
        "/api/v1/agent/device/start",
        json={"suggested_name": name, "device_name": "integration-laptop"},
    )
    assert start.status_code == 200
    start_data = start.json()["data"]
    vt = _verification_token(start_data["verification_url"])

    info = client.post(
        "/api/v1/agent/device/info",
        json={"verification_token": vt},
        headers=auth_headers,
    )
    assert info.status_code == 200

    authorize = client.post(
        "/api/v1/agent/device/authorize",
        json={"verification_token": vt, "agent_name": name},
        headers=auth_headers,
    )
    assert authorize.status_code == 200

    poll = client.get(f"/api/v1/agent/device/{start_data['device_code']}/poll")
    assert poll.status_code == 200
    data = poll.json()["data"]
    assert data["status"] == "authorized"
    return data["credential"]


def _agent_auth(credential: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {credential['access_token']}"}


def _eventually_messages(
    client: TestClient,
    room_id: str,
    auth_headers: dict[str, str],
    *,
    expected_count: int = 2,
) -> list[dict]:
    deadline = time.monotonic() + 2
    last_items: list[dict] = []
    while time.monotonic() < deadline:
        resp = client.get(f"/api/v1/rooms/{room_id}/messages", headers=auth_headers)
        assert resp.status_code == 200
        last_items = resp.json()["data"]["items"]
        if len(last_items) >= expected_count:
            return last_items
        time.sleep(0.05)
    return last_items


def test_agent_me_status_reads_live_connection_manager_state(live_client):
    client, auth_headers = live_client
    credential = _authorize_agent(client, auth_headers, name="Hermes")

    with client.websocket_connect(
        "/api/v1/agent/ws", headers=_agent_auth(credential)
    ) as ws:
        connected = ws.receive_json()
        assert connected["type"] == "agent.connected"

        status = client.get("/api/v1/agent/me/status", headers=_agent_auth(credential))
        assert status.status_code == 200
        online = status.json()["data"]
        assert online["agent_id"] == credential["agent_id"]
        assert online["online"] is True
        assert online["connected_at"] is not None
        assert online["last_heartbeat_at"] is not None

        ws.send_json({"type": "agent.heartbeat"})
        ack = ws.receive_json()
        assert ack["type"] == "agent.heartbeat_ack"

    offline = client.get("/api/v1/agent/me/status", headers=_agent_auth(credential))
    assert offline.status_code == 200
    assert offline.json()["data"]["online"] is False


def test_room_message_to_room_reply_preserves_message_correlation(live_client):
    client, auth_headers = live_client
    agent_name = "Hermes"
    credential = _authorize_agent(client, auth_headers, name=agent_name)

    room = client.post(
        "/api/v1/rooms",
        json={"name": "Integration Room", "description": "S2-7"},
        headers=auth_headers,
    )
    assert room.status_code == 200
    room_id = room.json()["data"]["id"]

    invite = client.post(
        f"/api/v1/rooms/{room_id}/agents",
        json={"agent_id": credential["agent_id"]},
        headers=auth_headers,
    )
    assert invite.status_code == 200

    with client.websocket_connect(
        "/api/v1/agent/ws", headers=_agent_auth(credential)
    ) as agent_ws:
        assert agent_ws.receive_json()["type"] == "agent.connected"

        sent = client.post(
            f"/api/v1/rooms/{room_id}/messages",
            json={"content": f"@{agent_name} please reply"},
            headers=auth_headers,
        )
        assert sent.status_code == 200
        original = sent.json()["data"]

        delivered = agent_ws.receive_json()
        assert delivered["type"] == "room.message"
        assert delivered["room_id"] == room_id
        assert delivered["message_id"] == original["id"]

        agent_ws.send_json(
            {
                "type": "room.reply",
                "room_id": room_id,
                "reply_to": original["id"],
                "content": "correlated reply",
            }
        )

        messages = _eventually_messages(client, room_id, auth_headers)

    replies = [m for m in messages if m["sender"]["type"] == "agent"]
    assert len(replies) == 1
    reply = replies[0]
    assert reply["sender"]["id"] == credential["agent_id"]
    assert reply["content"] == "correlated reply"
    assert reply["reply_to_message_id"] == original["id"]


def test_cross_user_room_mentions_deliver_to_both_agents(live_client):
    client, alice_headers = live_client
    bob_login = client.post(
        "/api/v1/auth/login", json={"username": "bob", "password": "pass1234"}
    )
    assert bob_login.status_code == 200
    bob_headers = {"Authorization": f"Bearer {bob_login.json()['data']['access_token']}"}

    alice_agent = _authorize_agent(client, alice_headers, name="HermesA")
    bob_agent = _authorize_agent(client, bob_headers, name="HermesB")

    room = client.post(
        "/api/v1/rooms",
        json={"name": "Dual Hermes Room", "description": "cross-user dual mention"},
        headers=alice_headers,
    )
    assert room.status_code == 200
    room_id = room.json()["data"]["id"]

    invite_alice = client.post(
        f"/api/v1/rooms/{room_id}/agents",
        json={"agent_id": alice_agent["agent_id"]},
        headers=alice_headers,
    )
    assert invite_alice.status_code == 200

    invite_bob = client.post(
        f"/api/v1/rooms/{room_id}/agents",
        json={"agent_id": bob_agent["agent_id"]},
        headers=alice_headers,
    )
    assert invite_bob.status_code == 200
    assert invite_bob.json()["data"]["id"] == bob_agent["agent_id"]

    with client.websocket_connect(
        "/api/v1/agent/ws", headers=_agent_auth(alice_agent)
    ) as alice_ws:
        assert alice_ws.receive_json()["type"] == "agent.connected"
        with client.websocket_connect(
            "/api/v1/agent/ws", headers=_agent_auth(bob_agent)
        ) as bob_ws:
            assert bob_ws.receive_json()["type"] == "agent.connected"

            sent = client.post(
                f"/api/v1/rooms/{room_id}/messages",
                json={
                    "content": (
                        f"@{alice_agent['agent_id']} @{bob_agent['agent_id']} "
                        "please both answer"
                    )
                },
                headers=alice_headers,
            )
            assert sent.status_code == 200
            original = sent.json()["data"]
            assert len(original["mentioned_agent_ids"]) == 2

            delivered_alice = alice_ws.receive_json()
            delivered_bob = bob_ws.receive_json()
            assert delivered_alice["type"] == "room.message"
            assert delivered_bob["type"] == "room.message"
            assert delivered_alice["message_id"] == original["id"]
            assert delivered_bob["message_id"] == original["id"]

            alice_ws.send_json(
                {
                    "type": "room.reply",
                    "room_id": room_id,
                    "reply_to": original["id"],
                    "content": "HermesA reply",
                }
            )
            bob_ws.send_json(
                {
                    "type": "room.reply",
                    "room_id": room_id,
                    "reply_to": original["id"],
                    "content": "HermesB reply",
                }
            )

            messages = _eventually_messages(
                client, room_id, alice_headers, expected_count=3
            )

    replies = [m for m in messages if m["sender"]["type"] == "agent"]
    assert {r["sender"]["id"] for r in replies} == {
        alice_agent["agent_id"],
        bob_agent["agent_id"],
    }
    assert {r["content"] for r in replies} == {"HermesA reply", "HermesB reply"}
    assert all(r["reply_to_message_id"] == original["id"] for r in replies)
