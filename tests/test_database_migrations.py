"""Migration orchestration contracts for fresh and existing databases."""

from lifetrace.storage import database_base as database_base_module
from lifetrace.storage.database_base import DatabaseBase


class _Config:
    def __init__(self, _path: str) -> None:
        self.options: dict[str, str] = {}

    def set_main_option(self, key: str, value: str) -> None:
        self.options[key] = value


class _CommandRecorder:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def stamp(self, _config: _Config, revision: str) -> None:
        self.calls.append(("stamp", revision))

    def upgrade(self, _config: _Config, revision: str) -> None:
        self.calls.append(("upgrade", revision))


def test_fresh_database_is_stamped_at_head_after_create_all(monkeypatch):
    recorder = _CommandRecorder()
    monkeypatch.delenv("LIFETRACE_SKIP_MIGRATIONS", raising=False)
    monkeypatch.setattr(database_base_module, "command", recorder)
    monkeypatch.setattr(database_base_module, "Config", _Config)
    monkeypatch.setattr(database_base_module, "get_database_url", lambda: "sqlite:///fresh.db")

    database = DatabaseBase.__new__(DatabaseBase)
    database._run_migrations(fresh_database=True)

    assert recorder.calls == [("stamp", "head")]


def test_existing_database_is_upgraded_to_head(monkeypatch):
    recorder = _CommandRecorder()
    monkeypatch.delenv("LIFETRACE_SKIP_MIGRATIONS", raising=False)
    monkeypatch.setattr(database_base_module, "command", recorder)
    monkeypatch.setattr(database_base_module, "Config", _Config)
    monkeypatch.setattr(database_base_module, "get_database_url", lambda: "sqlite:///existing.db")

    database = DatabaseBase.__new__(DatabaseBase)
    database._run_migrations(fresh_database=False)

    assert recorder.calls == [("upgrade", "head")]
