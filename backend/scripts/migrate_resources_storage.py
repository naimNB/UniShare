#!/usr/bin/env python3
"""
UniShare Idempotent Demo PDF Storage Migration & Verification Tool
------------------------------------------------------------------
Uploads and verifies the 12 existing demo academic PDF files to the
private 'approved-resources' Supabase Storage bucket.

Features:
- Deterministic, collision-safe key mapping (1-to-1 parity with Resource.file_path)
- Idempotent uploads (skips identical verified objects, refuses conflicting overwrites)
- Strict privacy check (refuses operation if target bucket is public)
- Authenticated download verification (size + SHA-256 checksum)
- Unauthenticated access rejection probe (ensures non-200 public denial)
- Generates gitignored storage manifest (fixtures/storage_manifest.json)
- Preserves local SQLite database integrity without any writes
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import httpx
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from backend.app.config import (
    STORAGE_DIR,
    SUPABASE_APPROVED_BUCKET,
    SUPABASE_PENDING_BUCKET,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    clean_env_value,
)
from backend.app.models import Course, Resource
from backend.app.storage import SupabaseStorageBackend, get_storage_backend


def calculate_sha256(data: bytes) -> str:
    """Compute hex SHA-256 digest of data bytes."""
    return hashlib.sha256(data).hexdigest()


def check_bucket_privacy(backend: SupabaseStorageBackend, bucket_name: str) -> dict[str, Any]:
    """
    Verify that the target bucket exists and is strictly private.
    Raises RuntimeError if bucket does not exist or is marked public.
    """
    bucket_url = f"{backend.url}/storage/v1/bucket/{bucket_name}"
    res = httpx.get(bucket_url, headers=backend.headers, timeout=10.0)
    if res.status_code != 200:
        raise RuntimeError(
            f"Failed to fetch metadata for bucket '{bucket_name}' [HTTP {res.status_code}]: {res.text}"
        )

    info = res.json()
    is_public = info.get("public", False)
    if is_public:
        raise RuntimeError(
            f"CRITICAL SECURITY VIOLATION: Bucket '{bucket_name}' is PUBLIC! "
            f"Expected strictly private storage."
        )

    return info


def list_remote_objects(backend: SupabaseStorageBackend, bucket_name: str) -> dict[str, dict[str, Any]]:
    """List all objects currently in the target bucket, mapped by object name."""
    list_url = f"{backend.url}/storage/v1/object/list/{bucket_name}"
    res = httpx.post(list_url, json={"prefix": "", "limit": 200}, headers=backend.headers, timeout=15.0)
    if res.status_code != 200:
        raise RuntimeError(f"Failed to list objects in bucket '{bucket_name}' [HTTP {res.status_code}]: {res.text}")

    items = res.json()
    return {item["name"]: item for item in items if "name" in item}


def run_migration(
    sqlite_path: Optional[str] = None,
    manifest_path: Optional[str] = None,
    dry_run: bool = False,
    verify_only: bool = False,
) -> dict[str, Any]:
    """Execute idempotent upload, validation, and manifest generation."""
    root_dir = Path(__file__).resolve().parent.parent.parent
    db_file = Path(sqlite_path or (root_dir / "backend" / "unishare.db")).resolve()
    manifest_file = Path(manifest_path or (root_dir / "fixtures" / "storage_manifest.json")).resolve()

    if not db_file.is_file():
        raise FileNotFoundError(f"SQLite database file not found at {db_file}")

    print("=" * 70)
    print("UniShare Supabase Storage Demo PDF Migration")
    print("=" * 70)

    # 1. Read SQLite resources (read-only)
    sqlite_engine = create_engine(f"sqlite:///{db_file.as_posix()}", future=True)
    SqliteSession = sessionmaker(bind=sqlite_engine, future=True)

    with SqliteSession() as session:
        resources = session.scalars(select(Resource).order_by(Resource.id)).all()
        # Detach/copy data to avoid holding connection
        resource_data = [
            {
                "id": r.id,
                "title": r.title,
                "course_id": r.course_id,
                "category_id": r.category_id,
                "file_path": r.file_path,
                "original_filename": r.original_filename,
                "file_size": r.file_size,
            }
            for r in resources
        ]

    sqlite_engine.dispose()
    print(f"[INFO] Loaded {len(resource_data)} resource records from SQLite ({db_file.name}).")

    if len(resource_data) != 12:
        raise ValueError(f"Expected exactly 12 resources in SQLite, found {len(resource_data)}")

    # 2. Verify local PDF files exist and compute checksums
    local_files: list[dict[str, Any]] = []
    uploads_dir = Path(STORAGE_DIR).resolve()

    for r in resource_data:
        file_path = uploads_dir / r["file_path"]
        if not file_path.is_file():
            raise FileNotFoundError(f"Local resource file missing: {file_path}")

        file_bytes = file_path.read_bytes()
        sha256 = calculate_sha256(file_bytes)
        size = len(file_bytes)

        if r["file_size"] and r["file_size"] != size:
            print(f"[WARN] File size mismatch for {r['file_path']}: DB={r['file_size']}, Disk={size}")

        local_files.append({
            "resource_id": r["id"],
            "title": r["title"],
            "local_filename": r["file_path"],
            "local_path": str(file_path.relative_to(root_dir)),
            "storage_object_key": r["file_path"],
            "file_size": size,
            "sha256": sha256,
            "content": file_bytes,
        })

    print(f"[PASS] All {len(local_files)} local demo PDFs verified on disk with SHA-256 checksums.")

    # 3. Initialize and verify Supabase Storage backend
    backend = SupabaseStorageBackend(
        supabase_url=SUPABASE_URL,
        service_role_key=SUPABASE_SERVICE_ROLE_KEY,
        approved_bucket=SUPABASE_APPROVED_BUCKET,
        pending_bucket=SUPABASE_PENDING_BUCKET,
    )

    print(f"[INFO] Target Supabase project: {backend.url}")
    print(f"[INFO] Target bucket: '{backend.approved_bucket}'")

    bucket_info = check_bucket_privacy(backend, backend.approved_bucket)
    print(f"[PASS] Bucket '{backend.approved_bucket}' verified strictly PRIVATE (public={bucket_info.get('public')}).")

    # 4. Check existing remote objects
    existing_objects = list_remote_objects(backend, backend.approved_bucket)
    print(f"[INFO] Found {len(existing_objects)} pre-existing objects in '{backend.approved_bucket}'.")

    # 5. Idempotent upload execution
    manifest_items = []
    uploaded_count = 0
    skipped_count = 0
    failed_count = 0

    for item in local_files:
        key = item["storage_object_key"]
        local_sha = item["sha256"]
        local_size = item["file_size"]
        content = item["content"]

        manifest_entry = {
            "resource_id": item["resource_id"],
            "title": item["title"],
            "local_filename": item["local_filename"],
            "local_path": item["local_path"],
            "storage_object_key": key,
            "file_size": local_size,
            "sha256": local_sha,
            "status": "pending",
        }

        if key in existing_objects:
            # Object already exists: verify SHA-256 before skipping
            print(f"[INFO] Object '{key}' exists remotely. Checking integrity...")
            try:
                remote_content = backend.read_public_file(key)
                remote_sha = calculate_sha256(remote_content)
                if remote_sha == local_sha:
                    print(f"[SKIP] '{key}' already exists with matching SHA-256. Skipping upload.")
                    manifest_entry["status"] = "skipped_identical"
                    skipped_count += 1
                else:
                    raise RuntimeError(
                        f"CONFLICT: Remote object '{key}' exists with differing checksum! "
                        f"Remote SHA={remote_sha[:12]}, Local SHA={local_sha[:12]}. Aborting to protect data."
                    )
            except Exception as exc:
                if "CONFLICT" in str(exc):
                    raise
                print(f"[ERROR] Failed to read existing remote object '{key}': {exc}")
                failed_count += 1
                manifest_entry["status"] = f"read_error: {exc}"
                manifest_items.append(manifest_entry)
                continue
        else:
            if dry_run or verify_only:
                print(f"[DRY-RUN] Would upload '{key}' ({local_size} bytes, SHA-256={local_sha[:12]}...).")
                manifest_entry["status"] = "would_upload" if dry_run else "missing_remote"
                if verify_only:
                    failed_count += 1
            else:
                print(f"[UPLOAD] Uploading '{key}' ({local_size} bytes)...")
                try:
                    backend.save_public_file(key, content)
                    manifest_entry["status"] = "uploaded"
                    uploaded_count += 1
                    print(f"[PASS] Successfully uploaded '{key}'.")
                except Exception as exc:
                    print(f"[ERROR] Upload failed for '{key}': {exc}")
                    manifest_entry["status"] = f"upload_failed: {exc}"
                    failed_count += 1
                    manifest_items.append(manifest_entry)
                    continue

        manifest_items.append(manifest_entry)

    # 6. Post-Upload Verification (unless dry-run)
    verified_count = 0
    if not dry_run:
        print("\n" + "-" * 70)
        print("Running Full Security & Download Verification on Uploaded Objects...")
        print("-" * 70)

        for entry in manifest_items:
            key = entry["storage_object_key"]
            expected_sha = entry["sha256"]
            expected_size = entry["file_size"]

            # A. Authenticated download check
            try:
                downloaded = backend.read_public_file(key)
                if len(downloaded) != expected_size:
                    raise ValueError(f"Size mismatch: expected {expected_size}, got {len(downloaded)}")
                downloaded_sha = calculate_sha256(downloaded)
                if downloaded_sha != expected_sha:
                    raise ValueError(f"Checksum mismatch: expected {expected_sha}, got {downloaded_sha}")
            except Exception as exc:
                print(f"[FAIL] Authenticated download verification failed for '{key}': {exc}")
                entry["verification"] = f"auth_download_failed: {exc}"
                failed_count += 1
                continue

            # B. Unauthenticated public probe (must be rejected)
            public_url = f"{backend.url}/storage/v1/object/public/{backend.approved_bucket}/{key}"
            try:
                probe_res = httpx.get(public_url, timeout=10.0)
                if probe_res.status_code == 200:
                    raise RuntimeError(
                        f"SECURITY BREACH: Object '{key}' is publicly accessible without authentication!"
                    )
                # Any non-200 (400, 404, etc.) confirms public access is denied
            except httpx.RequestError as exc:
                # Connection or protocol error also means unauthenticated access was not served
                pass

            # C. Signed URL check
            try:
                signed_url = backend.create_signed_url(backend.approved_bucket, key, expires_in=300)
                signed_res = httpx.get(signed_url, timeout=10.0)
                if signed_res.status_code != 200 or len(signed_res.content) != expected_size:
                    raise RuntimeError(f"Signed URL download failed (status {signed_res.status_code})")
            except Exception as exc:
                print(f"[FAIL] Signed URL check failed for '{key}': {exc}")
                entry["verification"] = f"signed_url_failed: {exc}"
                failed_count += 1
                continue

            entry["verification"] = "verified_private_and_accessible"
            entry["status"] = "verified"
            verified_count += 1

        print(f"[PASS] Verified {verified_count}/{len(manifest_items)} objects: private, authenticated, checksum match.")

    # 7. Write Manifest
    manifest_data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project_url": backend.url,
        "bucket": backend.approved_bucket,
        "bucket_is_private": not bucket_info.get("public", False),
        "total_resources": len(manifest_items),
        "uploaded_count": uploaded_count,
        "skipped_count": skipped_count,
        "verified_count": verified_count,
        "failed_count": failed_count,
        "items": [
            {
                "resource_id": item["resource_id"],
                "title": item["title"],
                "local_filename": item["local_filename"],
                "local_path": item["local_path"],
                "storage_object_key": item["storage_object_key"],
                "file_size": item["file_size"],
                "sha256": item["sha256"],
                "status": item["status"],
                "verification": item.get("verification", "none"),
            }
            for item in manifest_items
        ],
    }

    manifest_file.parent.mkdir(parents=True, exist_ok=True)
    manifest_file.write_text(json.dumps(manifest_data, indent=2), encoding="utf-8")
    print(f"[PASS] Storage mapping manifest written to: {manifest_file.relative_to(root_dir)}")

    # 8. Re-check SQLite integrity
    check_engine = create_engine(f"sqlite:///{db_file.as_posix()}", future=True)
    with check_engine.connect() as conn:
        integrity = conn.execute(text("PRAGMA integrity_check;")).scalar()
        course_cnt = conn.execute(text("SELECT count(*) FROM courses;")).scalar()
        credit_sum = conn.execute(text("SELECT sum(credits) FROM courses;")).scalar()
        res_cnt = conn.execute(text("SELECT count(*) FROM resources;")).scalar()

    check_engine.dispose()
    assert integrity == "ok", f"SQLite integrity compromised: {integrity}"
    assert course_cnt == 78, f"Course count mismatch: {course_cnt}"
    assert credit_sum == 161.0, f"Credits mismatch: {credit_sum}"
    assert res_cnt == 12, f"Resource count mismatch: {res_cnt}"
    print(f"[PASS] SQLite integrity verified: {course_cnt} courses, {credit_sum} credits, {res_cnt} resources intact.")

    print("\n" + "=" * 70)
    print(f"MIGRATION COMPLETE: Uploaded={uploaded_count}, Skipped={skipped_count}, "
          f"Verified={verified_count}, Failed={failed_count}")
    print("=" * 70)

    return manifest_data


def main():
    parser = argparse.ArgumentParser(description="UniShare Supabase Storage Demo PDF Migration")
    parser.add_argument("--sqlite-path", help="Path to unishare.db SQLite database")
    parser.add_argument("--manifest-out", help="Path to output manifest JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Simulate without uploading")
    parser.add_argument("--verify-only", action="store_true", help="Only verify existing remote objects")

    args = parser.parse_args()

    try:
        run_migration(
            sqlite_path=args.sqlite_path,
            manifest_path=args.manifest_out,
            dry_run=args.dry_run,
            verify_only=args.verify_only,
        )
    except Exception as exc:
        print(f"\n[FATAL ERROR] {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
