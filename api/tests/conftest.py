import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    yield session_factory
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def seed_user(db):
    async def _seed(username: str = "admin", password: str = "admin123", is_admin: bool = True) -> User:
        async with db() as session:
            user = User(
                username=username,
                password_hash=hash_password(password),
                display_name="管理员",
                is_admin=is_admin,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user

    return _seed


@pytest_asyncio.fixture
async def auth_headers(client, seed_user):
    await seed_user(username="alice", password="pass1234", is_admin=False)
    resp = await client.post("/api/v1/auth/login", json={"username": "alice", "password": "pass1234"})
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def auth_headers_bob(client, seed_user):
    await seed_user(username="bob", password="pass1234", is_admin=False)
    resp = await client.post("/api/v1/auth/login", json={"username": "bob", "password": "pass1234"})
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def admin_headers(client, seed_user):
    """管理后台 token（admin=true，短有效期）。"""
    await seed_user(username="admin", password="admin123", is_admin=True)
    resp = await client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "admin123"}
    )
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def approve_tutorial(db):
    """V3.2 教程预审：把指定 tutorial id 改为 published（绕过审核，供测试用）。"""
    from app.models.tutorial import Tutorial

    async def _approve(tutorial_id: int) -> None:
        async with db() as session:
            t = await session.get(Tutorial, tutorial_id)
            if t is not None:
                t.status = "published"
                await session.commit()

    return _approve
