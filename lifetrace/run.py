"""Launcher that patches sys.path then starts uvicorn."""
import os
import sys

_project_root = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.dirname(_project_root)
os.chdir(_project_root)

sys.path.insert(0, _parent_dir)

import uvicorn
from lifetrace.util.settings import settings
from server import find_available_port, app  # noqa: E402

host = settings.server.host
port = settings.server.port
actual_port = find_available_port(host, port)

uvicorn.run(
    "lifetrace.server:app",
    host=host,
    port=actual_port,
    log_level="info",
)
