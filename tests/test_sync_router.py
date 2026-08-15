from lifetrace.core.module_registry import MODULE_INDEX
from lifetrace.routers.sync import router


def test_sync_router_exposes_push_and_pull_as_a_core_module() -> None:
    routes = {(route.path, method) for route in router.routes for method in route.methods}

    assert ("/api/sync/push", "POST") in routes
    assert ("/api/sync/pull", "GET") in routes
    assert MODULE_INDEX["sync"].core is True
