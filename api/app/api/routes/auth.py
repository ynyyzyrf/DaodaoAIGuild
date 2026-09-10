import jwt
from fastapi import APIRouter

from app.api.deps import CurrentUserDep, SessionDep
from app.core.exceptions import ApiError
from app.core.security import create_access_token, create_refresh_token, decode_access_token
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, LoginResponse, OmeLoginRequest, RefreshTokenRequest
from app.schemas.common import ApiResponse
from app.schemas.user import UserOut
from app.services.auth import authenticate
from app.services.ome_account import resolve_ome_user

router = APIRouter(prefix="/auth", tags=["auth"])


def build_login_response(user, refresh_token: str | None = None) -> LoginResponse:
    access_token = create_access_token(user.id, user.username)
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token or create_refresh_token(user.id, user.username),
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=ApiResponse[LoginResponse])
async def login(payload: LoginRequest, session: SessionDep):
    user = await authenticate(session, payload.username, payload.password)
    if user is None:
        raise ApiError(code=41003, message="用户名或密码错误", status_code=401)
    return ApiResponse(data=build_login_response(user))


@router.post("/ome-login", response_model=ApiResponse[LoginResponse])
async def ome_login(payload: OmeLoginRequest, session: SessionDep):
    try:
        user = await resolve_ome_user(session, payload.external_token)
    except ApiError:
        raise
    except Exception as err:
        raise ApiError(code=50012, message="OMEACCOUNT 服务暂时不可用", status_code=502) from err
    return ApiResponse(data=build_login_response(user))


@router.post("/refresh", response_model=ApiResponse[LoginResponse])
async def refresh(payload: RefreshTokenRequest, session: SessionDep):
    try:
        token_payload = decode_access_token(payload.refresh_token)
    except jwt.ExpiredSignatureError as err:
        raise ApiError(code=41002, message="刷新令牌已过期", status_code=401) from err
    except jwt.PyJWTError as err:
        raise ApiError(code=41001, message="无效刷新令牌", status_code=401) from err

    if token_payload.get("type") != "refresh":
        raise ApiError(code=41001, message="无效刷新令牌", status_code=401)

    user_id = int(token_payload.get("sub"))
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None or not user.is_active:
        raise ApiError(code=41001, message="用户不存在或已禁用", status_code=401)

    return ApiResponse(data=build_login_response(user, refresh_token=payload.refresh_token))


@router.get("/me", response_model=ApiResponse[UserOut])
async def me(current_user: CurrentUserDep):
    return ApiResponse(data=UserOut.model_validate(current_user))
