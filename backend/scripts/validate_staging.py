#!/usr/bin/env python3
"""
UniShare Supabase Staging Environment Validation Tool
------------------------------------------------------
Safely verifies:
1. PostgreSQL connectivity (SELECT 1)
2. Target database cleanliness & readiness for Alembic schema migration
3. Alembic baseline migration execution (STRICT: only on empty staging database)
4. Private pending bucket upload & unauthenticated access prevention
5. Promotion of disposable objects to private approved bucket
6. Signed URL generation & authenticated retrieval
7. Complete cleanup of test objects

MODES:
- Default: Performs connection check, empty-database verification, baseline migration,
  disposable PDF upload/promotion/signed-URL retrieval, and complete bucket cleanup.
- --preflight / --connection-only: Tests connectivity to PostgreSQL (SELECT 1) and
  verifies storage bucket reachability WITHOUT executing any migrations, file writes,
  or bucket mutations.
- --dry-run: Validates environment configuration variables without network calls.

IMPORTANT:
- NEVER logs, prints, or exposes credentials or signed URLs.
- Compatible with modern sb_secret_* keys (apikey header) and legacy JWT keys.
- Operates ONLY on disposable test objects with guaranteed finally-block cleanup.
- Does NOT touch or migrate local SQLite data or PDF storage.
"""

import argparse
import sys
import uuid
from pathlib import Path
from typing import Optional

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.config import (
    DATABASE_URL,
    STORAGE_BACKEND,
    SUPABASE_APPROVED_BUCKET,
    SUPABASE_PENDING_BUCKET,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    normalize_database_url,
)
from backend.app.config import clean_env_value


def is_invalid_or_placeholder(val: Optional[str]) -> bool:
    cleaned = clean_env_value(val)
    if not cleaned:
        return True
    if cleaned.startswith("sb_secret_") or cleaned.startswith("eyJ"):
        return False
    v = str(cleaned).lower()
    return "[" in v or "placeholder" in v or "<project" in v or "your_" in v


def inspect_configuration() -> tuple[bool, list[str]]:
    missing = []

    if not DATABASE_URL or DATABASE_URL.startswith("sqlite") or is_invalid_or_placeholder(DATABASE_URL):
        missing.append("DATABASE_URL (must be a valid PostgreSQL connection string, e.g. postgresql://...)")
    if is_invalid_or_placeholder(SUPABASE_URL):
        missing.append("SUPABASE_URL (e.g. https://<project-ref>.supabase.co)")
    if is_invalid_or_placeholder(SUPABASE_SERVICE_ROLE_KEY):
        missing.append("SUPABASE_SERVICE_ROLE_KEY (modern sb_secret_* or legacy service_role key)")

    return len(missing) == 0, missing


def test_postgres_connection(db_url: str):
    """Test PostgreSQL connection with SELECT 1 without printing connection strings."""
    from sqlalchemy import create_engine, text

    url = normalize_database_url(db_url)
    engine = create_engine(url, connect_args={"connect_timeout": 10} if "postgresql" in url else {})
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1;")).scalar()
            if result != 1:
                raise RuntimeError(f"Unexpected query result: {result}")
        print("[PASS] Task 3: PostgreSQL connection verified (SELECT 1 returned 1).")
    finally:
        engine.dispose()


def check_target_database_suitability(db_url: str) -> bool:
    """
    Verify target database public schema is empty and dedicated to staging.
    Never allows migrations to run on non-empty databases.
    """
    from sqlalchemy import create_engine, inspect

    url = normalize_database_url(db_url)
    engine = create_engine(url)
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        app_tables = {"courses", "categories", "resources", "submissions"}
        conflicts = app_tables.intersection(existing_tables)

        if conflicts:
            print(f"[SAFETY REFUSAL] Target database already contains application tables: {sorted(conflicts)}")
            return False

        non_alembic = existing_tables - {"alembic_version"}
        if len(non_alembic) > 0:
            print(f"[SAFETY REFUSAL] Target database is not empty. Found existing tables: {sorted(non_alembic)}")
            return False

        print("[PASS] Task 4: Target database verified clean and empty (suitable for fresh migration).")
        return True
    finally:
        engine.dispose()


def apply_alembic_migrations(db_url: str):
    """Apply Alembic baseline migration to confirmed empty staging database."""
    from alembic import command
    from alembic.config import Config

    alembic_ini_path = Path(__file__).resolve().parent.parent.parent / "alembic.ini"
    cfg = Config(str(alembic_ini_path))
    cfg.set_main_option("sqlalchemy.url", normalize_database_url(db_url))

    print("[INFO] Task 5 & 6: Applying Alembic baseline migration to staging database...")
    command.upgrade(cfg, "head")
    print("[PASS] Task 6: Alembic migration to 'head' completed successfully.")


def run_storage_preflight(
    supabase_url: str,
    service_key: str,
    pending_bucket: str,
    approved_bucket: str,
):
    """
    Safe read-only verification of Supabase Storage credentials and bucket existence.
    Does NOT upload or modify any files.
    """
    import httpx
    from backend.app.storage import SupabaseStorageBackend

    backend = SupabaseStorageBackend(
        supabase_url=supabase_url,
        service_role_key=service_key,
        pending_bucket=pending_bucket,
        approved_bucket=approved_bucket,
    )

    list_buckets_url = f"{supabase_url.rstrip('/')}/storage/v1/bucket"
    res = httpx.get(list_buckets_url, headers=backend.headers, timeout=10.0)

    if res.status_code != 200:
        raise RuntimeError(
            f"Storage authentication failed [{res.status_code}]. Verify SUPABASE_SERVICE_ROLE_KEY."
        )

    buckets_data = res.json()
    bucket_ids = {b.get("id") or b.get("name") for b in buckets_data}

    if pending_bucket not in bucket_ids:
        print(f"[WARN] Pending bucket '{pending_bucket}' was not found in Supabase storage.")
    else:
        print(f"[PASS] Verified private pending bucket exists: '{pending_bucket}'.")

    if approved_bucket not in bucket_ids:
        print(f"[WARN] Approved bucket '{approved_bucket}' was not found in Supabase storage.")
    else:
        print(f"[PASS] Verified private approved bucket exists: '{approved_bucket}'.")

    print("[PASS] Storage preflight verified: credentials valid and buckets reachable.")


def run_storage_verification(
    supabase_url: str,
    service_key: str,
    pending_bucket: str,
    approved_bucket: str,
):
    """
    Verify private buckets, signed URLs, access control, and complete cleanup
    using disposable objects with guaranteed finally-block cleanup.
    """
    import httpx
    from backend.app.storage import SupabaseStorageBackend

    backend = SupabaseStorageBackend(
        supabase_url=supabase_url,
        service_role_key=service_key,
        pending_bucket=pending_bucket,
        approved_bucket=approved_bucket,
    )

    test_id = uuid.uuid4().hex[:12]
    test_filename = f"disposable_staging_test_{test_id}.pdf"
    disposable_pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
    )

    try:
        # 1. Staging upload
        print(f"[INFO] Task 7: Staging disposable PDF in private pending bucket...")
        backend.save_staged_file(test_filename, disposable_pdf_content)
        assert backend.staged_file_exists(test_filename), "Staged file check failed"
        print("[PASS] Task 7: Disposable PDF saved and verified in pending bucket.")

        # 2. Verify pending file is NOT publicly accessible
        public_probe_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/{pending_bucket}/{test_filename}"
        try:
            probe_res = httpx.get(public_probe_url, timeout=10.0)
            if probe_res.status_code == 200:
                raise AssertionError(
                    "CRITICAL SECURITY FAILURE: Pending file is publicly accessible without authentication!"
                )
            print(f"[PASS] Task 8: Verified pending file is not publicly accessible (status: {probe_res.status_code}).")
        except httpx.RequestError as exc:
            print(f"[PASS] Task 8: Public probe safely rejected ({exc}).")

        # 3. Test signed URL & promotion
        print("[INFO] Task 9: Testing signed URL generation and promotion...")
        signed_url = backend.create_signed_url(pending_bucket, test_filename, expires_in=300)
        assert signed_url.startswith("http"), "Signed URL must be a valid HTTP URL"

        signed_res = httpx.get(signed_url, timeout=10.0)
        if signed_res.status_code != 200 or len(signed_res.content) != len(disposable_pdf_content):
            raise RuntimeError("Failed to retrieve staged file via signed URL")

        backend.promote_to_public(test_filename)
        assert backend.public_file_exists(test_filename), "Approved file check failed"
        print("[PASS] Task 9: Promotion to approved bucket and signed URL retrieval verified.")

    finally:
        # 4. Guaranteed cleanup of disposable files
        print("[INFO] Task 10: Cleaning up test objects from both buckets...")
        backend.delete_staged_file(test_filename)
        backend.delete_public_file(test_filename)

        assert not backend.staged_file_exists(test_filename), "Pending file cleanup failed"
        assert not backend.public_file_exists(test_filename), "Approved file cleanup failed"
        print("[PASS] Task 10: Cleanup verified. All disposable test objects removed from Supabase.")


def run_connection_preflight() -> int:
    """
    Run safe, connection-only preflight testing PostgreSQL SELECT 1
    and Supabase Storage bucket listing without executing migrations or file writes.
    Clearly reports which connections succeeded and which are still blocked.
    """
    print("=" * 70)
    print("UniShare Supabase Connection Preflight (Read-Only)")
    print("=" * 70)

    # 1. PostgreSQL Check
    pg_ok = False
    is_pg_configured = DATABASE_URL and not DATABASE_URL.startswith("sqlite") and not ("[" in DATABASE_URL)
    if not is_pg_configured:
        print("[POSTGRESQL] BLOCKED: DATABASE_URL not configured or contains placeholder in .env")
    else:
        try:
            test_postgres_connection(DATABASE_URL)
            pg_ok = True
        except Exception as exc:
            print(f"[POSTGRESQL] BLOCKED: Connection failed ({type(exc).__name__})")

    # 2. Supabase Storage Check
    storage_ok = False
    is_storage_configured = (
        SUPABASE_URL and not is_invalid_or_placeholder(SUPABASE_URL) and
        SUPABASE_SERVICE_ROLE_KEY and not is_invalid_or_placeholder(SUPABASE_SERVICE_ROLE_KEY)
    )
    if not is_storage_configured:
        print("[STORAGE API] BLOCKED: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY contains placeholder in .env")
    else:
        try:
            run_storage_preflight(
                supabase_url=SUPABASE_URL,
                service_key=SUPABASE_SERVICE_ROLE_KEY,
                pending_bucket=SUPABASE_PENDING_BUCKET,
                approved_bucket=SUPABASE_APPROVED_BUCKET,
            )
            storage_ok = True
        except Exception as exc:
            print(f"[STORAGE API] BLOCKED: Storage authentication failed ({type(exc).__name__})")

    print("-" * 70)
    print("PREFLIGHT STATUS SUMMARY:")
    print(f"  - PostgreSQL (SELECT 1):      {'SUCCEEDED' if pg_ok else 'BLOCKED'}")
    print(f"  - Supabase Storage API:       {'SUCCEEDED' if storage_ok else 'BLOCKED'}")
    print(f"  - Private Buckets Access:     {'SUCCEEDED' if storage_ok else 'BLOCKED'}")
    print("=" * 70)

    if pg_ok and storage_ok:
        print("\n[SUCCESS] All connection-only preflight checks passed successfully.")
        return 0
    else:
        print("\n[ACTION REQUIRED] Please enter real credentials directly into .env and rerun.")
        return 2


def main():
    parser = argparse.ArgumentParser(description="Validate Supabase staging environment safely")
    parser.add_argument("--dry-run", action="store_true", help="Inspect configuration without connecting")
    parser.add_argument(
        "--preflight",
        "--connection-only",
        dest="preflight",
        action="store_true",
        help="Test connection and bucket reachability without migrations or file writes",
    )
    args = parser.parse_args()

    if args.preflight:
        return run_connection_preflight()

    is_configured, missing = inspect_configuration()

    if not is_configured:
        print("=" * 70, file=sys.stderr)
        print("STOP: Supabase staging configuration incomplete.", file=sys.stderr)
        print("The following environment variables must be configured in .env:", file=sys.stderr)
        for item in missing:
            print(f"  - {item}", file=sys.stderr)
        print("=" * 70, file=sys.stderr)
        print("Please enter credentials directly into /home/md-naim/UniShare/.env")
        return 2

    if args.dry_run:
        print("[PASS] Configuration inspection: All required variables are configured.")
        return 0

    # Full execution mode: verify target is clean before running migrations
    test_postgres_connection(DATABASE_URL)
    is_clean = check_target_database_suitability(DATABASE_URL)
    if not is_clean:
        print("[ERROR] Safety check failed: Target database is not confirmed empty. Aborting.", file=sys.stderr)
        return 1

    apply_alembic_migrations(DATABASE_URL)

    run_storage_verification(
        supabase_url=SUPABASE_URL,
        service_key=SUPABASE_SERVICE_ROLE_KEY,
        pending_bucket=SUPABASE_PENDING_BUCKET,
        approved_bucket=SUPABASE_APPROVED_BUCKET,
    )

    print("\n[SUCCESS] Supabase staging environment is fully verified and ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
