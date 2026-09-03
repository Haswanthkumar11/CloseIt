"""
backend/routers/subscription.py
API router for Smart Recharge & Subscription Rescue.
Handles plan discovery, factual plan recommendations, context-aware negotiation,
strict policy authorization, and audit logging.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime

from backend.services.subscription_service import (
    get_all_plans,
    get_plan_by_id,
    get_plan_recommendations,
)
from backend.services.negotiation_engine import run_agent_turn
from backend.services.policy_engine import validate_subscription_discount
from backend.services.payments import create_payment_link_service
from backend.db.mongo import save_audit_event_db, get_audit_events_db, save_outcome_db

router = APIRouter(prefix="/subscription", tags=["Subscription & Recharge"])

class SelectPlanRequest(BaseModel):
    plan_id: str
    user_id: Optional[str] = "demo_user"

class NegotiateSubscriptionRequest(BaseModel):
    session_id: str
    selected_plan_id: str
    user_message: str
    history: Optional[List[Dict[str, Any]]] = []
    current_discount: Optional[int] = 0

@router.get("/plans")
async def get_plans():
    """Returns MongoDB-backed catalog of recharge plans."""
    plans = await get_all_plans()
    return {"plans": plans, "total": len(plans)}

@router.get("/recommendations/{plan_id}")
async def get_recommendations(plan_id: str):
    """Returns factual mathematical plan recommendations for a selected plan ID."""
    result = await get_plan_recommendations(plan_id)
    
    # Record PLAN_RECOMMENDED audit event
    for rec in result.get("recommendations", []):
        await save_audit_event_db({
            "event_type": "PLAN_RECOMMENDED",
            "context_type": "subscription",
            "selected_plan_id": plan_id,
            "recommended_plan_id": rec["plan"]["id"],
            "recommendation_badge": rec.get("badge"),
            "reason": rec.get("reason"),
            "decision": "RECOMMENDED",
            "timestamp": datetime.utcnow().isoformat()
        })
        
    return result

@router.post("/negotiate")
async def negotiate_subscription(req: NegotiateSubscriptionRequest):
    """
    Handles context-aware subscription rescue chat turns.
    Validates all discounts against Policy Engine and strictly calculates final Razorpay amount on backend.
    """
    selected_plan = await get_plan_by_id(req.selected_plan_id)
    if not selected_plan:
        raise HTTPException(status_code=404, detail="Selected plan not found")
        
    # Get factual recommendations to feed into LLM prompt
    recs_data = await get_plan_recommendations(req.selected_plan_id)
    recs = recs_data.get("recommendations", [])
    
    facts_summary = []
    for r in recs:
        facts_summary.append(f"- Alternative {r['plan']['name']} ({r['plan']['id']}): ₹{r['plan']['price']} for {r['plan']['validity_days']} days ({r['reason']})")
    
    extra_context = "\nFactual Available Alternatives:\n" + ("\n".join(facts_summary) if facts_summary else "No additional alternatives.")
    
    # Process user turn with negotiation engine
    response = await run_agent_turn(
        user_message=req.user_message,
        history=req.history or [],
        item_name=selected_plan["name"],
        item_price=selected_plan["price"],
        session_id=req.session_id,
        current_discount=req.current_discount,
        context_type="subscription"
    )
    
    # Check if a function tool was triggered
    func_call = response.get("function_call")
    if func_call:
        fn_name = func_call.get("name")
        args = func_call.get("args", {})
        
        # 1. Offer Discount: Validate via Policy Engine (capped at 10%)
        if fn_name == "offer_discount":
            requested_pct = float(args.get("percent", 10))
            policy_res = await validate_subscription_discount(
                original_price=selected_plan["price"],
                discount_percent=requested_pct
            )
            
            # Record POLICY_DECISION audit event
            await save_audit_event_db({
                "event_type": "POLICY_DECISION",
                "context_type": "subscription",
                "session_id": req.session_id,
                "selected_plan_id": req.selected_plan_id,
                "action": "offer_discount",
                "requested_discount_percent": requested_pct,
                "allowed": policy_res["allowed"],
                "reason": policy_res["reason"],
                "final_price": policy_res["final_price"],
                "timestamp": datetime.utcnow().isoformat()
            })
            
            if policy_res["allowed"]:
                response["applied_discount_percent"] = requested_pct
                response["final_price"] = policy_res["final_price"]
                response["reply_text"] += f" I've applied an exclusive {requested_pct}% discount! Your final price is ₹{policy_res['final_price']}."
            else:
                response["reply_text"] = f"I'm sorry, I can only offer up to a 10% instant discount per merchant policy. Would you like a 10% discount bringing your plan to ₹{round(selected_plan['price'] * 0.9, 2)}?"
                response["applied_discount_percent"] = 10
                response["final_price"] = round(selected_plan["price"] * 0.9, 2)
                
        # 2. Switch Plan: Fetch target plan and switch context
        elif fn_name == "switch_subscription_plan":
            new_plan_id = args.get("new_plan_id")
            target_plan = await get_plan_by_id(new_plan_id)
            if target_plan:
                response["switched_plan"] = target_plan
                await save_audit_event_db({
                    "event_type": "PLAN_SWITCHED",
                    "context_type": "subscription",
                    "session_id": req.session_id,
                    "from_plan_id": req.selected_plan_id,
                    "to_plan_id": new_plan_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
        # 3. Create Payment Link: STRICT backend price calculation
        elif fn_name == "create_payment_link":
            # Security Rule: Ignore arbitrary LLM amount! Calculate backend final price cleanly.
            disc = response.get("applied_discount_percent", req.current_discount or 0)
            verified_amount = round(selected_plan["price"] * (1 - disc / 100), 2)
            
            link_res = await create_payment_link_service(
                amount=verified_amount,
                description=f"Smart Recharge: {selected_plan['name']} ({selected_plan['validity_days']} Days)",
                customer_name="Shopper",
                customer_email="shopper@example.com"
            )
            
            response["payment_link"] = link_res.get("short_url")
            
            # Log outcome & audit event
            await save_outcome_db({
                "session_id": req.session_id,
                "item_name": selected_plan["name"],
                "objection_type": "recharge_hesitation",
                "resolution_type": "plan_negotiation",
                "original_amount": selected_plan["price"],
                "recovered_amount": verified_amount,
                "status": "RECOVERED",
                "timestamp": datetime.utcnow().isoformat()
            })
            
            await save_audit_event_db({
                "event_type": "PAYMENT_LINK_CREATED",
                "context_type": "subscription",
                "session_id": req.session_id,
                "plan_id": selected_plan["id"],
                "verified_amount": verified_amount,
                "payment_url": link_res.get("short_url"),
                "timestamp": datetime.utcnow().isoformat()
            })

    return response

@router.get("/audit-logs")
async def get_audit_logs():
    """Returns chronological audit trail of all policy decisions and recommendations."""
    events = await get_audit_events_db()
    return {"audit_events": events, "total": len(events)}
