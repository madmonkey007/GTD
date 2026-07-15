"""零秒思考（Zero-Second Thinking）相关的 Pydantic 模型"""

from pydantic import BaseModel, Field, field_validator


class ZeroThinkCardCreate(BaseModel):
    """创建零秒思考卡片请求模型"""

    question: str = Field(..., min_length=1, max_length=500, description="问题标题（必须包含？或?）")
    answers: list[str] = Field(..., min_length=4, max_length=6, description="答案列表（4-6条）")
    day_index: int = Field(..., ge=1, le=10, description="今天第几个问题（1-10）")
    mode: str = Field("scattered", description="模式：scattered | batch")
    duration_ms: int = Field(0, ge=0, description="实际耗时（毫秒）")

    @field_validator("question")
    @classmethod
    def question_must_contain_question_mark(cls, v: str) -> str:
        if "?" not in v and "\uff1f" not in v:
            raise ValueError("问题必须是疑问句（包含？或?）")
        return v

    @field_validator("answers")
    @classmethod
    def answers_must_be_4_to_6(cls, v: list[str]) -> list[str]:
        if len(v) < 4 or len(v) > 6:
            raise ValueError("答案数量必须为4-6条")
        return v


class ZeroThinkCardResponse(BaseModel):
    """零秒思考卡片响应模型"""

    id: str = Field(..., description="卡片ID")
    user_id: str = Field(..., description="用户ID")
    date: str = Field(..., description="日期 YYYY-MM-DD")
    question: str = Field(..., description="问题标题")
    answers: list[str] = Field(..., description="答案列表")
    day_index: int = Field(..., description="今天第几个问题")
    mode: str = Field(..., description="模式")
    duration_ms: int = Field(0, description="实际耗时（毫秒）")
    is_locked: bool = Field(False, description="是否已锁定")
    category: str = Field("", description="AI分类场景")
    created_at: str = Field(..., description="创建时间")

    class Config:
        from_attributes = True


class ZeroThinkStatsResponse(BaseModel):
    """零秒思考统计响应模型"""

    total_days: int = Field(0, description="有卡片的总天数")
    current_streak: int = Field(0, description="当前连续天数")
    best_streak: int = Field(0, description="历史最佳连续天数")
    today_count: int = Field(0, description="今天卡片数量")
    today_completed: bool = Field(False, description="今天10个是否已完成")


class ZeroThinkDailySummary(BaseModel):
    """零秒思考每日摘要"""

    date: str = Field(..., description="日期")
    cards: list[ZeroThinkCardResponse] = Field(default_factory=list, description="当天所有卡片")
    total_questions: int = Field(0, description="问题总数")
    themes: list[str] = Field(default_factory=list, description="常见主题")
    summary_text: str = Field("", description="AI生成的摘要")
