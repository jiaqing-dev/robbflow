from uuid import uuid4

from fastapi.testclient import TestClient


def test_login_and_me(client: TestClient, headers: dict[str, str]):
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "demo@robbflow.dev"


def test_presets_are_bootstrapped(client: TestClient, headers: dict[str, str]):
    workflows = client.get("/workflows", headers=headers).json()
    keys = {w["key"] for w in workflows}
    assert {"engineering", "product", "bug", "test_case", "test_task"} <= keys
    types = client.get("/work-item-types", headers=headers).json()
    type_keys = {t["key"] for t in types}
    assert {"requirement", "task", "bug", "test_case"} <= type_keys


def test_replace_workflow_is_idempotent(client: TestClient, headers: dict[str, str]):
    created = client.post(
        "/workflows",
        headers=headers,
        json={"name": f"v02-save-{uuid4().hex[:8]}", "preset": "bug"},
    )
    assert created.status_code == 200, created.text
    wf = created.json()
    payload = {
        "name": wf["name"],
        "description": wf["description"],
        "is_default": False,
        "states": wf["states"],
        "transitions": wf["transitions"],
    }
    first = client.put(f"/workflows/{wf['id']}", headers=headers, json=payload)
    assert first.status_code == 200, first.text
    extra = {
        "key": f"gate_{uuid4().hex[:6]}",
        "name": "质量门禁",
        "category": "started",
        "color": "#38bdf8",
        "position": 40,
        "layout_x": 640,
        "layout_y": 96,
    }
    payload["states"] = [*wf["states"], extra]
    added = client.put(f"/workflows/{wf['id']}", headers=headers, json=payload)
    assert added.status_code == 200, added.text
    again = client.put(f"/workflows/{wf['id']}", headers=headers, json=payload)
    assert again.status_code == 200, again.text
    keys = [s["key"] for s in again.json()["states"]]
    assert extra["key"] in keys
    assert len(keys) == len(set(keys))
