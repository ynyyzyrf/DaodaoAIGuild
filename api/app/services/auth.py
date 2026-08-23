from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.models.user import User
from app.repositories.user import UserRepository


async def authenticate(session: AsyncSession, username: str, password: str) -> User | None:
    repo = UserRepository(session)
    user = await repo.get_by_username(username)
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
