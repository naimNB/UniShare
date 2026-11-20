from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Text,
    DateTime,
    ForeignKey,
    Index,
    CheckConstraint,
    func,
)
from sqlalchemy.orm import relationship

from backend.app.database import Base



def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(32), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    semester = Column(Integer, nullable=False, index=True)
    credits = Column(Float, nullable=False, default=3.0, server_default="3.0")
    display_order = Column(Integer, nullable=False, default=0, server_default="0", index=True)
    description = Column(Text, nullable=True)

    @property
    def year(self) -> int:
        """Derive academic year (1 to 4) from semester (1 to 8)."""
        return (self.semester + 1) // 2

    @property
    def term(self) -> int:
        """Derive year-term (1 or 2) from semester (1 to 8)."""
        return 1 if self.semester % 2 != 0 else 2

    # Relationships
    resources = relationship(
        "Resource",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="Resource.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Course(id={self.id}, code='{self.code}', semester={self.semester}, credits={self.credits})>"


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Relationships
    resources = relationship(
        "Resource",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="Resource.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Category(id={self.id}, name='{self.name}')>"


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=True)  # in bytes
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False, index=True)
    download_count = Column(Integer, default=0, server_default="0", nullable=False)

    # Relationships
    course = relationship("Course", back_populates="resources")
    category = relationship("Category", back_populates="resources")

    __table_args__ = (
        Index("ix_resources_course_category", "course_id", "category_id"),
    )

    def __repr__(self) -> str:
        return f"<Resource(id={self.id}, title='{self.title}', course_id={self.course_id})>"


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False, default="application/pdf", server_default="application/pdf")
    file_size = Column(Integer, nullable=False)
    contributor_name = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="pending", server_default="pending", index=True)  # pending, approved, rejected
    rejection_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False, index=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    course = relationship("Course")
    category = relationship("Category")

    __table_args__ = (
        Index("ix_submissions_status_created", "status", "created_at"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_submissions_status"),
    )


    def __repr__(self) -> str:
        return f"<Submission(id={self.id}, title='{self.title}', status='{self.status}')>"
