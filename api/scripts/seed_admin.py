"""幂等创建初始账号（管理员 + 普通用户）：python scripts/seed_admin.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import async_session_factory
from app.models.user import User

# (username, password, display_name, is_admin, bio)
ACCOUNTS: list[tuple[str, str, str, bool, str]] = [
    ("admin", "admin123", "管理员", True, ""),
    (
        "knight",
        "knight123",
        "见习騎士",
        False,
        "一名正在 AI 落地路上摸爬滚打的龍蝦騎士，热爱 Agent 与 FDE 实战。",
    ),
]


async def seed() -> None:
    async with async_session_factory() as session:
        for username, password, display_name, is_admin, bio in ACCOUNTS:
            result = await session.execute(select(User).where(User.username == username))
            if result.scalar_one_or_none() is None:
                session.add(
                    User(
                        username=username,
                        password_hash=hash_password(password),
                        display_name=display_name,
                        bio=bio,
                        is_admin=is_admin,
                    )
                )
                role = "管理员" if is_admin else "普通用户"
                print(f"[seed] 已创建{role}账号：{username} / {password}（生产环境请立即改密）")
            else:
                print(f"[seed] 账号 '{username}' 已存在，跳过。")
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
