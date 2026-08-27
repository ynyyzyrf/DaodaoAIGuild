"""E2E harness — 把完整 daostore-fde ASGI app 跑在 live uvicorn + temporary SQLite。

**只給 SDK 端 integration test 透過 subprocess 呼叫**。SDK **不** import 任何
``app.*``、``get_db``、repo、service 內部；它只會：
  1. spawn 這個腳本
  2. 從 stdout 讀一行 ``READY <server_url> <wss_url>``
  3. 拿 ``LOBSTER_SERVER_URL`` / ``LOBSTER_WSS_URL`` env 跑測試
  4. 結束時送 SIGTERM

為什麼不在 SDK 端用 fastapi.TestClient：
  TestClient 走 in-process ASGI transport，無法驗證：
    - 真 uvicorn 的 WSS upgrade handling
    - 真 socket buffer / handshake
    - 跨 process 的 ConnectionManager shared state
  plan §4.5 要求「必須跑真流程」，因此用 live uvicorn。

DB 為什麼是 temporary SQLite：
  plan §4.5 接受 docker-compose Postgres 為最終狀態；M1 階段為降低外部依賴，
  採與 server 既有 test_agent_wss_integration.py 一致的臨時 SQLite 檔。
  MySQL-only 欄位型別會在 create_all 階段爆，所以這個腳本只支援 SQLite。

Usage::

    python api/scripts/e2e_harness.py --port 0 --db /tmp/e2e.db

    # 啟動後 stdout 印出：
    READY http://127.0.0.1:54321 ws://127.0.0.1:54321/api/v1/agent/ws

    # 對 SDK 來說就是：
    LOBSTER_SERVER_URL=http://127.0.0.1:54321/api/v1
    LOBSTER_WSS_URL=ws://127.0.0.1:54321/api/v1/agent/ws
"""
from __future__ import annotations

import argparse
import asyncio
import os
import signal
import socket
import sys
from pathlib import Path

# ── 1. 在 import 任何 app.* 之前覆寫 DATABASE_URL ────────────
# 不然 app.db.session.engine 會在 module-import 階段就鎖死成 MySQL DSN，
# 後續 monkey-patch 都來不及。

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--port", type=int, default=0,
                   help="0 = 隨機 free port（推薦）")
    p.add_argument("--db", type=str, required=True,
                   help="SQLite 檔路徑；不存在會自動建立；啟動前刪除以保證乾淨")
    p.add_argument("--keep-db", action="store_true",
                   help="保留既有 SQLite 檔；用於 restart/reconnect E2E")
    p.add_argument("--host", type=str, default="127.0.0.1")
    return p.parse_args()


def _pick_free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _reset_db(path: Path) -> None:
    """刪除舊檔（連同 -journal / -wal），確保 schema 從零建立。"""
    for suffix in ("", "-journal", "-wal", "-shm"):
        p = Path(str(path) + suffix)
        if p.exists():
            p.unlink()


def main() -> int:
    args = _parse_args()
    db_path = Path(args.db)
    if not args.keep_db:
        _reset_db(db_path)
    db_url = f"sqlite+aiosqlite:///{db_path}"

    # 必須在 import app.* 之前設好 DATABASE_URL
    os.environ["DATABASE_URL"] = db_url

    # 確保 pwd 在 api/，讓 app.* 相對 import 找得到
    api_dir = Path(__file__).resolve().parent.parent
    os.chdir(api_dir)
    sys.path.insert(0, str(api_dir))

    import uvicorn
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.db import session as db_session
    from app.db.base import Base
    from app.db.session import get_db
    from app.main import app
    from app.api.routes import agent_ws, ws_rooms  # noqa: F401 確保 router 註冊

    # ── 2. 建立 SQLite engine + 套用 schema ────────────────
    engine = create_async_engine(db_url, echo=False, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _create_schema() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_create_schema())

    # ── 3. 把 app / agent_ws / ws_rooms 的 session 切到我們的 factory ──
    # routes 用的是 ``from app.db.session import async_session_factory``，
    # session.py 內 module-level 變數，直接覆寫。
    db_session.async_session_factory = session_factory

    async def _override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    # ── 3.5 seed 測試 user ──────────────────────────────────────
    # SDK E2E 需要 user 走 device authorization 的 authorize 步驟（user 必須是
    # 已登入狀態）。Harness 自己 seed 一個 admin 與一個普通 user，username 從
    # env 讀（SDK 端 conftest 設 E2E_*_USER / E2E_*_PASS），避免 hard-code。
    import os as _os
    from app.core.security import hash_password
    from sqlalchemy import select

    from app.models.user import User

    seed_username = _os.environ.get("E2E_USER_USERNAME", "e2e_user")
    seed_password = _os.environ.get("E2E_USER_PASSWORD", "e2e_pass_1234")
    admin_username = _os.environ.get("E2E_ADMIN_USERNAME", "e2e_admin")
    admin_password = _os.environ.get("E2E_ADMIN_PASSWORD", "e2e_admin_1234")

    async def _seed_users() -> None:
        async with session_factory() as session:
            existing = await session.execute(
                select(User.username).where(User.username.in_([seed_username, admin_username]))
            )
            usernames = set(existing.scalars().all())
            if seed_username not in usernames:
                session.add(
                    User(
                        username=seed_username,
                        password_hash=hash_password(seed_password),
                        display_name="E2E User",
                        is_admin=False,
                    )
                )
            if admin_username not in usernames:
                session.add(
                    User(
                        username=admin_username,
                        password_hash=hash_password(admin_password),
                        display_name="E2E Admin",
                        is_admin=True,
                    )
                )
            if seed_username not in usernames or admin_username not in usernames:
                await session.commit()

    asyncio.run(_seed_users())

    # ── 4. 啟 uvicorn（programmatic，subprocess 模式）────────
    port = args.port or _pick_free_port()
    config = uvicorn.Config(
        app=app,
        host=args.host,
        port=port,
        log_level="warning",
        access_log=False,
        lifespan="on",
    )
    server = uvicorn.Server(config)

    # SIGTERM → 乾淨退出（subprocess terminate 會送 SIGTERM on POSIX，
    # Windows 上 Python 收 SIGTERM 同樣會走 .serve 迴圈拋 KeyboardInterrupt）
    def _term(*_a: object) -> None:
        server.should_exit = True
    signal.signal(signal.SIGTERM, _term)
    signal.signal(signal.SIGINT, _term)

    # 啟動 listener 在 background；READY 行在 server 真的 serve 完後印
    import threading
    import time
    import urllib.request

    ready_event = threading.Event()
    base = f"http://{args.host}:{port}"

    def _wait_for_ready() -> None:
        """poll /openapi.json 直到 200，印 READY。"""
        deadline = time.monotonic() + 15.0
        while time.monotonic() < deadline:
            try:
                r = urllib.request.urlopen(f"{base}/openapi.json", timeout=0.5)
                if r.status == 200:
                    sys.stdout.write(
                        f"READY {base} ws://{args.host}:{port}/api/v1/agent/ws\n"
                    )
                    sys.stdout.flush()
                    ready_event.set()
                    return
            except Exception:  # noqa: BLE001
                time.sleep(0.1)
        sys.stdout.write(f"FAILED_TO_START {base}\n")
        sys.stdout.flush()
        server.should_exit = True

    threading.Thread(target=_wait_for_ready, daemon=True).start()

    async def _run() -> None:
        sys.stdout.write(f"STARTING {args.host}:{port}\n")
        sys.stdout.flush()
        await server.serve()

    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        pass
    finally:
        # engine 釋放
        async def _dispose() -> None:
            await engine.dispose()
        try:
            asyncio.run(_dispose())
        except Exception:  # noqa: BLE001
            pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
