from pydantic import BaseModel

from app.schemas.user import UserOut


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class OmeLoginRequest(BaseModel):
    external_token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str
