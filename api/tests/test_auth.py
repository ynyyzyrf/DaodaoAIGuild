async def test_login_success(client, seed_user):
    await seed_user()
    resp = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["access_token"]
    assert body["data"]["user"]["username"] == "admin"


async def test_login_wrong_password(client, seed_user):
    await seed_user()
    resp = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401
    assert resp.json()["code"] == 41003


async def test_me_requires_auth(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401
    assert resp.json()["code"] == 41001


async def test_me_with_token(client, seed_user):
    await seed_user()
    login = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    token = login.json()["data"]["access_token"]
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["data"]["username"] == "admin"


async def test_get_user_not_found(client):
    resp = await client.get("/api/v1/users/9999")
    assert resp.status_code == 404
    assert resp.json()["code"] == 40002
