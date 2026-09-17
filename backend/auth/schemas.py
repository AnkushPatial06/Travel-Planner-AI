"""
backend/auth/schemas.py
========================
Pydantic request/response schemas for authentication endpoints.
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


class SignupRequest(BaseModel):
    name:     str
    email:    EmailStr
    password: str
    phone:    Optional[str] = None
    role:     Optional[str] = "traveler"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("traveler", "planner", "package_provider", "admin"):
            raise ValueError("Role must be traveler, planner, package_provider, or admin")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class UserResponse(BaseModel):
    id:            int
    name:          str
    email:         str
    role:          str
    phone:         Optional[str] = None
    profile_image: Optional[str] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserResponse
