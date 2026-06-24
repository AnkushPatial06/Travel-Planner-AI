from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class FlightRequest(BaseModel):
    origin: str
    destination: str
    outbound_date: str
    return_date: str

class HotelRequest(BaseModel):
    location: str
    check_in_date: str
    check_out_date: str

class ItineraryRequest(BaseModel):
    destination: str
    check_in_date: str
    check_out_date: str
    flights: str
    hotels: str

class FlightInfo(BaseModel):
    airline: str
    price: str
    duration: str
    stops: str
    departure: str
    arrival: str
    travel_class: str
    return_date: str
    airline_logo: str

class HotelInfo(BaseModel):
    name: str
    price: str
    rating: float
    location: str
    link: str
    image: str = ""


class AIResponse(BaseModel):
    flights: List[FlightInfo] = Field(default_factory=list)
    hotels: List[HotelInfo] = Field(default_factory=list)
    ai_flight_recommendation: str = ""
    ai_hotel_recommendation: str = ""
    itinerary: str = ""


# ── Chat Models ────────────────────────────────────────────

class ChatMessage(BaseModel):
    """A single message in the conversation history."""
    role: str          # 'user' or 'assistant'
    content: str


class TripContext(BaseModel):
    """Snapshot of the user's current trip, sent with every chat request."""
    origin:                   Optional[str]            = None
    destination:              Optional[str]            = None
    outbound_date:            Optional[str]            = None
    return_date:              Optional[str]            = None
    budget:                   Optional[float]          = None
    trip_nights:              Optional[int]            = None
    selected_flight:          Optional[Dict[str, Any]] = None   # {airline, price}
    selected_hotel:           Optional[Dict[str, Any]] = None   # {name, pricePerNight, totalPrice}
    available_flights:        Optional[List[Dict]]     = None   # summary list
    available_hotels:         Optional[List[Dict]]     = None   # summary list
    itinerary:                Optional[str]            = None
    ai_flight_recommendation: Optional[str]            = None
    ai_hotel_recommendation:  Optional[str]            = None
    total_flight_cost:        Optional[float]          = None
    total_hotel_cost:         Optional[float]          = None
    total_spent:              Optional[float]          = None
    remaining_budget:         Optional[float]          = None


class ChatRequest(BaseModel):
    """Incoming payload for /chat/ endpoint."""
    message: str
    context: TripContext = Field(default_factory=TripContext)
    history: List[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """Response from /chat/ endpoint."""
    reply: str
