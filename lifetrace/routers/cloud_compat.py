"""Small compatibility endpoints used by the web client in cloud deployments.

These endpoints deliberately do not expose desktop-only state or secrets.  The
desktop application has richer implementations in the regular routers, while
Vercel needs stable responses for the shared web UI and its polling hooks.
"""

from fastapi import APIRouter

from lifetrace.core.module_registry import get_capabilities_report
from lifetrace.services.config_service import is_llm_configured

router = APIRouter(prefix="/api", tags=["cloud-compat"])


@router.get("/capabilities")
async def cloud_capabilities() -> dict[str, object]:
    """Report module capability information without enabling desktop routers."""
    return get_capabilities_report()


@router.get("/llm-status")
async def cloud_llm_status() -> dict[str, bool]:
    """Return configuration state only; connection probing is not serverless-safe."""
    try:
        configured = is_llm_configured()
    except Exception:
        configured = False
    return {"configured": configured}


@router.get("/get-config")
async def cloud_config() -> dict[str, object]:
    """Keep the legacy response shape without returning API keys to browsers."""
    return {"success": True, "config": {}}


@router.get("/notifications")
async def cloud_notifications() -> list[object]:
    """Cloud deployments have no in-memory desktop notification scheduler yet."""
    return []


@router.delete("/notifications/{notification_id}")
async def delete_cloud_notification(notification_id: str) -> dict[str, object]:
    del notification_id
    return {"success": False, "message": "云端通知未启用"}
