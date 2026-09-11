"""
backend/api/packages.py
========================
Travel package CRUD endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from backend.database.connection import get_db
from backend.database.models import PackageItinerary, TravelPackage, PackageStatus
from backend.auth.utils import get_current_user, require_planner
from backend.database.models import User, PlannerProfile

router = APIRouter(prefix="/api/packages", tags=["Packages"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class ItineraryDayOut(BaseModel):
    day_number: int
    title: str
    description: Optional[str] = None
    activities: Optional[list] = None

    model_config = {"from_attributes": True}


class PackageOut(BaseModel):
    id: int
    planner_id: int
    destination_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    duration_days: int
    price: float
    max_travelers: int
    travel_style: Optional[str] = None
    status: str
    itinerary_days: List[ItineraryDayOut] = []

    model_config = {"from_attributes": True}


class ItineraryDayCreate(BaseModel):
    day_number: int
    title: str
    description: Optional[str] = None
    activities: Optional[List[str]] = None


class PackageCreate(BaseModel):
    destination_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    duration_days: int = 1
    price: float = 0.0
    max_travelers: int = 10
    travel_style: Optional[str] = None
    itinerary_days: Optional[List[ItineraryDayCreate]] = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[PackageOut])
def list_packages(
    destination_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    """List all active travel packages, optionally filtered by destination."""
    q = (
        db.query(TravelPackage)
        .options(joinedload(TravelPackage.itinerary_days))
        .filter(TravelPackage.status == PackageStatus.active)
    )
    if destination_id:
        q = q.filter(TravelPackage.destination_id == destination_id)
    return q.offset(skip).limit(limit).all()


@router.get("/{package_id}", response_model=PackageOut)
def get_package(package_id: int, db: Session = Depends(get_db)):
    """Get a single package with full itinerary."""
    pkg = (
        db.query(TravelPackage)
        .options(joinedload(TravelPackage.itinerary_days))
        .filter(TravelPackage.id == package_id)
        .first()
    )
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found.")
    return pkg


@router.post("/", response_model=PackageOut, status_code=status.HTTP_201_CREATED)
def create_package(
    payload: PackageCreate,
    current_user: User = Depends(require_planner),
    db: Session = Depends(get_db),
):
    """Create a new travel package (planner only)."""
    profile = db.query(PlannerProfile).filter(
        PlannerProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Planner profile not found. Create your profile first.",
        )

    pkg = TravelPackage(
        planner_id=profile.id,
        destination_id=payload.destination_id,
        title=payload.title,
        description=payload.description,
        duration_days=payload.duration_days,
        price=payload.price,
        max_travelers=payload.max_travelers,
        travel_style=payload.travel_style,
    )
    db.add(pkg)
    db.flush()  # get pkg.id before adding itinerary

    if payload.itinerary_days:
        for day in payload.itinerary_days:
            db.add(PackageItinerary(
                package_id=pkg.id,
                day_number=day.day_number,
                title=day.title,
                description=day.description,
                activities=day.activities,
            ))

    db.commit()
    db.refresh(pkg)
    return pkg
