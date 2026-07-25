"""习惯相关的 Pydantic 模型"""

from datetime import datetime

from pydantic import BaseModel, Field


class HabitCreate(BaseModel):
    """创建习惯请求模型"""

    name: str = Field(..., max_length=200, description="习惯名称")
    icon: str = Field("✅", max_length=32, description="图标（emoji）")
    frequency: str = Field("daily", max_length=20, description="daily/weekly/monthly")
    goal: str = Field("complete", max_length=20, description="complete/participate")
    start_date: datetime | None = Field(None, description="开始日期")
    persistence_days: int = Field(0, ge=0, description="目标坚持天数")
    group: str = Field("allDay", max_length=20, description="morning/afternoon/evening/allDay")


class HabitUpdate(BaseModel):
    """更新习惯请求模型"""

    name: str | None = Field(None, max_length=200)
    icon: str | None = Field(None, max_length=32)
    frequency: str | None = Field(None, max_length=20)
    goal: str | None = Field(None, max_length=20)
    start_date: datetime | None = None
    persistence_days: int | None = Field(None, ge=0)
    group: str | None = Field(None, max_length=20)


class HabitResponse(BaseModel):
    """习惯响应模型"""

    id: int
    uid: str
    name: str
    icon: str
    frequency: str
    goal: str
    start_date: datetime | None
    persistence_days: int
    group: str
    created_at: datetime
    updated_at: datetime


class HabitRecordCreate(BaseModel):
    """打卡请求模型"""

    date: datetime = Field(..., description="打卡日期")


class HabitRecordResponse(BaseModel):
    """打卡记录响应模型"""

    id: int
    habit_id: int
    record_date: datetime
    created_at: datetime


class HabitListResponse(BaseModel):
    """习惯列表响应模型"""

    total: int
    habits: list[HabitResponse]
