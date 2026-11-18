from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from backend.app.database import get_db
from backend.app.models import Course, Resource
from backend.app.schemas import CourseDetail, CourseRead

router = APIRouter(prefix="/courses", tags=["Courses"])


@router.get("", response_model=List[CourseRead], summary="List all courses")
def list_courses(
    semester: Optional[int] = Query(
        None, ge=1, le=12, description="Filter courses by semester number"
    ),
    db: Session = Depends(get_db),
) -> List[CourseRead]:
    """Retrieve all university courses with their resource counts, ordered by semester and code."""
    # Build query counting resources per course
    query = (
        select(
            Course.id,
            Course.code,
            Course.name,
            Course.semester,
            Course.description,
            func.count(Resource.id).label("resource_count"),
        )
        .outerjoin(Resource, Course.id == Resource.course_id)
        .group_by(Course.id)
    )

    if semester is not None:
        query = query.where(Course.semester == semester)

    query = query.order_by(Course.semester.asc(), Course.code.asc())

    rows = db.execute(query).all()
    results = [
        CourseRead(
            id=row.id,
            code=row.code,
            name=row.name,
            semester=row.semester,
            description=row.description,
            resource_count=row.resource_count,
        )
        for row in rows
    ]
    return results


@router.get("/{course_id}", response_model=CourseDetail, summary="Get course details")
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
) -> CourseDetail:
    """Retrieve single course details including all associated resources."""
    query = (
        select(Course)
        .options(selectinload(Course.resources))
        .where(Course.id == course_id)
    )
    course = db.execute(query).scalar_one_or_none()

    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course with ID {course_id} not found",
        )

    return CourseDetail(
        id=course.id,
        code=course.code,
        name=course.name,
        semester=course.semester,
        description=course.description,
        resource_count=len(course.resources),
        resources=course.resources,
    )
