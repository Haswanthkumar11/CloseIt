"""
backend/services/invoice_service.py
Data access and status management service for Invoice Recovery.
Contains no LLM logic. Interacts purely with database helpers.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.db.mongo import get_invoices_db, get_invoice_by_id_db, save_invoice_db

async def get_all_invoices() -> List[Dict[str, Any]]:
    """Returns all invoices from database."""
    return await get_invoices_db()

async def get_invoice_by_id(invoice_id: str) -> Optional[Dict[str, Any]]:
    """Returns specific invoice by ID."""
    return await get_invoice_by_id_db(invoice_id)

async def create_invoice(invoice_data: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a new invoice record."""
    if "id" not in invoice_data:
        invoice_data["id"] = f"inv_{int(datetime.utcnow().timestamp())}"
    if "status" not in invoice_data:
        invoice_data["status"] = "pending"
    if "negotiation_history" not in invoice_data:
        invoice_data["negotiation_history"] = []
    
    await save_invoice_db(invoice_data)
    return invoice_data

async def mark_invoice_overdue(invoice_id: str) -> Optional[Dict[str, Any]]:
    """Marks an invoice as overdue."""
    inv = await get_invoice_by_id(invoice_id)
    if not inv:
        return None
    inv["status"] = "overdue"
    await save_invoice_db(inv)
    return inv

async def update_invoice_status(invoice_id: str, status: str, details: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Updates invoice status and attaches resolution details."""
    inv = await get_invoice_by_id(invoice_id)
    if not inv:
        return None
    inv["status"] = status
    if details:
        inv["resolution_details"] = details
    await save_invoice_db(inv)
    return inv

async def add_negotiation_event(invoice_id: str, event_type: str, details: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Appends an event to an invoice's negotiation history."""
    inv = await get_invoice_by_id(invoice_id)
    if not inv:
        return None
    
    event_entry = {
        "event_type": event_type,
        "details": details,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    history = inv.get("negotiation_history", [])
    history.append(event_entry)
    inv["negotiation_history"] = history
    await save_invoice_db(inv)
    return inv
