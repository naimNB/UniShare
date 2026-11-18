def test_list_resources(client):
    """Verify listing resources with default pagination and structure."""
    response = client.get("/api/resources")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data
    assert data["total"] >= 2
    assert len(data["items"]) >= 2

    first = data["items"][0]
    assert "id" in first
    assert "title" in first
    assert "original_filename" in first
    assert "mime_type" in first
    assert "download_count" in first
    assert "course" in first
    assert "category" in first
    assert first["course"] is not None
    assert first["category"] is not None


def test_search_resources_by_query(client):
    """Verify search filter across title and description."""
    response = client.get("/api/resources?q=normalization")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for item in data["items"]:
        match = "normalization" in item["title"].lower() or "normalization" in (item["description"] or "").lower()
        assert match


def test_filter_resources_by_semester(client):
    """Verify filtering resources by course semester."""
    response = client.get("/api/resources?semester=5")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["course"]["semester"] == 5


def test_filter_resources_by_course_and_category(client):
    """Verify filtering by course_id and category_id."""
    res_list = client.get("/api/resources").json()
    sample = res_list["items"][0]
    c_id = sample["course_id"]
    cat_id = sample["category_id"]

    response = client.get(f"/api/resources?course_id={c_id}&category_id={cat_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["course_id"] == c_id
        assert item["category_id"] == cat_id


def test_resource_pagination(client):
    """Verify limit and offset pagination parameters."""
    response = client.get("/api/resources?limit=1&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert data["limit"] == 1
    assert data["offset"] == 0
    assert len(data["items"]) == 1

    first_item = data["items"][0]

    response_offset = client.get("/api/resources?limit=1&offset=1")
    assert response_offset.status_code == 200
    data_offset = response_offset.json()
    assert data_offset["offset"] == 1
    if data_offset["total"] > 1:
        assert data_offset["items"][0]["id"] != first_item["id"]


def test_get_resource_detail(client):
    """Verify retrieving single resource details."""
    res_list = client.get("/api/resources").json()
    target_id = res_list["items"][0]["id"]

    response = client.get(f"/api/resources/{target_id}")
    assert response.status_code == 200
    detail = response.json()
    assert detail["id"] == target_id
    assert "course" in detail
    assert "category" in detail


def test_get_resource_not_found(client):
    """Verify 404 response for non-existent resource ID."""
    response = client.get("/api/resources/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_preview_resource(client):
    """Verify inline document preview endpoint."""
    res_list = client.get("/api/resources").json()
    target_id = res_list["items"][0]["id"]

    response = client.get(f"/api/resources/{target_id}/preview")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    content_disp = response.headers.get("content-disposition", "")
    assert "inline" in content_disp
    assert len(response.content) > 0


def test_preview_resource_not_found(client):
    """Verify 404 on preview for non-existent resource ID."""
    response = client.get("/api/resources/99999/preview")
    assert response.status_code == 404


def test_download_resource_and_increment_counter(client):
    """Verify download endpoint returns attachment and increments download counter."""
    res_list = client.get("/api/resources").json()
    target = res_list["items"][0]
    target_id = target["id"]
    initial_downloads = target["download_count"]

    response = client.get(f"/api/resources/{target_id}/download")
    assert response.status_code == 200
    content_disp = response.headers.get("content-disposition", "")
    assert "attachment" in content_disp
    assert target["original_filename"] in content_disp
    assert len(response.content) > 0

    # Verify counter incremented in database
    after_res = client.get(f"/api/resources/{target_id}").json()
    assert after_res["download_count"] == initial_downloads + 1


def test_download_resource_not_found(client):
    """Verify 404 on download for non-existent resource ID."""
    response = client.get("/api/resources/99999/download")
    assert response.status_code == 404


def test_resources_write_methods_unavailable(client):
    """Verify that public write methods on resources are unavailable (405)."""
    # POST
    post_res = client.post("/api/resources", json={"title": "Unauthorized"})
    assert post_res.status_code == 405

    # PUT
    put_res = client.put("/api/resources/1", json={"title": "Unauthorized"})
    assert put_res.status_code == 405

    # DELETE
    del_res = client.delete("/api/resources/1")
    assert del_res.status_code == 405


def test_path_traversal_protection(client, db_session, test_env):
    """Verify that path traversal attempts in stored file paths are rejected with 400."""
    from backend.app.models import Course, Category, Resource

    course = db_session.query(Course).first()
    category = db_session.query(Category).first()

    malicious_res = Resource(
        title="Malicious Path Test",
        course_id=course.id,
        category_id=category.id,
        file_path="../../etc/passwd",
        original_filename="passwd.pdf",
        mime_type="application/pdf",
        file_size=100,
    )
    db_session.add(malicious_res)
    db_session.commit()

    # Attempt preview
    prev_res = client.get(f"/api/resources/{malicious_res.id}/preview")
    assert prev_res.status_code == 400
    assert "security violation" in prev_res.json()["detail"].lower()

    # Attempt download
    down_res = client.get(f"/api/resources/{malicious_res.id}/download")
    assert down_res.status_code == 400
    assert "security violation" in down_res.json()["detail"].lower()

