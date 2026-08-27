from __future__ import annotations

from urllib.parse import parse_qs, urlparse


def _verification_token(verification_url: str) -> str:
    fragment = urlparse(verification_url).fragment
    values = parse_qs(fragment).get("vt")
    assert values and values[0]
    return values[0]


async def _authorize_agent(client, auth_headers, *, name: str = "Hermes") -> dict:
    start = await client.post(
        "/api/v1/agent/device/start",
        json={"suggested_name": name, "device_name": "integration-laptop"},
    )
    assert start.status_code == 200
    start_data = start.json()["data"]
    vt = _verification_token(start_data["verification_url"])

    info = await client.post(
        "/api/v1/agent/device/info",
        json={"verification_token": vt},
        headers=auth_headers,
    )
    assert info.status_code == 200
    assert info.json()["data"]["suggested_name"] == name

    authorize = await client.post(
        "/api/v1/agent/device/authorize",
        json={"verification_token": vt, "agent_name": name},
        headers=auth_headers,
    )
    assert authorize.status_code == 200

    poll = await client.get(f"/api/v1/agent/device/{start_data['device_code']}/poll")
    assert poll.status_code == 200
    poll_data = poll.json()["data"]
    assert poll_data["status"] == "authorized"
    assert poll_data["credential"]["access_token"]
    assert poll_data["credential"]["access_expires_at"].endswith(("+00:00", "Z"))
    assert poll_data["credential"]["refresh_expires_at"].endswith(("+00:00", "Z"))
    return poll_data["credential"]


async def test_agent_me_status_uses_bearer_identity_and_reports_offline(client, auth_headers):
    credential = await _authorize_agent(client, auth_headers, name="Hermes Status")

    resp = await client.get(
        "/api/v1/agent/me/status",
        headers={"Authorization": f"Bearer {credential['access_token']}"},
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data == {
        "agent_id": credential["agent_id"],
        "online": False,
        "connected_at": None,
        "last_heartbeat_at": None,
    }


async def test_agent_me_status_rejects_user_token(client, auth_headers):
    resp = await client.get("/api/v1/agent/me/status", headers=auth_headers)

    assert resp.status_code == 401


async def test_agent_me_status_ignores_client_supplied_agent_id(
    client, auth_headers, auth_headers_bob
):
    alice_credential = await _authorize_agent(client, auth_headers, name="Alice Hermes")
    bob_credential = await _authorize_agent(client, auth_headers_bob, name="Bob Hermes")

    resp = await client.get(
        f"/api/v1/agent/me/status?agent_id={bob_credential['agent_id']}",
        headers={"Authorization": f"Bearer {alice_credential['access_token']}"},
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["agent_id"] == alice_credential["agent_id"]
    assert data["agent_id"] != bob_credential["agent_id"]
