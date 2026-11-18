def test_list_categories(client):
    """Verify listing all categories with resource counts."""
    response = client.get("/api/categories")
    assert response.status_code == 200
    categories = response.json()
    assert isinstance(categories, list)
    assert len(categories) >= 3

    # Check category schema
    first = categories[0]
    assert "id" in first
    assert "name" in first
    assert "resource_count" in first


def test_categories_write_methods_unavailable(client):
    """Verify that public write endpoints on categories are rejected."""
    # POST /api/categories -> 405 Method Not Allowed
    post_res = client.post("/api/categories", json={"name": "New Cat"})
    assert post_res.status_code == 405

    # PUT /api/categories -> 405 Method Not Allowed
    put_res = client.put("/api/categories", json={"name": "Updated"})
    assert put_res.status_code == 405

    # DELETE /api/categories -> 405 Method Not Allowed
    del_res = client.delete("/api/categories")
    assert del_res.status_code == 405

    # Write attempts on subpaths return 404/405
    sub_put = client.put("/api/categories/1", json={"name": "Updated"})
    assert sub_put.status_code in (404, 405)

    sub_del = client.delete("/api/categories/1")
    assert sub_del.status_code in (404, 405)

