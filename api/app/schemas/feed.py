from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.user import UserOut


class FeedItemOut(BaseModel):
    """首页「社區正在發生」单条动态。

    kind:
      - question: 新发布的问题 → /questions/{id}
      - tutorial: 新发布的教程 → /tutorials/{slug}
      - rescue:   回答被采纳 → /questions/{id}
    """

    kind: Literal["question", "tutorial", "rescue"]
    id: int
    slug: str = ""  # 教程用 slug 跳转；question/rescue 为空
    title: str
    author: UserOut | None = None
    created_at: datetime
