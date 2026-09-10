from app.services import ome_account


async def test_ome_login_creates_local_session(client, monkeypatch):
    async def fake_fetch_employee_info(token: str):
        assert token == "external-token"
        return {
            "employeeId": "E001",
            "displayName": "MAG",
            "avatarUrl": "https://example.com/avatar.png",
        }

    monkeypatch.setattr(ome_account, "fetch_employee_info", fake_fetch_employee_info)

    resp = await client.post("/api/v1/auth/ome-login", json={"external_token": "external-token"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["access_token"]
    assert body["data"]["user"]["username"] == "ome_E001"
    assert body["data"]["user"]["display_name"] == "MAG"

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['data']['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["data"]["username"] == "ome_E001"


async def test_ome_login_updates_existing_user(client, monkeypatch):
    calls = iter(
        [
            {"employeeId": "E001", "displayName": "MAG"},
            {"employeeId": "E001", "displayName": "MAG Updated"},
        ]
    )

    async def fake_fetch_employee_info(token: str):
        return next(calls)

    monkeypatch.setattr(ome_account, "fetch_employee_info", fake_fetch_employee_info)

    first = await client.post("/api/v1/auth/ome-login", json={"external_token": "token-a"})
    second = await client.post("/api/v1/auth/ome-login", json={"external_token": "token-b"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["data"]["user"]["id"] == second.json()["data"]["user"]["id"]
    assert second.json()["data"]["user"]["display_name"] == "MAG Updated"


async def test_ome_login_returns_json_error_when_profile_lookup_crashes(client, monkeypatch):
    async def broken_fetch_employee_info(token: str):
        raise RuntimeError("upstream returned non-json 500")

    monkeypatch.setattr(ome_account, "fetch_employee_info", broken_fetch_employee_info)

    resp = await client.post("/api/v1/auth/ome-login", json={"external_token": "external-token"})

    assert resp.status_code == 502
    body = resp.json()
    assert body["code"] == 50012
    assert body["message"] == "OMEACCOUNT 服务暂时不可用"
    assert body["data"] is None
