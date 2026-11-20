from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

try:
    config = context.config
except AttributeError:
    config = None

# Interpret the config file for Python logging.
if config is not None and config.config_file_name is not None:
    fileConfig(config.config_file_name)


import os
import sys
from pathlib import Path

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.config import DATABASE_URL
from backend.app.database import Base
from backend.app import models  # noqa: F401

target_metadata = Base.metadata



def get_migration_url() -> str:
    """
    Ensure migrations run via session pooler (port 5432) or direct connection.
    If transaction pooler (port 6543) is passed, switch to port 5432 for DDL safety.
    """
    ini_url = config.get_main_option("sqlalchemy.url") if config is not None else None
    if ini_url and not ini_url.startswith("driver://"):
        raw_url = ini_url
    else:
        raw_url = os.getenv("DIRECT_URL") or os.getenv("MIGRATION_DATABASE_URL") or DATABASE_URL

    from backend.app.config import normalize_database_url
    url = normalize_database_url(raw_url)
    if ":6543/" in url:
        url = url.replace(":6543/", ":5432/")
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode without an active database connection."""
    url = get_migration_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True if url.startswith("sqlite") else False,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using the application's engine."""
    from backend.app.database import create_db_engine
    target_url = get_migration_url()
    connectable = create_db_engine(target_url)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True if target_url.startswith("sqlite") else False,
        )

        with context.begin_transaction():
            context.run_migrations()


if config is not None:
    if context.is_offline_mode():
        run_migrations_offline()
    else:
        run_migrations_online()
