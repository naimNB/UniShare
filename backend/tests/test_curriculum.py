"""
Comprehensive tests for the official CSE curriculum, migration safety,
idempotent seeding, foreign-key integrity, and course API schemas.
"""

import pytest
from sqlalchemy import create_engine, inspect, text, select
from sqlalchemy.orm import Session, sessionmaker
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import Base, migrate_db
from backend.app.models import Course, Resource, Category
from backend.scripts.seed import OFFICIAL_CURRICULUM, RESOURCE_INTENDED_COURSE_MAP, seed_database


def test_authoritative_curriculum_spec():
    """Verify official curriculum specification: 78 unique courses, 8 semesters, 161.00 credits."""
    assert len(OFFICIAL_CURRICULUM) == 78, f"Expected 78 courses, got {len(OFFICIAL_CURRICULUM)}"

    # Check unique codes
    codes = [item[2] for item in OFFICIAL_CURRICULUM]
    assert len(codes) == len(set(codes)), "Course codes must be unique"

    # Check semester range 1..8
    semesters = [item[0] for item in OFFICIAL_CURRICULUM]
    assert set(semesters) == set(range(1, 9)), "All 8 semesters must be represented"

    # Check expected semester counts and credit totals
    expected_semester_specs = {
        1: (9, 20.00),
        2: (9, 19.00),
        3: (9, 20.00),
        4: (10, 21.00),
        5: (10, 21.00),
        6: (11, 20.00),
        7: (10, 19.00),
        8: (10, 21.00),
    }

    total_credits = sum(item[4] for item in OFFICIAL_CURRICULUM)
    assert abs(total_credits - 161.00) < 0.001, f"Expected 161.00 total credits, got {total_credits}"

    for sem, (exp_count, exp_credits) in expected_semester_specs.items():
        sem_courses = [item for item in OFFICIAL_CURRICULUM if item[0] == sem]
        assert len(sem_courses) == exp_count, f"Semester {sem} expected {exp_count} courses, got {len(sem_courses)}"
        sem_credits = sum(item[4] for item in sem_courses)
        assert abs(sem_credits - exp_credits) < 0.001, f"Semester {sem} expected {exp_credits} credits, got {sem_credits}"


def test_derived_academic_year_and_term():
    """Verify academic year (1..4) and term (1..2) derived from semester (1..8)."""
    expected_mappings = {
        1: (1, 1),  # Year 1, 1st Semester
        2: (1, 2),  # Year 1, 2nd Semester
        3: (2, 1),  # Year 2, 1st Semester
        4: (2, 2),  # Year 2, 2nd Semester
        5: (3, 1),  # Year 3, 1st Semester
        6: (3, 2),  # Year 3, 2nd Semester
        7: (4, 1),  # Year 4, 1st Semester
        8: (4, 2),  # Year 4, 2nd Semester
    }

    for sem, (exp_year, exp_term) in expected_mappings.items():
        course = Course(code=f"TEST {sem}", name=f"Test {sem}", semester=sem, credits=3.0)
        assert course.year == exp_year, f"Semester {sem} should map to Year {exp_year}"
        assert course.term == exp_term, f"Semester {sem} should map to Term {exp_term}"


def test_safe_sqlite_migration_on_legacy_schema(tmp_path):
    """Verify that migrate_db() adds missing columns to an existing SQLite schema without data loss."""
    db_file = tmp_path / "legacy_test.db"
    engine = create_engine(f"sqlite:///{db_file}")

    # Create legacy table without credits and display_order
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code VARCHAR(32) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                semester INTEGER NOT NULL,
                description TEXT
            )
        """))
        conn.execute(text("INSERT INTO courses (code, name, semester) VALUES ('CSE 1101', 'Intro to Computing', 1)"))

    # Inspect before migration
    inspector = inspect(engine)
    cols_before = [col["name"] for col in inspector.get_columns("courses")]
    assert "credits" not in cols_before
    assert "display_order" not in cols_before

    # Run safe migration on this engine
    with engine.begin() as conn:
        columns = [col["name"] for col in inspect(engine).get_columns("courses")]
        if "credits" not in columns:
            conn.execute(text("ALTER TABLE courses ADD COLUMN credits REAL NOT NULL DEFAULT 3.0"))
        if "display_order" not in columns:
            conn.execute(text("ALTER TABLE courses ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0"))

    # Inspect after migration
    inspector = inspect(engine)
    cols_after = [col["name"] for col in inspector.get_columns("courses")]
    assert "credits" in cols_after
    assert "display_order" in cols_after

    # Ensure pre-existing row was preserved with defaults
    with engine.connect() as conn:
        row = conn.execute(text("SELECT code, name, semester, credits, display_order FROM courses WHERE code = 'CSE 1101'")).fetchone()
        assert row is not None
        assert row[0] == "CSE 1101"
        assert row[1] == "Intro to Computing"
        assert row[2] == 1
        assert row[3] == 3.0
        assert row[4] == 0


def test_idempotent_curriculum_seeding(tmp_path):
    """Verify that seed_database is repeatable and yields exactly 78 courses and 161.00 credits."""
    db_file = tmp_path / "seed_idempotent_test.db"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    # First seed run
    db1 = TestingSession()
    seed_database(db1)
    db1.close()

    db_check1 = TestingSession()
    total_courses_1 = db_check1.execute(select(Course)).scalars().all()
    total_credits_1 = sum(c.credits for c in total_courses_1)
    assert len(total_courses_1) == 78
    assert abs(total_credits_1 - 161.00) < 0.001
    db_check1.close()

    # Second seed run (idempotency check)
    db2 = TestingSession()
    seed_database(db2)
    db2.close()

    db_check2 = TestingSession()
    total_courses_2 = db_check2.execute(select(Course)).scalars().all()
    total_credits_2 = sum(c.credits for c in total_courses_2)
    assert len(total_courses_2) == 78, "Seeding must not duplicate courses"
    assert abs(total_credits_2 - 161.00) < 0.001, "Total credits must remain 161.00"

    # Verify foreign-key check
    fk_violations = db_check2.execute(text("PRAGMA foreign_key_check")).fetchall()
    assert len(fk_violations) == 0, f"No FK violations allowed: {fk_violations}"
    db_check2.close()


def test_existing_resource_safe_migration_and_fk_integrity(tmp_path):
    """Verify that pre-existing resources mapped to inaccurate demo courses are safely re-linked by topic."""
    db_file = tmp_path / "fk_relink_test.db"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    db = TestingSession()

    # Create Category
    cat = Category(name="Lecture Notes")
    db.add(cat)

    # Create inaccurate legacy courses
    old_c1 = Course(code="CSE 3101", name="Database Management Systems", semester=5, credits=3.0)
    old_c2 = Course(code="CSE 4103", name="Web Engineering", semester=7, credits=3.0)
    db.add_all([old_c1, old_c2])
    db.flush()

    # Attach resources
    r1 = Resource(
        title="Introduction to Relational Databases & Relational Algebra",
        description="DBMS notes",
        course_id=old_c1.id,
        category_id=cat.id,
        file_path="test_db.pdf",
        original_filename="db.pdf",
        mime_type="application/pdf",
        file_size=1024,
        download_count=5,
    )
    r2 = Resource(
        title="Official Course Syllabus & Grading Matrix: Web Engineering",
        description="Web syllabus",
        course_id=old_c2.id,
        category_id=cat.id,
        file_path="test_web.pdf",
        original_filename="web.pdf",
        mime_type="application/pdf",
        file_size=1024,
        download_count=5,
    )
    db.add_all([r1, r2])
    db.commit()

    # Now run seed_database to execute the official curriculum migration
    seed_database(db)

    # Verify foreign key integrity
    fk_violations = db.execute(text("PRAGMA foreign_key_check")).fetchall()
    assert len(fk_violations) == 0

    # Verify r1 is now linked to official CSE 2103 (Database Management System, Sem 4)
    res_db = db.execute(select(Resource).where(Resource.title == "Introduction to Relational Databases & Relational Algebra")).scalar_one()
    assert res_db.course.code == "CSE 2103"
    assert res_db.course.name == "Database Management System"
    assert res_db.course.semester == 4

    # Verify r2 is now linked to official CSE 2201 (Web Engineering, Sem 5)
    res_web = db.execute(select(Resource).where(Resource.title == "Official Course Syllabus & Grading Matrix: Web Engineering")).scalar_one()
    assert res_web.course.code == "CSE 2201"
    assert res_web.course.name == "Web Engineering"
    assert res_web.course.semester == 5

    db.close()


def test_courses_api_returns_credits_and_curriculum_order(client):
    """Verify that /api/courses returns credits, display_order, year, term and preserves curriculum ordering."""
    response = client.get("/api/courses")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

    first = data[0]
    assert "credits" in first
    assert "display_order" in first
    assert "year" in first
    assert "term" in first
    assert isinstance(first["credits"], (int, float))

    # Verify single course detail endpoint
    course_id = first["id"]
    detail_res = client.get(f"/api/courses/{course_id}")
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["id"] == course_id
    assert "credits" in detail_data
    assert "year" in detail_data
    assert "term" in detail_data
    assert detail_data["credits"] == first["credits"]
