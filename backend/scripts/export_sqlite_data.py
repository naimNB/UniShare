#!/usr/bin/env python3
"""
UniShare SQLite-to-PostgreSQL Export & Relationship Verification Tool
---------------------------------------------------------------------
Extracts data from the local SQLite database, verifies foreign-key relational
integrity in memory, and formats records for direct migration into PostgreSQL
with primary key preservation and sequence synchronization.

Usage:
    python backend/scripts/export_sqlite_data.py [--json-out fixtures/export.json] [--sql-out fixtures/import.sql]
"""

import argparse
import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import select
from backend.app.database import SessionLocal
from backend.app.models import Category, Course, Resource, Submission


def verify_and_export(session=None, sqlite_path=None):
    if session is not None:
        db = session
        should_close = False
    else:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        db_file = Path(sqlite_path or (Path(__file__).resolve().parent.parent / "unishare.db"))
        sqlite_engine = create_engine(f"sqlite:///{db_file.as_posix()}", future=True)
        SqliteSession = sessionmaker(bind=sqlite_engine, future=True)
        db = SqliteSession()
        should_close = True
    try:
        courses = db.scalars(select(Course).order_by(Course.id)).all()
        categories = db.scalars(select(Category).order_by(Category.id)).all()
        resources = db.scalars(select(Resource).order_by(Resource.id)).all()
        submissions = db.scalars(select(Submission).order_by(Submission.id)).all()

        print(f"Loaded: {len(courses)} courses, {len(categories)} categories, {len(resources)} resources, {len(submissions)} submissions.")

        # 1. Relational Integrity Checks
        course_ids = {c.id for c in courses}
        category_ids = {c.id for c in categories}

        for res in resources:
            if res.course_id not in course_ids:
                raise ValueError(f"Integrity Error: Resource #{res.id} references missing course_id {res.course_id}")
            if res.category_id not in category_ids:
                raise ValueError(f"Integrity Error: Resource #{res.id} references missing category_id {res.category_id}")

        for sub in submissions:
            if sub.course_id not in course_ids:
                raise ValueError(f"Integrity Error: Submission #{sub.id} references missing course_id {sub.course_id}")
            if sub.category_id not in category_ids:
                raise ValueError(f"Integrity Error: Submission #{sub.id} references missing category_id {sub.category_id}")

        print("Relational integrity check: PASSED (all foreign keys valid).")

        payload = {
            "metadata": {
                "course_count": len(courses),
                "total_credits": sum(c.credits for c in courses),
                "category_count": len(categories),
                "resource_count": len(resources),
                "submission_count": len(submissions),
            },
            "courses": [
                {
                    "id": c.id,
                    "code": c.code,
                    "name": c.name,
                    "semester": c.semester,
                    "credits": c.credits,
                    "display_order": c.display_order,
                    "description": c.description,
                }
                for c in courses
            ],
            "categories": [
                {
                    "id": c.id,
                    "name": c.name,
                    "description": c.description,
                }
                for c in categories
            ],
            "resources": [
                {
                    "id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "course_id": r.course_id,
                    "category_id": r.category_id,
                    "file_path": r.file_path,
                    "original_filename": r.original_filename,
                    "mime_type": r.mime_type,
                    "file_size": r.file_size,
                    "download_count": r.download_count,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in resources
            ],
            "submissions": [
                {
                    "id": s.id,
                    "title": s.title,
                    "description": s.description,
                    "course_id": s.course_id,
                    "category_id": s.category_id,
                    "file_path": s.file_path,
                    "original_filename": s.original_filename,
                    "mime_type": s.mime_type,
                    "file_size": s.file_size,
                    "contributor_name": s.contributor_name,
                    "status": s.status,
                    "rejection_reason": s.rejection_reason,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
                }
                for s in submissions
            ],
        }

        return payload
    finally:
        if should_close:
            db.close()



def escape_sql_str(val: str | None) -> str:
    """Format string for SQL insert with single-quote escaping."""
    if val is None:
        return "NULL"
    escaped = val.replace("'", "''")
    return f"'{escaped}'"


def generate_sql_dump(payload: dict) -> str:
    """Generate SQL statements for PostgreSQL import with sequence advancement."""
    lines = [
        "-- UniShare PostgreSQL Data Import Script",
        "-- Generated to preserve exact primary and foreign key relationships",
        "BEGIN;",
        "",
    ]

    # Courses
    for c in payload["courses"]:
        code_esc = escape_sql_str(c["code"])
        name_esc = escape_sql_str(c["name"])
        desc_esc = escape_sql_str(c["description"])
        lines.append(
            f"INSERT INTO courses (id, code, name, semester, credits, display_order, description) "
            f"VALUES ({c['id']}, {code_esc}, {name_esc}, {c['semester']}, {c['credits']}, {c['display_order']}, {desc_esc}) "
            f"ON CONFLICT (id) DO NOTHING;"
        )

    # Categories
    for cat in payload["categories"]:
        name_esc = escape_sql_str(cat["name"])
        desc_esc = escape_sql_str(cat["description"])
        lines.append(
            f"INSERT INTO categories (id, name, description) "
            f"VALUES ({cat['id']}, {name_esc}, {desc_esc}) "
            f"ON CONFLICT (id) DO NOTHING;"
        )

    # Resources
    for r in payload["resources"]:
        title_esc = escape_sql_str(r["title"])
        desc_esc = escape_sql_str(r["description"])
        file_esc = escape_sql_str(r["file_path"])
        orig_esc = escape_sql_str(r["original_filename"])
        mime_esc = escape_sql_str(r["mime_type"])
        created = f"'{r['created_at']}'" if r["created_at"] else "NOW()"
        lines.append(
            f"INSERT INTO resources (id, title, description, course_id, category_id, file_path, original_filename, mime_type, file_size, created_at, download_count) "
            f"VALUES ({r['id']}, {title_esc}, {desc_esc}, {r['course_id']}, {r['category_id']}, {file_esc}, {orig_esc}, {mime_esc}, {r['file_size']}, {created}, {r['download_count']}) "
            f"ON CONFLICT (id) DO NOTHING;"
        )


    # Sequence advancement for PostgreSQL
    lines.extend([
        "",
        "-- Advance PostgreSQL sequences so future autoincrements avoid ID collisions",
        "SELECT setval(pg_get_serial_sequence('courses', 'id'), coalesce(max(id), 1)) FROM courses;",
        "SELECT setval(pg_get_serial_sequence('categories', 'id'), coalesce(max(id), 1)) FROM categories;",
        "SELECT setval(pg_get_serial_sequence('resources', 'id'), coalesce(max(id), 1)) FROM resources;",
        "SELECT setval(pg_get_serial_sequence('submissions', 'id'), coalesce(max(id), 1)) FROM submissions;",
        "",
        "COMMIT;",
    ])

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Export UniShare SQLite data for PostgreSQL")
    parser.add_argument("--json-out", type=str, default=None, help="Output path for JSON export")
    parser.add_argument("--sql-out", type=str, default=None, help="Output path for PostgreSQL SQL dump")
    args = parser.parse_args()

    payload = verify_and_export()

    if args.json_out:
        out_path = Path(args.json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2))
        print(f"JSON export written to: {out_path}")

    if args.sql_out:
        out_path = Path(args.sql_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        sql_content = generate_sql_dump(payload)
        out_path.write_text(sql_content)
        print(f"SQL import script written to: {out_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
