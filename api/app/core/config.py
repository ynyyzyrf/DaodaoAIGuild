from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "DaoDao AI Guild API"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False

    database_url: str = "mysql+asyncmy://daodao:daodao@localhost:3306/daodao"
    jwt_secret: str = "dev-secret-change-me-in-production-32bytes-min"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120

    # Agent Room（docs/3.3.md v0.1）
    # 獨立 secret 簽發 Agent JWT；撤銷 Agent Credential 不必動用戶 token
    agent_jwt_secret: str = "dev-agent-secret-change-me-in-production-32bytes-min"
    # Agent access token 短效（24h），refresh token 90d
    agent_access_token_expire_hours: int = 24
    agent_refresh_token_expire_days: int = 90
    # device_code（Device Authorization Grant）有效期
    agent_device_code_expire_minutes: int = 10

    media_dir: str = "/media"

    # 上传大小限制（字节），按附件 kind 区分
    max_image_size: int = 10 * 1024 * 1024
    max_video_size: int = 200 * 1024 * 1024
    max_file_size: int = 20 * 1024 * 1024
    max_log_size: int = 5 * 1024 * 1024

    # 管理后台（docs/3.2.md §10）
    admin_token_expire_minutes: int = 60
    admin_login_max_attempts: int = 5
    admin_login_lock_minutes: int = 15

    # 允许的跨域来源，逗号分隔；部署环境通过 CORS_ORIGINS 覆盖
    cors_origins_env: str = Field(
        "http://localhost:3000,http://localhost",
        env="CORS_ORIGINS",
    )

    # Agent Room verification URL 的 public base；部署时通过 PUBLIC_BASE_URL 覆盖
    public_base_url: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_env.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
