"""
backend/routers/invoice.py
API Router for Invoice Recovery & B2B Debt Negotiation.
Implements thin router pattern: Invoice Service -> Negotiation Engine -> Policy Engine -> Payment Service.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.invoice_service import (
    get_all_invoices,
    get_invoice_by_id,
    create_invoice,
    mark_invoice_overdue,
    update_invoice_status,
    add_negotiation_event
)
from backend.services.email import send_email
from backend.services.negotiation_engine import run_agent_turn
from backend.services.policy_engine import (
    validate_invoice_partial_payment,
    validate_invoice_extension,
    validate_invoice_discount
)
from backend.services.payments import create_payment_link_service
from backend.db.mongo import save_audit_event_db, get_audit_events_db, save_outcome_db

router = APIRouter(prefix="/invoice", tags=["Invoice Recovery"])

class CreateInvoiceRequest(BaseModel):
    client_name: str
    client_email: str
    amount: float
    due_date: str
    description: str

class SendReminderRequest(BaseModel):
    invoice_id: str

class NegotiateInvoiceRequest(BaseModel):
    session_id: str
    invoice_id: str
    user_message: str
    history: Optional[List[Dict[str, Any]]] = []
    current_discount: Optional[int] = 0

class ConfirmArrangementRequest(BaseModel):
    session_id: str
    invoice_id: str
    arrangement_type: str  # "partial" | "extension" | "discount" | "full"
    amount_now: Optional[float] = None
    extension_days: Optional[int] = None
    discount_percent: Optional[float] = None

@router.get("/list")
async def list_invoices():
    """Returns list of all invoices."""
    invoices = await get_all_invoices()
    return {"invoices": invoices, "total": len(invoices)}

@router.post("/create")
async def create_new_invoice(req: CreateInvoiceRequest):
    """Creates a new invoice record."""
    inv = await create_invoice(req.dict())
    return {"success": True, "invoice": inv}

@router.post("/send-reminder")
async def send_invoice_reminder(req: SendReminderRequest):
    """Triggers email reminder notice and logs INVOICE_REMINDER_SENT event."""
    inv = await get_invoice_by_id(req.invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    subject = f"Payment Reminder: Overdue Invoice #{inv['id'].upper()} ({inv['description']})"
    body = (
        f"Dear {inv['client_name']},\n\n"
        f"Your invoice #{inv['id'].upper()} for {inv['description']} is overdue.\n\n"
        f"Total Amount Due: ₹{inv['amount']:,.2f}\n"
        f"Original Due Date: {inv['due_date']}\n\n"
        f"If you are facing payment difficulty, reply to discuss an alternative payment arrangement with our AI Recovery Assistant.\n\n"
        f"Best regards,\nAccounts Receivable Team"
    )

    email_res = send_email(inv["client_email"], subject, body)

    # Log audit events
    audit_data = {
        "event_type": "INVOICE_REMINDER_SENT",
        "context_type": "invoice",
        "invoice_id": inv["id"],
        "client_name": inv["client_name"],
        "client_email": inv["client_email"],
        "amount": inv["amount"],
        "dispatch_mode": email_res.get("mode", "simulated"),
        "timestamp": datetime.utcnow().isoformat()
    }
    await save_audit_event_db(audit_data)
    await add_negotiation_event(inv["id"], "INVOICE_REMINDER_SENT", audit_data)

    return {"success": True, "invoice_id": inv["id"], "email_result": email_res}

@router.post("/negotiate")
async def negotiate_invoice(req: NegotiateInvoiceRequest):
    """
    Processes context-aware invoice recovery chat turn.
    Evaluates proposed arrangements against Merchant Policy Engine deterministically.
    """
    inv = await get_invoice_by_id(req.invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Run unified negotiation engine turn with invoice context
    response = await run_agent_turn(
        user_message=req.user_message,
        history=req.history or [],
        item_name=f"Invoice #{inv['id'].upper()} ({inv['client_name']})",
        item_price=inv["amount"],
        session_id=req.session_id,
        current_discount=req.current_discount,
        context_type="invoice"
    )

    # Log audit event
    await save_audit_event_db({
        "event_type": "CUSTOMER_RESPONSE_RECEIVED",
        "context_type": "invoice",
        "session_id": req.session_id,
        "invoice_id": req.invoice_id,
        "user_message": req.user_message,
        "agent_reply": response.get("reply"),
        "timestamp": datetime.utcnow().isoformat()
    })

    return response

@router.post("/confirm")
async def confirm_invoice_arrangement(req: ConfirmArrangementRequest):
    """
    Validates proposed arrangement against Policy Engine and deterministically calculates Razorpay amount.
    """
    inv = await get_invoice_by_id(req.invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice_amount = inv["amount"]
    payable_amount = invoice_amount
    policy_res = {"allowed": True, "reason": "Standard full payment confirmed."}

    # Deterministic Policy Validation
    if req.arrangement_type == "partial":
        amount_now = req.amount_now or (invoice_amount * 0.32)
        policy_res = await validate_invoice_partial_payment(invoice_amount, amount_now)
        if not policy_res["allowed"]:
            return {
                "success": False,
                "allowed": False,
                "reason": policy_res["reason"],
                "reply": policy_res["reason"]
            }
        payable_amount = policy_res["amount_now"]

    elif req.arrangement_type == "extension":
        ext_days = req.extension_days or 15
        policy_res = await validate_invoice_extension(ext_days)
        if not policy_res["allowed"]:
            return {
                "success": False,
                "allowed": False,
                "reason": policy_res["reason"],
                "reply": policy_res["reason"]
            }
        payable_amount = invoice_amount

    elif req.arrangement_type == "discount":
        disc_pct = req.discount_percent or 10.0
        policy_res = await validate_invoice_discount(invoice_amount, disc_pct)
        if not policy_res["allowed"]:
            return {
                "success": False,
                "allowed": False,
                "reason": policy_res["reason"],
                "reply": policy_res["reason"]
            }
        payable_amount = policy_res["final_amount"]

    # Security Rule: Create Payment Link for exact backend-calculated payable_amount
    link_res = create_payment_link_service(
        amount=payable_amount,
        description=f"Invoice #{inv['id'].upper()} - {req.arrangement_type.capitalize()} Payment",
        customer_name=inv["client_name"],
        customer_email=inv["client_email"]
    )

    # Log POLICY_DECISION and PAYMENT_LINK_CREATED audit events
    audit_data = {
        "event_type": "POLICY_DECISION",
        "context_type": "invoice",
        "session_id": req.session_id,
        "invoice_id": req.invoice_id,
        "arrangement_type": req.arrangement_type,
        "allowed": policy_res["allowed"],
        "reason": policy_res["reason"],
        "payable_amount": payable_amount,
        "payment_url": link_res.get("payment_url"),
        "timestamp": datetime.utcnow().isoformat()
    }
    await save_audit_event_db(audit_data)
    await add_negotiation_event(req.invoice_id, "POLICY_DECISION_CONFIRMED", audit_data)

    # Record outcome
    await save_outcome_db({
        "session_id": req.session_id,
        "item_name": f"Invoice #{inv['id'].upper()}",
        "objection_type": f"invoice_{req.arrangement_type}",
        "resolution": policy_res["reason"],
        "converted": True,
        "recovered_amount": payable_amount,
        "status": "RECOVERED",
        "timestamp": datetime.utcnow().isoformat()
    })

    # Update invoice status
    await update_invoice_status(req.invoice_id, "arrangement_agreed", {
        "arrangement_type": req.arrangement_type,
        "payable_amount": payable_amount,
        "payment_url": link_res.get("payment_url")
    })

    return {
        "success": True,
        "allowed": True,
        "reason": policy_res["reason"],
        "payable_amount": payable_amount,
        "payment_link": link_res.get("payment_url"),
        "reply": f"Arrangement confirmed! Your payable amount is ₹{payable_amount:,.0f}. Tap below to complete payment."
    }

@router.get("/audit-logs/{invoice_id}")
async def get_invoice_audit_logs(invoice_id: str):
    """Returns chronological audit logs for a specific invoice."""
    inv = await get_invoice_by_id(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    all_events = await get_audit_events_db()
    inv_events = [e for e in all_events if e.get("invoice_id") == invoice_id]
    return {"invoice_id": invoice_id, "history": inv.get("negotiation_history", []), "audit_events": inv_events}
