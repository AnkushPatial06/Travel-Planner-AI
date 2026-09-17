"""
backend/database/models.py
============================
All 10 SQLAlchemy ORM models for the Travel Planner application.
Uses proper PKs, FKs, relationships, unique constraints, indexes, and timestamps.
"""

import enum
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    CheckConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from backend.database.connection import Base


# ── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    traveler = "traveler"
    planner = "planner"
    package_provider = "package_provider"
    admin = "admin"


class VerificationStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class TripStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class PackageStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    draft = "draft"


# ── Helper: automatic timestamps ─────────────────────────────────────────────

def _now():
    return datetime.utcnow()


# ══════════════════════════════════════════════════════════════════════════════
# 1. User
# ══════════════════════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    name = Column(
        String(120),
        nullable=False
    )

    email = Column(
        String(255),
        nullable=False,
        unique=True,
        index=True
    )

    phone = Column(
        String(20),
        nullable=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    role = Column(
        Enum(UserRole),
        nullable=False,
        default=UserRole.traveler
    )

    profile_image = Column(
        String(500),
        nullable=True
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=_now,
        nullable=False
    )

    updated_at = Column(
        DateTime,
        default=_now,
        onupdate=_now,
        nullable=False
    )

    # ── Relationships ────────────────────────────────────────────────────────

    planner_profile = relationship(
        "PlannerProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    trip_requests_as_traveler = relationship(
        "TripRequest",
        foreign_keys="TripRequest.traveler_id",
        back_populates="traveler"
    )

    trip_requests_as_planner = relationship(
        "TripRequest",
        foreign_keys="TripRequest.planner_id",
        back_populates="planner"
    )

    reviews_given = relationship(
        "Review",
        foreign_keys="Review.traveler_id",
        back_populates="traveler"
    )

    reviews_received = relationship(
        "Review",
        foreign_keys="Review.planner_id",
        back_populates="planner"
    )

    # IMPORTANT:
    # Favorite has TWO foreign keys to users.id:
    #   Favorite.traveler_id
    #   Favorite.planner_id
    #
    # Therefore SQLAlchemy needs us to explicitly tell it which one
    # belongs to User.favorites.
    favorites = relationship(
        "Favorite",
        foreign_keys="Favorite.traveler_id",
        back_populates="traveler",
        cascade="all, delete-orphan"
    )

    ai_trips = relationship(
        "AITrip",
        back_populates="traveler",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User id={self.id} email={self.email} role={self.role}>"


# ══════════════════════════════════════════════════════════════════════════════
# 2. PlannerProfile
# ══════════════════════════════════════════════════════════════════════════════

class PlannerProfile(Base):
    __tablename__ = "planner_profiles"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )

    bio = Column(
        Text,
        nullable=True
    )

    location = Column(
        String(200),
        nullable=True
    )

    years_experience = Column(
        Integer,
        default=0,
        nullable=False
    )

    starting_price = Column(
        Float,
        default=0.0,
        nullable=False
    )

    verification_status = Column(
        Enum(VerificationStatus),
        default=VerificationStatus.pending,
        nullable=False
    )

    rating = Column(
        Float,
        default=0.0,
        nullable=False
    )

    total_reviews = Column(
        Integer,
        default=0,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=_now,
        nullable=False
    )

    updated_at = Column(
        DateTime,
        default=_now,
        onupdate=_now,
        nullable=False
    )

    # Relationships

    user = relationship(
        "User",
        back_populates="planner_profile"
    )

    packages = relationship(
        "TravelPackage",
        back_populates="planner_profile"
    )

    specializations = relationship(
        "PlannerDestination",
        back_populates="planner",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<PlannerProfile id={self.id} user_id={self.user_id}>"


# ══════════════════════════════════════════════════════════════════════════════
# 3. Destination
# ══════════════════════════════════════════════════════════════════════════════

class Destination(Base):
    __tablename__ = "destinations"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    name = Column(
        String(200),
        nullable=False,
        index=True
    )

    country = Column(
        String(100),
        nullable=False,
        default="India"
    )

    state = Column(
        String(100),
        nullable=True
    )

    description = Column(
        Text,
        nullable=True
    )

    image = Column(
        String(500),
        nullable=True
    )

    best_time_to_visit = Column(
        String(200),
        nullable=True
    )

    average_budget = Column(
        Float,
        nullable=True
    )

    attractions = Column(JSON, nullable=True)
    activities = Column(JSON, nullable=True)
    travel_tips = Column(JSON, nullable=True)
    images = Column(JSON, nullable=True)

    created_at = Column(
        DateTime,
        default=_now,
        nullable=False
    )

    updated_at = Column(
        DateTime,
        default=_now,
        onupdate=_now,
        nullable=False
    )

    # Relationships

    planner_specializations = relationship(
        "PlannerDestination",
        back_populates="destination",
        cascade="all, delete-orphan"
    )

    packages = relationship(
        "TravelPackage",
        back_populates="destination"
    )

    trip_requests = relationship(
        "TripRequest",
        back_populates="destination"
    )

    ai_trips = relationship(
        "AITrip",
        back_populates="destination"
    )

    favorites = relationship(
        "Favorite",
        back_populates="destination"
    )

    def __repr__(self):
        return f"<Destination id={self.id} name={self.name}>"


# ══════════════════════════════════════════════════════════════════════════════
# 4. PlannerDestination
# ══════════════════════════════════════════════════════════════════════════════

class PlannerDestination(Base):
    __tablename__ = "planner_destinations"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    planner_id = Column(
        BigInteger,
        ForeignKey(
            "planner_profiles.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    destination_id = Column(
        BigInteger,
        ForeignKey(
            "destinations.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "planner_id",
            "destination_id",
            name="uq_planner_destination"
        ),

        Index(
            "ix_pd_planner",
            "planner_id"
        ),

        Index(
            "ix_pd_destination",
            "destination_id"
        ),
    )

    # Relationships

    planner = relationship(
        "PlannerProfile",
        back_populates="specializations"
    )

    destination = relationship(
        "Destination",
        back_populates="planner_specializations"
    )


# ══════════════════════════════════════════════════════════════════════════════
# 5. TravelPackage
# ══════════════════════════════════════════════════════════════════════════════

class TravelPackage(Base):
    __tablename__ = "travel_packages"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    planner_id = Column(
        BigInteger,
        ForeignKey(
            "planner_profiles.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    destination_id = Column(
        BigInteger,
        ForeignKey(
            "destinations.id",
            ondelete="SET NULL"
        ),
        nullable=True,
        index=True
    )

    title = Column(
        String(300),
        nullable=False
    )

    description = Column(
        Text,
        nullable=True
    )

    duration_days = Column(
        Integer,
        nullable=False,
        default=1
    )

    price = Column(
        Float,
        nullable=False,
        default=0.0
    )

    max_travelers = Column(
        Integer,
        nullable=False,
        default=10
    )

    travel_style = Column(
        String(100),
        nullable=True
    )

    hotels = Column(JSON, nullable=True)
    activities = Column(JSON, nullable=True)
    images = Column(JSON, nullable=True)
    inclusions = Column(JSON, nullable=True)
    exclusions = Column(JSON, nullable=True)
    availability = Column(JSON, nullable=True)

    status = Column(
        Enum(PackageStatus),
        default=PackageStatus.active,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=_now,
        nullable=False
    )

    updated_at = Column(
        DateTime,
        default=_now,
        onupdate=_now,
        nullable=False
    )

    # Relationships

    planner_profile = relationship(
        "PlannerProfile",
        back_populates="packages"
    )

    destination = relationship(
        "Destination",
        back_populates="packages"
    )

    itinerary_days = relationship(
        "PackageItinerary",
        back_populates="package",
        cascade="all, delete-orphan",
        order_by="PackageItinerary.day_number"
    )

    reviews = relationship(
        "Review",
        back_populates="package"
    )

    favorites = relationship(
        "Favorite",
        back_populates="package"
    )

    def __repr__(self):
        return f"<TravelPackage id={self.id} title={self.title}>"


# ══════════════════════════════════════════════════════════════════════════════
# 6. PackageItinerary
# ══════════════════════════════════════════════════════════════════════════════

class PackageItinerary(Base):
    __tablename__ = "package_itineraries"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    package_id = Column(
        BigInteger,
        ForeignKey(
            "travel_packages.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    day_number = Column(
        Integer,
        nullable=False
    )

    title = Column(
        String(300),
        nullable=False
    )

    description = Column(
        Text,
        nullable=True
    )

    activities = Column(
        JSON,
        nullable=True
    )

    __table_args__ = (
        UniqueConstraint(
            "package_id",
            "day_number",
            name="uq_package_day"
        ),
    )

    # Relationships

    package = relationship(
        "TravelPackage",
        back_populates="itinerary_days"
    )

    def __repr__(self):
        return f"<PackageItinerary package={self.package_id} day={self.day_number}>"


# ══════════════════════════════════════════════════════════════════════════════
# 7. TripRequest
# ══════════════════════════════════════════════════════════════════════════════

class TripRequest(Base):
    __tablename__ = "trip_requests"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    traveler_id = Column(
        BigInteger,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    planner_id = Column(
        BigInteger,
        ForeignKey(
            "users.id",
            ondelete="SET NULL"
        ),
        nullable=True,
        index=True
    )

    destination_id = Column(
        BigInteger,
        ForeignKey(
            "destinations.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    start_date = Column(
        DateTime,
        nullable=False
    )

    end_date = Column(
        DateTime,
        nullable=False
    )

    travelers_count = Column(
        Integer,
        default=1,
        nullable=False
    )

    budget = Column(
        Float,
        nullable=True
    )

    travel_style = Column(
        String(100),
        nullable=True
    )

    requirements = Column(
        Text,
        nullable=True
    )

    status = Column(
        Enum(TripStatus),
        default=TripStatus.pending,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=_now,
        nullable=False
    )

    updated_at = Column(
        DateTime,
        default=_now,
        onupdate=_now,
        nullable=False
    )

    __table_args__ = (
        Index(
            "ix_tr_status",
            "status"
        ),
    )

    # Relationships

    traveler = relationship(
        "User",
        foreign_keys=[traveler_id],
        back_populates="trip_requests_as_traveler"
    )

    planner = relationship(
        "User",
        foreign_keys=[planner_id],
        back_populates="trip_requests_as_planner"
    )

    destination = relationship(
        "Destination",
        back_populates="trip_requests"
    )

    review = relationship(
        "Review",
        back_populates="trip_request",
        uselist=False
    )

    def __repr__(self):
        return f"<TripRequest id={self.id} status={self.status}>"


# ══════════════════════════════════════════════════════════════════════════════
# 8. Review
# ══════════════════════════════════════════════════════════════════════════════

class Review(Base):
    __tablename__ = "reviews"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    traveler_id = Column(
        BigInteger,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    planner_id = Column(
        BigInteger,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=True,
        index=True
    )

    package_id = Column(
        BigInteger,
        ForeignKey(
            "travel_packages.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    destination_id = Column(
        BigInteger,
        ForeignKey(
            "destinations.id",
            ondelete="SET NULL"
        ),
        nullable=True,
        index=True
    )

    trip_request_id = Column(
        BigInteger,
        ForeignKey(
            "trip_requests.id",
            ondelete="SET NULL"
        ),
        nullable=True,
        unique=True
    )

    rating = Column(
        Integer,
        nullable=False
    )

    review_text = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=_now,
        nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_rating_range"
        ),

        Index(
            "ix_review_planner",
            "planner_id"
        ),
    )

    # Relationships

    traveler = relationship(
        "User",
        foreign_keys=[traveler_id],
        back_populates="reviews_given"
    )

    planner = relationship(
        "User",
        foreign_keys=[planner_id],
        back_populates="reviews_received"
    )

    package = relationship(
        "TravelPackage",
        back_populates="reviews"
    )

    destination = relationship("Destination")

    trip_request = relationship(
        "TripRequest",
        back_populates="review"
    )

    def __repr__(self):
        return f"<Review id={self.id} rating={self.rating}>"


# ══════════════════════════════════════════════════════════════════════════════
# 9. Favorite
# ══════════════════════════════════════════════════════════════════════════════

class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    traveler_id = Column(
        BigInteger,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    planner_id = Column(
        BigInteger,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=True
    )

    package_id = Column(
        BigInteger,
        ForeignKey(
            "travel_packages.id",
            ondelete="CASCADE"
        ),
        nullable=True
    )

    destination_id = Column(
        BigInteger,
        ForeignKey(
            "destinations.id",
            ondelete="CASCADE"
        ),
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=_now,
        nullable=False
    )

    __table_args__ = (
        Index(
            "ix_fav_traveler",
            "traveler_id"
        ),
    )

    # Relationships

    # Favorite.traveler uses traveler_id
    traveler = relationship(
        "User",
        foreign_keys=[traveler_id],
        back_populates="favorites"
    )

    # Favorite.planner uses planner_id
    #
    # This explicit foreign_keys declaration is important because
    # both traveler_id and planner_id point to users.id.
    planner = relationship(
        "User",
        foreign_keys=[planner_id]
    )

    package = relationship(
        "TravelPackage",
        back_populates="favorites"
    )

    destination = relationship(
        "Destination",
        back_populates="favorites"
    )

    def __repr__(self):
        return f"<Favorite id={self.id} traveler={self.traveler_id}>"


# ══════════════════════════════════════════════════════════════════════════════
# 10. AITrip
# ══════════════════════════════════════════════════════════════════════════════

class AITrip(Base):
    __tablename__ = "ai_trips"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    traveler_id = Column(
        BigInteger,
        ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        index=True
    )

    destination_id = Column(
        BigInteger,
        ForeignKey(
            "destinations.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    destination_name = Column(
        String(200),
        nullable=True
    )

    start_date = Column(
        DateTime,
        nullable=True
    )

    end_date = Column(
        DateTime,
        nullable=True
    )

    travelers_count = Column(
        Integer,
        default=1,
        nullable=False
    )

    budget = Column(
        Float,
        nullable=True
    )

    preferences = Column(
        JSON,
        nullable=True
    )

    generated_itinerary = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=_now,
        nullable=False
    )

    __table_args__ = (
        Index(
            "ix_aitrip_traveler",
            "traveler_id"
        ),
    )

    # Relationships

    traveler = relationship(
        "User",
        back_populates="ai_trips"
    )

    destination = relationship(
        "Destination",
        back_populates="ai_trips"
    )

    def __repr__(self):
        return f"<AITrip id={self.id} dest={self.destination_name}>"
# ------------------------------------------------------------------------------
# 11. ChatRoom
# ------------------------------------------------------------------------------

class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    traveler_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    planner_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("traveler_id", "planner_id", name="uq_chat_room_traveler_planner"),
        Index("ix_chat_room_traveler", "traveler_id"),
        Index("ix_chat_room_planner", "planner_id"),
    )

    traveler = relationship("User", foreign_keys=[traveler_id])
    planner = relationship("User", foreign_keys=[planner_id])
    messages = relationship("ChatMessage", back_populates="room", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

# ------------------------------------------------------------------------------
# 12. ChatMessage
# ------------------------------------------------------------------------------

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    room_id = Column(BigInteger, ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        Index("ix_chat_msg_room", "room_id"),
        Index("ix_chat_msg_created", "created_at"),
    )

    room = relationship("ChatRoom", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])

# ------------------------------------------------------------------------------
# 13. DestinationBlog
# ------------------------------------------------------------------------------

class DestinationBlog(Base):
    __tablename__ = "destination_blogs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    destination_id = Column(BigInteger, ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    __table_args__ = (
        Index("ix_blog_destination", "destination_id"),
        Index("ix_blog_author", "author_id"),
    )

    destination = relationship("Destination")
    author = relationship("User", foreign_keys=[author_id])


# ------------------------------------------------------------------------------
# 14. SiteFeedback
# ------------------------------------------------------------------------------

class SiteFeedback(Base):
    """Public 'rate our website' feedback — separate from planner/destination
    Reviews above. Submission does not require login (user_id is nullable)."""
    __tablename__ = "site_feedback"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name = Column(String(120), nullable=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_site_feedback_rating_range"),
        Index("ix_site_feedback_created", "created_at"),
    )

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<SiteFeedback id={self.id} rating={self.rating}>"
