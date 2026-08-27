"""Phase B 端到端測試：人類 + Agent 透過 WSS 的完整對話閉環。

流程：
1. admin 登入 → 建立 Agent（device flow）→ 建立房間 → 邀請 Agent
2. Agent 連 /api/v1/agent/ws
3. 人類連 /api/v1/ws/rooms 並訂閱房間
4. 人類發消息 "@Hermes 你好" → Agent 應收到 room.message
5. Agent 回 room.reply → 人類應收到 room.message（sender=agent）
"""
import asyncio
import json
import urllib.request

import asyncmy
import websockets

BASE = "http://localhost:8000"
WS = "ws://localhost:8000"

AGENT_NAME = "HermesE2E"


def http_json(path, method="GET", data=None, token=None):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(data).encode() if data is not None else None,
        method=method,
    )
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())["data"]


async def main():
    # 1. login
    user_token = http_json(
        "/api/v1/auth/login", "POST", {"username": "admin", "password": "admin123"}
    )["access_token"]

    # 2. 建立 Agent
    start = http_json(
        "/api/v1/agent/device/start",
        "POST",
        {"suggested_name": AGENT_NAME, "device_name": "E2E-PC"},
    )
    device_code = start["device_code"]
    vt = start["verification_url"].split("#vt=")[1]
    http_json(
        "/api/v1/agent/device/authorize",
        "POST",
        {"verification_token": vt, "agent_name": AGENT_NAME},
        token=user_token,
    )
    poll = http_json(f"/api/v1/agent/device/{device_code}/poll")
    agent_access = poll["credential"]["access_token"]
    agent_id = poll["credential"]["agent_id"]
    print(f"[1] agent created: {agent_id}")

    # 3. 建立房間 + 邀請 Agent
    room = http_json(
        "/api/v1/rooms",
        "POST",
        {"name": "DaoStore Lab", "description": "E2E 測試房"},
        token=user_token,
    )
    room_id = room["id"]
    http_json(
        f"/api/v1/rooms/{room_id}/agents",
        "POST",
        {"agent_id": agent_id},
        token=user_token,
    )
    print(f"[2] room created: {room_id}, agent invited")

    # 4. 同時開兩條 WS：人類 + Agent
    received_human: list[dict] = []
    received_agent: list[dict] = []

    async def agent_listener():
        async with websockets.connect(
            f"{WS}/api/v1/agent/ws",
            additional_headers={"Authorization": f"Bearer {agent_access}"},
        ) as ws:
            first = json.loads(await ws.recv())
            assert first["type"] == "agent.connected"
            # 等人類發消息
            try:
                evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                received_agent.append(evt)
                # Agent 回覆
                if evt["type"] == "room.message":
                    await ws.send(
                        json.dumps(
                            {
                                "type": "room.reply",
                                "room_id": evt["room_id"],
                                "reply_to": evt["message_id"],
                                "content": "你好，我是 Hermes！我收到你的 @ 了 👋",
                            }
                        )
                    )
                # 保持連線短暫，讓 human 收到 reply
                await asyncio.sleep(1)
            except asyncio.TimeoutError:
                print("[WARN] agent didn't receive message in 10s")

    async def human_listener():
        async with websockets.connect(
            f"{WS}/api/v1/ws/rooms",
            additional_headers={"Authorization": f"Bearer {user_token}"},
        ) as ws:
            # 訂閱房間
            await ws.send(json.dumps({"type": "room.subscribe", "room_ids": [room_id]}))
            ack = json.loads(await ws.recv())
            assert ack["type"] == "room.subscribed", f"subscribe failed: {ack}"
            # 人類發消息 @Agent
            await asyncio.sleep(0.3)  # 確保 agent ws 已連好
            http_json(
                f"/api/v1/rooms/{room_id}/messages",
                "POST",
                {"content": f"@{AGENT_NAME} 你好，幫我看一下這個方案"},
                token=user_token,
            )
            # 等收到自己的消息 + Agent 的回覆
            try:
                while True:
                    evt = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                    received_human.append(evt)
                    if evt["type"] == "room.message" and evt["sender"]["type"] == "agent":
                        break
            except asyncio.TimeoutError:
                print("[WARN] human didn't receive agent reply in time")

    await asyncio.gather(agent_listener(), human_listener())

    # 5. 結果
    print(f"\n[3] Agent received {len(received_agent)} event(s):")
    for e in received_agent:
        print(f"    type={e['type']} room={e.get('room_id')} content={e.get('content')}")
        print(f"    sender={e.get('sender')}")

    print(f"[4] Human received {len(received_human)} event(s):")
    for e in received_human:
        print(f"    type={e['type']} sender={e.get('sender',{}).get('type')} content={e.get('content')}")

    # 6. 驗證 DB：消息歷史
    msgs = http_json(f"/api/v1/rooms/{room_id}/messages", token=user_token)
    print(f"\n[5] message history in room ({len(msgs['items'])}):")
    for m in msgs["items"]:
        print(f"    {m['sender']['type']}:{m['sender']['name']} | {m['content']}")

    # 7. 清理測試資料（保持 DB 乾淨）
    conn = await asyncmy.connect(host="localhost", port=3306, user="daodao", password="daodao", database="daodao")
    cur = conn.cursor()
    await cur.execute("DELETE FROM room_messages WHERE room_id IN (SELECT id FROM rooms WHERE name=%s)", ("DaoStore Lab",))
    await cur.execute("DELETE FROM room_members WHERE room_id IN (SELECT id FROM rooms WHERE name=%s)", ("DaoStore Lab",))
    await cur.execute("DELETE FROM rooms WHERE name=%s", ("DaoStore Lab",))
    await cur.execute("DELETE FROM device_codes")
    await cur.execute("DELETE FROM agent_credentials")
    await cur.execute("DELETE FROM agents WHERE display_name=%s", (AGENT_NAME,))
    await conn.commit()
    conn.close()
    print("\n[6] test data cleaned")

    # 8. 判定
    ok = any(e["type"] == "room.message" for e in received_agent) and any(
        e["type"] == "room.message" and e["sender"]["type"] == "agent" for e in received_human
    )
    print("\n" + ("✅ Phase B 閉環 PASSED" if ok else "❌ Phase B 閉環 FAILED"))
    return ok


if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1)
