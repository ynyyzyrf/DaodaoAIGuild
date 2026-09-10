"""模擬 Hermes Agent — 讓開發者能在瀏覽器端測完整「邀請 → @ → 回覆」閉環。

Hermes CLI 尚未實作，此腳本扮演「本地 Agent」：
1. 透過 device flow 建立一個 Agent（Hermes 的 Connect 行為）
2. 連上 /api/v1/agent/ws
3. 收到被 @ 的 room.message 時：
   - 先回 room.typing（Hermes is working...）
   - 回覆 room.reply（固定文案）

用法：
    python scripts/simulate_hermes.py --name Hermes --device-name MAG-PC

選項：
    --name            Agent 顯示名稱（預設 "Hermes"）
    --device-name     裝置名稱（預設 "MAG-PC"）
    --auto-auth       自動授權（用 admin/admin123 登入並按授權，方便本地測試）
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import urllib.request

import websockets

API = "http://localhost:8000"
WS = "ws://localhost:8000"


def http_json(path: str, method: str = "GET", data: dict | None = None, token: str | None = None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(data).encode() if data is not None else None,
        method=method,
    )
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["data"]


async def main(name: str, device_name: str, auto_auth: bool) -> None:
    # 1. 發起 device flow（Hermes 的 Connect）
    start = http_json(
        "/api/v1/agent/device/start",
        "POST",
        {"suggested_name": name, "device_name": device_name},
    )
    device_code = start["device_code"]
    vt = start["verification_url"].split("#vt=")[1]
    print(f"verification_url: {start['verification_url']}")

    # 2. 瀏覽器授權。auto-auth 時自動登入並授權（本地開發方便）
    if auto_auth:
        user_token = http_json(
            "/api/v1/auth/login", "POST", {"username": "admin", "password": "admin123"}
        )["access_token"]
        http_json(
            "/api/v1/agent/device/authorize",
            "POST",
            {"verification_token": vt, "agent_name": name},
            token=user_token,
        )
        print(f"authorized (auto): {name}")
    else:
        print(f"請在瀏覽器開啟上面的 URL 完成授權，然後按 Enter 繼續...")
        input()

    # 3. 輪詢拿 credential（Hermes 的行為）
    print("polling for credential...")
    while True:
        poll = http_json(f"/api/v1/agent/device/{device_code}")
        if poll["status"] == "authorized":
            cred = poll["credential"]
            break
        if poll["status"] in ("expired", "denied"):
            print(f"授權 {poll['status']}，結束")
            return
        await asyncio.sleep(1)

    access_token = cred["access_token"]
    agent_id = cred["agent_id"]
    print(f"agent_id: {agent_id}")

    # 4. 連 WSS
    async with websockets.connect(
        f"{WS}/api/v1/agent/ws",
        additional_headers={"Authorization": f"Bearer {access_token}"},
    ) as ws:
        first = json.loads(await ws.recv())
        print(f"[connected] {first['type']} (heartbeat every {first['heartbeat_interval']}s)")

        # 5. 心跳 + 處理消息
        async def heartbeat_loop():
            while True:
                await asyncio.sleep(first["heartbeat_interval"])
                await ws.send(json.dumps({"type": "agent.heartbeat"}))

        hb_task = asyncio.create_task(heartbeat_loop())
        print("等待被 @ 的消息...（在瀏覽器房間輸入 @名字 發送）")

        try:
            while True:
                evt = json.loads(await ws.recv())
                etype = evt.get("type")
                if etype == "room.message":
                    sender = evt.get("sender", {})
                    print(f"\n[收到] {sender.get('name')}: {evt.get('content')}")
                    # 6. 先發 typing
                    await ws.send(
                        json.dumps(
                            {
                                "type": "room.typing",
                                "room_id": evt["room_id"],
                                "status": True,
                            }
                        )
                    )
                    await asyncio.sleep(0.8)
                    await ws.send(
                        json.dumps(
                            {
                                "type": "room.typing",
                                "room_id": evt["room_id"],
                                "status": False,
                            }
                        )
                    )
                    # 7. 回覆
                    reply = f"你好 {sender.get('name')}！我是 {name}，收到你的消息了 👋 我幫你看看吧。"
                    await ws.send(
                        json.dumps(
                            {
                                "type": "room.reply",
                                "room_id": evt["room_id"],
                                "reply_to": evt["message_id"],
                                "content": reply,
                            }
                        )
                    )
                    print(f"[回覆] {reply}")
                elif etype == "agent.disconnected":
                    print(f"\n[server 斷線] reason={evt.get('reason')}")
                    break
        finally:
            hb_task.cancel()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="模擬 Hermes Agent")
    parser.add_argument("--name", default="Hermes", help="Agent 顯示名稱")
    parser.add_argument("--device-name", default="MAG-PC", help="裝置名稱")
    parser.add_argument(
        "--auto-auth", action="store_true", help="自動用 admin 登入並授權（本地開發用）"
    )
    args = parser.parse_args()
    asyncio.run(main(args.name, args.device_name, args.auto_auth))
