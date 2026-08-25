"""
Merchant Policy Engine for CloseIt.

The LLM may propose a commercial action, but this service
decides whether that action is permitted by the merchant's
rules stored in MongoDB.
"""

import logging
from typing import Any, Dict, Optional

from backend.db.mongo import get_database

logger = logging.getLogger("closeit.policy")


async def get_merchant_policy(
    merchant_id: str = "demo-merchant",
) -> Optional[Dict[str, Any]]:
    """Load the merchant policy from MongoDB."""

    db = get_database()

    if db is None:
        logger.error("MongoDB database is unavailable.")
        return None

    try:
        policy = await db.merchant_policies.find_one(
            {"merchant_id": merchant_id},
            {"_id": 0},
        )
        return policy

    except Exception as e:
        logger.error(f"Error reading merchant policy: {e}")
        return None


async def validate_discount(
    original_price: float,
    discount_percent: float,
    merchant_id: str = "demo-merchant",
) -> Dict[str, Any]:
    """
    Validate whether a requested discount is allowed.

    Returns:
        {
            "allowed": bool,
            "reason": str,
            "original_price": float,
            "discount_percent": float,
            "final_price": float
        }
    """

    policy = await get_merchant_policy(merchant_id)

    if policy is None:
        return {
            "allowed": False,
            "reason": "Merchant policy could not be loaded.",
            "original_price": original_price,
            "discount_percent": discount_percent,
            "final_price": original_price,
        }

    negotiation = policy.get("negotiation", {})

    if not negotiation.get("enabled", False):
        return {
            "allowed": False,
            "reason": "Negotiation is disabled for this merchant.",
            "original_price": original_price,
            "discount_percent": discount_percent,
            "final_price": original_price,
        }

    max_discount = float(
        negotiation.get("max_discount_percent", 0)
    )

    if discount_percent < 0:
        return {
            "allowed": False,
            "reason": "Discount cannot be negative.",
            "original_price": original_price,
            "discount_percent": discount_percent,
            "final_price": original_price,
        }

    if discount_percent > max_discount:
        return {
            "allowed": False,
            "reason": (
                f"Requested discount of {discount_percent}% exceeds "
                f"merchant maximum of {max_discount}%."
            ),
            "original_price": original_price,
            "discount_percent": discount_percent,
            "final_price": original_price,
        }

    final_price = round(
        original_price * (1 - discount_percent / 100),
        2,
    )

    return {
        "allowed": True,
        "reason": "Discount is within merchant policy.",
        "original_price": original_price,
        "discount_percent": discount_percent,
        "final_price": final_price,
    }


async def validate_payment_method(
    method: str,
    merchant_id: str = "demo-merchant",
) -> Dict[str, Any]:
    """Validate whether a payment method is permitted."""

    policy = await get_merchant_policy(merchant_id)

    if policy is None:
        return {
            "allowed": False,
            "reason": "Merchant policy could not be loaded.",
        }

    allowed_methods = [
        str(method).lower()
        for method in policy.get("payment", {}).get(
            "allowed_methods", []
        )
    ]

    normalized_method = str(method).lower()

    if normalized_method not in allowed_methods:
        return {
            "allowed": False,
            "reason": (
                f"Payment method '{normalized_method}' is not "
                f"allowed by the merchant."
            ),
        }

    return {
        "allowed": True,
        "reason": "Payment method is allowed.",
        "payment_method": normalized_method,
    }


async def validate_quantity(
    quantity: int,
    merchant_id: str = "demo-merchant",
) -> Dict[str, Any]:
    """Validate the requested quantity."""

    policy = await get_merchant_policy(merchant_id)

    if policy is None:
        return {
            "allowed": False,
            "reason": "Merchant policy could not be loaded.",
        }

    max_quantity = int(
        policy.get("agent_limits", {}).get("max_quantity", 1)
    )

    if quantity < 1:
        return {
            "allowed": False,
            "reason": "Quantity must be at least 1.",
        }

    if quantity > max_quantity:
        return {
            "allowed": False,
            "reason": (
                f"Requested quantity {quantity} exceeds "
                f"merchant maximum of {max_quantity}."
            ),
        }

    return {
        "allowed": True,
        "reason": "Quantity is within merchant policy.",
        "quantity": quantity,
    }
