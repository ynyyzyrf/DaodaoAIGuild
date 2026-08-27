"""Agent 模組的 Repository（封裝三張表的查詢 / 寫入）。"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.agent_security import generate_public_agent_id
from app.models.agent import Agent
from app.models.agent_credential import AgentCredential
from app.models.device_code import DeviceCode


class AgentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── agents ────────────────────────────────────────────────────────────

    async def get_by_id(self, agent_id: int) -> Agent | None:
        return await self.session.get(Agent, agent_id)

    async def get_by_public_id(self, public_id: str) -> Agent | None:
        result = await self.session.execute(select(Agent).where(Agent.agent_id == public_id))
        return result.scalar_one_or_none()

    async def list_by_owner(self, owner_id: int) -> list[Agent]:
        result = await self.session.execute(
            select(Agent).where(Agent.owner_id == owner_id).order_by(Agent.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        owner_id: int,
        display_name: str,
        agent_type: str = "hermes",
        visibility: str = "only_me",
    ) -> Agent:
        # 重新生成直到 UNIQUE 通過（碰撞機率極低，10 個 URL-safe chars 空間）
        for _ in range(5):
            public_id = generate_public_agent_id()
            existing = await self.get_by_public_id(public_id)
            if existing is None:
                break
        else:
            raise RuntimeError("failed to generate unique agent_id after 5 attempts")

        agent = Agent(
            agent_id=public_id,
            owner_id=owner_id,
            agent_type=agent_type,
            display_name=display_name,
            visibility=visibility,
            status="pending",
        )
        self.session.add(agent)
        await self.session.commit()
        await self.session.refresh(agent)
        return agent

    async def set_status(self, agent_id: int, status: str) -> None:
        agent = await self.get_by_id(agent_id)
        if agent is not None:
            agent.status = status
            await self.session.commit()

    async def mark_online(self, agent_id: int) -> None:
        agent = await self.get_by_id(agent_id)
        if agent is not None:
            agent.status = "online"
            # 不在這裡寫 last_seen_at，由 ConnectionManager 控制節流
            await self.session.commit()

    async def mark_offline(self, agent_id: int) -> None:
        agent = await self.get_by_id(agent_id)
        if agent is not None:
            agent.status = "offline"
            agent.last_seen_at = datetime.utcnow()
            await self.session.commit()

    async def disconnect(self, agent_id: int, *, reason: str) -> None:
        """使用者主動中斷連線：撤銷 credential + 設 offline。"""
        cred = await self.get_credential(agent_id)
        if cred is not None:
            cred.access_jti = None
            cred.refresh_jti = None
            cred.revoked_at = datetime.utcnow()
            cred.revoked_reason = reason
        agent = await self.get_by_id(agent_id)
        if agent is not None:
            agent.status = "offline"
            agent.last_seen_at = datetime.utcnow()
        await self.session.commit()

    # ── agent_credentials ─────────────────────────────────────────────────

    async def get_credential(self, agent_id: int) -> AgentCredential | None:
        result = await self.session.execute(
            select(AgentCredential).where(AgentCredential.agent_id == agent_id)
        )
        return result.scalar_one_or_none()

    async def get_credential_by_access_jti(self, jti: str) -> AgentCredential | None:
        result = await self.session.execute(
            select(AgentCredential).where(AgentCredential.access_jti == jti)
        )
        return result.scalar_one_or_none()

    async def get_credential_by_refresh_jti(self, jti: str) -> AgentCredential | None:
        result = await self.session.execute(
            select(AgentCredential).where(AgentCredential.refresh_jti == jti)
        )
        return result.scalar_one_or_none()

    async def create_credential(
        self,
        *,
        agent_id: int,
        device_name: str,
        device_fingerprint: str | None = None,
    ) -> AgentCredential:
        cred = AgentCredential(
            agent_id=agent_id,
            device_name=device_name,
            device_fingerprint=device_fingerprint,
        )
        self.session.add(cred)
        await self.session.commit()
        await self.session.refresh(cred)
        return cred

    async def update_jtis(
        self,
        *,
        cred: AgentCredential,
        access_jti: str,
        access_expires_at: datetime,
        refresh_jti: str,
        refresh_expires_at: datetime,
    ) -> None:
        cred.access_jti = access_jti
        cred.access_expires_at = access_expires_at
        cred.refresh_jti = refresh_jti
        cred.refresh_expires_at = refresh_expires_at
        cred.refresh_rotation_count = (cred.refresh_rotation_count or 0) + 1
        cred.last_used_at = datetime.utcnow()
        await self.session.commit()

    async def rotate_refresh(
        self,
        *,
        cred: AgentCredential,
        new_access_jti: str,
        new_access_expires_at: datetime,
        new_refresh_jti: str,
        new_refresh_expires_at: datetime,
    ) -> None:
        """Refresh token rotation：先驗證舊 refresh_jti 仍為 cred.refresh_jti，
        然後撤銷舊的、寫入新的。
        """
        cred.access_jti = new_access_jti
        cred.access_expires_at = new_access_expires_at
        cred.refresh_jti = new_refresh_jti
        cred.refresh_expires_at = new_refresh_expires_at
        cred.refresh_rotation_count = (cred.refresh_rotation_count or 0) + 1
        cred.last_used_at = datetime.utcnow()
        await self.session.commit()

    # ── device_codes ──────────────────────────────────────────────────────

    async def get_device_code_by_hash(self, device_code_hash: str) -> DeviceCode | None:
        result = await self.session.execute(
            select(DeviceCode).where(DeviceCode.device_code_hash == device_code_hash)
        )
        return result.scalar_one_or_none()

    async def get_device_code_by_verification_hash(
        self, verification_token_hash: str
    ) -> DeviceCode | None:
        result = await self.session.execute(
            select(DeviceCode).where(
                DeviceCode.verification_token_hash == verification_token_hash
            )
        )
        return result.scalar_one_or_none()

    async def create_device_code(
        self,
        *,
        device_code_hash: str,
        verification_token_hash: str,
        suggested_name: str,
        device_name: str,
        expires_at: datetime,
        agent_type: str = "hermes",
        requested_scopes: list[str] | None = None,
        device_fingerprint: str | None = None,
    ) -> DeviceCode:
        dc = DeviceCode(
            device_code_hash=device_code_hash,
            verification_token_hash=verification_token_hash,
            agent_type=agent_type,
            suggested_name=suggested_name,
            device_name=device_name,
            device_fingerprint=device_fingerprint,
            expires_at=expires_at,
            requested_scopes=requested_scopes,
            status="pending",
        )
        self.session.add(dc)
        await self.session.commit()
        await self.session.refresh(dc)
        return dc

    async def update_device_code_status(
        self,
        dc: DeviceCode,
        *,
        status: str,
        owner_id: int | None = None,
        agent_id: int | None = None,
    ) -> None:
        dc.status = status
        if status == "authorized":
            dc.owner_id = owner_id
            dc.agent_id = agent_id
            dc.authorized_at = datetime.utcnow()
        elif status == "consumed":
            dc.consumed_at = datetime.utcnow()
        await self.session.commit()
