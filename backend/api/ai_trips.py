"""
backend/api/ai_trips.py
========================
Save and retrieve AI-generated trip itineraries for authenticated users.
Does NOT replace or alter the existing AI generation logic in main.py.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models import AITrip, User
from backend.auth.utils import get_current_user

router = APIRouter(prefix="/api/ai-trips", tags=["AI Trips"])


class AITripSave(BaseModel):
    destination_name: str
    destination_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    travelers_count: int = 1
    budget: Optional[float] = None
    preferences: Optional[dict] = None
    generated_itinerary: str


class AITripOut(BaseModel):
    id: int
    traveler_id: int
    destination_name: Optional[str] = None
    destination_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    travelers_count: int
    budget: Optional[float] = None
    preferences: Optional[dict] = None
    generated_itinerary: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/save", response_model=AITripOut, status_code=status.HTTP_201_CREATED)
def save_ai_trip(
    payload: AITripSave,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save an AI-generated itinerary to the database for the authenticated user."""
    trip = AITrip(
        traveler_id=current_user.id,
        destination_id=payload.destination_id,
        destination_name=payload.destination_name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        travelers_count=payload.travelers_count,
        budget=payload.budget,
        preferences=payload.preferences,
        generated_itinerary=payload.generated_itinerary,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/my", response_model=List[AITripOut])
def my_ai_trips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all saved AI trips for the authenticated user."""
    return (
        db.query(AITrip)
        .filter(AITrip.traveler_id == current_user.id)
        .order_by(AITrip.created_at.desc())
        .all()
    )


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ai_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a saved AI trip."""
    trip = db.query(AITrip).filter(
        AITrip.id == trip_id,
        AITrip.traveler_id == current_user.id,
    ).first()
    if not trip:
        raise HTTPException(status_code=404, detail="AI trip not found.")
    db.delete(trip)
    db.commit()
