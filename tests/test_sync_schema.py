from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from lifetrace.schemas.sync import SyncOpResult, SyncPullResponse, SyncPushRequest


def test_sync_push_request_accepts_client_outbox_camel_case() -> None:
    queued_at = "2026-08-15T01:02:03Z"
    request = SyncPushRequest.model_validate(
        {
            "clientId": "phone-1",
            "ops": [
                {
                    "opId": "op-1",
                    "kind": "todo.create",
                    "uid": "todo-uid",
                    "dependsOn": ["parent-uid"],
                    "baseUpdatedAt": None,
                    "payload": {"name": "offline todo"},
                    "queuedAt": queued_at,
                }
            ],
        }
    )

    assert request.client_id == "phone-1"
    assert request.ops[0].op_id == "op-1"
    assert request.ops[0].depends_on == ["parent-uid"]
    assert request.ops[0].queued_at == datetime(2026, 8, 15, 1, 2, 3, tzinfo=UTC)

    dumped = request.model_dump(by_alias=True, mode="json")
    assert dumped["clientId"] == "phone-1"
    assert dumped["ops"][0]["baseUpdatedAt"] is None
    assert dumped["ops"][0]["queuedAt"] == queued_at


@pytest.mark.parametrize("status", ["applied", "duplicate", "conflict", "error"])
def test_sync_op_result_accepts_supported_statuses(status: str) -> None:
    result = SyncOpResult.model_validate(
        {"opId": "op-1", "status": status, "entityType": "todo", "uid": "todo-uid"}
    )
    assert result.status == status


def test_sync_op_result_rejects_unknown_status() -> None:
    with pytest.raises(ValidationError):
        SyncOpResult.model_validate(
            {"opId": "op-1", "status": "ignored", "entityType": "todo", "uid": "todo-uid"}
        )


def test_sync_pull_response_has_stable_client_aliases() -> None:
    response = SyncPullResponse(server_time=datetime(2026, 8, 15, tzinfo=UTC))
    dumped = response.model_dump(by_alias=True, mode="json")

    assert dumped == {
        "todos": [],
        "journals": [],
        "habits": [],
        "habitRecords": [],
        "tombstones": [],
        "serverTime": "2026-08-15T00:00:00Z",
    }
