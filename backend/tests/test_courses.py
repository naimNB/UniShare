def test_list_courses(client):
    """Verify listing all courses with correct structure and counts."""
    response = client.get("/api/courses")
    assert response.status_code == 200
    courses = response.json()
    assert isinstance(courses, list)
    assert len(courses) >= 3

    # Check course schema attributes
    first = courses[0]
    assert "id" in first
    assert "code" in first
    assert "name" in first
    assert "semester" in first
    assert "resource_count" in first


def test_filter_courses_by_semester(client):
    """Verify filtering courses by semester query param."""
    response = client.get("/api/courses?semester=5")
    assert response.status_code == 200
    courses = response.json()
    assert len(courses) >= 1
    for c in courses:
        assert c["semester"] == 5


def test_get_course_detail(client):
    """Verify retrieving course detail with associated resources."""
    # First get list to find an existing course
    list_res = client.get("/api/courses")
    courses = list_res.json()
    target_id = courses[0]["id"]

    response = client.get(f"/api/courses/{target_id}")
    assert response.status_code == 200
    detail = response.json()
    assert detail["id"] == target_id
    assert "resources" in detail
    assert isinstance(detail["resources"], list)


def test_get_course_not_found(client):
    """Verify 404 for non-existent course ID."""
    response = client.get("/api/courses/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_courses_write_methods_unavailable(client):
    """Verify that public write endpoints (POST, PUT, DELETE) are rejected."""
    # POST
    post_res = client.post("/api/courses", json={"code": "TEST 101", "name": "Test", "semester": 1})
    assert post_res.status_code == 405

    # PUT
    put_res = client.put("/api/courses/1", json={"name": "Updated"})
    assert put_res.status_code == 405

    # DELETE
    del_res = client.delete("/api/courses/1")
    assert del_res.status_code == 405
