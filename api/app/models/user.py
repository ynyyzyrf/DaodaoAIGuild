from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    avatar_url: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    bio: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 匿名發言號：每人固定隨機號，與 id 無關，用於「龍蝦騎士xxxx號」展示
    anon_number: Mapped[int | None] = mapped_column(Integer, nullable=True, unique=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    reputation: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 經驗值：代表「參與了多少」，与声望（代表「帮助了多少人」）相互独立
    exp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 当前展示称号 code（目录见 services/gamification.py TITLES）
    current_title_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # 官方认证 FDE 标记（docs/3.2.md §5.3）
    is_verified_fde: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
