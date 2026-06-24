import os
import logging
from dataclasses import dataclass
from dotenv import load_dotenv

# Base directory setup pointing to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("travel_planner")

@dataclass(frozen=True)
class Settings:
    groq_api_key: str | None = os.getenv("GROQ_API_KEY")
    groq_model: str = os.getenv("GROQ_MODEL", "groq/llama-3.3-70b-versatile")
    serp_api_key: str | None = os.getenv("SERPAPI_API_KEY") or os.getenv("SERPER_API_KEY")
    demo_mode: bool = os.getenv("DEMO_MODE", "true").lower() in {"1", "true", "yes", "on"}

    def __post_init__(self):
        model = self.groq_model
        if model and not model.startswith("groq/"):
            object.__setattr__(self, "groq_model", "groq/" + model)
        if self.groq_api_key:
            os.environ["GROQ_API_KEY"] = self.groq_api_key

settings = Settings()

