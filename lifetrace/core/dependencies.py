"""FastAPI 依赖注入模块

提供数据库会话和服务层的依赖注入工厂函数。
"""

from collections.abc import Generator

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from lifetrace.core.lazy_services import (
    get_rag_service as lazy_get_rag_service,
)
from lifetrace.core.lazy_services import (
    get_vector_service as lazy_get_vector_service,
)
from lifetrace.repositories.interfaces import (
    IActivityRepository,
    IChatRepository,
    IEventRepository,
    IJournalRepository,
    IOcrRepository,
    ITodoRepository,
)
from lifetrace.repositories.sql_activity_repository import SqlActivityRepository
from lifetrace.repositories.sql_chat_repository import SqlChatRepository
from lifetrace.repositories.sql_collection_repository import SqlCollectionRepository
from lifetrace.repositories.sql_event_repository import SqlEventRepository, SqlOcrRepository
from lifetrace.repositories.sql_habit_repository import SqlHabitRepository
from lifetrace.repositories.sql_journal_repository import SqlJournalRepository
from lifetrace.repositories.sql_note_link_repository import SqlNoteLinkRepository
from lifetrace.repositories.sql_project_repository import SqlProjectRepository
from lifetrace.repositories.sql_todo_repository import SqlTodoRepository
from lifetrace.services.activity_service import ActivityService
from lifetrace.services.auth_service import (
    AuthService,
    AuthTokenError,
    verify_access_token,
)
from lifetrace.services.chat_service import ChatService
from lifetrace.services.collection_service import CollectionService
from lifetrace.services.event_service import EventService
from lifetrace.services.habit_service import HabitService
from lifetrace.services.journal_service import JournalService
from lifetrace.services.note_link_service import NoteLinkService
from lifetrace.services.project_service import ProjectService
from lifetrace.services.sync_service import SyncService
from lifetrace.services.todo_service import TodoService
from lifetrace.services.zero_think_service import ZeroThinkService
from lifetrace.storage.database_base import DatabaseBase
from lifetrace.storage.models import User
from lifetrace.storage.zero_think_manager import ZeroThinkManager
from lifetrace.util.settings import settings

bearer_scheme = HTTPBearer(auto_error=False)


def get_db_base() -> DatabaseBase:
    """获取数据库基础实例（复用 storage 模块的单例）"""
    from lifetrace.storage.database import db_base  # noqa: PLC0415

    return db_base


def get_db_session(
    db_base: DatabaseBase = Depends(get_db_base),
) -> Generator[Session]:
    """获取数据库会话 - 请求级别生命周期"""
    if db_base.SessionLocal is None:
        raise RuntimeError("Database session factory is not initialized.")
    session = db_base.SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ========== Auth module dependencies ==========


def get_auth_service(session: Session = Depends(get_db_session)) -> AuthService:
    """Return the request-scoped authentication service."""
    return AuthService(session)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Resolve the authenticated user from a bearer access token."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="未登录")
    try:
        claims = verify_access_token(credentials.credentials)
    except AuthTokenError as exc:
        raise HTTPException(status_code=401, detail="登录已过期或无效") from exc
    user = auth_service.get_user_by_id(claims.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="登录已过期或无效")
    return user


# ========== Todo 模块依赖注入 ==========


def get_todo_repository(
    db_base: DatabaseBase = Depends(get_db_base),
    current_user: User = Depends(get_current_user),
) -> ITodoRepository:
    """获取 Todo 仓库实例"""
    if current_user.id is None:
        raise HTTPException(status_code=401, detail="未登录")
    return SqlTodoRepository(db_base, user_id=current_user.id)


def get_todo_service(
    repo: ITodoRepository = Depends(get_todo_repository),
    db_base: DatabaseBase = Depends(get_db_base),
) -> TodoService:
    """获取 Todo 服务实例"""
    return TodoService(repo, db_base=db_base)


# ========== Journal 模块依赖注入 ==========


def get_journal_repository(
    db_base: DatabaseBase = Depends(get_db_base),
    current_user: User = Depends(get_current_user),
) -> IJournalRepository:
    """获取 Journal 仓库实例"""
    if current_user.id is None:
        raise HTTPException(status_code=401, detail="未登录")
    return SqlJournalRepository(db_base, user_id=current_user.id)


def get_journal_service(
    repo: IJournalRepository = Depends(get_journal_repository),
    db_base: DatabaseBase = Depends(get_db_base),
    todo_repo: ITodoRepository = Depends(get_todo_repository),
) -> JournalService:
    """获取 Journal 服务实例"""
    return JournalService(repo, db_base, todo_repository=todo_repo)


# ========== Habit 模块依赖注入 ==========


def get_habit_repository(
    db_base: DatabaseBase = Depends(get_db_base),
    current_user: User = Depends(get_current_user),
) -> SqlHabitRepository:
    """获取 Habit 仓库实例"""
    if current_user.id is None:
        raise HTTPException(status_code=401, detail="未登录")
    return SqlHabitRepository(db_base, user_id=current_user.id)


def get_habit_service(
    repo: SqlHabitRepository = Depends(get_habit_repository),
    db_base: DatabaseBase = Depends(get_db_base),
) -> HabitService:
    """获取 Habit 服务实例"""
    return HabitService(repo, db_base)


# ========== Offline sync module dependency injection ==========


def get_sync_service(
    db_base: DatabaseBase = Depends(get_db_base),
) -> SyncService:
    """Return the batch offline synchronization service."""
    return SyncService(db_base)


# ========== NoteLink 模块依赖注入 ==========


def get_note_link_repository(
    db_base: DatabaseBase = Depends(get_db_base),
) -> SqlNoteLinkRepository:
    """获取 NoteLink 仓库实例"""
    return SqlNoteLinkRepository(db_base)


def get_note_link_service(
    repo: SqlNoteLinkRepository = Depends(get_note_link_repository),
    journal_repo: IJournalRepository = Depends(get_journal_repository),
    db_base: DatabaseBase = Depends(get_db_base),
) -> NoteLinkService:
    """获取 NoteLink 服务实例"""
    return NoteLinkService(repo, journal_repo, db_base)


# ========== Collection 模块依赖注入 ==========


def get_collection_repository(
    db_base: DatabaseBase = Depends(get_db_base),
) -> SqlCollectionRepository:
    """获取 Collection 仓库实例"""
    return SqlCollectionRepository(db_base)


def get_collection_service(
    repo: SqlCollectionRepository = Depends(get_collection_repository),
    journal_repo: IJournalRepository = Depends(get_journal_repository),
) -> CollectionService:
    """获取 Collection 服务实例"""
    return CollectionService(repo, journal_repo)


# ========== Project 模块依赖注入 ==========


def get_project_repository(
    db_base: DatabaseBase = Depends(get_db_base),
    current_user: User = Depends(get_current_user),
) -> SqlProjectRepository:
    """获取 Project 仓库实例"""
    if current_user.id is None:
        raise HTTPException(status_code=401, detail="未登录")
    return SqlProjectRepository(db_base, user_id=current_user.id)


def get_project_service(
    repo: SqlProjectRepository = Depends(get_project_repository),
    todo_repo: ITodoRepository = Depends(get_todo_repository),
    journal_repo: IJournalRepository = Depends(get_journal_repository),
) -> ProjectService:
    """获取 Project 服务实例"""
    return ProjectService(repo, todo_repo, journal_repo)


# ========== Event 模块依赖注入 ==========


def get_event_repository(
    db_base: DatabaseBase = Depends(get_db_base),
) -> IEventRepository:
    """获取 Event 仓库实例"""
    return SqlEventRepository(db_base)


def get_ocr_repository(
    db_base: DatabaseBase = Depends(get_db_base),
) -> IOcrRepository:
    """获取 OCR 仓库实例"""
    return SqlOcrRepository(db_base)


def get_event_service(
    event_repo: IEventRepository = Depends(get_event_repository),
    ocr_repo: IOcrRepository = Depends(get_ocr_repository),
) -> EventService:
    """获取 Event 服务实例"""
    return EventService(event_repo, ocr_repo)


# ========== Activity 模块依赖注入 ==========


def get_activity_repository(
    db_base: DatabaseBase = Depends(get_db_base),
) -> IActivityRepository:
    """获取 Activity 仓库实例"""
    return SqlActivityRepository(db_base)


def get_activity_service(
    activity_repo: IActivityRepository = Depends(get_activity_repository),
    event_repo: IEventRepository = Depends(get_event_repository),
) -> ActivityService:
    """获取 Activity 服务实例"""
    return ActivityService(activity_repo, event_repo)


# ========== Chat 模块依赖注入 ==========


def get_chat_repository(
    db_base: DatabaseBase = Depends(get_db_base),
) -> IChatRepository:
    """获取 Chat 仓库实例"""
    return SqlChatRepository(db_base)


def get_chat_service(
    repo: IChatRepository = Depends(get_chat_repository),
) -> ChatService:
    """获取 Chat 服务实例"""
    return ChatService(repo)


# ========== 延迟加载服务 ==========


def get_vector_service():
    """获取向量服务（延迟加载）"""
    return lazy_get_vector_service()


def get_rag_service():
    """获取 RAG 服务（延迟加载）"""
    return lazy_get_rag_service()


# ========== 配置依赖注入 ==========


def get_settings():
    """获取配置对象"""
    return settings


# ========== ZeroThink 模块依赖注入 ==========


def get_zero_think_manager(
    db_base: DatabaseBase = Depends(get_db_base),
) -> ZeroThinkManager:
    """获取零秒思考管理器实例"""
    return ZeroThinkManager(db_base)


def get_zero_think_service(
    manager: ZeroThinkManager = Depends(get_zero_think_manager),
) -> ZeroThinkService:
    """获取零秒思考服务实例"""
    return ZeroThinkService(manager)
