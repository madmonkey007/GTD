"""Database URL selection must support both desktop and cloud runtimes."""

from lifetrace.util.path_utils import get_database_url


def test_database_url_prefers_deployment_environment(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:password@ep-example.us-east-2.aws.neon.tech/lifetrace?sslmode=require",
    )

    assert get_database_url() == (
        "postgresql://user:password@ep-example.us-east-2.aws.neon.tech/"
        "lifetrace?sslmode=require"
    )


def test_database_url_falls_back_to_local_sqlite(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)

    assert get_database_url().startswith("sqlite:///")
