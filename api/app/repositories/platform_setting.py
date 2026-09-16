from sqlalchemy.ext.asyncio import AsyncSession

from app.models.platform_setting import PlatformSetting


class PlatformSettingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, key: str) -> PlatformSetting | None:
        return await self.session.get(PlatformSetting, key)

    async def upsert(self, key: str, value: dict, updated_by: int | None = None) -> PlatformSetting:
        setting = await self.get(key)
        if setting is None:
            setting = PlatformSetting(key=key, value=value, updated_by=updated_by)
            self.session.add(setting)
        else:
            setting.value = value
            setting.updated_by = updated_by
        await self.session.commit()
        await self.session.refresh(setting)
        return setting
