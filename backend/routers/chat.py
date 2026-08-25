"""
backend/routers/chat.py
Chat endpoints. Handles POST /chat to execute agentic turns, run function calls/fallbacks, and update history.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from backend.models.schemas import ChatRequest, ChatResponse
from backend.db.mongo import get_session_db, save_session_db
from backend.services.negotiation_engine import run_agent_turn
from backend.config import settings

router = APIRouter(tags=["Chat"])

@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Send Chat Message to Agent",
    description="Processes shopper input/objection, runs LLM agent tool calls or fallback classifier, updates conversation history, and returns assistant reply."
)
async def chat_endpoint(req: ChatRequest):
    # 1. Fetch session from database
    session_doc = await get_session_db(req.session_id)
    if not session_doc:
        # Fallback create session if missing
        session_doc = {
            "session_id": req.session_id,
            "cart": {
                "item_name": settings.DEFAULT_ITEM_NAME,
                "price": settings.DEFAULT_ITEM_PRICE,
                "quantity": 1
            },
            "history": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "applied_discount": 0
        }

    cart = session_doc.get("cart", {})
    item_name = cart.get("item_name", settings.DEFAULT_ITEM_NAME)
    item_price = cart.get("price", settings.DEFAULT_ITEM_PRICE)
    history = session_doc.get("history", [])
    applied_discount = session_doc.get("applied_discount", 0)

    # 2. Run agent turn using generalized negotiation_engine with context_type="checkout"
    agent_output = await run_agent_turn(
        history=history,
        user_message=req.message,
        item_name=item_name,
        item_price=item_price,
        session_id=req.session_id,
        current_discount=applied_discount,
        context_type="checkout"
    )

    # Update applied discount if new discount returned
    if agent_output.get("discount_percent"):
        session_doc["applied_discount"] = agent_output["discount_percent"]

    # 3. Append messages to history
    now_iso = datetime.now(timezone.utc).isoformat()
    history.append({"role": "user", "content": req.message, "timestamp": now_iso})
    history.append({"role": "assistant", "content": agent_output["reply"], "timestamp": now_iso})
    session_doc["history"] = history

    # 4. Save updated session
    await save_session_db(session_doc)

    return ChatResponse(
        session_id=req.session_id,
        reply=agent_output["reply"],
        objection_type=agent_output.get("objection_type"),
        resolution_offered=agent_output.get("resolution_offered"),
        payment_link=agent_output.get("payment_link"),
        discount_percent=agent_output.get("discount_percent"),
        payment_method=agent_output.get("payment_method")
    )
