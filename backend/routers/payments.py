"""
backend/routers/payments.py
Payment endpoints. Exposes POST /create-payment-link for generating Razorpay Test Mode Payment Links.
"""

from fastapi import APIRouter
from backend.models.schemas import CreatePaymentLinkRequest, CreatePaymentLinkResponse
from backend.services.payments import create_payment_link_service

router = APIRouter(tags=["Payments"])

@router.post(
    "/create-payment-link",
    response_model=CreatePaymentLinkResponse,
    summary="Create Razorpay Payment Link",
    description="Generates a live Razorpay Test Mode Payment Link for a specified amount and description."
)
async def create_payment_link_endpoint(req: CreatePaymentLinkRequest):
    result = create_payment_link_service(
        amount=req.amount,
        description=req.description,
        session_id=req.session_id
    )
    return CreatePaymentLinkResponse(**result)
