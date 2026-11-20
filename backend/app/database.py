from collections.abc import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from backend.app.config import (
    DATABASE_URL,
    DB_MAX_OVERFLOW,
    DB_POOL_RECYCLE,
    DB_POOL_SIZE,
    DB_POOL_TIMEOUT,
)


def create_db_engine(url: str):
    """
    Construct a SQLAlchemy Engine configured specifically for the target database dialect:
    - SQLite: disables thread-checking for FastAPI async workers and enables PRAGMA foreign_keys=ON.
    - PostgreSQL: configures connection pooling (pre-ping, recycle, size, overflow) for cloud workloads.
    """
    if url.startswith("sqlite"):
        eng = create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=False,
            future=True,
        )

        @event.listens_for(eng, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return eng

    # PostgreSQL / other production RDBMS
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_MAX_OVERFLOW,
        pool_timeout=DB_POOL_TIMEOUT,
        pool_recycle=DB_POOL_RECYCLE,
        echo=False,
        future=True,
    )


engine = create_db_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

Base = declarative_base()



def get_db() -> Generator[Session, None, None]:
    """Dependency injection yield for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_db() -> None:
    """Run safe legacy migrations for SQLite schema updates in local development."""
    from sqlalchemy import inspect, text

    if not DATABASE_URL.startswith("sqlite"):
        # Production PostgreSQL schema is versioned and managed exclusively by Alembic
        return

    inspector = inspect(engine)
    if "courses" in inspector.get_table_names():
        columns = [col["name"] for col in inspector.get_columns("courses")]
        with engine.begin() as conn:
            if "credits" not in columns:
                conn.execute(text("ALTER TABLE courses ADD COLUMN credits REAL NOT NULL DEFAULT 3.0"))
            if "display_order" not in columns:
                conn.execute(text("ALTER TABLE courses ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0"))



def init_db() -> None:
    """Create all tables defined in models and run schema migrations."""
    from backend.app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    migrate_db()
