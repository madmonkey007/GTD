from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException

from lifetrace.core.dependencies import get_auth_service, get_current_user
from lifetrace.schemas.auth import (
    AuthTokenResponse,
    UserLoginRequest,
    UserProfileUpdate,
    UserRegisterRequest,
    UserResponse,
)
from lifetrace.services.auth_service import (
    AuthService,
    DuplicateUserEmailError,
    InvalidCredentialsError,
    create_access_token,
)

if TYPE_CHECKING:
    from lifetrace.storage.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthTokenResponse, status_code=201)
async def register(
    payload: UserRegisterRequest,
    service: AuthService = Depends(get_auth_service),
) -> AuthTokenResponse:
    try:
        user = service.register_user(
            email=payload.email,
            password=payload.password,
            display_name=payload.display_name,
        )
    except DuplicateUserEmailError as exc:
        raise HTTPException(status_code=409, detail="邮箱已注册") from exc
    return _token_response(user)


@router.post("/login", response_model=AuthTokenResponse)
async def login(
    payload: UserLoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> AuthTokenResponse:
    try:
        user = service.authenticate_user(email=payload.email, password=payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=401, detail="邮箱或密码不正确") from exc
    return _token_response(user)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    user = service.update_display_name(
        current_user, display_name=payload.display_name
    )
    return UserResponse.model_validate(user)


def _token_response(user: User) -> AuthTokenResponse:
    if user.id is None:
        raise HTTPException(status_code=500, detail="用户创建失败")
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        expires_delta=timedelta(minutes=10080),
    )
    return AuthTokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )
