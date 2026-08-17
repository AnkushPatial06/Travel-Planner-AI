"""
budget_service.py
=================
Analyzes a user's trip budget against actual fetched flight and hotel prices.
Produces a structured BudgetAnalysis with cost breakdown, status classification,
and optimization suggestions.
"""

from backend.config import logger
from backend.models import BudgetAnalysis, BudgetRequest, CostBreakdown


# =====================================================================
# COST ESTIMATION CONSTANTS (fraction of base travel cost)
# =====================================================================

FOOD_RATIO          = 0.18   # Food = 18% of total stay cost per night (rough estimate)
TRANSPORT_RATIO     = 0.08   # Local transport = 8% of (flight + hotel)
ACTIVITIES_RATIO    = 0.12   # Activities = 12% of (flight + hotel)
EMERGENCY_RATIO     = 0.10   # Emergency reserve = 10% of total estimated cost


def _parse_price(val) -> float:
    """Parse a price string like '₹5,200' or '5200' into a float."""
    if val is None:
        return 0.0
    s = str(val).replace(",", "").replace("₹", "").replace("INR", "").strip()
    # Remove any non-numeric chars except dot
    cleaned = "".join(c for c in s if c.isdigit() or c == ".")
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def analyze_budget(request: BudgetRequest) -> BudgetAnalysis:
    """
    Calculate trip cost breakdown and budget status.

    Cost logic:
      - Flights:      cheapest available flight price (or 0 if none)
      - Hotels:       cheapest per-night price × trip_nights (or 0 if none)
      - Food:         FOOD_RATIO × hotel_cost_per_night × nights
      - Transport:    TRANSPORT_RATIO × (flights + hotels)
      - Activities:   ACTIVITIES_RATIO × (flights + hotels)
      - Emergency:    EMERGENCY_RATIO × subtotal
    """
    logger.info(
        "Budget analysis: budget=%.0f, nights=%d, flights=%d, hotels=%d",
        request.user_budget, request.trip_nights,
        len(request.flights), len(request.hotels),
    )

    nights = max(request.trip_nights, 1)

    # ── Flight cost ──────────────────────────────────────────────────
    flight_prices = [_parse_price(f.get("price")) for f in request.flights if f.get("price")]
    flight_cost = min(flight_prices) if flight_prices else 0.0

    # ── Hotel cost ───────────────────────────────────────────────────
    hotel_prices = [_parse_price(h.get("price")) for h in request.hotels if h.get("price")]
    hotel_per_night = min(hotel_prices) if hotel_prices else 0.0
    hotel_cost = hotel_per_night * nights

    # ── Derived costs ────────────────────────────────────────────────
    base_cost   = flight_cost + hotel_cost
    food_cost   = round(hotel_per_night * FOOD_RATIO * nights, 0) if hotel_per_night else round(base_cost * 0.10, 0)
    transport   = round(base_cost * TRANSPORT_RATIO, 0)
    activities  = round(base_cost * ACTIVITIES_RATIO, 0)
    subtotal    = base_cost + food_cost + transport + activities
    emergency   = round(subtotal * EMERGENCY_RATIO, 0)
    total       = subtotal + emergency

    # ── Classification ───────────────────────────────────────────────
    budget = request.user_budget
    remaining = budget - total

    if remaining > budget * 0.15:
        status = "UNDER_BUDGET"
        emoji  = "✅"
    elif remaining >= 0:
        status = "WITHIN_BUDGET"
        emoji  = "⚠️"
    else:
        status = "OVER_BUDGET"
        emoji  = "❌"

    # ── Optimization suggestions ─────────────────────────────────────
    suggestions = _build_suggestions(
        status=status,
        remaining=remaining,
        budget=budget,
        flights=request.flights,
        hotels=request.hotels,
        flight_cost=flight_cost,
        hotel_cost=hotel_per_night,
        nights=nights,
    )

    logger.info(
        "Budget result: total=%.0f, status=%s, remaining=%.0f",
        total, status, remaining,
    )

    return BudgetAnalysis(
        user_budget=budget,
        estimated_total_cost=total,
        remaining_budget=remaining,
        budget_status=status,
        budget_status_emoji=emoji,
        cost_breakdown=CostBreakdown(
            flights=flight_cost,
            hotels=hotel_cost,
            food=food_cost,
            transportation=transport,
            activities=activities,
            emergency_reserve=emergency,
        ),
        optimization_suggestions=suggestions,
        ai_budget_analysis="",   # Will be populated by AI agent
    )


def _build_suggestions(
    status: str,
    remaining: float,
    budget: float,
    flights: list,
    hotels: list,
    flight_cost: float,
    hotel_cost: float,
    nights: int,
) -> list[str]:
    """Build specific, data-driven optimization suggestions."""
    suggestions: list[str] = []

    if status == "UNDER_BUDGET":
        surplus = remaining
        suggestions.append(
            f"You're within budget with ₹{surplus:,.0f} to spare — "
            "consider upgrading to a better hotel or premium flight class for more comfort."
        )
        if surplus > budget * 0.25:
            suggestions.append("Your surplus is large enough to add an extra travel day or book guided tours.")
        return suggestions

    if status == "WITHIN_BUDGET":
        suggestions.append("Your budget is tight. Avoid unplanned expenses by booking activities in advance.")
        suggestions.append("Consider using the emergency reserve only for genuine emergencies.")
        return suggestions

    # OVER_BUDGET — targeted suggestions
    overage = abs(remaining)

    # 1. Flight alternatives
    flight_prices = sorted(
        [(_parse_price(f.get("price")), f.get("airline", "Unknown")) for f in flights if f.get("price")],
        key=lambda x: x[0]
    )
    if len(flight_prices) > 1:
        cheapest_price, cheapest_airline = flight_prices[0]
        if cheapest_price < flight_cost:
            savings = flight_cost - cheapest_price
            suggestions.append(
                f"Switch to {cheapest_airline} (₹{cheapest_price:,.0f}) instead of the current selection — "
                f"saves ₹{savings:,.0f} on flights."
            )

    # 2. Hotel alternatives
    hotel_prices = sorted(
        [(_parse_price(h.get("price")), h.get("name", "Unknown")) for h in hotels if h.get("price")],
        key=lambda x: x[0]
    )
    if len(hotel_prices) > 1:
        cheapest_hotel_price, cheapest_hotel_name = hotel_prices[0]
        if cheapest_hotel_price < hotel_cost:
            hotel_savings = (hotel_cost - cheapest_hotel_price) * nights
            suggestions.append(
                f"Switch to {cheapest_hotel_name} (₹{cheapest_hotel_price:,.0f}/night) — "
                f"saves ₹{hotel_savings:,.0f} for {nights} night(s)."
            )

    # 3. General over-budget suggestions
    if overage > budget * 0.30:
        suggestions.append(
            "Consider reducing the trip duration by 1–2 days to significantly cut hotel and food costs."
        )
    suggestions.append(
        "Use public transport (metro, buses) instead of taxis to save 40–60% on local transportation."
    )
    if overage > 5000:
        suggestions.append(
            "Eat at local restaurants and street food spots — typically 3–4x cheaper than hotel dining."
        )
    suggestions.append(
        "Prioritize the top 2–3 must-see attractions and skip expensive tourist traps to cut activity costs."
    )
    if overage > budget * 0.20:
        suggestions.append(
            "Consider alternate travel dates — mid-week flights and off-season hotels are often significantly cheaper."
        )

    return suggestions
