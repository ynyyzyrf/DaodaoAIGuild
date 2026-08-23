"""管理后台路由包（docs/3.2.md §9）。

所有路由前缀 /admin，挂在 /api/v1 之下 → 完整路径 /api/v1/admin/*。
全部依赖 AdminDep（is_admin 校验）。
"""
from app.api.routes.admin import (
    audit,
    auth,
    dashboard,
    moderation,
    missions,
    sensitive_words,
    users,
)

__all__ = [
    "auth",
    "dashboard",
    "users",
    "moderation",
    "missions",
    "sensitive_words",
    "audit",
]
