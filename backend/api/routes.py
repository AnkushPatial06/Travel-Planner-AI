import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException

from backend.ai.itinerary import generate_itinerary
from backend.ai.recommendations import get_ai_recommendation
from backend.core.logging import logger
from backend.models.schemas import AIResponse, FlightRequest, HotelRequest, ItineraryRequest
from backend.services.formatters import format_travel_data
from backend.services.search import search_flights, search_hotels


router = APIRouter()



@router.post("/search_flights/", response_model=AIResponse)
async def get_flight_recommendations(flight_request: FlightRequest):
    
    try:
        flights = await search_flights(flight_request)

        if isinstance(flights, dict) and "error" in flights:
            raise HTTPException(status_code=400, detail=flights["error"])
        if not flights:
            raise HTTPException(status_code=404, detail="No flights found")

        flights_text = format_travel_data("flights", flights)
        recommendation = await get_ai_recommendation("flights", flights_text)

        return AIResponse(flights=flights, ai_flight_recommendation=recommendation)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Flight search endpoint error")
        raise HTTPException(status_code=500, detail=f"Flight search error: {exc}") from exc


@router.post("/search_hotels/", response_model=AIResponse)
async def get_hotel_recommendations(hotel_request: HotelRequest):
    try:
        hotels = await search_hotels(hotel_request)

        if isinstance(hotels, dict) and "error" in hotels:
            raise HTTPException(status_code=400, detail=hotels["error"])
        if not hotels:
            raise HTTPException(status_code=404, detail="No hotels found")

        hotels_text = format_travel_data("hotels", hotels)
        recommendation = await get_ai_recommendation("hotels", hotels_text)

        return AIResponse(hotels=hotels, ai_hotel_recommendation=recommendation)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Hotel search endpoint error")
        raise HTTPException(status_code=500, detail=f"Hotel search error: {exc}") from exc


@router.post("/complete_search/", response_model=AIResponse)
async def complete_travel_search(

    flight_request: FlightRequest,
    hotel_request: Optional[HotelRequest] = None,
):
    try:
        if hotel_request is None:
            hotel_request = HotelRequest(
                location=flight_request.destination,
                check_in_date=flight_request.outbound_date,
                check_out_date=flight_request.return_date,
            )

        flight_task = asyncio.create_task(get_flight_recommendations(flight_request))
        hotel_task = asyncio.create_task(get_hotel_recommendations(hotel_request))
        flight_results, hotel_results = await asyncio.gather(
            flight_task,
            hotel_task,
            return_exceptions=True,
        )

        if isinstance(flight_results, Exception):
            logger.error("Flight search failed: %s", flight_results)
            flight_results = AIResponse(
                flights=[],
                ai_flight_recommendation="Could not retrieve flights.",
            )

        if isinstance(hotel_results, Exception):
            logger.error("Hotel search failed: %s", hotel_results)
            hotel_results = AIResponse(
                hotels=[],
                ai_hotel_recommendation="Could not retrieve hotels.",
            )

        flights_text = format_travel_data("flights", flight_results.flights)
        hotels_text = format_travel_data("hotels", hotel_results.hotels)

        itinerary = ""
        if flight_results.flights and hotel_results.hotels:
            itinerary = await generate_itinerary(
                destination=flight_request.destination,
                flights_text=flights_text,
                hotels_text=hotels_text,
                check_in_date=flight_request.outbound_date,
                check_out_date=flight_request.return_date,
            )

        return AIResponse(
            flights=flight_results.flights,
            hotels=hotel_results.hotels,
            ai_flight_recommendation=flight_results.ai_flight_recommendation,
            ai_hotel_recommendation=hotel_results.ai_hotel_recommendation,
            itinerary=itinerary,
        )
    except Exception as exc:
        logger.exception("Complete travel search error")
        raise HTTPException(status_code=500, detail=f"Travel search error: {exc}") from exc


@router.post("/generate_itinerary/", response_model=AIResponse)
async def get_itinerary(itinerary_request: ItineraryRequest):
    try:
        itinerary = await generate_itinerary(
            destination=itinerary_request.destination,
            flights_text=itinerary_request.flights,
            hotels_text=itinerary_request.hotels,
            check_in_date=itinerary_request.check_in_date,
            check_out_date=itinerary_request.check_out_date,
        )
        return AIResponse(itinerary=itinerary)
    except Exception as exc:
        logger.exception("Itinerary generation error")
        raise HTTPException(status_code=500, detail=f"Itinerary generation error: {exc}") from exc
