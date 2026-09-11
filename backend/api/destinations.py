"""
backend/api/destinations.py
============================
Public endpoints for browsing travel destinations.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.connection import get_db
from backend.database.models import Destination

router = APIRouter(prefix="/api/destinations", tags=["Destinations"])


class DestinationOut(BaseModel):
    id: int
    name: str
    country: str
    state: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    best_time_to_visit: Optional[str] = None
    average_budget: Optional[float] = None

    model_config = {"from_attributes": True}


@router.get("/", response_model=List[DestinationOut])
def list_destinations(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List all available travel destinations."""
    return db.query(Destination).offset(skip).limit(limit).all()


@router.get("/{destination_id}", response_model=DestinationOut)
def get_destination(destination_id: int, db: Session = Depends(get_db)):
    """Get a single destination by ID."""
    dest = db.query(Destination).filter(Destination.id == destination_id).first()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found.")
    return dest
