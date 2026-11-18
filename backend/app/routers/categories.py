from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import Category, Resource
from backend.app.schemas import CategoryRead

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=List[CategoryRead], summary="List all categories")
def list_categories(
    db: Session = Depends(get_db),
) -> List[CategoryRead]:
    """Retrieve all academic resource categories with resource counts, ordered alphabetically."""
    query = (
        select(
            Category.id,
            Category.name,
            Category.description,
            func.count(Resource.id).label("resource_count"),
        )
        .outerjoin(Resource, Category.id == Resource.category_id)
        .group_by(Category.id)
        .order_by(Category.name.asc())
    )

    rows = db.execute(query).all()
    results = [
        CategoryRead(
            id=row.id,
            name=row.name,
            description=row.description,
            resource_count=row.resource_count,
        )
        for row in rows
    ]
    return results
