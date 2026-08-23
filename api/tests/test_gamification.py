"""龍蝦騎士 2.0 遊戲化测试：EXP / 成就 / 称号 / 装备 / 个人档案。"""


async def _my_profile(client, headers) -> dict:
    resp = await client.get("/api/v1/users/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    return body["data"]


def _unlocked_codes(items: list[dict]) -> set[str]:
    return {item["code"] for item in items if item["unlocked"]}


async def test_exp_accumulates(client, auth_headers, auth_headers_bob):
    """发问题/回答/被采纳/发教程 分别累计 EXP。"""
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    # 发问题 +5
    assert (await _my_profile(client, auth_headers))["exp"] == 5
    # 回答 +3
    a = await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答"}, headers=auth_headers_bob)
    aid = a.json()["data"]["id"]
    assert (await _my_profile(client, auth_headers_bob))["exp"] == 3
    # 被采纳 +10
    await client.post(f"/api/v1/questions/{qid}/accept", json={"answer_id": aid}, headers=auth_headers)
    assert (await _my_profile(client, auth_headers_bob))["exp"] == 13
    # 发教程 +15
    await client.post(
        "/api/v1/tutorials",
        json={"title": "教程", "summary": "s", "content": "c", "category": "AI Agent"},
        headers=auth_headers,
    )
    assert (await _my_profile(client, auth_headers))["exp"] == 20


async def test_first_unlocks_and_default_title(client, auth_headers, auth_headers_bob):
    """首次提问/首次回答/首次被采纳解锁对应成就与称号；默认称号 sea_novice 恒有。"""
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]

    alice = await _my_profile(client, auth_headers)
    assert "first_question" in _unlocked_codes(alice["achievements"])
    assert "sea_novice" in _unlocked_codes(alice["titles"])
    assert alice["current_title"]["code"] == "sea_novice"

    a = await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答"}, headers=auth_headers_bob)
    aid = a.json()["data"]["id"]
    bob = await _my_profile(client, auth_headers_bob)
    assert "first_answer" in _unlocked_codes(bob["achievements"])

    await client.post(f"/api/v1/questions/{qid}/accept", json={"answer_id": aid}, headers=auth_headers)
    bob = await _my_profile(client, auth_headers_bob)
    assert "first_rescue" in _unlocked_codes(bob["achievements"])
    assert "debug_apprentice" in _unlocked_codes(bob["titles"])


async def test_equipment_unlock_equip_unequip(client, auth_headers, auth_headers_bob):
    """10 条回答解锁銅鉗護腕，可穿戴/卸下。"""
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    for _ in range(10):
        await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答"}, headers=auth_headers_bob)

    bob = await _my_profile(client, auth_headers_bob)
    gauntlet = next(e for e in bob["equipment"] if e["code"] == "copper_gauntlet")
    assert gauntlet["unlocked"] is True
    assert gauntlet["is_equipped"] is False

    resp = await client.post(
        "/api/v1/users/me/equipment/copper_gauntlet/equip", headers=auth_headers_bob
    )
    assert resp.json()["code"] == 0
    equipped = {e["code"]: e for e in resp.json()["data"]["equipment"]}
    assert equipped["copper_gauntlet"]["is_equipped"] is True

    resp = await client.post(
        "/api/v1/users/me/equipment/copper_gauntlet/unequip", headers=auth_headers_bob
    )
    equipped = {e["code"]: e for e in resp.json()["data"]["equipment"]}
    assert equipped["copper_gauntlet"]["is_equipped"] is False


async def test_equip_unowned_equipment_fails(client, auth_headers_bob):
    resp = await client.post(
        "/api/v1/users/me/equipment/rescue_helmet/equip", headers=auth_headers_bob
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == 40003


async def test_set_current_title(client, auth_headers, auth_headers_bob):
    q = await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    qid = q.json()["data"]["id"]
    a = await client.post(f"/api/v1/questions/{qid}/answers", json={"content": "答"}, headers=auth_headers_bob)
    aid = a.json()["data"]["id"]
    await client.post(f"/api/v1/questions/{qid}/accept", json={"answer_id": aid}, headers=auth_headers)

    resp = await client.post(
        "/api/v1/users/me/title", json={"title_code": "debug_apprentice"}, headers=auth_headers_bob
    )
    assert resp.json()["code"] == 0
    assert resp.json()["data"]["current_title"]["code"] == "debug_apprentice"

    # 未解锁称号不可设置
    resp = await client.post(
        "/api/v1/users/me/title", json={"title_code": "fde_master_t"}, headers=auth_headers_bob
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == 40003


async def test_me_recent_unlocks(client, auth_headers):
    await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    me = await _my_profile(client, auth_headers)
    assert me["exp"] > 0
    kinds = {u["kind"] for u in me["recent_unlocks"]}
    assert "achievement" in kinds
    assert "title" in kinds
    codes = {u["code"] for u in me["recent_unlocks"]}
    assert "first_question" in codes
    assert "sea_novice" in codes


async def test_public_profile_includes_gamification(client, auth_headers):
    me = await _my_profile(client, auth_headers)
    await client.post("/api/v1/questions", json={"title": "问题"}, headers=auth_headers)
    resp = await client.get(f"/api/v1/users/{me['id']}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "exp" in data and data["exp"] >= 5
    assert len(data["titles"]) > 0
    assert len(data["achievements"]) > 0
    assert len(data["equipment"]) > 0
    assert data["reputation"] == 2  # 声望数值不变（发问题 +2）
    # 公开接口不返回 recent_unlocks
    assert "recent_unlocks" not in data


async def test_equip_same_slot_exclusive(db, seed_user):
    """同槽位装备互斥：换穿黄金战甲自动卸下银鉗胸甲（均为 armor 槽）。"""
    user = await seed_user(username="carol", password="pass1234", is_admin=False)
    from app.repositories.gamification import GamificationRepository
    from app.services.gamification import equip

    async with db() as session:
        repo = GamificationRepository(session)
        await repo.grant_equipment(user.id, "silver_chestplate")
        await repo.grant_equipment(user.id, "golden_armor")
        await session.commit()

        await equip(session, user, "silver_chestplate")
        rows = await repo.equipment_rows(user.id)
        assert rows["silver_chestplate"].is_equipped is True

        await equip(session, user, "golden_armor")
        rows = await repo.equipment_rows(user.id)
        assert rows["silver_chestplate"].is_equipped is False
        assert rows["golden_armor"].is_equipped is True
