"""
backend/api/favorites.py
=========================
Save/unsave planners, packages, or destinations.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models import Favorite, User
from backend.auth.utils import get_current_user

router = APIRouter(prefix="/api/favorites", tags=["Favorites"])


class FavoriteCreate(BaseModel):
    planner_id: Optional[int] = None
    package_id: Optional[int] = None
    destination_id: Optional[int] = None


class FavoriteOut(BaseModel):
    id: int
    traveler_id: int
    planner_id: Optional[int] = None
    package_id: Optional[int] = None
    destination_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/", response_model=FavoriteOut, status_code=status.HTTP_201_CREATED)
def add_favorite(
    payload: FavoriteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a planner, package, or destination to favorites."""
    if not any([payload.planner_id, payload.package_id, payload.destination_id]):
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of: planner_id, package_id, destination_id",
        )
    fav = Favorite(
        traveler_id=current_user.id,
        planner_id=payload.planner_id,
        package_id=payload.package_id,
        destination_id=payload.destination_id,
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


@router.get("/my", response_model=List[FavoriteOut])
def my_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all favorites for the authenticated user."""
    return (
        db.query(Favorite)
        .filter(Favorite.traveler_id == current_user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    favorite_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a favorite by ID."""
    fav = db.query(Favorite).filter(
        Favorite.id == favorite_id,
        Favorite.traveler_id == current_user.id,
    ).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite not found.")
    db.delete(fav)
    db.commit()
