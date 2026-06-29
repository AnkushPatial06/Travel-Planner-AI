import asyncio
from datetime import datetime
from functools import lru_cache
from typing import List, Dict, Any, Optional
import crewai.llms.cache as _crewai_cache
_crewai_cache.mark_cache_breakpoint = lambda msg: msg

import litellm
from crewai import Agent, Crew, Process, Task, LLM

from backend.config import settings, logger


# =====================================================================
# LLM INITIALIZER
# =====================================================================

@lru_cache(maxsize=1)
def initialize_llm():
    print("MODEL =", settings.groq_model)
    print("API KEY =", settings.groq_api_key[:10] if settings.groq_api_key else None)

    return LLM(
        model=settings.groq_model,
        api_key=settings.groq_api_key
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
) -> str:
    try:
        check_in = datetime.strptime(check_in_date, "%Y-%m-%d")
        check_out = datetime.strptime(check_out_date, "%Y-%m-%d")
        days = max((check_out - check_in).days, 1)

        agent = Agent(
            role="AI Travel Planner",
            goal="Create a practical trip itinerary using flight and hotel context.",
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

Travel dates: {check_in_date} to {check_out_date}

Include:
- Arrival and departure logistics
- Hotel check-in/check-out guidance
- Morning, afternoon, and evening activities for each day
- Must-visit attractions
- Restaurant suggestions
- Local transportation tips

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
        flights_lines.append(
            f"  {i}. {f.get('airline','?')} | {f.get('price','?')} | "
            f"{f.get('duration','?')} | {f.get('stops','?')}"
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

SELECTED OPTIONS
  ✈ Flight  : {sel_flight_str}
  🏨 Hotel   : {sel_hotel_str}

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
5. For weather questions: give seasonal insight for {dest} during {dep_date} to {ret_date}.
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
