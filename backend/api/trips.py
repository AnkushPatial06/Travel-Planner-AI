"""
backend/api/trips.py
=====================
Trip request endpoints: create, list, update status.
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models import TripRequest, TripStatus, User
from backend.auth.utils import get_current_user

router = APIRouter(prefix="/api/trips", tags=["Trip Requests"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class TripRequestCreate(BaseModel):
    planner_id: Optional[int] = None
    destination_id: Optional[int] = None
    start_date: datetime
    end_date: datetime
    travelers_count: int = 1
    budget: Optional[float] = None
    travel_style: Optional[str] = None
    requirements: Optional[str] = None


class TripRequestOut(BaseModel):
    id: int
    traveler_id: int
    planner_id: Optional[int] = None
    destination_id: Optional[int] = None
    start_date: datetime
    end_date: datetime
    travelers_count: int
    budget: Optional[float] = None
    travel_style: Optional[str] = None
    requirements: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StatusUpdate(BaseModel):
    status: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/request", response_model=TripRequestOut, status_code=status.HTTP_201_CREATED)
def create_trip_request(
    payload: TripRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new trip request (traveler sends to planner)."""
    trip = TripRequest(
        traveler_id=current_user.id,
        planner_id=payload.planner_id,
        destination_id=payload.destination_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        travelers_count=payload.travelers_count,
        budget=payload.budget,
        travel_style=payload.travel_style,
        requirements=payload.requirements,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/my", response_model=List[TripRequestOut])
def my_trips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all trip requests where the user is the traveler or planner."""
    from backend.database.models import UserRole
    if current_user.role in (UserRole.planner, UserRole.package_provider, UserRole.admin):
        # Planner sees requests directed to them
        trips = db.query(TripRequest).filter(
            TripRequest.planner_id == current_user.id
        ).order_by(TripRequest.created_at.desc()).all()
    else:
        trips = db.query(TripRequest).filter(
            TripRequest.traveler_id == current_user.id
        ).order_by(TripRequest.created_at.desc()).all()
    return trips


@router.patch("/{trip_id}/status", response_model=TripRequestOut)
def update_trip_status(
    trip_id: int,
    payload: StatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the status of a trip request (planner or traveler can update)."""
    valid_statuses = {s.value for s in TripStatus}
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Choose from: {', '.join(valid_statuses)}",
        )

    trip = db.query(TripRequest).filter(TripRequest.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip request not found.")

    # Only planner (assigned to trip) or traveler (owner) can update
    if trip.planner_id != current_user.id and trip.traveler_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this trip.")

    trip.status = TripStatus(payload.status)
    db.commit()
    db.refresh(trip)
    return trip
