"""
Tests for Environment-based Database Configuration, Storage Abstraction,
and Alembic Migration Metadata.
"""

from pathlib import Path
import pytest
from sqlalchemy import create_engine, select


from backend.app.config import normalize_database_url
from backend.app.database import Base, create_db_engine
from backend.app.storage import (
    BaseStorageBackend,
    LocalStorageBackend,
    StorageConfigurationError,
    StorageError,
    SupabaseStorageBackend,
    get_storage_backend,
)


def test_database_url_normalization():
    """Verify postgres:// and driverless postgresql:// are converted to postgresql+psycopg2:// for SQLAlchemy 2.0+."""
    legacy_url = "postgres://user:pass@ep-cool-db.us-east-1.aws.neon.tech/neondb?sslmode=require"
    normalized = normalize_database_url(legacy_url)
    assert normalized.startswith("postgresql+psycopg2://")

    sqlite_url = "sqlite:///./test.db"
    assert normalize_database_url(sqlite_url) == sqlite_url

    pg_url = "postgresql://user:pass@host/db"
    assert normalize_database_url(pg_url).startswith("postgresql+psycopg2://")

    # Verify pgbouncer=true query parameter is stripped for psycopg2 compatibility
    prisma_url = "postgresql://user:pass@host:6543/postgres?sslmode=require&pgbouncer=true"
    norm_prisma = normalize_database_url(prisma_url)
    assert "pgbouncer" not in norm_prisma
    assert norm_prisma.startswith("postgresql+psycopg2://")
    assert "sslmode=require" in norm_prisma


def test_create_db_engine_dialects(monkeypatch):
    """Verify create_db_engine sets appropriate options for SQLite vs PostgreSQL."""
    # SQLite
    sqlite_eng = create_db_engine("sqlite:///:memory:")
    assert sqlite_eng.dialect.name == "sqlite"
    sqlite_eng.dispose()

    # PostgreSQL dialect pooling configuration check via mock (no local psycopg2 dependency required)
    recorded_kwargs = {}

    def mock_create_engine(url, **kwargs):
        recorded_kwargs.update(kwargs)
        return "mock_postgres_engine"

    monkeypatch.setattr("backend.app.database.create_engine", mock_create_engine)
    pg_url = "postgresql://user:pass@localhost:5432/mockdb"
    res = create_db_engine(pg_url)
    assert res == "mock_postgres_engine"
    assert recorded_kwargs.get("pool_pre_ping") is True
    assert recorded_kwargs.get("pool_size") == 10
    assert recorded_kwargs.get("max_overflow") == 20
    assert recorded_kwargs.get("pool_recycle") == 1800



def test_local_storage_backend_lifecycle(tmp_path):
    """Verify LocalStorageBackend staging, promotion, reading, and deletion lifecycle."""
    storage_dir = tmp_path / "uploads"
    submissions_dir = tmp_path / "submissions"

    backend = LocalStorageBackend(storage_dir=storage_dir, submissions_dir=submissions_dir)
    assert isinstance(backend, BaseStorageBackend)

    filename = "test_doc_01.pdf"
    content = b"%PDF-1.4 sample content"

    # 1. Save to private staging
    backend.save_staged_file(filename, content)
    assert backend.staged_file_exists(filename)
    assert backend.read_staged_file(filename) == content
    assert not backend.public_file_exists(filename)

    # 2. Promote to public resources
    backend.promote_to_public(filename)
    assert backend.public_file_exists(filename)
    assert backend.read_public_file(filename) == content
    assert backend.staged_file_exists(filename)  # preserved for audit

    # 3. Clean up
    assert backend.delete_staged_file(filename) is True
    assert backend.staged_file_exists(filename) is False
    assert backend.public_file_exists(filename) is True

    assert backend.delete_public_file(filename) is True
    assert backend.public_file_exists(filename) is False

    # 4. Direct save to public storage
    direct_file = "direct_doc.pdf"
    backend.save_public_file(direct_file, content)
    assert backend.public_file_exists(direct_file)
    assert backend.read_public_file(direct_file) == content
    assert backend.delete_public_file(direct_file) is True
    assert backend.public_file_exists(direct_file) is False


def test_local_storage_path_traversal_protection(tmp_path):
    """Verify path traversal attacks are rejected by LocalStorageBackend."""
    storage_dir = tmp_path / "uploads"
    submissions_dir = tmp_path / "submissions"
    backend = LocalStorageBackend(storage_dir=storage_dir, submissions_dir=submissions_dir)

    with pytest.raises(StorageError):
        backend.save_staged_file("../../../evil.pdf", b"malicious")


def test_supabase_storage_backend_configuration():
    """Verify SupabaseStorageBackend enforces configuration requirements."""
    # Missing credentials must raise StorageConfigurationError
    with pytest.raises(StorageConfigurationError):
        SupabaseStorageBackend(supabase_url="", service_role_key="")

    # Valid config sets URL, headers, and private dual buckets
    # Modern sb_secret_* key: must set apikey and must NOT set Authorization Bearer
    sb_modern = SupabaseStorageBackend(
        supabase_url="https://xyzproject.supabase.co",
        service_role_key="sb_secret_mock_admin_12345",
        approved_bucket="approved-resources",
        pending_bucket="pending-submissions",
    )
    assert sb_modern.headers["apikey"] == "sb_secret_mock_admin_12345"
    assert "Authorization" not in sb_modern.headers
    assert sb_modern.approved_bucket == "approved-resources"
    assert sb_modern.pending_bucket == "pending-submissions"

    # Legacy JWT key: sets both apikey and Authorization Bearer
    sb_legacy = SupabaseStorageBackend(
        supabase_url="https://xyzproject.supabase.co",
        service_role_key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
        approved_bucket="approved-resources",
        pending_bucket="pending-submissions",
    )
    assert sb_legacy.headers["apikey"] == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig"
    assert sb_legacy.headers["Authorization"] == "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig"



def test_get_storage_backend_factory(tmp_path, monkeypatch):
    """Verify factory returns appropriate backend based on parameter or env var."""
    monkeypatch.setattr("backend.app.config.STORAGE_DIR", tmp_path / "uploads")
    monkeypatch.setattr("backend.app.config.SUBMISSIONS_DIR", tmp_path / "submissions")

    local_backend = get_storage_backend("local")
    assert isinstance(local_backend, LocalStorageBackend)

    with pytest.raises(ValueError, match="Unsupported storage backend"):
        get_storage_backend("s3_unsupported")


def test_alembic_metadata_matches_models():
    """Verify that Alembic target_metadata contains all 4 core tables and matching columns."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from backend.alembic.env import target_metadata
    from backend.app.models import Course, Category, Resource, Submission

    # Verify migration script directory recognizes head
    cfg = Config("alembic.ini")
    script_dir = ScriptDirectory.from_config(cfg)
    head_rev = script_dir.get_current_head()
    assert head_rev == "0001_initial_schema"

    tables = target_metadata.tables
    assert "courses" in tables
    assert "categories" in tables
    assert "resources" in tables
    assert "submissions" in tables


    # Check Course columns and server defaults
    course_table = tables["courses"]
    assert "code" in course_table.columns
    assert "credits" in course_table.columns
    assert "display_order" in course_table.columns
    assert course_table.columns["credits"].server_default is not None

    # Check Resource table foreign keys and columns
    resource_table = tables["resources"]
    assert "course_id" in resource_table.columns
    assert "category_id" in resource_table.columns
    assert "created_at" in resource_table.columns
    assert resource_table.columns["created_at"].server_default is not None

    # Check Submission table
    submission_table = tables["submissions"]
    assert "status" in submission_table.columns
    assert submission_table.columns["status"].server_default is not None


def test_alembic_upgrade_and_downgrade_on_disposable_db(tmp_path):
    """Verify that Alembic upgrade head and downgrade base run cleanly on an isolated temporary database."""
    from alembic import command
    from alembic.config import Config
    import sqlite3

    disposable_db = tmp_path / "disposable_migration_test.db"
    disposable_url = f"sqlite:///{disposable_db.as_posix()}"

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", disposable_url)

    # 1. Upgrade to head
    command.upgrade(cfg, "head")

    conn = sqlite3.connect(disposable_db)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cursor.fetchall()]
    assert "courses" in tables
    assert "categories" in tables
    assert "resources" in tables
    assert "submissions" in tables
    assert "alembic_version" in tables

    # 2. Downgrade to base
    command.downgrade(cfg, "base")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables_after = [row[0] for row in cursor.fetchall()]
    assert "courses" not in tables_after
    assert "resources" not in tables_after
    conn.close()


def test_submission_status_check_constraint(db_session):
    """Verify check constraint on Submission status rejects illegal values."""
    from sqlalchemy.exc import IntegrityError
    from backend.app.models import Category, Course, Submission

    course = db_session.scalars(select(Course)).first()
    category = db_session.scalars(select(Category)).first()

    invalid_sub = Submission(
        title="Illegal Status Note",
        course_id=course.id,
        category_id=category.id,
        file_path="note.pdf",
        original_filename="note.pdf",
        mime_type="application/pdf",
        file_size=1024,
        status="unauthorized_status",
    )
    db_session.add(invalid_sub)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_storage_cloud_redirects(client, db_session, monkeypatch):
    """Verify preview and download routes redirect to CDN when cloud storage is active."""
    import backend.app.routers.resources as res_router
    from backend.app.models import Resource

    existing_res = db_session.scalars(select(Resource)).first()
    assert existing_res is not None

    monkeypatch.setattr(res_router, "STORAGE_BACKEND", "supabase")

    class MockCloudStorage:
        def public_file_exists(self, filename: str) -> bool:
            return True

        def get_public_url(self, filename: str) -> str:
            return f"https://mock-project.supabase.co/storage/v1/object/public/resources/{filename}"

    monkeypatch.setattr(res_router, "get_storage_backend", lambda: MockCloudStorage())

    # Preview endpoint should return 307 Temporary Redirect
    res_prev = client.get(f"/api/resources/{existing_res.id}/preview", follow_redirects=False)
    assert res_prev.status_code == 307
    assert res_prev.headers["Location"].startswith("https://mock-project.supabase.co")

    # Download endpoint should return 307 Temporary Redirect and increment download_count
    orig_count = existing_res.download_count or 0
    res_down = client.get(f"/api/resources/{existing_res.id}/download", follow_redirects=False)
    assert res_down.status_code == 307
    assert res_down.headers["Location"].startswith("https://mock-project.supabase.co")

    db_session.refresh(existing_res)
    assert existing_res.download_count == orig_count + 1


def test_export_sqlite_data_integrity(db_session):
    """Verify export_sqlite_data script correctly loads and validates data relationships."""
    from backend.scripts.export_sqlite_data import verify_and_export, generate_sql_dump

    payload = verify_and_export(session=db_session)
    meta = payload["metadata"]
    assert meta["course_count"] == 3
    assert meta["category_count"] == 3
    assert meta["resource_count"] == 2

    sql_dump = generate_sql_dump(payload)
    assert "INSERT INTO courses" in sql_dump
    assert "SELECT setval" in sql_dump
    assert "COMMIT;" in sql_dump


def test_import_to_postgres_workflow(tmp_path, db_session):
    """Verify import_to_postgres validates schema and imports records idempotently."""
    from backend.app.database import Base
    from backend.scripts.export_sqlite_data import verify_and_export
    from backend.scripts.import_to_postgres import run_import
    from sqlalchemy import create_engine, select
    from backend.app.models import Course, Resource

    payload = verify_and_export(session=db_session)
    disposable_db = tmp_path / "disposable_import_test.db"
    disposable_url = f"sqlite:///{disposable_db.as_posix()}"

    # Initialize empty schema in disposable target
    engine = create_engine(disposable_url)
    Base.metadata.create_all(bind=engine)

    # 1. Dry run
    dry_counts = run_import(payload, target_db_url=disposable_url, dry_run=True)
    assert dry_counts["courses"] == 3
    assert dry_counts["resources"] == 2

    # Verify dry run did not write
    with engine.connect() as conn:
        res = conn.execute(select(Course)).fetchall()
        assert len(res) == 0

    # 2. Live import
    live_counts = run_import(payload, target_db_url=disposable_url, dry_run=False)
    assert live_counts["courses"] == 3
    assert live_counts["resources"] == 2

    # Verify records written
    with engine.connect() as conn:
        res = conn.execute(select(Course)).fetchall()
        assert len(res) == 3
        res_items = conn.execute(select(Resource)).fetchall()
        assert len(res_items) == 2

    # 3. Idempotent re-run (should not duplicate or error)
    rerun_counts = run_import(payload, target_db_url=disposable_url, dry_run=False)
    assert rerun_counts["courses"] == 0
    assert rerun_counts["resources"] == 0
    engine.dispose()


def test_validate_staging_configuration_inspection(monkeypatch):
    """Verify inspect_configuration identifies missing Supabase staging variables."""
    import backend.scripts.validate_staging as val_script

    # When variables are empty or SQLite
    monkeypatch.setattr(val_script, "DATABASE_URL", "sqlite:///./unishare.db")
    monkeypatch.setattr(val_script, "SUPABASE_URL", "")
    monkeypatch.setattr(val_script, "SUPABASE_SERVICE_ROLE_KEY", "")

    is_ready, missing = val_script.inspect_configuration()
    assert is_ready is False
    assert any("DATABASE_URL" in m for m in missing)
    assert any("SUPABASE_URL" in m for m in missing)
    assert any("SUPABASE_SERVICE_ROLE_KEY" in m for m in missing)

    # When all variables are configured
    monkeypatch.setattr(val_script, "DATABASE_URL", "postgresql://user:pass@ep.supabase.co:5432/postgres")
    monkeypatch.setattr(val_script, "SUPABASE_URL", "https://xyz.supabase.co")
    monkeypatch.setattr(val_script, "SUPABASE_SERVICE_ROLE_KEY", "secret-key")

    is_ready_now, missing_now = val_script.inspect_configuration()
    assert is_ready_now is True
    assert len(missing_now) == 0


def test_validate_staging_database_suitability(tmp_path):
    """Verify check_target_database_suitability detects clean vs dirty schemas."""
    from backend.scripts.validate_staging import check_target_database_suitability
    from backend.app.database import Base
    from sqlalchemy import create_engine

    clean_db = tmp_path / "clean.db"
    clean_url = f"sqlite:///{clean_db.as_posix()}"
    engine = create_engine(clean_url)
    # Target without tables is suitable
    assert check_target_database_suitability(clean_url) is True

    # After tables are created, check reports collision
    Base.metadata.create_all(bind=engine)
    assert check_target_database_suitability(clean_url) is False
    engine.dispose()


def test_validate_staging_storage_preflight(monkeypatch):
    """Verify run_storage_preflight verifies bucket reachability without write operations."""
    import httpx
    from backend.scripts.validate_staging import run_storage_preflight

    class MockResponse:
        status_code = 200

        def json(self):
            return [{"id": "pending-submissions"}, {"id": "approved-resources"}]

    def mock_get(url, headers, timeout):
        assert "apikey" in headers
        assert "Authorization" not in headers  # modern sb_secret key
        return MockResponse()

    monkeypatch.setattr(httpx, "get", mock_get)

    # Should succeed without error
    run_storage_preflight(
        supabase_url="https://mock.supabase.co",
        service_key="sb_secret_valid_key_123",
        pending_bucket="pending-submissions",
        approved_bucket="approved-resources",
    )
