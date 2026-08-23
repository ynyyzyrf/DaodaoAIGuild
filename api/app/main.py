import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

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
from app.api.routes import admin as admin_routes
from app.core.config import get_settings
from app.core.exceptions import ApiError


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

    return app


app = create_app()
