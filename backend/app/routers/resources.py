from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload
from backend.app.config import STORAGE_BACKEND, STORAGE_DIR
from backend.app.database import get_db
from backend.app.models import Course, Resource
from backend.app.schemas import PaginatedResources, ResourceRead
from backend.app.storage import get_storage_backend


router = APIRouter(prefix="/resources", tags=["Resources"])


def resolve_safe_file_path(relative_path: str) -> Path:
    """
    Resolve file path securely within the designated STORAGE_DIR.
    Prevents path traversal attacks and checks file existence.
    """
    try:
        resolved = (STORAGE_DIR / relative_path).resolve()
        # Verify that the path resides strictly inside STORAGE_DIR
        resolved.relative_to(STORAGE_DIR.resolve())
    except (ValueError, RuntimeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path security violation",
        )

    if not resolved.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource document file not found on disk",
        )

    return resolved


@router.get("", response_model=PaginatedResources, summary="List and filter academic resources")
def list_resources(
    q: Optional[str] = Query(
        None, max_length=200,
        description="Search resource title/description and course code/name",
    ),
    semester: Optional[int] = Query(
        None, ge=1, le=12, description="Filter resources by course semester"
    ),
    course_id: Optional[int] = Query(
        None, ge=1, description="Filter resources by course ID"
    ),
    category_id: Optional[int] = Query(
        None, ge=1, description="Filter resources by category ID"
    ),
    limit: int = Query(20, ge=1, le=100, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db),
) -> PaginatedResources:
    """
    Retrieve academic resources with multi-facet filtering and pagination.
    Supports keyword search, semester filtering, course filtering, and category filtering.
    """
    # Build filter conditions
    filters = []

    if q and q.strip():
        # Search literal text; '%' and '_' from user input are not wildcards.
        keyword = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search_term = f"%{keyword}%"
        filters.append(
            or_(
                Resource.title.ilike(search_term, escape="\\"),
                Resource.description.ilike(search_term, escape="\\"),
                Resource.course.has(or_(
                    Course.code.ilike(search_term, escape="\\"),
                    Course.name.ilike(search_term, escape="\\"),
                )),
            )
        )

    if course_id is not None:
        filters.append(Resource.course_id == course_id)

    if category_id is not None:
        filters.append(Resource.category_id == category_id)

    # Base query for count
    count_query = select(func.count(Resource.id))
    if semester is not None:
        count_query = count_query.join(Course, Resource.course_id == Course.id).where(
            Course.semester == semester
        )

    if filters:
        count_query = count_query.where(*filters)

    total = db.execute(count_query).scalar_one()

    # Query for items
    query = (
        select(Resource)
        .options(
            joinedload(Resource.course),
            joinedload(Resource.category),
        )
    )

    if semester is not None:
        query = query.join(Course, Resource.course_id == Course.id).where(
            Course.semester == semester
        )

    if filters:
        query = query.where(*filters)

    # Deterministic sorting: newest first, then id desc
    query = query.order_by(Resource.created_at.desc(), Resource.id.desc())
    query = query.limit(limit).offset(offset)

    items = db.execute(query).scalars().all()

    return PaginatedResources(
        items=list(items),
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{resource_id}", response_model=ResourceRead, summary="Get resource details")
def get_resource(
    resource_id: int,
    db: Session = Depends(get_db),
) -> ResourceRead:
    """Retrieve metadata for a specific academic resource."""
    query = (
        select(Resource)
        .options(
            joinedload(Resource.course),
            joinedload(Resource.category),
        )
        .where(Resource.id == resource_id)
    )
    resource = db.execute(query).scalar_one_or_none()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource with ID {resource_id} not found",
        )

    return resource


@router.get("/{resource_id}/preview", summary="Inline PDF/Document Preview")
def preview_resource(
    resource_id: int,
    db: Session = Depends(get_db),
):
    """
    Serve document file for inline browser viewing (PDF viewer).
    When cloud storage (Supabase) is configured, redirects to public CDN URL.
    Otherwise serves local file securely with Content-Disposition inline.
    """
    resource = db.execute(
        select(Resource).where(Resource.id == resource_id)
    ).scalar_one_or_none()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource with ID {resource_id} not found",
        )

    storage = get_storage_backend()
    if STORAGE_BACKEND == "supabase":
        if not storage.public_file_exists(resource.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource document file not found in storage",
            )
        return RedirectResponse(
            url=storage.get_public_url(resource.file_path),
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )

    file_path = resolve_safe_file_path(resource.file_path)

    return FileResponse(
        path=str(file_path),
        media_type=resource.mime_type or "application/pdf",
        filename=resource.original_filename,
        content_disposition_type="inline",
    )


@router.get("/{resource_id}/download", summary="Download resource document")
def download_resource(
    resource_id: int,
    db: Session = Depends(get_db),
):
    """
    Download resource document. Increments download_count on initiation.
    Redirects to Supabase CDN when cloud storage is active, or streams local file.
    """
    resource = db.execute(
        select(Resource).where(Resource.id == resource_id)
    ).scalar_one_or_none()

    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resource with ID {resource_id} not found",
        )

    storage = get_storage_backend()
    if STORAGE_BACKEND == "supabase":
        if not storage.public_file_exists(resource.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource document file not found in storage",
            )
        resource.download_count = (resource.download_count or 0) + 1
        db.commit()
        return RedirectResponse(
            url=storage.get_public_url(resource.file_path),
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        )

    file_path = resolve_safe_file_path(resource.file_path)

    # Increment download count only after verifying file exists on disk
    resource.download_count = (resource.download_count or 0) + 1
    db.commit()

    return FileResponse(
        path=str(file_path),
        media_type=resource.mime_type or "application/octet-stream",
        filename=resource.original_filename,
    )
