from __future__ import annotations

from pathlib import Path

import lifetrace.util.settings as settings_module


def test_read_only_config_dir_uses_default_without_copying_user_config(
    tmp_path: Path,
    monkeypatch,
) -> None:
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    default_path = config_dir / "default_config.yaml"
    default_path.write_text("server:\n  port: 8001\n", encoding="utf-8")

    monkeypatch.setattr(settings_module, "_get_config_dir", lambda: config_dir)
    monkeypatch.setattr(settings_module, "_get_default_config_dir", lambda: config_dir)

    files = settings_module._init_config_files()

    assert files == [str(default_path)]
    assert not (config_dir / "config.yaml").exists()
