# AI Travel Planner

This project is split into a FastAPI backend and a Streamlit frontend.

```text
travel planner agentic ai/
|-- backend/
|   |-- config.py            # configuration loader and logger setup
|   |-- models.py            # Pydantic models (request and response schemas)
|   |-- search_service.py    # SerpAPI search, mock data, and data formatting
|   |-- ai_service.py        # CrewAI LLM initialization, recommendations, and itinerary planner
|   `-- main.py              # FastAPI app and API endpoint handlers
|-- frontend/
|   `-- app.py               # Streamlit travel UI
|-- .env
|-- .env.example
|-- requirements.txt
```

## Backend Pipeline

The backend is now clean and flat:

1. `backend/main.py` initializes the FastAPI app and directly defines the endpoint routes.
2. `backend/config.py` loads environment variables and configures application-wide logging.
3. `backend/models.py` defines type-safe Pydantic request and response models.
4. `backend/search_service.py` handles live/demo flight and hotel searches and formats search data into text.
5. `backend/ai_service.py` executes LLM-driven flight/hotel analysis recommendations and generates final day-by-day travel itineraries using CrewAI.


## Is FastAPI Used?

Yes. FastAPI is used in `backend/main.py`.

The backend exposes these API routes:

- `GET /`
- `POST /search_flights/`
- `POST /search_hotels/`
- `POST /complete_search/`
- `POST /generate_itinerary/`

## APIs Used

This project uses:

- Groq API through CrewAI for AI recommendations and itinerary generation.
- SerpAPI Google Flights and Google Hotels through `google-search-results` for travel data.

## Where To Change API Keys

Edit the `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=groq/llama-3.3-70b-versatile
SERPAPI_API_KEY=your_serpapi_key_here
CREWAI_TRACING_ENABLED=true
DEMO_MODE=true
```

Your current `.env` uses `SERPER_API_KEY`; that still works. For SerpAPI, `SERPAPI_API_KEY` is the clearer name.

`DEMO_MODE=true` means the app shows realistic sample flights and hotels when the live API returns no results or the API key is not working. Set `DEMO_MODE=false` when you want only live API data.

## Free Or Free-Tier API Options

Useful APIs for this project:

- SerpAPI: Google Flights and Google Hotels data.
- Groq: fast LLM responses for recommendations and itinerary text.
- OpenWeatherMap: weather data for trip dates.
- Geoapify: geocoding, places, and routes.
- OpenTripMap: tourist attractions and places.
- Amadeus for Developers: flight and hotel search test APIs.

## How To Run

Install dependencies:

```powershell
pip install -r requirements.txt
```

Start the backend:

```powershell
uvicorn backend.main:app --reload
```

Start the frontend in a second terminal:

```powershell
streamlit run frontend/app.py
```
