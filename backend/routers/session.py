"""
backend/routers/session.py
Checkout session endpoints. Handles POST /session/start to initialize cart state and store session metadata in MongoDB.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from backend.models.schemas import SessionStartRequest, SessionStartResponse
from backend.db.mongo import save_session_db

router = APIRouter(tags=["Session"])

@router.post(
    "/session/start",
    response_model=SessionStartResponse,
    summary="Start Checkout Session",
    description="Creates a new checkout rescue session with cart context (item name, price, quantity) and returns a unique session_id."
)
async def start_session(req: SessionStartRequest):
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    cart_data = {
        "item_name": req.item_name,
        "price": req.price,
        "quantity": req.quantity,
        "total": req.price * req.quantity
    }
    
    session_doc = {
        "session_id": session_id,
        "cart": cart_data,
        "history": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "applied_discount": 0
    }
    
    await save_session_db(session_doc)
    
    return SessionStartResponse(
        session_id=session_id,
        message="Session successfully initialized",
        cart=cart_data
    )
