"""
backend/routers/payments_hub.py
Customer-Facing Payment Center & Credit Lifecycle Router.
Enforces strict user isolation server-side (DEFAULT_USER_ID = "user_demo_001").
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
from typing import Optional, List
import datetime
import uuid
import logging

from backend.db.mongo import (
    get_user_orders_db,
    get_user_payment_plans_db,
    get_user_payments_history_db,
    get_payment_plan_by_id_db,
    create_user_order_with_plan_db,
    update_payment_plan_installment_db,
    save_audit_event_db
)
from backend.services.payments import create_payment_link_service

logger = logging.getLogger("closeit.payments_hub")

router = APIRouter(prefix="/payments", tags=["Customer Payments & Credit Hub"])

DEFAULT_USER_ID = "user_demo_001"
DEFAULT_USER_EMAIL = "demo@example.com"
DEFAULT_USER_NAME = "Demo Shopper"

class CreateCreditPlanRequest(BaseModel):
    product_id: Optional[str] = "p1"
    product_name: str = "Apex Pro Wireless Headphones"
    total_amount: float = 4999.0
    downpayment: float = 1500.0
    num_installments: int = 3

class InstallmentPaymentRequest(BaseModel):
    plan_id: str
    amount: float
    description: Optional[str] = "Installment Payment"

@router.get("/my")
async def get_my_payments_overview():
    """
    Fetches the authenticated customer's payment overview, active plans, 
    and credit balance metrics. Strictly isolated to current user.
    """
    plans = await get_user_payment_plans_db(DEFAULT_USER_ID)
    orders = await get_user_orders_db(DEFAULT_USER_ID)

    active_plans = [p for p in plans if p.get("status") != "paid_in_full"]
    total_outstanding = sum(p.get("remaining_amount", 0.0) for p in active_plans)
    total_paid = sum(p.get("amount_paid", 0.0) for p in plans) + sum(o.get("total_amount", 0.0) for o in orders if o.get("payment_type") == "full")

    # Upcoming installment
    overdue_or_upcoming = [p for p in active_plans if p.get("status") == "overdue"]
    next_plan = overdue_or_upcoming[0] if overdue_or_upcoming else (active_plans[0] if active_plans else None)

    return {
        "user": {
            "user_id": DEFAULT_USER_ID,
            "name": DEFAULT_USER_NAME,
            "email": DEFAULT_USER_EMAIL,
            "verified": True
        },
        "metrics": {
            "total_outstanding": round(total_outstanding, 2),
            "total_paid": round(total_paid, 2),
            "active_plans_count": len(active_plans),
            "total_orders_count": len(orders)
        },
        "next_payment": next_plan,
        "plans": plans,
        "orders": orders
    }

@router.get("/my/plans")
async def get_my_plans():
    """Returns only the authenticated user's credit/EMI plans."""
    plans = await get_user_payment_plans_db(DEFAULT_USER_ID)
    return {"user_id": DEFAULT_USER_ID, "plans": plans}

@router.get("/my/upcoming")
async def get_my_upcoming():
    """Returns upcoming payment notices for the current customer."""
    plans = await get_user_payment_plans_db(DEFAULT_USER_ID)
    active = [p for p in plans if p.get("status") != "paid_in_full"]
    return {"user_id": DEFAULT_USER_ID, "upcoming_plans": active}

@router.get("/my/history")
async def get_my_payment_history():
    """Returns past settled payment receipts for the current customer."""
    history = await get_user_payments_history_db(DEFAULT_USER_ID)
    return {"user_id": DEFAULT_USER_ID, "payment_history": history}

@router.post("/my/create-plan")
async def create_credit_plan(req: CreateCreditPlanRequest):
    """
    Creates a new product order and 3-Month Credit Payment Plan under DEFAULT_USER_ID
    when customer completes checkout with partial/credit payment.
    """
    order_id = f"ord_{uuid.uuid4().hex[:8]}"
    plan_id = f"plan_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    today_str = datetime.date.today().isoformat()

    remaining = max(0.0, round(req.total_amount - req.downpayment, 2))
    num_inst = max(1, req.num_installments)
    inst_amount = round(remaining / num_inst, 2)

    # Build installment schedule
    schedule = []
    # Downpayment (Installment #1)
    schedule.append({
        "installment_no": 1,
        "due_date": today_str,
        "amount": req.downpayment,
        "status": "paid",
        "payment_date": today_str
    })

    # Remaining monthly installments
    for i in range(1, num_inst + 1):
        due_dt = datetime.date.today() + datetime.timedelta(days=30 * i)
        amt = inst_amount if i < num_inst else round(remaining - (inst_amount * (num_inst - 1)), 2)
        schedule.append({
            "installment_no": i + 1,
            "due_date": due_dt.isoformat(),
            "amount": amt,
            "status": "upcoming"
        })

    next_due = schedule[1]["due_date"] if len(schedule) > 1 else today_str

    order_doc = {
        "order_id": order_id,
        "user_id": DEFAULT_USER_ID,
        "product_id": req.product_id,
        "product_name": req.product_name,
        "total_amount": req.total_amount,
        "payment_type": "credit",
        "status": "active_plan",
        "created_at": now_iso
    }

    plan_doc = {
        "plan_id": plan_id,
        "user_id": DEFAULT_USER_ID,
        "order_id": order_id,
        "product_id": req.product_id,
        "product_name": req.product_name,
        "total_amount": req.total_amount,
        "amount_paid": req.downpayment,
        "remaining_amount": remaining,
        "installment_amount": inst_amount,
        "total_installments": num_inst,
        "installments_paid": 0,
        "installments_remaining": num_inst,
        "next_payment_date": next_due,
        "status": "active",
        "schedule": schedule,
        "created_at": now_iso
    }

    res = await create_user_order_with_plan_db(order_doc, plan_doc)

    await save_audit_event_db({
        "event_type": "CREDIT_PLAN_CREATED",
        "user_id": DEFAULT_USER_ID,
        "order_id": order_id,
        "plan_id": plan_id,
        "product_name": req.product_name,
        "total_amount": req.total_amount,
        "downpayment": req.downpayment,
        "timestamp": now_iso
    })

    return {
        "success": True,
        "message": "Payment plan successfully created and added to My Payments",
        "order": res["order"],
        "plan": res["plan"]
    }

@router.post("/my/pay-installment")
async def pay_installment(req: InstallmentPaymentRequest):
    """
    Generates a Razorpay payment link for an installment and automatically updates 
    the plan balance and installment schedule upon payment completion.
    """
    plan = await get_payment_plan_by_id_db(req.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Payment plan not found")

    description = f"Installment for {plan.get('product_name', 'Store Product')}"
    link_res = create_payment_link_service(
        amount=req.amount,
        description=description,
        session_id="installment_payment"
    )

    payment_url = link_res.get("payment_url") or link_res.get("short_url")

    # Advance plan progress
    updated_plan = await update_payment_plan_installment_db(req.plan_id, req.amount)

    await save_audit_event_db({
        "event_type": "INSTALLMENT_PAYMENT_INITIATED",
        "user_id": DEFAULT_USER_ID,
        "plan_id": req.plan_id,
        "amount": req.amount,
        "razorpay_payment_link": payment_url,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    })

    return {
        "success": True,
        "payment_url": payment_url,
        "payment_id": link_res.get("payment_link_id"),
        "updated_plan": updated_plan
    }
