from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile

from lifetrace.core.dependencies import get_auth_service, get_current_user
from lifetrace.schemas.auth import (
    AuthTokenResponse,
    PasswordChangeRequest,
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

MAX_AVATAR_BYTES = 2 * 1024 * 1024
ALLOWED_AVATAR_MIME = {"image/png", "image/jpeg", "image/webp", "image/gif"}


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


# 注意：response_model=None 必须显式传入。fastapi 0.115.6 在 `from __future__ import annotations`
# 下会把字符串注解 "None" 解析成 NoneType 并当作响应模型，与 204 状态码冲突导致模块加载失败
# （0.116+ 已修复）。降级 fastapi 前保持显式 None。
@router.put("/password", status_code=204, response_model=None)
async def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> None:
    try:
        service.change_password(
            current_user,
            old_password=payload.old_password,
            new_password=payload.new_password,
        )
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=400, detail="原密码不正确") from exc


@router.put("/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(..., description="头像图片"),
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    mime = (file.content_type or "").lower()
    if mime not in ALLOWED_AVATAR_MIME:
        raise HTTPException(status_code=400, detail="仅支持 PNG/JPEG/WebP/GIF 图片")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="图片内容为空")
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="图片不能超过 2MB")
    user = service.update_avatar(current_user, data=data, mime=mime)
    return UserResponse.model_validate(user)


@router.delete("/avatar", status_code=204, response_model=None)
async def delete_avatar(
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> None:
    service.clear_avatar(current_user)


@router.get("/avatar/{user_id}")
async def get_avatar(
    user_id: int,
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> Response:
    target = service.get_user_by_id(user_id)
    if not target or not target.avatar_data:
        raise HTTPException(status_code=404, detail="头像不存在")
    return Response(content=bytes(target.avatar_data), media_type=target.avatar_mime)


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
