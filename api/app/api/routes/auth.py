from fastapi import APIRouter

from app.api.deps import CurrentUserDep, SessionDep
from app.core.exceptions import ApiError
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, LoginResponse
from app.schemas.common import ApiResponse
from app.schemas.user import UserOut
from app.services.auth import authenticate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=ApiResponse[LoginResponse])
async def login(payload: LoginRequest, session: SessionDep):
    user = await authenticate(session, payload.username, payload.password)
    if user is None:
        raise ApiError(code=41003, message="用户名或密码错误", status_code=401)
    token = create_access_token(user.id, user.username)
    data = LoginResponse(access_token=token, user=UserOut.model_validate(user))
    return ApiResponse(data=data)


@router.get("/me", response_model=ApiResponse[UserOut])
async def me(current_user: CurrentUserDep):
    return ApiResponse(data=UserOut.model_validate(current_user))
