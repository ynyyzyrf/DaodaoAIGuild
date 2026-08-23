from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserAchievement(Base):
    """用户已解锁成就记录（成就目录在 services/gamification.py ACHIEVEMENTS）。"""

    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_code", name="uq_user_achievement"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    achievement_code: Mapped[str] = mapped_column(String(50), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class UserTitle(Base):
    """用户已解锁称号记录（称号目录在 services/gamification.py TITLES）。"""

    __tablename__ = "user_titles"
    __table_args__ = (UniqueConstraint("user_id", "title_code", name="uq_user_title"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title_code: Mapped[str] = mapped_column(String(50), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class UserEquipment(Base):
    """用户已解锁装备记录（装备目录在 services/gamification.py EQUIPMENT）。"""

    __tablename__ = "user_equipment"
    __table_args__ = (UniqueConstraint("user_id", "equipment_code", name="uq_user_equipment"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    equipment_code: Mapped[str] = mapped_column(String(50), nullable=False)
    is_equipped: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
