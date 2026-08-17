from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    try:
        from robbflow_api.main import app
    except Exception as exc:  # pragma: no cover - import-time env issues
        pytest.skip(f"API import failed: {exc}")
    try:
        with TestClient(app) as test_client:
            health = test_client.get("/health")
            if health.status_code != 200:
                pytest.skip("API health check failed")
            yield test_client
    except Exception as exc:
        pytest.skip(f"PostgreSQL unavailable: {exc}")


@pytest.fixture(scope="session")
def headers(client: TestClient) -> dict[str, str]:
    res = client.post("/auth/login", json={"email": "demo@robbflow.dev", "password": "robbflow"})
    if res.status_code != 200:
        pytest.skip("demo user not seeded")
    return {"Authorization": f"Bearer {res.json()['access_token']}"}
