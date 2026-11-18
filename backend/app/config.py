import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = Path(os.getenv("STORAGE_DIR", BASE_DIR / "storage" / "uploads"))
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "unishare.db"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATABASE_PATH.as_posix()}")

# CORS settings for development frontend
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Ensure storage directory exists
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
