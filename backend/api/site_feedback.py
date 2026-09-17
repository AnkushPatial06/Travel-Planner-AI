"""
backend/api/site_feedback.py
=============================
Public "rate our website" feedback — star rating + comment, shown in the
site footer. Distinct from planner/destination Reviews (see reviews.py):
this is feedback about the website itself, not about a trip.

Submitting feedback does NOT require login (anonymous visitors are
welcome to rate the site), but if the visitor is logged in, their
account is attached and their name is used unless they override it.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models import SiteFeedback, User
from backend.auth.utils import get_current_user_optional

router = APIRouter(prefix="/api/site-feedback", tags=["Site Feedback"])


class SiteFeedbackCreate(BaseModel):
    rating: int
    comment: str
    name: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def check_rating(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError("Rating must be between 1 and 5")
        return v

    @field_validator("comment")
    @classmethod
    def check_comment(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        if len(v) > 500:
            raise ValueError("Comment must be 500 characters or fewer")
        return v


class SiteFeedbackOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    name: Optional[str] = None
    rating: int
    comment: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/", response_model=SiteFeedbackOut, status_code=status.HTTP_201_CREATED)
def create_site_feedback(
    payload: SiteFeedbackCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Submit website feedback. Works whether or not the visitor is logged in."""
    display_name = payload.name or (current_user.name if current_user else None) or "Anonymous traveler"

    feedback = SiteFeedback(
        user_id=current_user.id if current_user else None,
        name=display_name,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/", response_model=List[SiteFeedbackOut])
def list_site_feedback(
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Public — most recent feedback first, for the footer reviews strip."""
    return (
        db.query(SiteFeedback)
        .order_by(SiteFeedback.created_at.desc())
        .limit(limit)
        .all()
    )
