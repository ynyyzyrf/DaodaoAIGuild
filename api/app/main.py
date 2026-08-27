import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import admin as admin_routes
from app.api.routes import (
    agent as agent_routes,
)
from app.api.routes import (
    agent_ws as agent_ws_routes,
)
from app.api.routes import (
    answers,
    auth,
    health,
    home,
    questions,
    tags,
    tutorials,
    uploads,
    users,
)
from app.api.routes import (
    rooms as room_routes,
)
from app.api.routes import ws_rooms as ws_rooms_routes
from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.services.agent_gateway import manager as agent_gateway_manager


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message, "data": None},
        )

    app.include_router(health.router, prefix=settings.api_v1_prefix)
    app.include_router(auth.router, prefix=settings.api_v1_prefix)
    app.include_router(home.router, prefix=settings.api_v1_prefix)
    app.include_router(users.router, prefix=settings.api_v1_prefix)
    app.include_router(questions.router, prefix=settings.api_v1_prefix)
    app.include_router(answers.router, prefix=settings.api_v1_prefix)
    app.include_router(tags.router, prefix=settings.api_v1_prefix)
    app.include_router(tutorials.router, prefix=settings.api_v1_prefix)
    app.include_router(uploads.router, prefix=settings.api_v1_prefix)

    # Agent Room v0.1（docs/3.3.md）
    app.include_router(agent_routes.router, prefix=settings.api_v1_prefix)
    app.include_router(agent_routes.agents_router, prefix=settings.api_v1_prefix)
    app.include_router(agent_ws_routes.router, prefix=settings.api_v1_prefix)
    # Phase B：房間 + 人類即時通道
    app.include_router(room_routes.router, prefix=settings.api_v1_prefix)
    app.include_router(ws_rooms_routes.router, prefix=settings.api_v1_prefix)

    # 管理后台 V3.2（docs/3.2.md）
    app.include_router(admin_routes.auth.router, prefix=settings.api_v1_prefix)
    app.include_router(admin_routes.dashboard.router, prefix=settings.api_v1_prefix)
    app.include_router(admin_routes.users.router, prefix=settings.api_v1_prefix)
    app.include_router(admin_routes.moderation.router, prefix=settings.api_v1_prefix)
    app.include_router(admin_routes.missions.router, prefix=settings.api_v1_prefix)
    app.include_router(admin_routes.sensitive_words.router, prefix=settings.api_v1_prefix)
    app.include_router(admin_routes.audit.router, prefix=settings.api_v1_prefix)

    # 本地开发直接由 FastAPI 服务 /media 下的上传文件；生产由 nginx 优先拦截。
    media_dir = settings.media_dir
    os.makedirs(media_dir, exist_ok=True)
    app.mount("/media", StaticFiles(directory=media_dir), name="media")

    # Agent Gateway watchdog：啟動 / 停止背景任務
    @app.on_event("startup")
    async def _start_agent_watchdog() -> None:
        agent_gateway_manager.start_watchdog()

    @app.on_event("shutdown")
    async def _stop_agent_watchdog() -> None:
        await agent_gateway_manager.stop_watchdog()

    return app


app = create_app()
