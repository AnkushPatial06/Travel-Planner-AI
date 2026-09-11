"""
backend/api/health.py
======================
Database health check endpoint.
"""

from fastapi import APIRouter
from backend.database.connection import check_db_connection

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("/db")
def db_health():
    """Check MySQL database connectivity."""
    ok = check_db_connection()
    return {
        "status": "ok" if ok else "error",
        "database": "mysql",
        "connected": ok,
    }
