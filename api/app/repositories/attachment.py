from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attachment import Attachment


class AttachmentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        uploader_id: int,
        kind: str,
        url: str,
        size: int,
        mime_type: str,
    ) -> Attachment:
        att = Attachment(
            uploader_id=uploader_id,
            kind=kind,
            url=url,
            size=size,
            mime_type=mime_type,
        )
        self.session.add(att)
        await self.session.commit()
        await self.session.refresh(att)
        return att

    async def link(self, urls: list[str], *, target_type: str, target_id: int) -> None:
        """把已上传的附件（按其 url）绑定到某个内容，仅绑定尚未关联的。"""
        if not urls:
            return
        await self.session.execute(
            update(Attachment)
            .where(Attachment.url.in_(urls), Attachment.target_type.is_(None))
            .values(target_type=target_type, target_id=target_id)
        )
        await self.session.commit()

    async def list_by_target(self, target_type: str, target_id: int) -> list[Attachment]:
        stmt = (
            select(Attachment)
            .where(Attachment.target_type == target_type, Attachment.target_id == target_id)
            .order_by(Attachment.id)
        )
        return list((await self.session.execute(stmt)).scalars().all())
