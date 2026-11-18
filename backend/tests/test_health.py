def test_health_check(client):
    """Verify GET /api/health returns 200 with expected structure."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "UniShare"
    assert "version" in data


def test_root_info(client):
    """Verify root endpoint provides API metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "UniShare" in data["app"]
    assert data["health"] == "/api/health"
