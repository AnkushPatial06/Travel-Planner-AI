"""
backend/database/connection.py
================================
SQLAlchemy engine, session factory, declarative base, and FastAPI dependency.
All credentials are read from environment variables — never hardcoded.
"""

import os
from typing import Generator
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from dotenv import load_dotenv


# Load .env from the project root and make sure it overrides
# any old DB_* environment variables.
load_dotenv(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        ".env"
    ),
    override=True
)


# ── Read database settings from environment ──────────────────────────────────
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "travel_planner")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")


# ── Encode password safely ───────────────────────────────────────────────────
# Important when password contains characters such as:
# @ : / ? # % &
DB_PASSWORD_ENCODED = quote_plus(DB_PASSWORD)


# ── Build connection URL ─────────────────────────────────────────────────────
DATABASE_URL = (
    f"mysql+pymysql://"
    f"{DB_USER}:"
    f"{DB_PASSWORD_ENCODED}@"
    f"{DB_HOST}:"
    f"{DB_PORT}/"
    f"{DB_NAME}"
    f"?charset=utf8mb4"
)


# ── Engine ───────────────────────────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
    echo=False,
)


# ── Session factory ──────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ── Declarative base ─────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── FastAPI dependency ───────────────────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """Yield a database session and guarantee it closes after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Database health check ────────────────────────────────────────────────────
def check_db_connection() -> bool:
    """Return True if the database is reachable, False otherwise."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False