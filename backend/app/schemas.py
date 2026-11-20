from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


# -----------------------------------------------------------------------------
# Shared / Summary Schemas
# -----------------------------------------------------------------------------
class CourseSummary(BaseModel):
    id: int
    code: str
    name: str
    semester: int
    credits: float = 3.0
    display_order: int = 0
    year: Optional[int] = None
    term: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class CategorySummary(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Resource Schemas
# -----------------------------------------------------------------------------
class ResourceSummary(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    original_filename: str
    mime_type: str
    file_size: Optional[int] = None
    created_at: datetime
    download_count: int

    model_config = ConfigDict(from_attributes=True)


class ResourceRead(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    course_id: int
    category_id: int
    original_filename: str
    mime_type: str
    file_size: Optional[int] = None
    created_at: datetime
    download_count: int
    course: Optional[CourseSummary] = None
    category: Optional[CategorySummary] = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedResources(BaseModel):
    items: List[ResourceRead]
    total: int
    limit: int
    offset: int


# -----------------------------------------------------------------------------
# Course Schemas
# -----------------------------------------------------------------------------
class CourseBase(BaseModel):
    code: str
    name: str
    semester: int
    credits: float = Field(default=3.0, ge=0.0)
    display_order: int = 0
    description: Optional[str] = None


class CourseRead(CourseBase):
    id: int
    resource_count: int = 0
    year: int = 1
    term: int = 1

    model_config = ConfigDict(from_attributes=True)


class CourseDetail(CourseBase):
    id: int
    resource_count: int = 0
    year: int = 1
    term: int = 1
    resources: List[ResourceSummary] = []

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Category Schemas
# -----------------------------------------------------------------------------
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryRead(CategoryBase):
    id: int
    resource_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Health Check Schema
# -----------------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str
    app: str
    version: str


# -----------------------------------------------------------------------------
# Submission Schemas
# -----------------------------------------------------------------------------
class SubmissionCreateResponse(BaseModel):
    id: int
    title: str
    status: str
    message: str


class SubmissionRead(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    course_id: int
    category_id: int
    original_filename: str
    mime_type: str
    file_size: int
    contributor_name: Optional[str] = None
    status: str
    rejection_reason: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    course: Optional[CourseSummary] = None
    category: Optional[CategorySummary] = None

    model_config = ConfigDict(from_attributes=True)
