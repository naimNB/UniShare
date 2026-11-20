import os
from pathlib import Path
from typing import Optional

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv
    # Automatically load from project root or backend directory if present
    load_dotenv(BASE_DIR.parent / ".env")
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", BASE_DIR / "storage" / "uploads"))
SUBMISSIONS_DIR = Path(os.getenv("SUBMISSIONS_DIR", BASE_DIR / "storage" / "submissions"))
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "unishare.db"))

raw_database_url = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_PATH.as_posix()}")


def normalize_database_url(url: str) -> str:
    """
    Normalize database connection URLs for SQLAlchemy 2.0+ and psycopg2:
    - Normalize legacy 'postgres://' or driverless 'postgresql://' to 'postgresql+psycopg2://'
    - Strip incompatible Prisma/Node query parameters like 'pgbouncer=true'
      which cause psycopg2.OperationalError: invalid connection option "pgbouncer".
    """
    if not url:
        return url
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]

    from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

    try:
        parsed = urlparse(url)
        if parsed.query and "pgbouncer" in parsed.query:
            params = parse_qs(parsed.query, keep_blank_values=True)
            params.pop("pgbouncer", None)
            new_query = urlencode(params, doseq=True)
            url = urlunparse(parsed._replace(query=new_query))
    except Exception:
        pass

    return url


DATABASE_URL = normalize_database_url(raw_database_url)

# Database pooling configuration (for PostgreSQL / production dialects)
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))

# Storage backend configuration (private dual-bucket staging)
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local").strip().lower()
def clean_env_value(val: Optional[str]) -> Optional[str]:
    """Clean surrounding square brackets or whitespace accidentally left by users."""
    if not val:
        return val
    v = val.strip()
    if v.startswith("[") and v.endswith("]"):
        v = v[1:-1].strip()
    return v


SUPABASE_URL = clean_env_value(os.getenv("SUPABASE_URL"))
SUPABASE_SERVICE_ROLE_KEY = clean_env_value(
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY")
)
SUPABASE_SECRET_KEY = SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PENDING_BUCKET = clean_env_value(
    os.getenv("SUPABASE_PENDING_BUCKET", os.getenv("SUPABASE_PRIVATE_BUCKET", "pending-submissions"))
)
SUPABASE_APPROVED_BUCKET = clean_env_value(
    os.getenv("SUPABASE_APPROVED_BUCKET", os.getenv("SUPABASE_PUBLIC_BUCKET", "approved-resources"))
)
SUPABASE_PRIVATE_BUCKET = SUPABASE_PENDING_BUCKET
SUPABASE_PUBLIC_BUCKET = SUPABASE_APPROVED_BUCKET


# Staged PDF retention policy (recommended bounded retention in days)
STAGED_RETENTION_DAYS = int(os.getenv("STAGED_RETENTION_DAYS", "30"))

# Discord alerts & durable rate limiting configuration (ready for future deployment)
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
DISCORD_NOTIFICATIONS_ENABLED = os.getenv("DISCORD_NOTIFICATIONS_ENABLED", "false").lower() in ("true", "1", "yes")
REDIS_URL = os.getenv("REDIS_URL")
CF_TURNSTILE_SECRET_KEY = os.getenv("CF_TURNSTILE_SECRET_KEY")
CF_TURNSTILE_SITE_KEY = os.getenv("CF_TURNSTILE_SITE_KEY")

# CORS settings for development frontend and production deployments
_DEFAULT_CORS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_env_cors = os.getenv("CORS_ORIGINS")
if _env_cors:
    CORS_ORIGINS = [orig.strip() for orig in _env_cors.split(",") if orig.strip()]
else:
    CORS_ORIGINS = _DEFAULT_CORS

# Ensure local storage directories exist when using local storage
if STORAGE_BACKEND == "local":
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)
