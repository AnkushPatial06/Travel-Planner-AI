"""
backend/api/planners.py
========================
Endpoints for browsing planners and managing planner profiles.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from backend.database.connection import get_db
from backend.database.models import PlannerDestination, PlannerProfile, User, UserRole, VerificationStatus
from backend.auth.utils import get_current_user, require_planner

router = APIRouter(prefix="/api/planners", tags=["Planners"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class PlannerProfileOut(BaseModel):
    id: int
    user_id: int
    bio: Optional[str] = None
    location: Optional[str] = None
    years_experience: int
    starting_price: float
    verification_status: str
    rating: float
    total_reviews: int
    # flattened user fields
    name: Optional[str] = None
    email: Optional[str] = None
    profile_image: Optional[str] = None
    destination_ids: List[int] = []

    model_config = {"from_attributes": True}


class PlannerProfileCreate(BaseModel):
    bio: Optional[str] = None
    location: Optional[str] = None
    years_experience: int = 0
    starting_price: float = 0.0


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[PlannerProfileOut])
def list_planners(skip: int = 0, limit: int = 30, db: Session = Depends(get_db)):
    """List all verified planners with their profiles."""
    profiles = (
        db.query(PlannerProfile)
        .options(joinedload(PlannerProfile.user), joinedload(PlannerProfile.specializations))
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for p in profiles:
        out = PlannerProfileOut(
            id=p.id,
            user_id=p.user_id,
            bio=p.bio,
            location=p.location,
            years_experience=p.years_experience,
            starting_price=p.starting_price,
            verification_status=p.verification_status.value,
            rating=p.rating,
            total_reviews=p.total_reviews,
            name=p.user.name if p.user else None,
            email=p.user.email if p.user else None,
            profile_image=p.user.profile_image if p.user else None,
            destination_ids=[s.destination_id for s in p.specializations],
        )
        result.append(out)
    return result


@router.get("/{planner_id}", response_model=PlannerProfileOut)
def get_planner(planner_id: int, db: Session = Depends(get_db)):
    """Get a single planner profile by ID."""
    p = (
        db.query(PlannerProfile)
        .options(joinedload(PlannerProfile.user), joinedload(PlannerProfile.specializations))
        .filter(PlannerProfile.id == planner_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Planner not found.")
    return PlannerProfileOut(
        id=p.id, user_id=p.user_id, bio=p.bio, location=p.location,
        years_experience=p.years_experience, starting_price=p.starting_price,
        verification_status=p.verification_status.value,
        rating=p.rating, total_reviews=p.total_reviews,
        name=p.user.name if p.user else None,
        email=p.user.email if p.user else None,
        profile_image=p.user.profile_image if p.user else None,
        destination_ids=[s.destination_id for s in p.specializations],
    )


@router.post("/profile", response_model=PlannerProfileOut, status_code=status.HTTP_201_CREATED)
def create_or_update_profile(
    payload: PlannerProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update the planner profile for the authenticated user."""
    if current_user.role not in (UserRole.planner, UserRole.package_provider, UserRole.admin):
        # Upgrade role to planner
        current_user.role = UserRole.planner
        db.add(current_user)

    profile = db.query(PlannerProfile).filter(
        PlannerProfile.user_id == current_user.id
    ).first()

    if profile:
        profile.bio = payload.bio or profile.bio
        profile.location = payload.location or profile.location
        profile.years_experience = payload.years_experience
        profile.starting_price = payload.starting_price
    else:
        profile = PlannerProfile(
            user_id=current_user.id,
            bio=payload.bio,
            location=payload.location,
            years_experience=payload.years_experience,
            starting_price=payload.starting_price,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)
    return PlannerProfileOut(
        id=profile.id, user_id=profile.user_id, bio=profile.bio,
        location=profile.location, years_experience=profile.years_experience,
        starting_price=profile.starting_price,
        verification_status=profile.verification_status.value,
        rating=profile.rating, total_reviews=profile.total_reviews,
        name=current_user.name, email=current_user.email,
        profile_image=current_user.profile_image,
        destination_ids=[s.destination_id for s in profile.specializations],
    )
