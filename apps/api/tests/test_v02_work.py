from uuid import uuid4

from fastapi.testclient import TestClient


def _project(client: TestClient, headers: dict[str, str]) -> dict:
    projects = client.get("/projects", headers=headers).json()
    assert projects
    return projects[0]


def test_create_uses_type_initial_status(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    bug = client.post(
        "/work-items",
        headers=headers,
        json={
            "project_id": project["id"],
            "type": "bug",
            "title": f"v02 bug {uuid4().hex[:6]}",
            "priority": "high",
        },
    )
    assert bug.status_code == 200, bug.text
    assert bug.json()["status"] == "open"

    task = client.post(
        "/work-items",
        headers=headers,
        json={
            "project_id": project["id"],
            "type": "task",
            "title": f"v02 task {uuid4().hex[:6]}",
        },
    )
    assert task.status_code == 200, task.text
    assert task.json()["status"] == "backlog"


def test_illegal_transition_is_rejected(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    created = client.post(
        "/work-items",
        headers=headers,
        json={
            "project_id": project["id"],
            "type": "bug",
            "title": f"v02 skip {uuid4().hex[:6]}",
        },
    )
    item = created.json()
    skipped = client.patch(
        f"/work-items/{item['id']}",
        headers=headers,
        json={"status": "done"},
    )
    assert skipped.status_code == 422

    moved = client.patch(
        f"/work-items/{item['id']}",
        headers=headers,
        json={"status": "in_progress"},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["status"] == "in_progress"


def test_board_follows_type_workflow(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    board = client.get(
        f"/projects/{project['id']}/board",
        headers=headers,
        params={"type": "bug"},
    )
    assert board.status_code == 200, board.text
    keys = [col["key"] for col in board.json()["columns"]]
    assert keys[0] == "open"
    assert "to_verify" in keys
    assert "backlog" not in keys


def test_relation_and_trace_graph(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    req = client.post(
        "/work-items",
        headers=headers,
        json={
            "project_id": project["id"],
            "type": "requirement",
            "title": f"v02 req {uuid4().hex[:6]}",
        },
    ).json()
    task = client.post(
        "/work-items",
        headers=headers,
        json={
            "project_id": project["id"],
            "type": "task",
            "title": f"v02 impl {uuid4().hex[:6]}",
        },
    ).json()
    rel = client.post(
        f"/work-items/{req['id']}/relations",
        headers=headers,
        json={"target_id": task["id"], "relation_type": "implements"},
    )
    assert rel.status_code == 200, rel.text
    graph = client.get(f"/work-items/{req['id']}/graph", headers=headers)
    assert graph.status_code == 200, graph.text
    node_ids = {n["id"] for n in graph.json()["nodes"]}
    assert req["id"] in node_ids
    assert task["id"] in node_ids


def test_feishu_doc_link(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    item = client.post(
        "/work-items",
        headers=headers,
        json={
            "project_id": project["id"],
            "type": "task",
            "title": f"v02 docs {uuid4().hex[:6]}",
        },
    ).json()
    rejected = client.post(
        f"/work-items/{item['id']}/links",
        headers=headers,
        json={"url": "不是链接"},
    )
    assert rejected.status_code == 422

    added = client.post(
        f"/work-items/{item['id']}/links",
        headers=headers,
        json={"url": "https://my.feishu.cn/docx/AbCdEf123"},
    )
    assert added.status_code == 200, added.text
    assert added.json()["provider"] == "feishu"
    listed = client.get(f"/work-items/{item['id']}/links", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    dup = client.post(
        f"/work-items/{item['id']}/links",
        headers=headers,
        json={"url": "https://my.feishu.cn/docx/AbCdEf123"},
    )
    assert dup.status_code == 409
    removed = client.delete(
        f"/work-items/{item['id']}/links/{added.json()['id']}",
        headers=headers,
    )
    assert removed.status_code == 200


def test_sprint_create(client: TestClient, headers: dict[str, str]):
    project = _project(client, headers)
    created = client.post(
        "/sprints",
        headers=headers,
        json={"project_id": project["id"], "name": f"v02 sprint {uuid4().hex[:6]}", "status": "planned"},
    )
    assert created.status_code == 200, created.text
    listed = client.get("/sprints", headers=headers, params={"project_id": project["id"]})
    assert listed.status_code == 200
    names = {row["name"] for row in listed.json()}
    assert created.json()["name"] in names
