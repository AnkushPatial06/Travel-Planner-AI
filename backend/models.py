from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# ── Flight Models ─────────────────────────────────────────────────────

class FlightRequest(BaseModel):
    origin: str
    destination: str
    outbound_date: str
    return_date: str
    budget: Optional[float] = None
    preferences: Optional[str] = None

class FlightInfo(BaseModel):
    airline: str
    price: str
    duration: str
    stops: str
    departure: str
    arrival: str
    departure_time: str = ""   # Clean time-only: "10:05 AM"
    arrival_time: str = ""     # Clean time-only: "01:45 PM"
    travel_class: str
    return_date: str
    airline_logo: str

# ── Hotel Models ──────────────────────────────────────────────────────

class HotelRequest(BaseModel):
    location: str
    check_in_date: str
    check_out_date: str

class HotelInfo(BaseModel):
    name: str
    price: str
    rating: float
    location: str
    link: str
    image: str = ""

# ── Itinerary Models ──────────────────────────────────────────────────

class ItineraryRequest(BaseModel):
    destination: str
    check_in_date: str
    check_out_date: str
    flights: str
    hotels: str
    budget: Optional[float] = None
    preferences: Optional[str] = None

# ── Weather Models ────────────────────────────────────────────────────

class WeatherRequest(BaseModel):
    destination: str
    start_date: str
    end_date: str
    preferences: Optional[str] = None

class DailyForecast(BaseModel):
    date: str
    condition: str
    temp_max: float
    temp_min: float
    rain_probability: float
    rainfall_mm: float
    humidity: float
    wind_speed_kmh: float
    visibility_km: float
    icon: str = "☀️"

class WeatherAlert(BaseModel):
    type: str          # "STORM" | "HEAT" | "COLD" | "HEAVY_RAIN" | "EXTREME_WIND"
    severity: str      # "WARNING" | "WATCH" | "ADVISORY"
    message: str
    dates: List[str] = Field(default_factory=list)

class WeatherAnalysis(BaseModel):
    destination: str = ""
    risk_level: str = "LOW"          # "LOW" | "MEDIUM" | "HIGH"
    risk_emoji: str = "🟢"
    overall_condition: str = ""
    temperature_range: str = ""
    current_temp: float = 0.0
    feels_like: float = 0.0
    humidity: float = 0.0
    wind_speed_kmh: float = 0.0
    avg_rain_probability: float = 0.0
    alerts: List[WeatherAlert] = Field(default_factory=list)
    daily_forecast: List[DailyForecast] = Field(default_factory=list)
    ai_weather_summary: str = ""         # Narrative from AI agent
    travel_recommendation: str = ""      # AI structured recommendation
    safe_activities: List[str] = Field(default_factory=list)
    activities_to_avoid: List[str] = Field(default_factory=list)
    best_travel_times: List[str] = Field(default_factory=list)
    packing_recommendations: List[str] = Field(default_factory=list)
    transport_warnings: List[str] = Field(default_factory=list)

# ── Budget Models ─────────────────────────────────────────────────────

class BudgetRequest(BaseModel):
    user_budget: float
    destination: str
    trip_nights: int
    flights: List[Dict[str, Any]] = Field(default_factory=list)
    hotels: List[Dict[str, Any]] = Field(default_factory=list)
    preferences: Optional[str] = None

class CostBreakdown(BaseModel):
    flights: float = 0.0
    hotels: float = 0.0
    food: float = 0.0
    transportation: float = 0.0
    activities: float = 0.0
    emergency_reserve: float = 0.0

class BudgetAnalysis(BaseModel):
    user_budget: float = 0.0
    estimated_total_cost: float = 0.0
    remaining_budget: float = 0.0
    budget_status: str = "WITHIN_BUDGET"   # "UNDER_BUDGET" | "WITHIN_BUDGET" | "OVER_BUDGET"
    budget_status_emoji: str = "✅"
    cost_breakdown: CostBreakdown = Field(default_factory=CostBreakdown)
    optimization_suggestions: List[str] = Field(default_factory=list)
    ai_budget_analysis: str = ""

# ── Travel Score Models ───────────────────────────────────────────────

class ScoreFactor(BaseModel):
    name: str
    score: int
    max_score: int
    description: str

class TravelScore(BaseModel):
    total_score: int = 0         # 0–100
    grade: str = "B"             # A / B / C / D / F
    grade_label: str = ""        # "Excellent" / "Good" / etc.
    factors: List[ScoreFactor] = Field(default_factory=list)
    ai_explanation: str = ""
    overall_verdict: str = ""    # "Safe to travel" | "Travel with precautions" | etc.

# ── Composite AI Response ─────────────────────────────────────────────

class AIResponse(BaseModel):
    flights: List[FlightInfo] = Field(default_factory=list)
    hotels: List[HotelInfo] = Field(default_factory=list)
    ai_flight_recommendation: str = ""
    ai_hotel_recommendation: str = ""
    itinerary: str = ""
    weather_analysis: Optional[WeatherAnalysis] = None
    budget_analysis: Optional[BudgetAnalysis] = None
    travel_score: Optional[TravelScore] = None

# ── Chat Models ───────────────────────────────────────────────────────

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
    selected_flight:          Optional[Dict[str, Any]] = None
    selected_hotel:           Optional[Dict[str, Any]] = None
    available_flights:        Optional[List[Dict]]     = None
    available_hotels:         Optional[List[Dict]]     = None
    itinerary:                Optional[str]            = None
    ai_flight_recommendation: Optional[str]            = None
    ai_hotel_recommendation:  Optional[str]            = None
    total_flight_cost:        Optional[float]          = None
    total_hotel_cost:         Optional[float]          = None
    total_spent:              Optional[float]          = None
    remaining_budget:         Optional[float]          = None
    # New weather + budget context for chat
    weather_risk_level:       Optional[str]            = None
    weather_summary:          Optional[str]            = None
    budget_status:            Optional[str]            = None
    travel_score:             Optional[int]            = None


class ChatRequest(BaseModel):
    """Incoming payload for /chat/ endpoint."""
    message: str
    context: TripContext = Field(default_factory=TripContext)
    history: List[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """Response from /chat/ endpoint."""
    reply: str
