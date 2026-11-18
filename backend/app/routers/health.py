from fastapi import APIRouter
from backend.app.schemas import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="API Health Check")
def get_health() -> HealthResponse:
    """Return API health status."""
    return HealthResponse(
        status="ok",
        app="UniShare",
        version="1.0.0",
    )
