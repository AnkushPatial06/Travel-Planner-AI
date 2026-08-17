import asyncio
from datetime import datetime
from functools import lru_cache
from typing import List, Dict, Any, Optional
import crewai.llms.cache as _crewai_cache
_crewai_cache.mark_cache_breakpoint = lambda msg: msg

import litellm
from crewai import Agent, Crew, Process, Task, LLM

from backend.config import settings, logger
from backend.models import (
    BudgetAnalysis,
    FlightInfo,
    HotelInfo,
    ScoreFactor,
    TravelScore,
    WeatherAnalysis,
)


# =====================================================================
# LLM INITIALIZER
# =====================================================================

@lru_cache(maxsize=1)
def initialize_llm():
    logger.info("Initializing LLM: model=%s", settings.groq_model)
    return LLM(
        model=settings.groq_model,
        api_key=settings.groq_api_key,
    )


# =====================================================================
# AI TRAVEL RECOMMENDATIONS
# =====================================================================

RECOMMENDATION_PROMPTS = {
    "flights": {
        "role": "AI Flight Analyst",
        "goal": "Recommend the best flight by comparing price, duration, stops, and convenience.",
        "backstory": "A travel analyst that compares flight options for real travelers.",
        "description": """
Review the flight options below and recommend the best one.

Explain the choice using:
- Price value
- Total travel time
- Stops and layover convenience
- Travel class and comfort

Do not repeat every flight detail. Give a practical recommendation a traveler can act on.
""",
    },
    "hotels": {
        "role": "AI Hotel Analyst",
        "goal": "Recommend the best hotel by comparing price, rating, location, and guest value.",
        "backstory": "A hotel analyst that balances comfort, price, and location.",
        "description": """
Review the hotel options below and recommend the best one.

Explain the choice using:
- Price value
- Rating and guest confidence
- Location convenience
- Overall fit for the trip

Compare against the other options briefly and make the recommendation easy to understand.
""",
    },
}


async def get_ai_recommendation(data_type: str, formatted_data: str) -> str:
    logger.info("Getting %s analysis from AI", data_type)

    prompt = RECOMMENDATION_PROMPTS.get(data_type)
    if prompt is None:
        raise ValueError("Invalid data type for AI recommendation")

    agent = Agent(
        role=prompt["role"],
        goal=prompt["goal"],
        backstory=prompt["backstory"],
        llm=initialize_llm(),
        verbose=False,
    )

    task = Task(
        description=f"{prompt['description']}\n\nData to analyze:\n{formatted_data}",
        agent=agent,
        expected_output=f"A concise, data-driven {data_type} recommendation.",
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
    )

    try:
        result = await asyncio.to_thread(crew.kickoff)
        return _stringify_crew_result(result, prompt["role"])
    except Exception as e:
        logger.exception("Error in AI %s analysis", data_type)
        return f"ERROR: {str(e)}"


def _stringify_crew_result(result, role: str) -> str:
    if hasattr(result, "outputs") and result.outputs:
        return str(result.outputs[0])
    if hasattr(result, "get"):
        return str(result.get(role, "No recommendation available."))
    return str(result)


# =====================================================================
# AI TRIP ITINERARY PLANNER
# =====================================================================

async def generate_itinerary(
    destination: str,
    flights_text: str,
    hotels_text: str,
    check_in_date: str,
    check_out_date: str,
    weather_summary: str = "",
    budget: Optional[float] = None,
) -> str:
    try:
        check_in = datetime.strptime(check_in_date, "%Y-%m-%d")
        check_out = datetime.strptime(check_out_date, "%Y-%m-%d")
        days = max((check_out - check_in).days, 1)

        weather_section = (
            f"\nWeather context:\n{weather_summary}\n"
            if weather_summary else ""
        )
        budget_section = (
            f"\nTravel budget: ₹{budget:,.0f}\n"
            if budget else ""
        )

        agent = Agent(
            role="AI Travel Planner",
            goal="Create a practical trip itinerary using flight, hotel, and weather context.",
            backstory="A travel planner that turns logistics into a clear day-by-day plan.",
            llm=initialize_llm(),
            verbose=False,
        )

        task = Task(
            description=f"""
Create a {days}-day itinerary for {destination}.

Flight details:
{flights_text}

Hotel details:
{hotels_text}
{weather_section}{budget_section}
Travel dates: {check_in_date} to {check_out_date}

Include:
- Arrival and departure logistics
- Hotel check-in/check-out guidance
- Morning, afternoon, and evening activities for each day
- Must-visit attractions
- Restaurant suggestions
- Local transportation tips
- Any weather-based adjustments if weather context is provided

Use clean Markdown headings and bullet points. Keep it realistic and useful.
""",
            agent=agent,
            expected_output="A practical Markdown itinerary with daily plans and travel tips.",
        )

        crew = Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,
            verbose=False,
        )

        result = await asyncio.to_thread(crew.kickoff)
        if hasattr(result, "outputs") and result.outputs:
            return str(result.outputs[0])
        if hasattr(result, "get"):
            return str(result.get("AI Travel Planner", "No itinerary available."))
        return str(result)
    except Exception:
        logger.exception("Error generating itinerary")
        return "Unable to generate itinerary due to an error. Please try again later."


# =====================================================================
# AI WEATHER DECISION AGENT
# =====================================================================

async def analyze_weather_with_ai(
    destination: str,
    weather: WeatherAnalysis,
    start_date: str,
    end_date: str,
) -> str:
    """
    AI agent that reads structured weather data and produces an intelligent,
    balanced travel recommendation. Does NOT invent weather conditions.
    """
    logger.info("Running AI weather analysis for %s", destination)

    # Build a structured weather brief for the agent
    alert_text = ""
    if weather.alerts:
        alert_lines = [
            f"- {a.type} ({a.severity}): {a.message} (Dates: {', '.join(a.dates)})"
            for a in weather.alerts
        ]
        alert_text = "ACTIVE ALERTS:\n" + "\n".join(alert_lines)
    else:
        alert_text = "ACTIVE ALERTS: None"

    forecast_lines = []
    for f in weather.daily_forecast[:7]:  # Limit to 7 days for context
        forecast_lines.append(
            f"  {f.date}: {f.condition} {f.icon} | "
            f"Max {f.temp_max}°C / Min {f.temp_min}°C | "
            f"Rain: {f.rain_probability}% | "
            f"Wind: {f.wind_speed_kmh} km/h"
        )
    forecast_text = "\n".join(forecast_lines) if forecast_lines else "No forecast data available."

    weather_brief = f"""
DESTINATION: {destination}
TRAVEL DATES: {start_date} to {end_date}
RISK LEVEL: {weather.risk_level}

CURRENT CONDITIONS:
- Temperature: {weather.current_temp}°C (feels like {weather.feels_like}°C)
- Condition: {weather.overall_condition}
- Humidity: {weather.humidity}%
- Wind: {weather.wind_speed_kmh} km/h

TEMPERATURE RANGE (trip): {weather.temperature_range}
AVERAGE RAIN PROBABILITY: {weather.avg_rain_probability}%

{alert_text}

DAILY FORECAST:
{forecast_text}
"""

    agent = Agent(
        role="AI Weather Intelligence Analyst",
        goal=(
            "Analyze weather data and provide balanced, intelligent travel recommendations. "
            "Use ONLY the weather data provided. Do NOT invent conditions."
        ),
        backstory=(
            "An expert meteorologist and travel safety advisor who translates weather data "
            "into practical, balanced traveler guidance. You give fair assessments — "
            "not overly cautious, not dismissive. Strong warnings only for genuine risks."
        ),
        llm=initialize_llm(),
        verbose=False,
    )

    task = Task(
        description=f"""
Analyze the weather data below for {destination} and generate a structured travel weather report.

{weather_brief}

Generate a response in exactly this format:

## 🌤️ WEATHER SUMMARY
[2-3 sentences describing overall conditions and temperature range for the trip]

## ✈️ TRAVEL RECOMMENDATION
**Overall verdict:** [One of: Safe to travel | Travel with precautions | Consider changing outdoor plans | Consider changing travel dates]

**Safe activities:**
[Bullet list of 3-5 activities appropriate for these conditions]

**Activities to approach with caution:**
[Bullet list of activities to be careful about, or "None" if conditions are good]

**Best time of day for sightseeing:**
[1-2 sentences on optimal timing]

**Clothing & packing:**
[Bullet list of 3-4 specific recommendations]

**Transport notes:**
[Any weather-related transport warnings, or "No special concerns" if conditions are fine]

## ⚠️ RISK ASSESSMENT
**Risk Level: {weather.risk_level}**
[1-2 sentences explaining why this risk level was assigned, referencing specific data points]

IMPORTANT RULES:
- Use ONLY the weather data provided above. Do not guess or invent conditions.
- Be balanced. Normal rain or mild heat does NOT warrant "do not travel" advice.
- Only give strong "consider postponing" warnings for HIGH risk conditions (storms, extreme heat ≥40°C, severe alerts).
- For LOW risk, be encouraging and practical.
- For MEDIUM risk, give helpful precautions without alarming the traveler.
""",
        agent=agent,
        expected_output="A structured weather intelligence report with travel recommendations.",
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
    )

    try:
        result = await asyncio.to_thread(crew.kickoff)
        return _stringify_crew_result(result, "AI Weather Intelligence Analyst")
    except Exception:
        logger.exception("Error in AI weather analysis")
        return _fallback_weather_text(weather, destination)


def _fallback_weather_text(weather: WeatherAnalysis, destination: str) -> str:
    """Simple text fallback if AI agent fails."""
    verdict_map = {
        "LOW":    "Safe to travel",
        "MEDIUM": "Travel with precautions",
        "HIGH":   "Consider changing outdoor plans",
    }
    return (
        f"## 🌤️ WEATHER SUMMARY\n"
        f"Weather for {destination}: {weather.overall_condition}. "
        f"Temperature range: {weather.temperature_range}. "
        f"Average rain probability: {weather.avg_rain_probability}%.\n\n"
        f"## ✈️ TRAVEL RECOMMENDATION\n"
        f"**Overall verdict:** {verdict_map.get(weather.risk_level, 'Travel with precautions')}\n\n"
        f"## ⚠️ RISK ASSESSMENT\n"
        f"**Risk Level: {weather.risk_level}** — Based on forecast conditions.\n"
    )


# =====================================================================
# AI BUDGET OPTIMIZER AGENT
# =====================================================================

async def analyze_budget_with_ai(
    budget_analysis: BudgetAnalysis,
    destination: str,
    trip_nights: int,
) -> str:
    """
    AI agent that provides narrative budget analysis and personalized advice.
    Uses the already-computed BudgetAnalysis object as context.
    """
    logger.info("Running AI budget analysis for %s", destination)

    bd = budget_analysis
    cb = bd.cost_breakdown

    suggestions_text = "\n".join(f"- {s}" for s in bd.optimization_suggestions) or "None"

    budget_brief = f"""
DESTINATION: {destination}
TRIP DURATION: {trip_nights} night(s)

USER BUDGET: ₹{bd.user_budget:,.0f}
ESTIMATED TOTAL COST: ₹{bd.estimated_total_cost:,.0f}
REMAINING BUDGET: ₹{bd.remaining_budget:,.0f} ({'surplus' if bd.remaining_budget >= 0 else 'deficit'})
STATUS: {bd.budget_status}

COST BREAKDOWN:
- Flights:          ₹{cb.flights:,.0f}
- Hotels:           ₹{cb.hotels:,.0f} (cheapest option × {trip_nights} nights)
- Food & Dining:    ₹{cb.food:,.0f}
- Local Transport:  ₹{cb.transportation:,.0f}
- Activities:       ₹{cb.activities:,.0f}
- Emergency Reserve:₹{cb.emergency_reserve:,.0f}

SYSTEM OPTIMIZATION SUGGESTIONS:
{suggestions_text}
"""

    agent = Agent(
        role="AI Budget Optimizer",
        goal="Analyze a traveler's budget and provide specific, actionable money-saving advice.",
        backstory=(
            "A seasoned travel budget consultant who helps travelers maximize value. "
            "You give practical, specific advice — not generic tips."
        ),
        llm=initialize_llm(),
        verbose=False,
    )

    task = Task(
        description=f"""
Analyze this trip budget and provide a clear, helpful financial assessment.

{budget_brief}

Generate a response in this format:

## 💰 BUDGET ANALYSIS

**Status: {bd.budget_status_emoji} {bd.budget_status.replace('_', ' ')}**

[2-3 sentences summarizing the budget situation clearly]

## 📊 COST BREAKDOWN INSIGHTS
[2-3 bullet points highlighting the biggest cost drivers and what's reasonable]

## 💡 OPTIMIZATION STRATEGIES
[3-5 specific, actionable suggestions. Reference the actual numbers above.
If UNDER_BUDGET, suggest smart upgrades or additions.
If WITHIN_BUDGET, suggest ways to protect the budget.
If OVER_BUDGET, suggest the most impactful cuts first.]

## 🎯 FINAL RECOMMENDATION
[1-2 sentences with a clear bottom-line recommendation]

RULES:
- Use the exact numbers from the budget brief above.
- Be specific (e.g., 'switching to the cheapest hotel saves ₹X').
- If under budget, be encouraging and suggest enhancements.
- If over budget, prioritize the highest-impact cuts first.
- Keep the tone helpful and professional, not preachy.
""",
        agent=agent,
        expected_output="A structured budget analysis with specific optimization advice.",
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=False,
    )

    try:
        result = await asyncio.to_thread(crew.kickoff)
        return _stringify_crew_result(result, "AI Budget Optimizer")
    except Exception:
        logger.exception("Error in AI budget analysis")
        return (
            f"## 💰 BUDGET ANALYSIS\n\n"
            f"**Status: {bd.budget_status_emoji} {bd.budget_status.replace('_', ' ')}**\n\n"
            f"Estimated trip cost: ₹{bd.estimated_total_cost:,.0f} vs budget: ₹{bd.user_budget:,.0f}.\n"
        )


# =====================================================================
# TRAVEL SCORE CALCULATOR + AI EXPLAINER
# =====================================================================

def _compute_travel_score(
    flights: List[FlightInfo],
    hotels: List[HotelInfo],
    weather: Optional[WeatherAnalysis],
    budget: Optional[BudgetAnalysis],
) -> tuple[int, List[ScoreFactor]]:
    """
    Compute a 0–100 Travel Score from:
    - Budget compatibility (25 pts)
    - Weather suitability (25 pts)
    - Flight convenience (20 pts)
    - Hotel suitability (20 pts)
    - Activity availability (10 pts)
    """
    factors: List[ScoreFactor] = []

    # ── 1. Budget Compatibility (25 pts) ─────────────────────────────
    if budget:
        status = budget.budget_status
        if status == "UNDER_BUDGET":
            b_score = 25
            b_desc = "Trip comfortably within budget with surplus remaining."
        elif status == "WITHIN_BUDGET":
            # Partial: how close?
            ratio = budget.remaining_budget / max(budget.user_budget, 1)
            b_score = max(10, int(20 * ratio / 0.15))  # scales 10–20
            b_desc = "Trip fits within budget but is tight."
        else:  # OVER_BUDGET
            overage_ratio = abs(budget.remaining_budget) / max(budget.user_budget, 1)
            b_score = max(0, int(10 - overage_ratio * 20))
            b_desc = f"Trip exceeds budget by ₹{abs(budget.remaining_budget):,.0f}."
        factors.append(ScoreFactor(name="Budget Compatibility", score=b_score, max_score=25, description=b_desc))
    else:
        factors.append(ScoreFactor(name="Budget Compatibility", score=15, max_score=25, description="Budget data unavailable."))
        b_score = 15

    # ── 2. Weather Suitability (25 pts) ──────────────────────────────
    if weather:
        risk = weather.risk_level
        if risk == "LOW":
            w_score = 25
            w_desc = f"Excellent weather conditions. {weather.overall_condition}."
        elif risk == "MEDIUM":
            w_score = 15
            w_desc = f"Moderate weather conditions — some precautions advised. {weather.overall_condition}."
        else:  # HIGH
            w_score = 5
            w_desc = f"Challenging weather conditions with active alerts. {weather.overall_condition}."
        factors.append(ScoreFactor(name="Weather Suitability", score=w_score, max_score=25, description=w_desc))
    else:
        w_score = 15
        factors.append(ScoreFactor(name="Weather Suitability", score=15, max_score=25, description="Weather data unavailable."))

    # ── 3. Flight Convenience (20 pts) ───────────────────────────────
    if flights:
        nonstop_count = sum(1 for f in flights if "nonstop" in f.stops.lower() or f.stops == "0")
        nonstop_ratio = nonstop_count / len(flights)

        # Check for daytime departure (6 AM – 10 PM)
        daytime_count = 0
        for f in flights:
            dep_t = f.departure_time
            if dep_t:
                try:
                    dt = datetime.strptime(dep_t.strip(), "%I:%M %p")
                    if 6 <= dt.hour <= 22:
                        daytime_count += 1
                except ValueError:
                    pass

        daytime_ratio = daytime_count / len(flights) if flights else 0

        f_score = int(10 * nonstop_ratio + 10 * daytime_ratio)
        f_score = max(5, min(20, f_score))

        if nonstop_ratio >= 0.5:
            f_desc = "Majority of flights are nonstop with convenient departure times."
        else:
            f_desc = "Some connecting flights available. Check layover times before booking."
        factors.append(ScoreFactor(name="Flight Convenience", score=f_score, max_score=20, description=f_desc))
    else:
        f_score = 10
        factors.append(ScoreFactor(name="Flight Convenience", score=10, max_score=20, description="No flight data available."))

    # ── 4. Hotel Suitability (20 pts) ────────────────────────────────
    if hotels:
        avg_rating = sum(h.rating for h in hotels) / len(hotels)
        if avg_rating >= 4.5:
            h_score = 20
            h_desc = f"Excellent hotel options available (avg rating: {avg_rating:.1f}/5)."
        elif avg_rating >= 4.0:
            h_score = 16
            h_desc = f"Good hotel options available (avg rating: {avg_rating:.1f}/5)."
        elif avg_rating >= 3.5:
            h_score = 12
            h_desc = f"Decent hotel options available (avg rating: {avg_rating:.1f}/5)."
        else:
            h_score = 8
            h_desc = f"Limited high-quality hotel options (avg rating: {avg_rating:.1f}/5)."
        factors.append(ScoreFactor(name="Hotel Suitability", score=h_score, max_score=20, description=h_desc))
    else:
        h_score = 10
        factors.append(ScoreFactor(name="Hotel Suitability", score=10, max_score=20, description="No hotel data available."))

    # ── 5. Activity Availability (10 pts) ────────────────────────────
    if weather:
        safe_count = len(weather.safe_activities)
        avoid_count = len(weather.activities_to_avoid)
        if avoid_count == 0 and safe_count >= 4:
            a_score = 10
            a_desc = "Wide range of activities available with no weather restrictions."
        elif avoid_count <= 2:
            a_score = 7
            a_desc = "Good activity availability with minor weather limitations."
        else:
            a_score = 4
            a_desc = "Activity options limited due to weather conditions."
    else:
        a_score = 7
        a_desc = "Activity availability not assessed (no weather data)."
    factors.append(ScoreFactor(name="Activity Availability", score=a_score, max_score=10, description=a_desc))

    total = b_score + w_score + f_score + h_score + a_score
    return min(100, max(0, total)), factors


def _score_to_grade(score: int) -> tuple[str, str]:
    if score >= 85:
        return "A", "Excellent"
    if score >= 70:
        return "B", "Good"
    if score >= 55:
        return "C", "Fair"
    if score >= 40:
        return "D", "Poor"
    return "F", "Not Recommended"


def _score_to_verdict(score: int, weather: Optional[WeatherAnalysis]) -> str:
    risk = weather.risk_level if weather else "LOW"
    if score >= 75 and risk == "LOW":
        return "Safe to travel — excellent conditions overall"
    if score >= 60:
        return "Travel with precautions — review recommendations before going"
    if score >= 45:
        return "Consider adjusting plans — some factors need attention"
    return "Consider changing travel dates — multiple risk factors present"


async def generate_travel_score(
    destination: str,
    flights: List[FlightInfo],
    hotels: List[HotelInfo],
    weather: Optional[WeatherAnalysis] = None,
    budget: Optional[BudgetAnalysis] = None,
) -> TravelScore:
    """Compute a 0–100 travel score and generate an AI explanation."""
    logger.info("Computing travel score for %s", destination)

    total_score, factors = _compute_travel_score(flights, hotels, weather, budget)
    grade, grade_label = _score_to_grade(total_score)
    verdict = _score_to_verdict(total_score, weather)

    # Build AI explanation
    factors_text = "\n".join(
        f"- {f.name}: {f.score}/{f.max_score} — {f.description}"
        for f in factors
    )

    weather_note = ""
    if weather:
        weather_note = f"\nWeather risk: {weather.risk_level} | Condition: {weather.overall_condition}"

    budget_note = ""
    if budget:
        budget_note = f"\nBudget status: {budget.budget_status} | Remaining: ₹{budget.remaining_budget:,.0f}"

    explanation = (
        f"**Travel Score: {total_score}/100 ({grade} — {grade_label})**\n\n"
        f"**Score Breakdown:**\n{factors_text}\n"
        f"{weather_note}{budget_note}\n\n"
        f"**Verdict:** {verdict}"
    )

    return TravelScore(
        total_score=total_score,
        grade=grade,
        grade_label=grade_label,
        factors=factors,
        ai_explanation=explanation,
        overall_verdict=verdict,
    )


# =====================================================================
# CONTEXT-AWARE TRAVEL ASSISTANT CHAT
# =====================================================================

def _build_travel_system_prompt(context: Dict[str, Any]) -> str:
    """Build a rich system prompt from the current trip context snapshot."""

    def fmt_inr(val):
        if val is None: return "Not set"
        return f"₹{int(val):,}"

    def fmt_date(d):
        if not d: return "Not set"
        try:
            from datetime import datetime as dt
            return dt.strptime(d, "%Y-%m-%d").strftime("%d %b %Y")
        except Exception:
            return d

    origin      = context.get("origin")      or "Not specified"
    dest        = context.get("destination") or "Not specified"
    dep_date    = fmt_date(context.get("outbound_date"))
    ret_date    = fmt_date(context.get("return_date"))
    nights      = context.get("trip_nights") or "N/A"
    budget      = fmt_inr(context.get("budget"))
    spent       = fmt_inr(context.get("total_spent"))
    remaining   = fmt_inr(context.get("remaining_budget"))

    # Selected options
    sel_flight  = context.get("selected_flight")
    sel_hotel   = context.get("selected_hotel")
    flight_cost = fmt_inr(context.get("total_flight_cost"))
    hotel_cost  = fmt_inr(context.get("total_hotel_cost"))

    sel_flight_str = "None selected yet"
    if sel_flight:
        sel_flight_str = f"{sel_flight.get('airline','?')} — {flight_cost}"

    sel_hotel_str = "None selected yet"
    if sel_hotel:
        sel_hotel_str = (
            f"{sel_hotel.get('name','?')} — "
            f"₹{int(sel_hotel.get('pricePerNight',0)):,}/night × {nights} nights = {hotel_cost}"
        )

    # Available flights summary (top 5)
    avail_flights = context.get("available_flights") or []
    flights_lines = []
    for i, f in enumerate(avail_flights[:5], 1):
        dep_t = f.get("departure_time") or f.get("departure", "?")
        arr_t = f.get("arrival_time") or f.get("arrival", "?")
        flights_lines.append(
            f"  {i}. {f.get('airline','?')} | {f.get('price','?')} | "
            f"{f.get('duration','?')} | {f.get('stops','?')} | {dep_t} → {arr_t}"
        )
    flights_block = "\n".join(flights_lines) if flights_lines else "  No flights data yet."

    # Available hotels summary (top 5)
    avail_hotels = context.get("available_hotels") or []
    hotels_lines = []
    for i, h in enumerate(avail_hotels[:5], 1):
        hotels_lines.append(
            f"  {i}. {h.get('name','?')} | {h.get('price','?')}/night | "
            f"Rating {h.get('rating','?')} | {h.get('location','?')}"
        )
    hotels_block = "\n".join(hotels_lines) if hotels_lines else "  No hotels data yet."

    ai_flight_rec = context.get("ai_flight_recommendation") or "Not yet generated."
    ai_hotel_rec  = context.get("ai_hotel_recommendation")  or "Not yet generated."
    itinerary     = context.get("itinerary") or "Not yet generated."

    # Weather + budget context
    weather_risk    = context.get("weather_risk_level") or "Not assessed"
    weather_summary = context.get("weather_summary") or "Not assessed"
    budget_status   = context.get("budget_status") or "Not assessed"
    travel_score    = context.get("travel_score")

    score_str = f"{travel_score}/100" if travel_score is not None else "Not computed"

    # Truncate long fields
    if len(ai_flight_rec) > 600: ai_flight_rec = ai_flight_rec[:600] + "…"
    if len(ai_hotel_rec)  > 600: ai_hotel_rec  = ai_hotel_rec[:600]  + "…"
    if len(itinerary)     > 800: itinerary     = itinerary[:800]     + "…"

    return f"""You are an expert AI Travel Assistant embedded in a professional travel booking application.
You have FULL access to the user's current trip data below. Always use this data first before using general knowledge.

════════════════════════════════════════
CURRENT TRIP CONTEXT
════════════════════════════════════════
Route         : {origin} → {dest}
Departure     : {dep_date}
Return        : {ret_date}
Duration      : {nights} night(s)

BUDGET OVERVIEW
  Total Budget    : {budget}
  Total Spent     : {spent}
  Remaining       : {remaining}
  Flight Cost     : {flight_cost}
  Hotel Cost      : {hotel_cost}
  Budget Status   : {budget_status}

SELECTED OPTIONS
  ✈ Flight  : {sel_flight_str}
  🏨 Hotel   : {sel_hotel_str}

WEATHER INTELLIGENCE
  Risk Level : {weather_risk}
  Summary    : {weather_summary}

TRAVEL SCORE: {score_str}

AVAILABLE FLIGHTS (top 5)
{flights_block}

AVAILABLE HOTELS (top 5)
{hotels_block}

AI FLIGHT ANALYSIS
{ai_flight_rec}

AI HOTEL ANALYSIS
{ai_hotel_rec}

GENERATED ITINERARY
{itinerary}
════════════════════════════════════════

BEHAVIOUR RULES:
1. You are STRICTLY a travel assistant. Never answer questions outside travel.
2. Always reference the trip context above when answering — use real numbers (prices, dates, budget).
3. Be proactive: if budget is exceeded, warn the user and suggest cheaper alternatives from the available list.
4. Sound like a professional travel advisor, not a generic chatbot.
5. For weather questions: use the Weather Intelligence section above first, then add seasonal insight for {dest}.
6. For safety questions: give current general travel advisories for {dest}.
7. For packing: factor in destination climate and trip duration ({nights} nights).
8. For food/attractions: give specific, highly-rated recommendations for {dest}.
9. If asked for cheaper flights/hotels: compare selected against available options from the context.
10. Keep responses concise, structured, and actionable (use bullet points where helpful).

ALLOWED TOPICS: Flights, Hotels, Travel budgets, Packing, Weather, Attractions, Restaurants,
                Safety/travel risks, Local transport, Itinerary planning, Visa requirements.

DISALLOWED TOPICS: Programming, Politics, Medical diagnosis, Stock/crypto finance,
                   General knowledge unrelated to travel.

If a user asks a non-travel question, respond ONLY with:
"I'm your travel assistant and can only help with flights, hotels, itineraries, budgets, weather and travel planning."

Always prioritise the trip context above over general knowledge.
"""


async def get_chat_response(
    message: str,
    context: Dict[str, Any],
    history: List[Dict[str, str]],
) -> str:
    """Send a context-aware message to the Groq LLM and return the reply."""
    logger.info("Chat request: %s", message[:80])

    system_prompt = _build_travel_system_prompt(context)

    # Build message list: system + last 12 history turns + new user message
    messages = [{"role": "system", "content": system_prompt}]
    for turn in history[-12:]:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    try:
        # Use litellm directly — much faster than spinning up a CrewAI crew
        model_name = settings.groq_model  # e.g. "groq/llama-3.3-70b-versatile"
        response = await asyncio.to_thread(
            litellm.completion,
            model=model_name,
            api_key=settings.groq_api_key,
            messages=messages,
            max_tokens=900,
            temperature=0.65,
        )
        reply = response.choices[0].message.content.strip()
        logger.info("Chat reply generated (%d chars)", len(reply))
        return reply
    except Exception as exc:
        logger.exception("Chat LLM error")
        return f"Sorry, I encountered an error: {exc}. Please try again."
