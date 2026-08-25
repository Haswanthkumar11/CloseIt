"""
backend/services/payments.py
Razorpay Test Mode Payment Links integration module.
Reads RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from settings and interacts with Razorpay Payment Links API.
Includes resilient fallback mock link generator if test credentials are not provided or API call fails during testing.
"""

import logging
import razorpay
from backend.config import settings

logger = logging.getLogger("closeit.payments")

def get_razorpay_client():
    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        try:
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            return client
        except Exception as e:
            logger.warning(f"Failed to initialize Razorpay client: {e}")
    return None

def create_payment_link_service(amount: float, description: str, session_id: str | None = None) -> dict:
    """
    Creates a Razorpay Payment Link in Test Mode.
    Returns dict containing status, payment_link_id, payment_url, amount, description.
    """
    client = get_razorpay_client()
    
    # Amount in Razorpay API is in paise (multiply INR by 100)
    amount_in_paise = int(round(amount * 100))
    
    if client:
        try:
            payload = {
                "amount": amount_in_paise,
                "currency": "INR",
                "accept_partial": False,
                "description": description,
                "customer": {
                    "name": "Valued Shopper",
                    "email": "shopper@example.com",
                    "contact": "+919876543210"
                },
                "notify": {
                    "sms": False,
                    "email": False
                },
                "reminder_enable": False,
                "notes": {
                    "session_id": session_id or "direct_test",
                    "app": "CloseIt Checkout Rescue"
                }
            }
            res = client.payment_link.create(payload)
            return {
                "status": "created",
                "payment_link_id": res.get("id", "plink_test"),
                "payment_url": res.get("short_url", f"https://rzp.io/i/test_{session_id or 'checkout'}"),
                "amount": amount,
                "description": description
            }
        except Exception as e:
            logger.error(f"Razorpay API call failed: {e}. Falling back to test link format.")
    
    # Fallback/Test mode mock link generator if credentials are placeholder
    mock_id = f"plink_test_{int(amount)}"
    mock_url = f"https://rzp.io/i/closeit_demo_{mock_id}"
    return {
        "status": "mock_created",
        "payment_link_id": mock_id,
        "payment_url": mock_url,
        "amount": amount,
        "description": f"{description} (Razorpay Test Mode Link)"
    }
