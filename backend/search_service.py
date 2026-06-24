import asyncio
from fastapi import HTTPException
from serpapi import GoogleSearch

from config import settings, logger
from models import FlightInfo, FlightRequest, HotelInfo, HotelRequest

# =====================================================================
# IATA RESOLVER & STABLE IMAGE PROVIDER
# =====================================================================

IATA_TO_CITY = {
    "DEL": "Delhi",
    "BLR": "Bengaluru",
    "BOM": "Mumbai",
    "MAA": "Chennai",
    "CCU": "Kolkata",
    "HYD": "Hyderabad",
    "COK": "Kochi",
    "DXB": "Dubai",
    "SIN": "Singapore",
    "LHR": "London",
    "JFK": "New York",
    "LAX": "Los Angeles",
    "SFO": "San Francisco",
    "NRT": "Tokyo",
    "HND": "Tokyo",
    "CDG": "Paris",
    "AMS": "Amsterdam",
    "BKK": "Bangkok",
    "KUL": "Kuala Lumpur",
    "HKG": "Hong Kong",
    "SYD": "Sydney",
    "MEL": "Melbourne",
    "ORD": "Chicago",
    "MIA": "Miami",
    "YYZ": "Toronto",
    "YVR": "Vancouver",
    "FRA": "Frankfurt",
    "MUC": "Munich",
    "IST": "Istanbul",
    "FCO": "Rome",
    "MAD": "Madrid",
    "BCN": "Barcelona",
    "ATH": "Athens",
    "AUH": "Abu Dhabi",
    "DOH": "Doha",
    "KWI": "Kuwait",
    "RUH": "Riyadh",
    "JED": "Jeddah",
    "MCT": "Muscat",
    "PNQ": "Pune",
    "AMD": "Ahmedabad",
    "GOI": "Goa",
    "TRV": "Trivandrum",
    "CCJ": "Calicut",
    "IXC": "Chandigarh",
    "ATQ": "Amritsar",
    "LKO": "Lucknow",
    "JAI": "Jaipur",
    "VNS": "Varanasi",
    "VTZ": "Visakhapatnam",
    "PAT": "Patna",
    "RPR": "Raipur",
    "BBI": "Bhubaneswar",
    "IXR": "Ranchi",
    "GAU": "Guwahati",
    "IMF": "Imphal",
    "IXA": "Agartala",
    "SXR": "Srinagar",
    "IXJ": "Jammu",
    "DED": "Dehradun",
    "BDQ": "Vadodara",
    "STV": "Surat",
    "NAG": "Nagpur",
    "IDR": "Indore",
    "BHO": "Bhopal",
    "HUR": "Khajuraho",
}

def resolve_iata(code: str) -> str:
    cleaned = code.strip().upper()
    return IATA_TO_CITY.get(cleaned, cleaned.title())

HOTEL_IMAGES = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1611891487122-207579d67d98?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=600&q=80",
]

def get_hotel_image(hotel_name: str, given_url: str | None) -> str:
    if given_url and "googleusercontent.com" not in given_url:
        return given_url
    name_hash = sum(ord(char) for char in hotel_name)
    img_idx = name_hash % len(HOTEL_IMAGES)
    return HOTEL_IMAGES[img_idx]

# =====================================================================
# MOCK / DEMO DATA PROVIDERS
# =====================================================================

def demo_flights(flight_request: FlightRequest) -> list[FlightInfo]:
    origin = flight_request.origin.strip().upper()
    destination = flight_request.destination.strip().upper()
    return [
        FlightInfo(
            airline="IndiGo",
            price="6520",
            duration="2 hr 45 min",
            stops="Nonstop",
            departure=f"{origin} Airport ({origin}) at 07:15 AM",
            arrival=f"{destination} Airport ({destination}) at 10:00 AM",
            travel_class="Economy",
            return_date=flight_request.return_date,
            airline_logo="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=80",
        ),
        FlightInfo(
            airline="Air India",
            price="7890",
            duration="3 hr 10 min",
            stops="Nonstop",
            departure=f"{origin} Airport ({origin}) at 11:30 AM",
            arrival=f"{destination} Airport ({destination}) at 02:40 PM",
            travel_class="Economy",
            return_date=flight_request.return_date,
            airline_logo="https://images.unsplash.com/photo-1529074963764-98f45c47344b?auto=format&fit=crop&w=900&q=80",
        ),
        FlightInfo(
            airline="Vistara",
            price="9340",
            duration="4 hr 25 min",
            stops="1 stop",
            departure=f"{origin} Airport ({origin}) at 04:20 PM",
            arrival=f"{destination} Airport ({destination}) at 08:45 PM",
            travel_class="Premium Economy",
            return_date=flight_request.return_date,
            airline_logo="https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=900&q=80",
        ),
    ]


def demo_hotels(hotel_request: HotelRequest) -> list[HotelInfo]:
    location = hotel_request.location.strip().title() or "Destination"
    return [
        HotelInfo(
            name=f"{location} Grand Hotel",
            price="5100",
            rating=4.6,
            location=f"Central {location}",
            link="https://www.google.com/travel/hotels",
            image="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
        ),
        HotelInfo(
            name=f"{location} City Suites",
            price="3900",
            rating=4.3,
            location=f"Near {location} business district",
            link="https://www.google.com/travel/hotels",
            image="https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80",
        ),
        HotelInfo(
            name=f"{location} Heritage Stay",
            price="6200",
            rating=4.7,
            location=f"Old town {location}",
            link="https://www.google.com/travel/hotels",
            image="https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=600&q=80",
        ),
    ]


# =====================================================================
# DATA FORMATTERS FOR AI PIPELINE
# =====================================================================

def format_travel_data(data_type: str, data: list[FlightInfo] | list[HotelInfo]) -> str:
    if not data:
        return f"No {data_type} available."

    if data_type == "flights":
        return _format_flights(data)
    if data_type == "hotels":
        return _format_hotels(data)
    return "Invalid data type."


def _format_flights(flights: list[FlightInfo]) -> str:
    lines = ["Available flight options:"]
    for index, flight in enumerate(flights, start=1):
        lines.extend(
            [
                f"Flight {index}:",
                f"- Airline: {flight.airline}",
                f"- Price: INR {flight.price}",
                f"- Duration: {flight.duration}",
                f"- Stops: {flight.stops}",
                f"- Departure: {flight.departure}",
                f"- Arrival: {flight.arrival}",
                f"- Class: {flight.travel_class}",
                "",
            ]
        )
    return "\n".join(lines).strip()


def _format_hotels(hotels: list[HotelInfo]) -> str:
    lines = ["Available hotel options:"]
    for index, hotel in enumerate(hotels, start=1):
        lines.extend(
            [
                f"Hotel {index}:",
                f"- Name: {hotel.name}",
                f"- Price: INR {hotel.price}",
                f"- Rating: {hotel.rating}",
                f"- Location: {hotel.location}",
                f"- Link: {hotel.link}",
                "",
            ]
        )
    return "\n".join(lines).strip()


# =====================================================================
# SEARCH RUNNERS & SERVICES
# =====================================================================

async def run_search(params: dict):
    if not params.get("api_key"):
        raise HTTPException(status_code=400, detail="Missing SerpAPI key. Add SERPAPI_API_KEY in .env.")

    try:
        return await asyncio.to_thread(lambda: GoogleSearch(params).get_dict())
    except Exception as exc:
        logger.exception("SerpAPI search error")
        raise HTTPException(status_code=500, detail=f"Search API error: {exc}") from exc


async def search_flights(flight_request: FlightRequest):
    logger.info("Searching flights: %s to %s", flight_request.origin, flight_request.destination)

    if settings.demo_mode and not settings.serp_api_key:
        logger.info("Using demo flights because SerpAPI key is missing")
        return demo_flights(flight_request)

    params = {
        "api_key": settings.serp_api_key,
        "engine": "google_flights",
        "hl": "en",
        "gl": "us",
        "departure_id": flight_request.origin.strip().upper(),
        "arrival_id": flight_request.destination.strip().upper(),
        "outbound_date": flight_request.outbound_date,
        "return_date": flight_request.return_date,
        "currency": "INR",
    }

    try:
        search_results = await run_search(params)
    except HTTPException:
        if settings.demo_mode:
            logger.info("Using demo flights because live flight search failed")
            return demo_flights(flight_request)
        raise

    if "error" in search_results:
        logger.error("Flight search error: %s", search_results["error"])
        if settings.demo_mode:
            logger.info("Using demo flights because live flight search returned an error")
            return demo_flights(flight_request)
        return {"error": search_results["error"]}

    formatted_flights = []
    for flight in search_results.get("best_flights", []):
        if not flight.get("flights"):
            continue

        first_leg = flight["flights"][0]
        formatted_flights.append(
            FlightInfo(
                airline=first_leg.get("airline", "Unknown Airline"),
                price=str(flight.get("price", "N/A")),
                duration=f"{flight.get('total_duration', 'N/A')} min",
                stops="Nonstop"
                if len(flight["flights"]) == 1
                else f"{len(flight['flights']) - 1} stop(s)",
                departure=_format_airport(first_leg.get("departure_airport", {})),
                arrival=_format_airport(first_leg.get("arrival_airport", {})),
                travel_class=first_leg.get("travel_class", "Economy"),
                return_date=flight_request.return_date,
                airline_logo=first_leg.get("airline_logo", ""),
            )
        )

    logger.info("Found %s flights", len(formatted_flights))
    if settings.demo_mode and not formatted_flights:
        logger.info("Using demo flights because live flight search returned no results")
        return demo_flights(flight_request)
    return formatted_flights


async def search_hotels(hotel_request: HotelRequest):
    # Resolve IATA code (e.g. DEL -> Delhi) for search query and logging
    resolved_location = resolve_iata(hotel_request.location)
    logger.info("Searching hotels for: %s (resolved from %s)", resolved_location, hotel_request.location)

    if settings.demo_mode and not settings.serp_api_key:
        logger.info("Using demo hotels because SerpAPI key is missing")
        return demo_hotels(hotel_request)

    params = {
        "api_key": settings.serp_api_key,
        "engine": "google_hotels",
        "q": resolved_location,
        "hl": "en",
        "gl": "us",
        "check_in_date": hotel_request.check_in_date,
        "check_out_date": hotel_request.check_out_date,
        "currency": "INR",
        "sort_by": 3,
        "rating": 8,
    }

    try:
        search_results = await run_search(params)
    except HTTPException:
        if settings.demo_mode:
            logger.info("Using demo hotels because live hotel search failed")
            return demo_hotels(hotel_request)
        raise

    if "error" in search_results:
        logger.error("Hotel search error: %s", search_results["error"])
        if settings.demo_mode:
            logger.info("Using demo hotels because live hotel search returned an error")
            return demo_hotels(hotel_request)
        return {"error": search_results["error"]}

    formatted_hotels = []
    for hotel in search_results.get("properties", []):
        try:
            # Extract real-time images (and resolve proxy URLs to prevent broken images)
            images = hotel.get("images", [])
            raw_image_url = ""
            if isinstance(images, list) and len(images) > 0:
                first_img = images[0]
                if isinstance(first_img, dict):
                    raw_image_url = first_img.get("original_image") or first_img.get("thumbnail") or ""
            
            image_url = get_hotel_image(hotel.get("name", ""), raw_image_url)

            # Parse location (use neighborhood, location, or fallback to the resolved search city)
            location_val = hotel.get("neighborhood") or hotel.get("location") or resolved_location

            formatted_hotels.append(
                HotelInfo(
                    name=hotel.get("name", "Unknown Hotel"),
                    price=hotel.get("rate_per_night", {}).get("lowest", "N/A"),
                    rating=hotel.get("overall_rating", 0.0),
                    location=location_val,
                    link=hotel.get("link", "N/A"),
                    image=image_url,
                )
            )
        except Exception as exc:
            logger.warning("Error formatting hotel data: %s", exc)

    logger.info("Found %s hotels", len(formatted_hotels))
    if settings.demo_mode and not formatted_hotels:
        logger.info("Using demo hotels because live hotel search returned no results")
        return demo_hotels(hotel_request)
    return formatted_hotels


def _format_airport(airport: dict) -> str:
    name = airport.get("name", "Unknown")
    airport_id = airport.get("id", "???")
    time = airport.get("time", "N/A")
    return f"{name} ({airport_id}) at {time}"
