import os
import logging
from dataclasses import dataclass
from dotenv import load_dotenv

# Base directory pointing to project root
BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

# Load .env and override old environment values
load_dotenv(
    os.path.join(BASE_DIR, ".env"),
    override=True
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger("travel_planner")


@dataclass(frozen=True)
class Settings:

    groq_api_key: str | None = os.getenv("GROQ_API_KEY")

    groq_model: str = os.getenv(
        "GROQ_MODEL",
        "groq/openai/gpt-oss-120b"
    )

    serp_api_key: str | None = (
        os.getenv("SERPAPI_API_KEY")
        or os.getenv("SERPER_API_KEY")
    )

    demo_mode: bool = (
        os.getenv("DEMO_MODE", "true").lower()
        in {"1", "true", "yes", "on"}
    )

    # ── Database ─────────────────────────────────────────────────────────────
    db_host:     str       = os.getenv("DB_HOST", "localhost")
    db_port:     str       = os.getenv("DB_PORT", "3306")
    db_name:     str       = os.getenv("DB_NAME", "travel_planner")
    db_user:     str       = os.getenv("DB_USER", "root")
    db_password: str       = os.getenv("DB_PASSWORD", "")

    # ── JWT ───────────────────────────────────────────────────────────────────
    jwt_secret_key: str    = os.getenv(
        "JWT_SECRET_KEY",
        "travel_planner_change_this_secret_key_in_production"
    )
    access_token_expire_minutes: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )

    def __post_init__(self):

        if self.groq_api_key:
            os.environ["GROQ_API_KEY"] = self.groq_api_key


settings = Settings()

# Temporary debugging
logger.info(
    "CONFIG LOADED - GROQ MODEL: %s",
    settings.groq_model
)

