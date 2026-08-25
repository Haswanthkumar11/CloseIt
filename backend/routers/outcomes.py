"""
backend/routers/outcomes.py
Outcome logging endpoints. Exposes POST /log-outcome to store checkout results and GET /outcomes to retrieve metrics.
"""

from datetime import datetime, timezone
from fastapi import APIRouter
from backend.models.schemas import LogOutcomeRequest, OutcomeResponse, OutcomesListResponse
from backend.db.mongo import save_outcome_db, get_outcomes_db

router = APIRouter(tags=["Outcomes"])

@router.post(
    "/log-outcome",
    response_model=OutcomeResponse,
    summary="Log Session Rescue Outcome",
    description="Records the final outcome of a checkout rescue session (objection type, resolution offered, conversion status, recovered amount)."
)
async def log_outcome(req: LogOutcomeRequest):
    outcome_doc = {
        "session_id": req.session_id,
        "objection_type": req.objection_type,
        "resolution": req.resolution,
        "converted": req.converted,
        "recovered_amount": req.recovered_amount if req.converted else 0.0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await save_outcome_db(outcome_doc)
    
    return OutcomeResponse(**outcome_doc)

@router.get(
    "/outcomes",
    response_model=OutcomesListResponse,
    summary="Get Logged Outcomes",
    description="Returns all logged session rescue outcomes sorted newest first, along with aggregate recovery statistics."
)
async def get_outcomes():
    raw_outcomes = await get_outcomes_db()
    
    outcomes_list = [
        OutcomeResponse(
            session_id=item.get("session_id", "unknown"),
            objection_type=item.get("objection_type", "other"),
            resolution=item.get("resolution", "None"),
            converted=item.get("converted", False),
            recovered_amount=float(item.get("recovered_amount", 0.0)),
            timestamp=item.get("timestamp", "")
        )
        for item in raw_outcomes
    ]
    
    total_count = len(outcomes_list)
    converted_count = sum(1 for o in outcomes_list if o.converted)
    total_recovered = sum(o.recovered_amount for o in outcomes_list if o.converted)
    
    return OutcomesListResponse(
        outcomes=outcomes_list,
        total_count=total_count,
        converted_count=converted_count,
        total_recovered_amount=total_recovered
    )
