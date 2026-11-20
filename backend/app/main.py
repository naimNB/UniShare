from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import CORS_ORIGINS
from backend.app.database import init_db
from backend.app.routers import categories, courses, health, resources, submissions


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on application startup
    init_db()
    yield


app = FastAPI(
    title="UniShare API",
    version="1.0.0",
    description="University Academic Resource Sharing API with Moderated Note Submissions",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for development frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "OPTIONS", "POST"],
    allow_headers=["*"],
)

# Register API Routers under /api
app.include_router(health.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")


@app.get("/", tags=["Root"])
def root_info():
    """Root info endpoint providing API metadata."""
    return {
        "app": "UniShare API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
        "description": "University Resource Sharing Platform — Read-Only Public API",
    }
