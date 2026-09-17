from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from backend.database.connection import get_db
from backend.database.models import User, DestinationBlog, Destination, UserRole
from backend.auth.utils import get_current_user

router = APIRouter()

class UserOut(BaseModel):
    id: int
    name: str
    profile_image: str | None = None

    class Config:
        from_attributes = True

class BlogCreate(BaseModel):
    destination_id: int
    title: str
    content: str
    image_url: str | None = None

class BlogOut(BaseModel):
    id: int
    destination_id: int
    author: UserOut
    title: str
    content: str
    image_url: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/destination/{destination_id}", response_model=List[BlogOut])
def get_destination_blogs(destination_id: int, db: Session = Depends(get_db)):
    """Get all blogs for a specific destination."""
    blogs = db.query(DestinationBlog).filter(DestinationBlog.destination_id == destination_id).order_by(DestinationBlog.created_at.desc()).all()
    return blogs


@router.post("/", response_model=BlogOut)
def create_blog(blog: BlogCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new blog (only for planners, package_providers, or admins)."""
    if current_user.role not in [UserRole.planner, UserRole.package_provider, UserRole.admin]:
        raise HTTPException(status_code=403, detail="Not authorized to create blogs.")
        
    destination = db.query(Destination).filter(Destination.id == blog.destination_id).first()
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found.")
        
    new_blog = DestinationBlog(
        destination_id=blog.destination_id,
        author_id=current_user.id,
        title=blog.title,
        content=blog.content,
        image_url=blog.image_url
    )
    db.add(new_blog)
    db.commit()
    db.refresh(new_blog)
    return new_blog

