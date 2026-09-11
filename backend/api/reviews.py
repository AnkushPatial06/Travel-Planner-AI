"""
backend/api/reviews.py
=======================
Review creation and listing endpoints.
One review allowed per completed trip request.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models import Review, TripRequest, TripStatus, User
from backend.auth.utils import get_current_user

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


class ReviewCreate(BaseModel):
    planner_id: int
    package_id: Optional[int] = None
    trip_request_id: Optional[int] = None
    rating: int
    review_text: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def check_rating(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError("Rating must be between 1 and 5")
        return v


class ReviewOut(BaseModel):
    id: int
    traveler_id: int
    planner_id: int
    package_id: Optional[int] = None
    trip_request_id: Optional[int] = None
    rating: int
    review_text: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a review. One review per completed trip request."""
    # If tied to a trip, ensure it's completed and prevent duplicates
    if payload.trip_request_id:
        trip = db.query(TripRequest).filter(
            TripRequest.id == payload.trip_request_id
        ).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip request not found.")
        if trip.status != TripStatus.completed:
            raise HTTPException(
                status_code=400, detail="You can only review a completed trip."
            )
        existing = db.query(Review).filter(
            Review.trip_request_id == payload.trip_request_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=409, detail="A review already exists for this trip."
            )

    review = Review(
        traveler_id=current_user.id,
        planner_id=payload.planner_id,
        package_id=payload.package_id,
        trip_request_id=payload.trip_request_id,
        rating=payload.rating,
        review_text=payload.review_text,
    )
    db.add(review)

    # Update planner's average rating
    from backend.database.models import PlannerProfile
    profile = db.query(PlannerProfile).filter(
        PlannerProfile.user_id == payload.planner_id
    ).first()
    if profile:
        total = profile.total_reviews + 1
        profile.rating = round(
            ((profile.rating * profile.total_reviews) + payload.rating) / total, 2
        )
        profile.total_reviews = total

    db.commit()
    db.refresh(review)
    return review


@router.get("/planner/{planner_user_id}", response_model=List[ReviewOut])
def planner_reviews(planner_user_id: int, db: Session = Depends(get_db)):
    """Get all reviews for a specific planner."""
    return (
        db.query(Review)
        .filter(Review.planner_id == planner_user_id)
        .order_by(Review.created_at.desc())
        .all()
    )
