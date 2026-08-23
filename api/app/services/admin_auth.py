"""管理后台认证服务（docs/3.2.md §5.1 / §10.3）。

- 登录锁定：连续失败 N 次锁 M 分钟（按 username，内存存储，MVP 接受多实例失效）
- 登录成功签发专用 admin token（短有效期）
- 所有登录尝试写稽核日志（auth.login / auth.login_failed / auth.locked）
"""
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_admin_access_token, verify_password
from app.models.user import User
from app.repositories.user import UserRepository
from app.services.admin_audit import AdminAuditService

# 内存锁：{username: (unlock_at, fail_count)}
_LOCKS: dict[str, tuple[datetime, int]] = {}


def _check_lock(username: str) -> tuple[bool, int]:
    """返回 (是否锁定, 剩余秒数)。"""
    settings = get_settings()
    now = datetime.now()
    entry = _LOCKS.get(username)
    if entry is None:
        return False, 0
    unlock_at, fails = entry
    if now < unlock_at:
        return True, int((unlock_at - now).total_seconds())
    # 锁定已过，但若仍失败会重新累计；这里先清零
    if fails >= settings.admin_login_max_attempts:
        return False, 0
    return False, 0


def _record_failure(username: str) -> tuple[bool, int]:
    """记录一次失败，返回 (是否触发锁定, 当前失败次数)。"""
    settings = get_settings()
    now = datetime.now()
    entry = _LOCKS.get(username)
    fails = (entry[1] + 1) if entry and now > entry[0] else 1
    if fails >= settings.admin_login_max_attempts:
        _LOCKS[username] = (now + timedelta(minutes=settings.admin_login_lock_minutes), fails)
        return True, fails
    _LOCKS[username] = (now, fails)
    return False, fails


def _clear_failure(username: str) -> None:
    _LOCKS.pop(username, None)


async def admin_authenticate(
    session: AsyncSession, username: str, password: str, ip: str | None = None
) -> tuple[User | None, str]:
    """返回 (user, message)。user 非 None 表示登录成功。"""
    audit = AdminAuditService(session)
    repo = UserRepository(session)

    locked, remain = _check_lock(username)
    if locked:
        await audit.log(
            admin_id=0,
            action="auth.locked",
            target_type="user",
            target_id=None,
            reason=f"账号 {username} 已锁定，剩余 {remain}s",
            ip=ip,
        )
        return None, f"账号已锁定，请 {remain} 秒后重试"

    user = await repo.get_by_username(username)
    if user is None or not user.is_active or not user.is_admin:
        _record_failure(username)
        await audit.log(
            admin_id=user.id if user else 0,
            action="auth.login_failed",
            target_type="user",
            target_id=user.id if user else None,
            reason=f"账号 {username} 不存在/已停用/非管理员",
            ip=ip,
        )
        return None, "用户名或密码错误"

    if not verify_password(password, user.password_hash):
        triggered, fails = _record_failure(username)
        await audit.log(
            admin_id=user.id,
            action="auth.login_failed",
            target_type="user",
            target_id=user.id,
            reason=f"密码错误，第 {fails} 次",
            ip=ip,
        )
        if triggered:
            return None, f"连续失败 {fails} 次，账号已锁定 {get_settings().admin_login_lock_minutes} 分钟"
        return None, "用户名或密码错误"

    _clear_failure(username)
    await audit.log(
        admin_id=user.id,
        action="auth.login",
        target_type="user",
        target_id=user.id,
        reason="登录成功",
        ip=ip,
    )
    token = create_admin_access_token(user.id, user.username)
    return user, token
