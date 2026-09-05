"""Admin 后台 API schema 定义"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from lifetrace.schemas.auth import _validate_email


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    display_name: str | None = None
    role: str = "user"
    disabled: bool = False
    created_at: str | None = None


class AdminUserCreateRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=200)
    display_name: str | None = Field(default=None, max_length=120)
    role: str = Field(default="user", pattern="^(admin|user)$")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)


class AdminUserUpdateRequest(BaseModel):
    role: str | None = Field(default=None, pattern="^(admin|user)$")
    display_name: str | None = Field(default=None, max_length=120)
    disabled: bool | None = None


class AdminUserResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=200)


class AdminStatsOverview(BaseModel):
    users: int
    todos: int
    journals: int
    projects: int


class AdminStatsGrowthPoint(BaseModel):
    date: str
    count: int


class AdminStatsGrowthResponse(BaseModel):
    series: list[AdminStatsGrowthPoint]


class AdminLlmCostItem(BaseModel):
    model: str | None = None
    total_tokens: int = 0
    total_cost: float = 0.0
    calls: int = 0


class AdminLlmCostResponse(BaseModel):
    items: list[AdminLlmCostItem]
