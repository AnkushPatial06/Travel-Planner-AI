"""
weather_service.py
==================
Real-time weather fetching using Open-Meteo (free, no API key needed).
- Geocoding: Open-Meteo geocoding API (destination name -> lat/lon)
- Weather:   Open-Meteo forecast API (current + daily forecast)
- WMO weather codes mapped to conditions, icons, and risk levels
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional
import httpx

from backend.config import logger
from backend.models import (
    DailyForecast,
    WeatherAlert,
    WeatherAnalysis,
    WeatherRequest,
)

# =====================================================================
# WMO WEATHER CODE MAPPING
# https://open-meteo.com/en/docs#weathervariables
# =====================================================================

WMO_CODE_MAP = {
    0:  ("Clear sky",              "☀️",  "LOW"),
    1:  ("Mainly clear",           "🌤️",  "LOW"),
    2:  ("Partly cloudy",          "⛅",   "LOW"),
    3:  ("Overcast",               "☁️",  "LOW"),
    45: ("Foggy",                  "🌫️",  "MEDIUM"),
    48: ("Icy fog",                "🌫️",  "MEDIUM"),
    51: ("Light drizzle",          "🌦️",  "LOW"),
    53: ("Moderate drizzle",       "🌦️",  "LOW"),
    55: ("Dense drizzle",          "🌧️",  "MEDIUM"),
    61: ("Light rain",             "🌧️",  "LOW"),
    63: ("Moderate rain",          "🌧️",  "MEDIUM"),
    65: ("Heavy rain",             "🌧️",  "HIGH"),
    66: ("Freezing light rain",    "🌨️",  "HIGH"),
    67: ("Freezing heavy rain",    "🌨️",  "HIGH"),
    71: ("Light snowfall",         "❄️",  "MEDIUM"),
    73: ("Moderate snowfall",      "❄️",  "HIGH"),
    75: ("Heavy snowfall",         "❄️",  "HIGH"),
    77: ("Snow grains",            "🌨️",  "MEDIUM"),
    80: ("Light rain showers",     "🌦️",  "LOW"),
    81: ("Moderate rain showers",  "🌧️",  "MEDIUM"),
    82: ("Violent rain showers",   "⛈️",   "HIGH"),
    85: ("Light snow showers",     "🌨️",  "MEDIUM"),
    86: ("Heavy snow showers",     "❄️",  "HIGH"),
    95: ("Thunderstorm",           "⛈️",   "HIGH"),
    96: ("Thunderstorm w/ hail",   "⛈️",   "HIGH"),
    99: ("Thunderstorm w/ heavy hail", "⛈️", "HIGH"),
}

RISK_PRIORITY = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}

RISK_EMOJI = {
    "LOW":    "🟢",
    "MEDIUM": "🟡",
    "HIGH":   "🔴",
}


def _wmo_info(code: int) -> tuple[str, str, str]:
    """Returns (condition_text, icon, risk_level)."""
    return WMO_CODE_MAP.get(code, ("Unknown", "🌡️", "LOW"))


# =====================================================================
# GEOCODING
# =====================================================================

async def _geocode(destination: str) -> Optional[tuple[float, float, str]]:
    """
    Resolve a destination name to (latitude, longitude, canonical_name).
    Returns None if not found.
    """
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": destination, "count": 1, "language": "en", "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            if not results:
                return None
            r = results[0]
            name = r.get("name", destination)
            country = r.get("country", "")
            canonical = f"{name}, {country}" if country else name
            return float(r["latitude"]), float(r["longitude"]), canonical
    except Exception as exc:
        logger.warning("Geocoding failed for '%s': %s", destination, exc)
        return None


# =====================================================================
# WEATHER FETCH
# =====================================================================

async def _fetch_weather(lat: float, lon: float, start_date: str, end_date: str) -> dict:
    """Fetch current conditions + daily forecast from Open-Meteo."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "apparent_temperature",
            "relative_humidity_2m",
            "wind_speed_10m",
            "weather_code",
            "visibility",
        ],
        "daily": [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_probability_max",
            "precipitation_sum",
            "wind_speed_10m_max",
            "relative_humidity_2m_max",
            "visibility_mean",
        ],
        "timezone": "auto",
        "start_date": start_date,
        "end_date": end_date,
        "wind_speed_unit": "kmh",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


# =====================================================================
# DEMO WEATHER (fallback when geocoding fails)
# =====================================================================

def _demo_weather(request: WeatherRequest) -> WeatherAnalysis:
    """Returns a plausible demo WeatherAnalysis when the real API is unavailable."""
    logger.info("Using demo weather data for '%s'", request.destination)
    try:
        start = datetime.strptime(request.start_date, "%Y-%m-%d")
        end = datetime.strptime(request.end_date, "%Y-%m-%d")
    except ValueError:
        start = datetime.now()
        end = start + timedelta(days=3)

    days = max((end - start).days + 1, 1)
    forecasts = []
    for i in range(days):
        day = start + timedelta(days=i)
        forecasts.append(DailyForecast(
            date=day.strftime("%Y-%m-%d"),
            condition="Partly cloudy",
            temp_max=32.0,
            temp_min=24.0,
            rain_probability=20.0,
            rainfall_mm=0.5,
            humidity=65.0,
            wind_speed_kmh=15.0,
            visibility_km=10.0,
            icon="⛅",
        ))

    return WeatherAnalysis(
        destination=request.destination,
        risk_level="LOW",
        risk_emoji="🟢",
        overall_condition="Partly cloudy with mild temperatures",
        temperature_range="24°C – 32°C",
        current_temp=29.0,
        feels_like=31.0,
        humidity=65.0,
        wind_speed_kmh=15.0,
        avg_rain_probability=20.0,
        alerts=[],
        daily_forecast=forecasts,
        ai_weather_summary="Weather conditions are generally favorable for travel. Expect mild temperatures with some cloud cover.",
        travel_recommendation="Safe to travel. Carry light rain protection as occasional showers are possible.",
        safe_activities=["Sightseeing", "Walking tours", "Outdoor dining", "Cultural visits"],
        activities_to_avoid=[],
        best_travel_times=["Morning (8 AM – 11 AM)", "Evening (5 PM – 8 PM)"],
        packing_recommendations=["Light clothing", "Sunscreen", "Compact umbrella"],
        transport_warnings=[],
    )


# =====================================================================
# RISK DETECTION
# =====================================================================

def _detect_alerts(daily_data: dict, dates: list[str]) -> list[WeatherAlert]:
    """Scan daily forecast data and produce WeatherAlert objects."""
    alerts: list[WeatherAlert] = []
    storm_dates, heat_dates, cold_dates, rain_dates, wind_dates = [], [], [], [], []

    for i, date in enumerate(dates):
        code = (daily_data.get("weather_code") or [])[i] if i < len(daily_data.get("weather_code", [])) else 0
        tmax = (daily_data.get("temperature_2m_max") or [])[i] if i < len(daily_data.get("temperature_2m_max", [])) else 20
        tmin = (daily_data.get("temperature_2m_min") or [])[i] if i < len(daily_data.get("temperature_2m_min", [])) else 10
        wind = (daily_data.get("wind_speed_10m_max") or [])[i] if i < len(daily_data.get("wind_speed_10m_max", [])) else 0
        precip = (daily_data.get("precipitation_sum") or [])[i] if i < len(daily_data.get("precipitation_sum", [])) else 0

        if code in (95, 96, 99):
            storm_dates.append(date)
        if tmax is not None and tmax >= 40:
            heat_dates.append(date)
        if tmin is not None and tmin <= 0:
            cold_dates.append(date)
        if precip is not None and precip >= 15:
            rain_dates.append(date)
        if wind is not None and wind >= 60:
            wind_dates.append(date)

    if storm_dates:
        alerts.append(WeatherAlert(
            type="STORM",
            severity="WARNING",
            message="Thunderstorm activity expected. Risk of lightning, strong winds, and heavy rain. Avoid outdoor activities.",
            dates=storm_dates,
        ))
    if heat_dates:
        alerts.append(WeatherAlert(
            type="EXTREME_HEAT",
            severity="WARNING",
            message="Extreme heat (≥40°C) expected. High risk of heat stroke. Stay hydrated and avoid afternoon outdoor activities.",
            dates=heat_dates,
        ))
    if cold_dates:
        alerts.append(WeatherAlert(
            type="EXTREME_COLD",
            severity="WATCH",
            message="Temperatures at or below freezing expected. Risk of icy roads and hypothermia.",
            dates=cold_dates,
        ))
    if rain_dates:
        alerts.append(WeatherAlert(
            type="HEAVY_RAIN",
            severity="WATCH",
            message="Heavy rainfall (≥15mm) expected. Risk of flooding and travel disruptions.",
            dates=rain_dates,
        ))
    if wind_dates:
        alerts.append(WeatherAlert(
            type="EXTREME_WIND",
            severity="WARNING",
            message="Very strong winds (≥60 km/h) expected. Outdoor activities may be hazardous.",
            dates=wind_dates,
        ))

    return alerts


def _compute_risk_level(alerts: list[WeatherAlert], wmo_codes: list[int]) -> str:
    """Determine overall trip risk from alerts and weather codes."""
    if not alerts and not wmo_codes:
        return "LOW"

    # Check alerts
    for alert in alerts:
        if alert.type in ("STORM", "EXTREME_HEAT", "EXTREME_WIND"):
            return "HIGH"
        if alert.type in ("HEAVY_RAIN", "EXTREME_COLD"):
            return "MEDIUM"

    # Check WMO codes
    code_risks = [RISK_PRIORITY[_wmo_info(c)[2]] for c in wmo_codes if c is not None]
    if not code_risks:
        return "LOW"
    max_risk = max(code_risks)
    if max_risk >= 2:
        return "HIGH"
    if max_risk == 1:
        return "MEDIUM"
    return "LOW"


# =====================================================================
# MAIN PUBLIC FUNCTION
# =====================================================================

async def fetch_weather_analysis(request: WeatherRequest) -> WeatherAnalysis:
    """
    Main entry point. Geocodes destination, fetches Open-Meteo data,
    detects risks, and returns a structured WeatherAnalysis.
    Falls back to demo data on any failure.
    """
    logger.info("Weather analysis requested for: %s (%s → %s)",
                request.destination, request.start_date, request.end_date)

    # 1. Geocode
    geo = await _geocode(request.destination)
    if geo is None:
        logger.warning("Could not geocode '%s', using demo weather", request.destination)
        return _demo_weather(request)

    lat, lon, canonical_name = geo
    logger.info("Geocoded '%s' → lat=%.4f lon=%.4f (%s)", request.destination, lat, lon, canonical_name)

    # 2. Fetch weather
    try:
        raw = await _fetch_weather(lat, lon, request.start_date, request.end_date)
    except Exception as exc:
        logger.warning("Open-Meteo fetch failed: %s — using demo weather", exc)
        return _demo_weather(request)

    # 3. Parse current conditions
    current = raw.get("current", {})
    current_temp   = current.get("temperature_2m", 0.0) or 0.0
    feels_like     = current.get("apparent_temperature", 0.0) or 0.0
    humidity       = current.get("relative_humidity_2m", 0.0) or 0.0
    wind_kmh       = current.get("wind_speed_10m", 0.0) or 0.0
    current_code   = current.get("weather_code", 0) or 0
    curr_cond, curr_icon, _ = _wmo_info(int(current_code))

    # 4. Parse daily forecast
    daily = raw.get("daily", {})
    dates = daily.get("time", [])
    daily_forecasts: list[DailyForecast] = []
    wmo_codes: list[int] = []

    for i, date_str in enumerate(dates):
        def _get(key, idx=i, default=0.0):
            vals = daily.get(key) or []
            return vals[idx] if idx < len(vals) else default

        code = int(_get("weather_code", default=0))
        wmo_codes.append(code)
        cond, icon, _ = _wmo_info(code)
        tmax   = _get("temperature_2m_max", default=25.0)
        tmin   = _get("temperature_2m_min", default=15.0)
        rain_p = _get("precipitation_probability_max", default=0.0)
        rain_m = _get("precipitation_sum", default=0.0)
        hum    = _get("relative_humidity_2m_max", default=60.0)
        wind   = _get("wind_speed_10m_max", default=10.0)
        vis    = _get("visibility_mean", default=10000.0)

        daily_forecasts.append(DailyForecast(
            date=date_str,
            condition=cond,
            temp_max=round(float(tmax), 1),
            temp_min=round(float(tmin), 1),
            rain_probability=round(float(rain_p), 1),
            rainfall_mm=round(float(rain_m), 2),
            humidity=round(float(hum), 1),
            wind_speed_kmh=round(float(wind), 1),
            visibility_km=round(float(vis) / 1000, 1) if float(vis) > 100 else round(float(vis), 1),
            icon=icon,
        ))

    # 5. Averages
    if daily_forecasts:
        avg_rain_prob = round(
            sum(d.rain_probability for d in daily_forecasts) / len(daily_forecasts), 1
        )
        overall_tmax = max(d.temp_max for d in daily_forecasts)
        overall_tmin = min(d.temp_min for d in daily_forecasts)
        temp_range = f"{overall_tmin}°C – {overall_tmax}°C"
    else:
        avg_rain_prob = 0.0
        temp_range = f"{current_temp}°C"

    # 6. Alerts + Risk level
    alerts = _detect_alerts(daily, dates)
    risk_level = _compute_risk_level(alerts, wmo_codes)
    risk_emoji = RISK_EMOJI[risk_level]

    # 7. Build static recommendation lists
    safe_activities, avoid_activities, best_times, packing, transport_warnings = (
        _build_recommendations(risk_level, alerts, daily_forecasts)
    )

    return WeatherAnalysis(
        destination=canonical_name,
        risk_level=risk_level,
        risk_emoji=risk_emoji,
        overall_condition=curr_cond,
        temperature_range=temp_range,
        current_temp=round(current_temp, 1),
        feels_like=round(feels_like, 1),
        humidity=round(humidity, 1),
        wind_speed_kmh=round(wind_kmh, 1),
        avg_rain_probability=avg_rain_prob,
        alerts=alerts,
        daily_forecast=daily_forecasts,
        # AI fields will be populated by ai_service after this call
        ai_weather_summary="",
        travel_recommendation="",
        safe_activities=safe_activities,
        activities_to_avoid=avoid_activities,
        best_travel_times=best_times,
        packing_recommendations=packing,
        transport_warnings=transport_warnings,
    )


def _build_recommendations(
    risk_level: str,
    alerts: list[WeatherAlert],
    forecasts: list[DailyForecast],
) -> tuple[list[str], list[str], list[str], list[str], list[str]]:
    """Return (safe_activities, avoid_activities, best_times, packing, transport_warnings)."""

    alert_types = {a.type for a in alerts}
    has_storm     = "STORM" in alert_types
    has_heat      = "EXTREME_HEAT" in alert_types
    has_cold      = "EXTREME_COLD" in alert_types
    has_rain      = "HEAVY_RAIN" in alert_types
    has_wind      = "EXTREME_WIND" in alert_types

    avg_rain = sum(f.rain_probability for f in forecasts) / max(len(forecasts), 1)
    avg_tmax = sum(f.temp_max for f in forecasts) / max(len(forecasts), 1)

    safe, avoid, best_times, packing, transport = [], [], [], [], []

    # Safe activities
    if risk_level == "LOW":
        safe = ["Outdoor sightseeing", "City walks", "Local markets", "Outdoor dining",
                "Cultural tours", "Day trips", "Beach / waterfront visits"]
        best_times = ["All day is generally safe", "Morning (8 AM – 12 PM) for sightseeing",
                      "Evening (6 PM – 9 PM) for dining"]
    elif risk_level == "MEDIUM":
        safe = ["Indoor museums and galleries", "Cultural sites (covered)", "Shopping malls",
                "Local restaurants", "Spa and wellness activities", "Morning walks"]
        best_times = ["Morning (7 AM – 11 AM) — best outdoor window",
                      "Avoid afternoon if rain is likely"]
    else:  # HIGH
        safe = ["Indoor activities only", "Museums", "Shopping centers",
                "Hotel-based activities", "Spa / wellness"]
        best_times = ["Check daily conditions before going out",
                      "Early morning if outdoors is necessary"]

    # Avoid activities
    if has_storm:
        avoid += ["Outdoor sightseeing during storm hours", "Water sports",
                  "High-altitude treks", "Open-air events", "Beachside activities"]
        transport.append("Storms may cause flight delays or cancellations — check airlines before departure.")
        transport.append("Road flooding possible — avoid low-lying routes during heavy rain.")
    if has_heat:
        avoid += ["Midday outdoor sightseeing (12 PM – 4 PM)", "Strenuous hikes or treks",
                  "Outdoor sports during peak heat"]
        best_times.append("Plan outdoor activities before 10 AM or after 5 PM")
        packing += ["High-SPF sunscreen", "UV-protective clothing", "Wide-brim hat",
                    "Electrolyte drinks / oral rehydration salts"]
    if has_cold:
        avoid += ["Outdoor activities without proper cold-weather gear",
                  "Mountain passes or high-altitude areas"]
        transport.append("Icy road conditions possible — drive cautiously or use public transport.")
        packing += ["Thermal underlayers", "Heavy winter jacket", "Insulated boots", "Gloves and scarf"]
    if has_rain or avg_rain > 40:
        avoid += ["Open-air events", "Hiking on muddy trails", "Rooftop dining during rain spells"]
        packing.append("Compact foldable umbrella or rain poncho")
    if has_wind:
        avoid += ["High-altitude viewpoints", "Open-deck boat rides", "Paragliding / skydiving"]
        transport.append("Strong winds may affect small aircraft, cable cars, and ferries.")

    # Default packing if empty
    if not packing:
        if avg_tmax > 30:
            packing = ["Light breathable clothing", "Sunscreen SPF 30+", "Sunglasses", "Hydration bottle"]
        elif avg_tmax < 15:
            packing = ["Warm jacket", "Layers", "Gloves"]
        else:
            packing = ["Comfortable clothing", "Light jacket for evenings", "Comfortable walking shoes"]

    return safe, avoid, best_times, packing, transport
