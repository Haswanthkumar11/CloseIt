"""
Merchant Policy Engine for CloseIt.

The LLM may propose a commercial action, but this service
decides whether that action is permitted by the merchant's
rules stored in MongoDB.
"""

import asyncio
import logging
from typing import Any, Dict, Optional

from backend.db.mongo import get_database

logger = logging.getLogger("closeit.policy")


DEFAULT_MERCHANT_POLICY: Dict[str, Any] = {
    "merchant_name": "AuraCommerce Premium Audio",
    "negotiation": {
        "enabled": True,
        "max_discount_percent": 20.0,
        "allow_auto_approval": True,
    },
    "payment": {
        "allowed_methods": ["emi", "upi", "cod", "card"],
        "installment_rules": {
            "enabled": True,
            "min_amount": 1000.0,
            "max_months": 12,
        },
    },
    "agent_limits": {
        "max_quantity": 10,
    },
}


async def get_merchant_policy(
    merchant_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Load the single global merchant policy from MongoDB, falling back to default if unavailable."""

    db = get_database()

    if db is not None:
        try:
            policy = await asyncio.wait_for(
                db.merchant_policies.find_one({}, {"_id": 0}),
                timeout=1.5
            )
            if policy:
                return policy
        except Exception as e:
            logger.warning(f"Reading merchant policy from Mongo timed out or failed ({e}); using default policy.")

    return DEFAULT_MERCHANT_POLICY


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


async def validate_subscription_discount(
    original_price: float,
    discount_percent: float,
    merchant_id: str = "demo-merchant",
) -> Dict[str, Any]:
    """
    Validate whether a requested subscription/recharge discount is allowed.
    Enforces max_subscription_discount_percent (default 10%).
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
    max_discount = float(negotiation.get("max_subscription_discount_percent", 10.0))

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
                f"merchant subscription maximum of {max_discount}%."
            ),
            "original_price": original_price,
            "discount_percent": discount_percent,
            "final_price": original_price,
        }

    final_price = round(original_price * (1 - discount_percent / 100), 2)
    return {
        "allowed": True,
        "reason": "Discount is within merchant subscription policy.",
        "original_price": original_price,
        "discount_percent": discount_percent,
        "final_price": final_price,
    }


async def validate_invoice_partial_payment(
    invoice_amount: float,
    amount_now: float,
    merchant_id: str = "demo-merchant",
) -> Dict[str, Any]:
    """
    Validate whether a proposed partial payment meets the merchant minimum percentage threshold (default 30%).
    """
    policy = await get_merchant_policy(merchant_id)
    min_pct = float(policy.get("invoice_rules", {}).get("minimum_partial_payment_percent", 30.0)) if policy else 30.0

    if invoice_amount <= 0:
        return {"allowed": False, "reason": "Invalid invoice amount."}

    actual_pct = (amount_now / invoice_amount) * 100

    if actual_pct < min_pct:
        required_min = round(invoice_amount * (min_pct / 100), 2)
        return {
            "allowed": False,
            "reason": (
                f"Proposed initial payment of ₹{amount_now:,.0f} ({actual_pct:.1f}%) is below "
                f"the merchant minimum requirement of {min_pct:g}% (at least ₹{required_min:,.0f} required)."
            ),
            "amount_now": amount_now,
            "actual_percent": round(actual_pct, 1),
            "required_min_amount": required_min,
            "min_percent_required": min_pct
        }

    amount_later = round(invoice_amount - amount_now, 2)
    return {
        "allowed": True,
        "reason": f"Partial payment of ₹{amount_now:,.0f} ({actual_pct:.1f}%) meets merchant minimum requirement of {min_pct:g}%.",
        "amount_now": amount_now,
        "amount_later": amount_later,
        "actual_percent": round(actual_pct, 1),
        "min_percent_required": min_pct
    }


async def validate_invoice_extension(
    extension_days: int,
    merchant_id: str = "demo-merchant",
) -> Dict[str, Any]:
    """
    Validate whether a proposed due-date extension is within maximum allowed days (default 30 days).
    """
    policy = await get_merchant_policy(merchant_id)
    max_days = int(policy.get("invoice_rules", {}).get("maximum_due_date_extension_days", 30)) if policy else 30

    if extension_days <= 0:
        return {"allowed": False, "reason": "Extension days must be greater than 0."}

    if extension_days > max_days:
        return {
            "allowed": False,
            "reason": (
                f"Requested extension of {extension_days} days exceeds "
                f"the merchant maximum limit of {max_days} days."
            ),
            "extension_days": extension_days,
            "max_allowed_days": max_days
        }

    return {
        "allowed": True,
        "reason": f"Extension of {extension_days} days is within the merchant maximum limit of {max_days} days.",
        "extension_days": extension_days,
        "max_allowed_days": max_days
    }


async def validate_invoice_discount(
    invoice_amount: float,
    discount_percent: float,
    merchant_id: str = "demo-merchant",
) -> Dict[str, Any]:
    """
    Validate whether a proposed invoice discount is within policy limits (default 10%).
    """
    policy = await get_merchant_policy(merchant_id)
    max_discount = float(policy.get("invoice_rules", {}).get("max_invoice_discount_percent", 10.0)) if policy else 10.0

    if discount_percent < 0:
        return {"allowed": False, "reason": "Discount cannot be negative."}

    if discount_percent > max_discount:
        return {
            "allowed": False,
            "reason": (
                f"Requested discount of {discount_percent}% exceeds "
                f"merchant maximum limit of {max_discount}%."
            ),
            "original_amount": invoice_amount,
            "discount_percent": discount_percent,
            "max_allowed_percent": max_discount
        }

    final_amount = round(invoice_amount * (1 - discount_percent / 100), 2)
    return {
        "allowed": True,
        "reason": f"Invoice discount of {discount_percent}% is within merchant policy limits.",
        "original_amount": invoice_amount,
        "discount_percent": discount_percent,
        "final_amount": final_amount
    }


