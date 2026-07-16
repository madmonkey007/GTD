# ruff: noqa: PLC0415
"""
后台任务管理器
负责管理所有后台任务的启动、停止和配置更新

注：屏幕录制/OCR/主动OCR/活动聚合/截图清理/自动待办检测/Todo专用录制
等截图相关定时任务已移除（用户不需要）。
"""

from functools import lru_cache

from lifetrace.core.module_registry import get_module_states
from lifetrace.jobs.scheduler import SchedulerManager, get_scheduler_manager
from lifetrace.util.logging_config import get_logger
from lifetrace.util.settings import settings

logger = get_logger()


def _execute_deadline_reminder_task():
    from lifetrace.jobs.deadline_reminder import execute_deadline_reminder_task

    return execute_deadline_reminder_task()


def execute_audio_recording_status_check():
    """音频录制状态检查任务（用于监控录音状态）

    注意：音频录制实际上由前端WebSocket控制，此任务仅用于状态监控和日志记录
    """
    try:
        # 检查配置
        enabled = settings.get("jobs.audio_recording.enabled", False)
        audio_is_24x7 = settings.get("audio.is_24x7", False)

        # 如果配置开启，记录状态（实际启动由前端控制）
        if enabled and audio_is_24x7:
            logger.debug("音频录制服务已启用（由前端WebSocket控制）")
        else:
            logger.debug("音频录制服务未启用")
    except Exception as e:
        logger.error(f"音频录制状态检查失败: {e}", exc_info=True)


class JobManager:
    """后台任务管理器"""

    def __init__(self):
        """初始化任务管理器"""
        # 后台服务实例
        self.scheduler_manager: SchedulerManager | None = None
        self.module_states = {}

        logger.info("任务管理器已初始化")

    def _get_scheduler(self) -> SchedulerManager | None:
        if not self.scheduler_manager:
            logger.warning("调度器未初始化，跳过任务配置")
            return None
        return self.scheduler_manager

    def _is_module_active(self, *module_ids: str) -> bool:
        """检查模块是否启用且依赖可用"""
        if not self.module_states:
            self.module_states = get_module_states()

        for module_id in module_ids:
            state = self.module_states.get(module_id)
            if not state or not state.enabled or not state.available:
                return False
        return True

    def start_all(self):
        """启动所有后台任务"""
        logger.info("开始启动所有后台任务")

        self.module_states = get_module_states()

        if not self._is_module_active("scheduler"):
            logger.warning("调度器模块未启用或依赖缺失，跳过后台任务启动")
            return

        # 启动调度器
        self._start_scheduler()
        if not self.scheduler_manager:
            logger.warning("调度器启动失败，停止后台任务初始化")
            return

        # 启动 DDL 提醒任务
        self._start_deadline_reminder_job()

        # 启动用户自定义自动化任务
        self._start_automation_tasks()

        # 启动音频录制状态检查任务
        self._start_audio_recording_job()

        logger.info("所有后台任务已启动")

    def stop_all(self):
        """停止所有后台任务"""
        logger.error("正在停止所有后台任务")

        # 停止调度器（会自动停止所有调度任务）
        self._stop_scheduler()

        logger.error("所有后台任务已停止")

    def _start_scheduler(self):
        """启动调度器"""
        try:
            self.scheduler_manager = get_scheduler_manager()
            self.scheduler_manager.start()
            logger.info("调度器已启动")
        except Exception as e:
            logger.error(f"启动调度器失败: {e}", exc_info=True)

    def _stop_scheduler(self):
        """停止调度器"""
        if self.scheduler_manager:
            try:
                logger.error("正在停止调度器...")
                self.scheduler_manager.shutdown(wait=True)
                logger.error("调度器已停止")
            except Exception as e:
                logger.error(f"停止调度器失败: {e}")

    def _start_deadline_reminder_job(self):
        """启动 DDL 提醒任务"""
        if not self._is_module_active("todo", "notification"):
            logger.info("待办/通知模块未启用，跳过 DDL 提醒任务")
            return
        enabled = settings.get("jobs.deadline_reminder.enabled")

        try:
            scheduler = self._get_scheduler()
            if not scheduler:
                return

            # 清理旧的定时扫描任务（历史遗留）
            if scheduler.get_job("deadline_reminder_job"):
                scheduler.remove_job("deadline_reminder_job")
                logger.info("已移除旧的 DDL 提醒扫描任务")

            if not enabled:
                from lifetrace.jobs.deadline_reminder import clear_all_todo_reminder_jobs

                clear_all_todo_reminder_jobs()
                logger.info("DDL 提醒服务未启用，已清理提醒任务")
                return

            from lifetrace.jobs.deadline_reminder import sync_all_todo_reminders

            sync_all_todo_reminders()
            logger.info("DDL 提醒任务已同步")
        except Exception as e:
            logger.error(f"启动 DDL 提醒任务失败: {e}", exc_info=True)

    def _start_automation_tasks(self):
        """启动用户自定义自动化任务"""
        if not self._is_module_active("automation", "scheduler"):
            logger.info("自动化模块未启用，跳过自动化任务")
            return

        scheduler = self._get_scheduler()
        if not scheduler:
            return

        try:
            from lifetrace.services.automation_task_service import AutomationTaskService

            AutomationTaskService().sync_all_tasks()
            logger.info("自动化任务同步完成")
        except Exception as e:
            logger.error(f"自动化任务同步失败: {e}", exc_info=True)

    def _start_audio_recording_job(self):
        """启动音频录制状态检查任务

        注意：音频录制实际上由前端WebSocket控制，此任务仅用于状态监控
        """
        if not self._is_module_active("audio"):
            logger.info("音频模块未启用，跳过音频录制状态检查任务")
            return
        enabled = settings.get("jobs.audio_recording.enabled", False)

        try:
            scheduler = self._get_scheduler()
            if not scheduler:
                return

            # 添加到调度器（无论是否启用都添加）
            interval = settings.get("jobs.audio_recording.interval", 60)
            audio_recording_id = settings.get("jobs.audio_recording.id", "audio_recording")
            scheduler.add_interval_job(
                func=execute_audio_recording_status_check,
                job_id="audio_recording_job",
                name=audio_recording_id,
                seconds=interval,
                replace_existing=True,
            )
            logger.info(f"音频录制状态检查任务已添加，间隔: {interval}秒")

            # 如果未启用，则暂停
            if not enabled:
                scheduler.pause_job("audio_recording_job")
                logger.info("音频录制服务未启用，已暂停")
            else:
                logger.info("音频录制服务已启用（由前端WebSocket控制）")
        except Exception as e:
            logger.error(f"启动音频录制任务失败: {e}", exc_info=True)


# 全局单例


@lru_cache(maxsize=1)
def get_job_manager() -> JobManager:
    """获取任务管理器单例"""
    return JobManager()
