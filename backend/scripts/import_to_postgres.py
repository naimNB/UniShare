#!/usr/bin/env python3
"""
UniShare Idempotent PostgreSQL Data Import & Relationship Preservation Tool
---------------------------------------------------------------------------
Imports curriculum and catalog data exported from SQLite into a target PostgreSQL
database, strictly preserving entity primary keys, foreign key relationships,
and advancing PostgreSQL SERIAL/IDENTITY sequences.

Usage:
    # Dry run verification
    python backend/scripts/import_to_postgres.py --input-json fixtures/export.json --dry-run

    # Import into target PostgreSQL database
    python backend/scripts/import_to_postgres.py --input-json fixtures/export.json --db-url "postgresql://..."
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session, sessionmaker
from backend.app.config import DATABASE_URL, normalize_database_url
from backend.app.models import Category, Course, Resource, Submission


def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except Exception:
        return datetime.now(timezone.utc)


def run_import(
    data: dict[str, Any],
    target_db_url: str,
    dry_run: bool = False,
    manifest_data: Optional[dict[str, Any]] = None,
) -> dict[str, int]:
    """
    Import courses, categories, resources, and submissions into target database,
    preserving exact primary key IDs and resetting sequences.
    """
    url = normalize_database_url(target_db_url)
    engine = create_engine(url, future=True)
    SessionClass = sessionmaker(bind=engine, future=True)

    counts = {"courses": 0, "categories": 0, "resources": 0, "submissions": 0}

    # Pre-flight check: ensure schema tables exist
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    required = ["courses", "categories", "resources", "submissions"]
    missing = [t for t in required if t not in existing_tables]
    if missing:
        raise RuntimeError(
            f"Target database missing required tables: {missing}. Run 'alembic upgrade head' first."
        )

    if dry_run:
        print("[DRY-RUN] Schema verified. Validating records and foreign-key references in payload...")

    courses_in = data.get("courses", [])
    categories_in = data.get("categories", [])
    resources_in = data.get("resources", [])
    submissions_in = data.get("submissions", [])

    # Validate relationships in memory before any DB operations
    course_ids = {c["id"] for c in courses_in}
    category_ids = {cat["id"] for cat in categories_in}

    for r in resources_in:
        if r["course_id"] not in course_ids:
            raise ValueError(f"Integrity check failed: Resource #{r['id']} references unknown course_id {r['course_id']}")
        if r["category_id"] not in category_ids:
            raise ValueError(f"Integrity check failed: Resource #{r['id']} references unknown category_id {r['category_id']}")

    for s in submissions_in:
        if s["course_id"] not in course_ids:
            raise ValueError(f"Integrity check failed: Submission #{s['id']} references unknown course_id {s['course_id']}")
        if s["category_id"] not in category_ids:
            raise ValueError(f"Integrity check failed: Submission #{s['id']} references unknown category_id {s['category_id']}")

    # Apply & validate storage manifest mappings if provided
    if manifest_data:
        manifest_items = manifest_data.get("items", [])
        manifest_map = {item["resource_id"]: item for item in manifest_items}
        for r in resources_in:
            m_item = manifest_map.get(r["id"])
            if not m_item:
                raise ValueError(f"Storage manifest missing entry for Resource #{r['id']} ({r.get('title')})")
            if m_item.get("status") not in ("verified", "skipped_identical"):
                raise ValueError(f"Storage manifest entry for Resource #{r['id']} is not verified (status={m_item.get('status')})")
            # Enforce clean remote storage object key mapping (e.g. no local filesystem prefixes)
            r["file_path"] = m_item["storage_object_key"]
            if not r.get("file_size"):
                r["file_size"] = m_item.get("file_size")
        print(f"[INFO] Storage manifest validated: all {len(resources_in)} resources mapped to verified cloud storage keys.")

    if dry_run:
        print(f"[DRY-RUN] Data validation successful: {len(courses_in)} courses, {len(categories_in)} categories, {len(resources_in)} resources, {len(submissions_in)} submissions ready for import.")
        return {
            "courses": len(courses_in),
            "categories": len(categories_in),
            "resources": len(resources_in),
            "submissions": len(submissions_in),
        }

    # Execute import inside a single atomic transaction
    with SessionClass() as session:
        try:
            # 1. Courses
            for c in courses_in:
                existing = session.get(Course, c["id"])
                if not existing:
                    course = Course(
                        id=c["id"],
                        code=c["code"],
                        name=c["name"],
                        semester=c["semester"],
                        credits=c.get("credits", 3.0),
                        display_order=c.get("display_order", 0),
                        description=c.get("description"),
                    )
                    session.add(course)
                    counts["courses"] += 1

            session.flush()

            # 2. Categories
            for cat in categories_in:
                existing = session.get(Category, cat["id"])
                if not existing:
                    category = Category(
                        id=cat["id"],
                        name=cat["name"],
                        description=cat.get("description"),
                    )
                    session.add(category)
                    counts["categories"] += 1

            session.flush()

            # 3. Resources
            for r in resources_in:
                existing = session.get(Resource, r["id"])
                if not existing:
                    resource = Resource(
                        id=r["id"],
                        title=r["title"],
                        description=r.get("description"),
                        course_id=r["course_id"],
                        category_id=r["category_id"],
                        file_path=r["file_path"],
                        original_filename=r["original_filename"],
                        mime_type=r.get("mime_type", "application/pdf"),
                        file_size=r.get("file_size"),
                        download_count=r.get("download_count", 0),
                        created_at=parse_iso_datetime(r.get("created_at")),
                    )
                    session.add(resource)
                    counts["resources"] += 1

            session.flush()

            # 4. Submissions
            for s in submissions_in:
                existing = session.get(Submission, s["id"])
                if not existing:
                    submission = Submission(
                        id=s["id"],
                        title=s["title"],
                        description=s.get("description"),
                        course_id=s["course_id"],
                        category_id=s["category_id"],
                        file_path=s["file_path"],
                        original_filename=s["original_filename"],
                        mime_type=s.get("mime_type", "application/pdf"),
                        file_size=s["file_size"],
                        contributor_name=s.get("contributor_name"),
                        status=s.get("status", "pending"),
                        rejection_reason=s.get("rejection_reason"),
                        created_at=parse_iso_datetime(s.get("created_at")),
                        reviewed_at=parse_iso_datetime(s.get("reviewed_at")),
                    )
                    session.add(submission)
                    counts["submissions"] += 1

            session.flush()

            # 5. Advance sequences if target is PostgreSQL
            if url.startswith("postgresql"):
                for table in ["courses", "categories", "resources", "submissions"]:
                    session.execute(
                        text(
                            f"""
                            DO $$
                            DECLARE
                                max_id bigint;
                                seq_name text;
                            BEGIN
                                seq_name := pg_get_serial_sequence('{table}', 'id');
                                IF seq_name IS NOT NULL THEN
                                    EXECUTE 'SELECT max(id) FROM {table}' INTO max_id;
                                    IF max_id IS NOT NULL THEN
                                        PERFORM setval(seq_name, max_id, true);
                                    ELSE
                                        PERFORM setval(seq_name, 1, false);
                                    END IF;
                                END IF;
                            END $$;
                            """
                        )
                    )

            session.commit()
            print(f"[SUCCESS] Import completed: {counts}")
            return counts

        except Exception as exc:
            session.rollback()
            print(f"[ERROR] Import failed, transaction rolled back: {exc}", file=sys.stderr)
            raise
        finally:
            engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Import UniShare data to PostgreSQL preserving IDs")
    parser.add_argument("--input-json", type=str, required=True, help="Path to JSON file generated by export_sqlite_data.py")
    parser.add_argument("--db-url", type=str, default=None, help="Target PostgreSQL connection string (defaults to DATABASE_URL)")
    parser.add_argument("--manifest", type=str, default="fixtures/storage_manifest.json", help="Path to storage_manifest.json")
    parser.add_argument("--dry-run", action="store_true", help="Validate payload without writing to database")
    args = parser.parse_args()

    input_path = Path(args.input_json)
    if not input_path.is_file():
        print(f"Error: Input file '{input_path}' not found.", file=sys.stderr)
        return 1

    target_url = args.db_url or DATABASE_URL
    if "unishare.db" in target_url and not args.dry_run:
        print("Safety refusal: Target cannot be existing 'unishare.db' without dry-run.", file=sys.stderr)
        return 1

    manifest_data = None
    if args.manifest:
        m_path = Path(args.manifest)
        if m_path.is_file():
            manifest_data = json.loads(m_path.read_text(encoding="utf-8"))
            print(f"[INFO] Loaded storage manifest from '{args.manifest}'.")
        else:
            print(f"[WARN] Storage manifest '{args.manifest}' not found; proceeding without manifest mapping.")

    payload = json.loads(input_path.read_text())
    run_import(payload, target_db_url=target_url, dry_run=args.dry_run, manifest_data=manifest_data)
    return 0


if __name__ == "__main__":
    sys.exit(main())
