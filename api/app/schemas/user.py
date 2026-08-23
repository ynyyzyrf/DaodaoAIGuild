from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.gamification import AchievementOut, EquipmentOut, RecentUnlockOut, TitleOut


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str
    avatar_url: str
    bio: str
    level: int
    reputation: int
    is_admin: bool
    created_at: datetime


def masked_author(author, is_anonymous: bool) -> UserOut | None:
    """匿名内容作者对外只显示「龍蝦騎士xxxx號」，其余身份字段置空/归零。

    供 services/question.py 与 routes/home.py 共用，避免两份拷贝漂移。
    """
    if author is None:
        return None
    if not is_anonymous:
        return UserOut.model_validate(author)
    return UserOut(
        id=author.id,
        username="",
        display_name=f"龍蝦騎士{author.anon_number or 0}號",
        avatar_url="",
        bio="",
        level=0,
        reputation=0,
        is_admin=False,
        created_at=author.created_at,
    )


class UserProfileOut(UserOut):
    """个人页：身份卡 + 内容统计 + 騎士遊戲化（等级/经验/称号/成就/装备目录）。"""

    questions_count: int = 0
    answers_count: int = 0
    tutorials_count: int = 0
    accepted_count: int = 0
    # 遊戲化身份层
    exp: int = 0
    current_title: TitleOut | None = None
    achievements: list[AchievementOut] = []
    titles: list[TitleOut] = []
    equipment: list[EquipmentOut] = []


class MeOut(UserProfileOut):
    """本人视角：额外带最近解锁提示。"""

    recent_unlocks: list[RecentUnlockOut] = []


class LeaderboardOut(UserOut):
    """騎士排行榜条目：在基础身份上附加该榜单项的数值与擅長領域标签。"""

    metric_value: int = 0
    top_tags: list[str] = []
