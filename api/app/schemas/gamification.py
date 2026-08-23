from datetime import datetime

from pydantic import BaseModel


class AchievementOut(BaseModel):
    """单个成就：目录 + 解锁态。"""

    code: str
    name: str
    description: str
    icon: str
    rarity: str
    unlocked: bool = False
    unlocked_at: datetime | None = None


class TitleOut(BaseModel):
    """单个称号：目录 + 解锁态 + 是否当前展示。"""

    code: str
    name: str
    description: str
    icon: str
    rarity: str
    unlocked: bool = False
    unlocked_at: datetime | None = None
    is_current: bool = False


class EquipmentOut(BaseModel):
    """单个装备：目录 + 解锁态 + 穿戴态。"""

    code: str
    name: str
    slot: str
    rarity: str
    description: str
    unlocked: bool = False
    unlocked_at: datetime | None = None
    is_equipped: bool = False


class RecentUnlockOut(BaseModel):
    """最近解锁提示项（kind: achievement / title / equipment）。"""

    kind: str
    code: str
    name: str
    icon: str
    rarity: str
    unlocked_at: datetime


class TitleSetRequest(BaseModel):
    title_code: str
