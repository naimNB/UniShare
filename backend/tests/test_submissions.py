import io
from pathlib import Path
from types import SimpleNamespace
from pypdf import PdfWriter
from sqlalchemy import select

from backend.app.config import STORAGE_DIR, SUBMISSIONS_DIR
from backend.app.models import Category, Course, Resource, Submission
from backend.scripts import review_submissions, seed


def generate_valid_pdf_bytes(title: str = "Test Student Notes") -> bytes:
    """Generate a genuine, valid 1-page PDF in-memory."""
    buf = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.add_metadata({"/Title": title, "/Producer": "UniShare Test Suite"})
    writer.write(buf)
    return buf.getvalue()


def test_submit_valid_note_creates_pending_submission(client, db_session, test_env, tmp_path):
    """Test successful submission creates a pending record and stores file in private staging."""
    course = db_session.scalar(select(Course).where(Course.code == "CSE 3101"))
    category = db_session.scalar(select(Category).where(Category.name == "Lecture Notes"))

    pdf_bytes = generate_valid_pdf_bytes("Lecture 01 Notes")

    response = client.post(
        "/api/submissions",
        data={
            "title": "Lecture 01: Relational Algebra & Calculus",
            "course_id": course.id,
            "category_id": category.id,
            "consent": "true",
            "description": "Comprehensive notes from Week 1 lectures.",
            "contributor_name": "Student A",
        },
        files={"file": ("relational_algebra.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert "Lecture 01: Relational Algebra" in data["title"]
    assert "submitted for review" in data["message"]

    # Verify record in DB is pending
    sub_id = data["id"]
    submission = db_session.scalar(select(Submission).where(Submission.id == sub_id))
    assert submission is not None
    assert submission.status == "pending"
    assert submission.course_id == course.id
    assert submission.category_id == category.id
    assert submission.original_filename == "relational_algebra.pdf"
    assert submission.contributor_name == "Student A"

    # Verify file is stored in private SUBMISSIONS_DIR and NOT in public STORAGE_DIR
    staged_file = test_env["submissions_dir"] / submission.file_path
    public_file = test_env["storage_dir"] / submission.file_path
    assert staged_file.is_file()
    assert not public_file.exists()

    # IMPORTANT: verify pending submission is NOT exposed in public resources list
    public_resources = client.get("/api/resources").json()["items"]
    assert not any(r["title"] == submission.title for r in public_resources)


def test_submission_requires_consent(client, db_session):
    """Verify that submissions without consent are rejected with 422."""
    course = db_session.scalars(select(Course)).first()
    category = db_session.scalars(select(Category)).first()
    pdf_bytes = generate_valid_pdf_bytes()

    response = client.post(
        "/api/submissions",
        data={
            "title": "Notes Without Consent",
            "course_id": course.id,
            "category_id": category.id,
            "consent": "false",
        },
        files={"file": ("notes.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 422
    assert "permission to share" in response.json()["detail"].lower()


def test_submission_rejects_non_pdf(client, db_session):
    """Verify that non-PDF files are rejected with 422."""
    course = db_session.scalars(select(Course)).first()
    category = db_session.scalars(select(Category)).first()

    response = client.post(
        "/api/submissions",
        data={
            "title": "Text File Disguised as PDF",
            "course_id": course.id,
            "category_id": category.id,
            "consent": "true",
        },
        files={"file": ("malicious.pdf", b"This is just plain text, not a PDF", "application/pdf")},
    )
    assert response.status_code == 422
    assert "not a valid pdf" in response.json()["detail"].lower()


def test_submission_rejects_invalid_course_and_category(client, db_session):
    """Verify that nonexistent course/category IDs return 404."""
    pdf_bytes = generate_valid_pdf_bytes()

    # Invalid course
    res1 = client.post(
        "/api/submissions",
        data={
            "title": "Invalid Course Test",
            "course_id": 999999,
            "category_id": 1,
            "consent": "true",
        },
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    )
    assert res1.status_code == 404

    # Invalid category
    course = db_session.scalars(select(Course)).first()
    res2 = client.post(
        "/api/submissions",
        data={
            "title": "Invalid Category Test",
            "course_id": course.id,
            "category_id": 999999,
            "consent": "true",
        },
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    )
    assert res2.status_code == 404


def test_cli_review_approval_promotes_submission_to_public_resource(client, db_session, test_env):
    """Verify the CLI approve workflow publishes the submission to the public catalog."""
    course = db_session.scalar(select(Course).where(Course.code == "CSE 3101"))
    category = db_session.scalar(select(Category).where(Category.name == "Lecture Notes"))
    pdf_bytes = generate_valid_pdf_bytes("Approved Lecture Slides")

    # 1. Student submits note
    res = client.post(
        "/api/submissions",
        data={
            "title": "Verified OS Concurrency Notes",
            "course_id": course.id,
            "category_id": category.id,
            "consent": "true",
            "contributor_name": "T. Rahim",
        },
        files={"file": ("concurrency.pdf", pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 201
    sub_id = res.json()["id"]

    # Verify not yet in public resources
    before_public = client.get("/api/resources?q=Verified+OS+Concurrency").json()
    assert before_public["total"] == 0

    # 2. Maintainer approves via review CLI
    approve_args = SimpleNamespace(id=sub_id)
    exit_code = review_submissions.cmd_approve(approve_args)
    assert exit_code == 0

    # Verify submission status updated to approved
    db_session.expire_all()
    sub = db_session.scalar(select(Submission).where(Submission.id == sub_id))
    assert sub.status == "approved"
    assert sub.reviewed_at is not None

    # Verify promoted Resource exists in public catalog
    after_public = client.get("/api/resources?q=Verified+OS+Concurrency").json()
    assert after_public["total"] == 1
    published_res = after_public["items"][0]
    assert published_res["title"] == "Verified OS Concurrency Notes"
    assert published_res["course"]["code"] == "CSE 3101"

    # Verify file is now downloadable and previewable
    download_res = client.get(f"/api/resources/{published_res['id']}/download")
    assert download_res.status_code == 200
    assert download_res.content == pdf_bytes


def test_cli_review_rejection_safely_removes_staged_file(client, db_session, test_env):
    """Verify the CLI reject workflow marks rejected and removes staged file from disk."""
    course = db_session.scalars(select(Course)).first()
    category = db_session.scalars(select(Category)).first()
    pdf_bytes = generate_valid_pdf_bytes("To Be Rejected")

    res = client.post(
        "/api/submissions",
        data={
            "title": "Low Quality Upload",
            "course_id": course.id,
            "category_id": category.id,
            "consent": "true",
        },
        files={"file": ("poor_quality.pdf", pdf_bytes, "application/pdf")},
    )
    sub_id = res.json()["id"]

    sub = db_session.scalar(select(Submission).where(Submission.id == sub_id))
    staged_path = test_env["submissions_dir"] / sub.file_path
    assert staged_path.is_file()

    # Reject via CLI
    reject_args = SimpleNamespace(id=sub_id, reason="Illegible handwriting")
    exit_code = review_submissions.cmd_reject(reject_args)
    assert exit_code == 0

    db_session.expire_all()
    sub_after = db_session.scalar(select(Submission).where(Submission.id == sub_id))
    assert sub_after.status == "rejected"
    assert sub_after.rejection_reason == "Illegible handwriting"

    # Staged file must be deleted
    assert not staged_path.exists()


def test_duplicate_pending_submission_rejected(client, db_session):
    """Verify that duplicate pending submissions for the same course and title return 409 Conflict."""
    course = db_session.scalars(select(Course)).first()
    category = db_session.scalars(select(Category)).first()
    pdf_bytes = generate_valid_pdf_bytes("Unique Notes Title")

    # First submission succeeds
    res1 = client.post(
        "/api/submissions",
        data={
            "title": "Discrete Math Lecture 01",
            "course_id": course.id,
            "category_id": category.id,
            "consent": "true",
        },
        files={"file": ("math1.pdf", pdf_bytes, "application/pdf")},
    )
    assert res1.status_code == 201

    # Second submission with identical title (case-insensitive with whitespace) is rejected
    res2 = client.post(
        "/api/submissions",
        data={
            "title": "  discrete math lecture 01  ",
            "course_id": course.id,
            "category_id": category.id,
            "consent": "true",
        },
        files={"file": ("math2.pdf", pdf_bytes, "application/pdf")},
    )
    assert res2.status_code == 409
    assert "already awaiting review" in res2.json()["detail"].lower()


def test_duplicate_against_existing_resource_rejected(client, db_session):
    """Verify that submissions matching an already published Resource return 409 Conflict."""
    # Find an existing published resource
    existing = db_session.scalars(select(Resource)).first()
    assert existing is not None
    course = existing.course
    category = existing.category
    pdf_bytes = generate_valid_pdf_bytes()

    res = client.post(
        "/api/submissions",
        data={
            "title": existing.title.lower(),
            "course_id": course.id,
            "category_id": category.id,
            "consent": "true",
        },
        files={"file": ("duplicate.pdf", pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 409
    assert "already exists in the library" in res.json()["detail"].lower()


def test_cli_approval_preserves_original_staged_file(client, db_session, test_env):
    """Verify that approving a submission preserves the original staged file for audit history."""
    course = db_session.scalars(select(Course)).first()
    category = db_session.scalars(select(Category)).first()
    pdf_bytes = generate_valid_pdf_bytes("Audit Trail Test")

    res = client.post(
        "/api/submissions",
        data={
            "title": "Preserved Original Staged File Note",
            "course_id": course.id,
            "category_id": category.id,
            "consent": "true",
        },
        files={"file": ("audit.pdf", pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 201
    sub_id = res.json()["id"]

    sub = db_session.scalar(select(Submission).where(Submission.id == sub_id))
    staged_path = test_env["submissions_dir"] / sub.file_path
    public_path = test_env["storage_dir"] / sub.file_path

    assert staged_path.is_file()
    assert not public_path.exists()

    # Approve
    exit_code = review_submissions.cmd_approve(SimpleNamespace(id=sub_id))
    assert exit_code == 0

    # Both staged file (audit trail) and public file (catalog) must exist
    assert staged_path.is_file()
    assert public_path.is_file()


def test_cli_approval_cleans_up_dest_file_on_commit_failure(client, db_session, test_env, monkeypatch):
    """Verify that if a database commit fails during approval, the copied dest_file is cleaned up."""
    from sqlalchemy.orm import Session as SASession

    course = db_session.scalars(select(Course)).first()
    category = db_session.scalars(select(Category)).first()
    pdf_bytes = generate_valid_pdf_bytes("Failure Test")

    res = client.post(
        "/api/submissions",
        data={
            "title": "Commit Failure Test Note",
            "course_id": course.id,
            "category_id": category.id,
            "consent": "true",
        },
        files={"file": ("fail_commit.pdf", pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 201
    sub_id = res.json()["id"]

    sub = db_session.scalar(select(Submission).where(Submission.id == sub_id))
    staged_path = test_env["submissions_dir"] / sub.file_path
    public_path = test_env["storage_dir"] / sub.file_path

    # Monkeypatch db.commit to simulate database failure during cmd_approve
    orig_commit = SASession.commit

    def faulty_commit(self):
        raise RuntimeError("Simulated SQLite write error")

    monkeypatch.setattr(SASession, "commit", faulty_commit)

    exit_code = review_submissions.cmd_approve(SimpleNamespace(id=sub_id))
    assert exit_code == 1

    # Dest file must NOT remain orphaned in public storage
    assert not public_path.exists()
    # Staged file must still exist
    assert staged_path.is_file()


def test_rate_limiter_pruning_and_enforcement(client):
    """Verify rate limiter blocks spam and cleans up old IP entries."""
    from backend.app.routers import submissions
    import time

    submissions._client_timestamps.clear()

    class MockClient:
        host = "192.168.1.100"

    class MockRequest:
        client = MockClient()

    req = MockRequest()

    # Should allow up to _RATE_LIMIT_MAX
    for _ in range(submissions._RATE_LIMIT_MAX):
        submissions.check_rate_limit(req)

    # Exceeding should raise HTTPException 429
    try:
        submissions.check_rate_limit(req)
        assert False, "Should have raised 429"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 429

    # Test pruning stale IPs
    now = time.time()
    for i in range(250):
        submissions._client_timestamps[f"stale_ip_{i}"] = [now - 120]

    assert len(submissions._client_timestamps) > 200
    # Next call with a new IP should prune stale entries
    new_req = MockRequest()
    new_req.client = MockClient()
    new_req.client.host = "10.0.0.1"
    submissions.check_rate_limit(new_req)

    # Dictionary should have been pruned
    assert len(submissions._client_timestamps) < 200


def test_submissions_public_write_and_review_endpoints_unavailable(client):
    """Verify approval/rejection and unauthorized methods cannot be accessed over public HTTP endpoints."""
    # Listing all submissions is not exposed to public
    assert client.get("/api/submissions").status_code == 405

    # Modifying or deleting submissions is not exposed
    assert client.put("/api/submissions/1").status_code in (404, 405)
    assert client.delete("/api/submissions/1").status_code in (404, 405)
    assert client.patch("/api/submissions/1").status_code in (404, 405)

    # Approve and reject cannot be invoked over HTTP
    assert client.post("/api/submissions/1/approve").status_code == 404
    assert client.post("/api/submissions/1/reject").status_code == 404
    assert client.get("/api/submissions/1/approve").status_code == 404
