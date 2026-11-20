import os
import tempfile
from pathlib import Path
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Configuration creates storage on import. Keep even that bootstrap side effect
# away from the developer's configured database and real uploaded documents.
_bootstrap_dir = tempfile.TemporaryDirectory(prefix="unishare-test-bootstrap-")
with patch.dict(os.environ, {
    "DATABASE_URL": f"sqlite:///{_bootstrap_dir.name}/bootstrap.db",
    "STORAGE_DIR": f"{_bootstrap_dir.name}/uploads",
}):
    from backend.app.database import Base, get_db
    from backend.app.main import app
    from backend.app.models import Category, Course, Resource
    from backend.scripts.seed import generate_sample_pdf


@pytest.fixture
def test_env(tmp_path, monkeypatch):
    """A fresh real SQLite database and storage directory for every test."""
    temp_path = tmp_path
    test_storage = temp_path / "uploads"
    test_storage.mkdir(parents=True, exist_ok=True)
    test_submissions = temp_path / "submissions"
    test_submissions.mkdir(parents=True, exist_ok=True)
    db_file = temp_path / "test.db"
    db_url = f"sqlite:///{db_file.as_posix()}"

    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
        future=True,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        future=True,
    )

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Patch config directories for routers and scripts
    import backend.app.config as app_config
    import backend.app.main as app_main
    import backend.app.routers.resources as res_router
    import backend.app.routers.submissions as sub_router
    import backend.scripts.review_submissions as review_script
    import backend.scripts.seed as seed_script
    monkeypatch.setattr(app_config, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(app_config, "STORAGE_DIR", test_storage)
    monkeypatch.setattr(app_config, "SUBMISSIONS_DIR", test_submissions)
    monkeypatch.setattr(res_router, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(res_router, "STORAGE_DIR", test_storage)
    monkeypatch.setattr(sub_router, "SUBMISSIONS_DIR", test_submissions)
    sub_router._client_timestamps.clear()
    monkeypatch.setattr(review_script, "STORAGE_DIR", test_storage)
    monkeypatch.setattr(review_script, "SUBMISSIONS_DIR", test_submissions)
    monkeypatch.setattr(review_script, "SessionLocal", TestingSessionLocal)
    monkeypatch.setattr(seed_script, "STORAGE_DIR", test_storage)
    monkeypatch.setattr(seed_script, "SessionLocal", TestingSessionLocal)
    monkeypatch.setattr(app_main, "init_db", lambda: Base.metadata.create_all(bind=engine))

    yield {
        "engine": engine,
        "SessionLocal": TestingSessionLocal,
        "storage_dir": test_storage,
        "submissions_dir": test_submissions,
    }

    # Teardown
    engine.dispose()


@pytest.fixture
def db_session(test_env):
    """Provide a session backed by this test's disposable database."""
    session = test_env["SessionLocal"]()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(test_env, db_session):
    """FastAPI TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def seed_test_data(test_env):
    """Seed predictable fixtures for tests."""
    session = test_env["SessionLocal"]()
    storage = test_env["storage_dir"]

    # Courses
    c1 = Course(
        code="CSE 3101",
        name="Database Management Systems",
        semester=5,
        description="Core DBMS concepts",
    )
    c2 = Course(
        code="CSE 4103",
        name="Web Engineering",
        semester=7,
        description="Web architecture and REST APIs",
    )
    c3 = Course(
        code="CSE 1101",
        name="Introduction to Computer Systems",
        semester=1,
        description="Basic computing concepts",
    )
    session.add_all([c1, c2, c3])
    session.flush()

    # Categories
    cat1 = Category(name="Lecture Notes", description="Class slides and notes")
    cat2 = Category(name="Lab Manuals", description="Practical lab assignments")
    cat3 = Category(name="Past Questions", description="Exam questions")
    session.add_all([cat1, cat2, cat3])
    session.flush()

    # Files
    f1_name = "test_dbms_notes.pdf"
    f1_path = storage / f1_name
    sz1 = generate_sample_pdf(f1_path, "DBMS Normalization", "CSE 3101", ["Notes line 1", "Notes line 2"])

    f2_name = "test_web_syllabus.pdf"
    f2_path = storage / f2_name
    sz2 = generate_sample_pdf(f2_path, "Web Engineering Syllabus", "CSE 4103", ["Syllabus line 1"])

    # Resources
    r1 = Resource(
        title="DBMS Normalization Guide",
        description="Comprehensive functional dependency and 3NF/BCNF notes",
        course_id=c1.id,
        category_id=cat1.id,
        file_path=f1_name,
        original_filename="dbms_normalization.pdf",
        mime_type="application/pdf",
        file_size=sz1,
        download_count=10,
    )
    r2 = Resource(
        title="Web Engineering REST Architecture",
        description="Guidelines on client-server design and HTTP methods",
        course_id=c2.id,
        category_id=cat1.id,
        file_path=f2_name,
        original_filename="web_rest_architecture.pdf",
        mime_type="application/pdf",
        file_size=sz2,
        download_count=5,
    )
    session.add_all([r1, r2])
    session.commit()
    session.close()
