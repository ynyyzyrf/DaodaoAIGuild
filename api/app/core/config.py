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

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_env.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
