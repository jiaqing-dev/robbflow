from fastapi.testclient import TestClient


def test_app_metadata():
    from robbflow_api.main import app

    assert app.title == "RobbFlow API"
    assert app.version == "0.2.0"


def test_health_ok(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["product"] == "RobbFlow"
