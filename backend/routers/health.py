"""
backend/routers/health.py
Health check endpoint returning system status and MongoDB Atlas connection status.
"""

from datetime import datetime, timezone
from fastapi import APIRouter
from backend.models.schemas import HealthResponse
from backend.db.mongo import check_db_health

router = APIRouter(tags=["Health"])

@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Backend & Database Health Check",
    description="Returns backend uptime status, MongoDB Atlas connectivity info, and current server UTC timestamp."
)
async def health_check():
    db_health = await check_db_health()
    return HealthResponse(
        status="healthy",
        database=db_health,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
