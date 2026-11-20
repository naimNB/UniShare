"""0001_initial_schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-20 23:30:00.000000

Initial baseline migration creating courses, categories, resources, and submissions
tables with full PostgreSQL and SQLite compatibility.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Courses Table
    op.create_table(
        'courses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=32), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('semester', sa.Integer(), nullable=False),
        sa.Column('credits', sa.Float(), server_default='3.0', nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_courses_id', 'courses', ['id'], unique=False)
    op.create_index('ix_courses_code', 'courses', ['code'], unique=True)
    op.create_index('ix_courses_semester', 'courses', ['semester'], unique=False)
    op.create_index('ix_courses_display_order', 'courses', ['display_order'], unique=False)

    # 2. Categories Table
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_categories_id', 'categories', ['id'], unique=False)
    op.create_index('ix_categories_name', 'categories', ['name'], unique=True)

    # 3. Resources Table
    op.create_table(
        'resources',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('download_count', sa.Integer(), server_default='0', nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_resources_id', 'resources', ['id'], unique=False)
    op.create_index('ix_resources_title', 'resources', ['title'], unique=False)
    op.create_index('ix_resources_course_id', 'resources', ['course_id'], unique=False)
    op.create_index('ix_resources_category_id', 'resources', ['category_id'], unique=False)
    op.create_index('ix_resources_created_at', 'resources', ['created_at'], unique=False)
    op.create_index('ix_resources_course_category', 'resources', ['course_id', 'category_id'], unique=False)

    # 4. Submissions Table
    op.create_table(
        'submissions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), server_default='application/pdf', nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('contributor_name', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
        sa.Column('rejection_reason', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='ck_submissions_status'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_submissions_id', 'submissions', ['id'], unique=False)
    op.create_index('ix_submissions_title', 'submissions', ['title'], unique=False)
    op.create_index('ix_submissions_course_id', 'submissions', ['course_id'], unique=False)
    op.create_index('ix_submissions_category_id', 'submissions', ['category_id'], unique=False)
    op.create_index('ix_submissions_status', 'submissions', ['status'], unique=False)
    op.create_index('ix_submissions_created_at', 'submissions', ['created_at'], unique=False)
    op.create_index('ix_submissions_status_created', 'submissions', ['status', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('submissions')
    op.drop_table('resources')
    op.drop_table('categories')
    op.drop_table('courses')
