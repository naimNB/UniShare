import time
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.config import SUBMISSIONS_DIR
from backend.app.database import get_db
from backend.app.models import Category, Course, Resource, Submission
from backend.app.pdf_utils import MAX_UPLOAD_SIZE_BYTES, sanitize_filename, validate_pdf_content
from backend.app.schemas import SubmissionCreateResponse
from backend.app.storage import get_storage_backend


router = APIRouter(prefix="/submissions", tags=["Submissions"])

# Basic in-memory rate limiting to prevent submission spam
# Sliding window: max 10 submissions per 60 seconds per client IP
_RATE_LIMIT_MAX = 10
_RATE_LIMIT_WINDOW_SECONDS = 60
_client_timestamps: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(request: Request) -> None:
    """
    Enforce in-memory sliding-window rate limiting per client IP.

    NOTE for multi-worker / production deployments:
    In-memory rate limiting is process-local. When running multiple Uvicorn workers
    or horizontal instances, rate limits should be backed by a centralized Redis
    store (e.g., via redis-py with sliding window sorted sets) or Cloudflare Turnstile /
    WAF IP rate limiting.
    """
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    cutoff = now - _RATE_LIMIT_WINDOW_SECONDS

    # Filter timestamps for this client within active sliding window
    recent = [t for t in _client_timestamps[client_ip] if t > cutoff]
    if len(recent) >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many note submissions received from this network. Please wait a minute before submitting again.",
        )
    recent.append(now)
    _client_timestamps[client_ip] = recent

    # Prune inactive client IPs to prevent unbounded memory growth
    if len(_client_timestamps) > 200:
        stale_ips = [
            ip for ip, timestamps in _client_timestamps.items()
            if not timestamps or timestamps[-1] <= cutoff
        ]
        for ip in stale_ips:
            _client_timestamps.pop(ip, None)



@router.post(
    "",
    response_model=SubmissionCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit study material for moderation",
)
async def create_submission(
    request: Request,
    title: str = Form(..., min_length=3, max_length=200, description="Resource title"),
    course_id: int = Form(..., description="ID of the associated academic course"),
    category_id: int = Form(..., description="ID of the resource category"),
    consent: bool = Form(..., description="Confirmation of permission to share"),
    description: Optional[str] = Form(None, max_length=1000, description="Optional brief description"),
    contributor_name: Optional[str] = Form(None, max_length=100, description="Optional contributor name or alias"),
    file: UploadFile = File(..., description="PDF document to submit"),
    db: Session = Depends(get_db),
):
    """
    Accepts a student study material submission, strictly validates the PDF structure,
    and stages it in private storage with status 'pending' awaiting moderator approval.
    Does NOT publish directly to the public library.
    """
    check_rate_limit(request)

    # 1. Validate consent
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You must confirm that you have permission to share this academic material.",
        )

    # 2. Validate course existence
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course with ID {course_id} was not found.",
        )

    # 3. Validate category existence
    category = db.scalar(select(Category).where(Category.id == category_id))
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with ID {category_id} was not found.",
        )

    # 4. Check for duplicates (existing pending submission or already published resource)
    clean_title = title.strip()
    existing_pending = db.scalar(
        select(Submission).where(
            Submission.course_id == course.id,
            func.lower(Submission.title) == clean_title.lower(),
            Submission.status == "pending",
        )
    )
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A pending submission titled '{clean_title}' is already awaiting review for {course.code}.",
        )

    existing_resource = db.scalar(
        select(Resource).where(
            Resource.course_id == course.id,
            func.lower(Resource.title) == clean_title.lower(),
        )
    )
    if existing_resource:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A resource titled '{clean_title}' already exists in the library for {course.code}.",
        )

    # 5. Check filename and extension
    clean_filename = sanitize_filename(file.filename)
    if not clean_filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PDF documents (.pdf) are permitted for academic note submissions.",
        )

    # 6. Stream and read file bytes with hard 10 MB limit and safe cleanup
    content_chunks: list[bytes] = []
    total_bytes = 0
    chunk_size = 64 * 1024  # 64 KB chunks

    try:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > MAX_UPLOAD_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum allowed upload size of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB.",
                )
            content_chunks.append(chunk)
    finally:
        await file.close()

    file_bytes = b"".join(content_chunks)

    # 7. Validate actual PDF structure and properties
    try:
        validate_pdf_content(file_bytes, clean_filename)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    # 8. Write to private staging storage using storage abstraction
    storage = get_storage_backend()
    staged_filename = f"{uuid.uuid4().hex}.pdf"

    try:
        storage.save_staged_file(staged_filename, file_bytes)
    except Exception as exc:
        storage.delete_staged_file(staged_filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to store staged document for moderation.",
        ) from exc

    # 9. Record in database with pending status
    submission = Submission(
        title=title.strip(),
        description=description.strip() if description else None,
        course_id=course.id,
        category_id=category.id,
        file_path=staged_filename,
        original_filename=clean_filename,
        mime_type="application/pdf",
        file_size=len(file_bytes),
        contributor_name=contributor_name.strip() if contributor_name else None,
        status="pending",
    )

    try:
        db.add(submission)
        db.commit()
        db.refresh(submission)
    except Exception as exc:
        db.rollback()
        # Clean up staged file to prevent orphaned files
        storage.delete_staged_file(staged_filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record submission in database.",
        ) from exc


    return SubmissionCreateResponse(
        id=submission.id,
        title=submission.title,
        status=submission.status,
        message=(
            f"Thank you! '{submission.title}' has been submitted for review. "
            "It will appear in the public library under "
            f"{course.code} ({course.name}) once verified by maintainers."
        ),
    )
