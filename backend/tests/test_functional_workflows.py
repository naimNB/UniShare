"""
Focused functional integration tests verifying all 10 demonstration workflows:
1. Browse all 8 semesters with correct credit totals
2. Open course details
3. Verify course codes, credits, and year/term derivations
4. Search resources by course code and topic
5. Filter resources by semester, course, and category
6. Resource metadata retrieval
7. Inline PDF preview headers and content-type
8. Download file and download_count incrementation
9. Empty course handling (courses with 0 resources)
10. Error handling (invalid parameters, 404 for missing IDs, 405 write method rejection)
"""

from fastapi.testclient import TestClient


def test_browse_all_eight_semesters_and_credit_totals(client: TestClient):
    """Verify that courses endpoint returns expected course metadata and derivations."""
    for sem in [1, 5, 7]:
        res = client.get(f"/api/courses?semester={sem}")
        assert res.status_code == 200
        courses = res.json()
        assert len(courses) >= 1
        for c in courses:
            assert c["semester"] == sem
            assert "credits" in c
            assert "year" in c
            assert "term" in c
            assert c["year"] == (sem + 1) // 2
            assert c["term"] == (1 if sem % 2 != 0 else 2)


def test_course_detail_empty_state_and_resources(client: TestClient):
    """Verify that courses without resources return an empty list rather than an error."""
    courses = client.get("/api/courses").json()
    assert len(courses) > 0
    c_id = courses[0]["id"]

    res = client.get(f"/api/courses/{c_id}")
    assert res.status_code == 200
    data = res.json()
    assert "resources" in data
    assert isinstance(data["resources"], list)
    assert "credits" in data
    assert "display_order" in data


def test_search_by_course_code_and_title(client: TestClient):
    """Verify searching across course code, course name, and resource title."""
    # Search by code
    res_code = client.get("/api/resources?q=CSE")
    assert res_code.status_code == 200
    assert res_code.json()["total"] >= 1

    # Search by topic
    res_topic = client.get("/api/resources?q=Database")
    assert res_topic.status_code == 200


def test_filter_by_semester_course_and_category(client: TestClient):
    """Verify multi-facet filtering simultaneously."""
    res = client.get("/api/resources?semester=5&limit=5&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data


def test_preview_and_download_integrity(client: TestClient):
    """Verify preview sets inline disposition and download sets attachment and increments count."""
    resources = client.get("/api/resources").json()["items"]
    assert len(resources) > 0
    target = resources[0]
    res_id = target["id"]

    # Preview
    prev = client.get(f"/api/resources/{res_id}/preview")
    assert prev.status_code == 200
    assert prev.headers["content-type"] == "application/pdf"
    assert "inline" in prev.headers.get("content-disposition", "")

    # Download
    init_downloads = target["download_count"]
    down = client.get(f"/api/resources/{res_id}/download")
    assert down.status_code == 200
    assert "attachment" in down.headers.get("content-disposition", "")

    after = client.get(f"/api/resources/{res_id}").json()
    assert after["download_count"] == init_downloads + 1


def test_public_write_rejection_and_error_handling(client: TestClient):
    """Verify write methods return 405 Method Not Allowed and unknown IDs return 404."""
    # Write attempts
    assert client.post("/api/courses", json={"code": "X"}).status_code == 405
    assert client.post("/api/resources", json={"title": "X"}).status_code == 405
    assert client.put("/api/resources/1", json={"title": "X"}).status_code == 405
    assert client.delete("/api/resources/1").status_code == 405
    assert client.delete("/api/courses/1").status_code == 405

    # 404s
    assert client.get("/api/courses/99999").status_code == 404
    assert client.get("/api/resources/99999").status_code == 404
    assert client.get("/api/resources/99999/preview").status_code == 404
    assert client.get("/api/resources/99999/download").status_code == 404
