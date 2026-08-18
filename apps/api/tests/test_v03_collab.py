from uuid import uuid4

from fastapi.testclient import TestClient


def _project(client: TestClient, headers: dict[str, str]) -> dict:
    projects = client.get("/projects", headers=headers).json()
    assert projects
    return projects[0]


def test_notifications_and_views(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    created = client.post(
        "/work-items",
        headers=headers,
        json={"project_id": project["id"], "type": "task", "title": f"notify {uuid4().hex[:6]}"},
    )
    assert created.status_code == 200
    item = created.json()
    members = client.get("/members", headers=headers).json()
    other = next((m for m in members if m["id"] != item["creator_id"]), None)
    if other:
        patched = client.patch(
            f"/work-items/{item['id']}",
            headers=headers,
            json={"assignee_id": other["id"]},
        )
        assert patched.status_code == 200
    notes = client.get("/notifications", headers=headers)
    assert notes.status_code == 200
    view = client.post(
        "/views",
        headers=headers,
        json={"name": "逾期", "project_id": project["id"], "filters": {"overdue": True}},
    )
    assert view.status_code == 200
    listed = client.get("/views", headers=headers, params={"project_id": project["id"]})
    assert any(v["name"] == "逾期" for v in listed.json())


def test_document_note_and_url(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    note = client.post(
        "/documents",
        headers=headers,
        json={"project_id": project["id"], "kind": "note", "title": "纪要", "body": "讨论结论"},
    )
    assert note.status_code == 200, note.text
    assert note.json()["provider"] == "note"
    link = client.post(
        "/documents",
        headers=headers,
        json={"project_id": project["id"], "url": "https://example.com/spec"},
    )
    assert link.status_code == 200, link.text
    listed = client.get("/documents", headers=headers, params={"project_id": project["id"]})
    assert listed.status_code == 200
    assert len(listed.json()) >= 2


def test_git_link(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    item = client.post(
        "/work-items",
        headers=headers,
        json={"project_id": project["id"], "type": "task", "title": f"git {uuid4().hex[:6]}"},
    ).json()
    linked = client.post(
        f"/work-items/{item['id']}/git-links",
        headers=headers,
        json={
            "provider": "github",
            "repo": "acme/robbflow",
            "ref": "feat/login",
            "url": "https://github.com/acme/robbflow/tree/feat/login",
            "kind": "branch",
        },
    )
    assert linked.status_code == 200, linked.text
    listed = client.get(f"/work-items/{item['id']}/git-links", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["ref"] == "feat/login"


def test_ticket_approval_requires_admin(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    created = client.post(
        "/work-items",
        headers=headers,
        json={"project_id": project["id"], "type": "ticket", "title": f"ticket {uuid4().hex[:6]}"},
    )
    assert created.status_code == 200, created.text
    item = created.json()
    assert item["status"] == "submitted"
    moved = client.patch(
        f"/work-items/{item['id']}",
        headers=headers,
        json={"status": "pending_approval"},
    )
    assert moved.status_code == 200, moved.text
    approved = client.patch(
        f"/work-items/{item['id']}",
        headers=headers,
        json={"status": "processing"},
    )
    assert approved.status_code == 200, approved.text


def test_integrations_list(client: TestClient, headers: dict[str, str]):
    res = client.get("/integrations", headers=headers)
    assert res.status_code == 200
    keys = {row["key"] for row in res.json()}
    assert "feishu" in keys
    assert "dingtalk" in keys
    assert "oa" in keys
    oidc = client.get("/integrations/oidc/feishu", headers=headers)
    assert oidc.status_code == 200
    assert oidc.json()["status"] == "not_configured"
    bind = client.post(
        "/integrations/bindings",
        headers=headers,
        json={"provider": "feishu", "external_id": "ou_demo"},
    )
    assert bind.status_code == 200


def test_oa_callback_advances_status(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    created = client.post(
        "/work-items",
        headers=headers,
        json={"project_id": project["id"], "type": "task", "title": f"oa {uuid4().hex[:6]}"},
    )
    assert created.status_code == 200
    item = created.json()
    nxt = client.post(
        "/integrations/oa/callback",
        headers=headers,
        json={"work_item_id": item["id"], "status": "in_progress"},
    )
    assert nxt.status_code in {200, 422}


def test_sprint_progress(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    sprints = client.get("/sprints", headers=headers, params={"project_id": project["id"]})
    assert sprints.status_code == 200
    if sprints.json():
        row = sprints.json()[0]
        assert "progress" in row
        assert "done_count" in row
