"""
backend/services/negotiation_engine.py
Unified Payment Lifecycle Negotiation Engine for CloseIt.
Generalizes LLM function-calling, prompt engineering, and fallback classification across commercial contexts.
Supports context_type: "checkout" (with seams for "subscription" and "invoice").
"""

import json
import logging
import re
from typing import List, Dict, Any, Tuple
import httpx
from backend.config import settings
from backend.services.payments import create_payment_link_service
from backend.services.policy_engine import (
    validate_discount,
    validate_payment_method,
    validate_quantity,
)

logger = logging.getLogger("closeit.engine")

# 1. Tool Declarations Scoped by Context Type
CHECKOUT_TOOLS = [
    {
        "name": "offer_discount",
        "description": "Offer an instant percentage discount on the current cart item to resolve price objections.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "percent": {
                    "type": "INTEGER",
                    "description": "Discount percentage to offer (e.g. 5, 10, 15)."
                }
            },
            "required": ["percent"]
        }
    },
    {
        "name": "switch_payment_method",
        "description": "Highlight or switch to an alternate payment method (e.g. EMI, UPI, or Cash on Delivery) to resolve payment friction.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "method": {
                    "type": "STRING",
                    "enum": ["emi", "upi", "cod"],
                    "description": "The alternative payment method offered to the customer."
                }
            },
            "required": ["method"]
        }
    },
    {
        "name": "create_payment_link",
        "description": "Generate a Razorpay Payment Link when the customer expresses readiness to purchase.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "amount": {
                    "type": "NUMBER",
                    "description": "Final total payment amount after any applied discount."
                }
            },
            "required": ["amount"]
        }
    }
]

def get_tools_for_context(context_type: str = "checkout") -> List[Dict[str, Any]]:
    """Returns function declarations scoped to the specific commercial context."""
    if context_type == "checkout":
        return [{"function_declarations": CHECKOUT_TOOLS}]
    # Seams reserved for future Checkpoints (subscription, invoice)
    return [{"function_declarations": CHECKOUT_TOOLS}]

# 2. System Prompt Builders Scoped by Context Type
def build_system_prompt(item_name: str, item_price: float, context_type: str = "checkout") -> str:
    """Builds dynamic system prompt based on context_type and record metadata."""
    if context_type == "checkout":
        return f"""You are CloseIt, a helpful and natural checkout-rescue shopping assistant for {settings.STORE_NAME}.
Your goal is to warmly resolve shopper hesitations and close the sale.

Current Cart Context:
- Item: {item_name}
- Regular Price: ₹{item_price:,.2f}

Guidelines:
1. Keep replies short (1-2 concise sentences max), warm, helpful, and never salesy.
2. If the user mentions price, cost, or budget, call function `offer_discount(percent)`.
3. If the user mentions payment methods, installments, UPI, or COD, call function `switch_payment_method(method)`.
4. If the user accepts an offer or says they are ready to buy/pay, call function `create_payment_link(amount)`.

Few-Shot Conversation Examples:
User: "This is a bit expensive for me right now."
Assistant: [Calls offer_discount(percent=10)] "I understand! How about a 10% instant discount? That brings your price down to ₹4,499."

User: "Can I pay in installments or via UPI?"
Assistant: [Calls switch_payment_method(method="emi")] "Absolutely! We support No-Cost EMI starting at ₹833/month, as well as instant UPI."

User: "Okay awesome, send me the payment link."
Assistant: [Calls create_payment_link(amount=4499.0)] "Here is your exclusive checkout link with the discount applied. Tap below to complete your order!"
"""
    return build_system_prompt(item_name, item_price, "checkout")

# 3. Fallback Keyword Classifier
def fallback_keyword_classifier(
    user_message: str,
    cart_item: str,
    base_price: float,
    current_discount: int = 0,
    context_type: str = "checkout"
) -> Tuple[str, Dict[str, Any]]:
    """
    Keyword-based fallback objection classifier used if LLM call fails, times out (>5s), or API key is missing.
    """
    msg = user_message.lower()
    effective_price = base_price * (1 - (current_discount / 100))
    
    # 1. Price Objection
    if any(k in msg for k in ["expensive", "price", "cost", "cheaper", "discount", "budget", "high", "money", "afford"]):
        discount = 10
        new_price = base_price * (1 - (discount / 100))
        reply = f"I completely understand! How about a 10% instant discount on the {cart_item}? That brings it down to ₹{new_price:,.0f}."
        return reply, {
            "tool_called": "offer_discount",
            "objection_type": "price",
            "resolution_offered": "10% discount",
            "discount_percent": discount
        }
        
    # 2. Payment Method Objection
    elif any(k in msg for k in ["emi", "installment", "upi", "cod", "cash", "pay later", "card"]):
        if "emi" in msg or "installment" in msg:
            method = "emi"
            monthly = round(effective_price / 6)
            reply = f"We offer No-Cost EMI starting at just ₹{monthly}/month for 6 months with zero extra fees."
        elif "upi" in msg:
            method = "upi"
            reply = "You can pay instantly via GPay, PhonePe, or Paytm UPI with 1-tap checkout."
        else:
            method = "cod"
            reply = "Cash on Delivery is available with free door-step delivery."
            
        return reply, {
            "tool_called": "switch_payment_method",
            "objection_type": "payment_method",
            "resolution_offered": f"{method.upper()} option",
            "payment_method": method
        }
        
    # 3. Intent to Buy / Request Payment Link
    elif any(k in msg for k in ["pay", "buy", "link", "checkout", "deal", "yes", "ok", "okay", "send", "sure", "great"]):
        link_res = create_payment_link_service(
            amount=effective_price,
            description=f"{cart_item} - Checkout Rescue",
            session_id="fallback_session"
        )
        reply = f"Awesome! Here is your secure Razorpay checkout link for ₹{effective_price:,.0f}. Click the button below to complete your order!"
        return reply, {
            "tool_called": "create_payment_link",
            "objection_type": "converted",
            "resolution_offered": "Payment Link generated",
            "payment_link": link_res["payment_url"]
        }
        
    # 4. Default / Generic
    else:
        reply = f"We offer 7-day hassle-free returns and free express shipping on the {cart_item}. Is there anything specific holding you back?"
        return reply, {
            "tool_called": None,
            "objection_type": "trust/shipping",
            "resolution_offered": "Free shipping & 7-day returns"
        }

# 4. Main Unified Agent Turn Runner
async def run_agent_turn(
    history: List[Dict[str, str]],
    user_message: str,
    item_name: str,
    item_price: float,
    session_id: str,
    current_discount: int = 0,
    context_type: str = "checkout"
) -> Dict[str, Any]:
    """
    Executes one turn of the agent conversation with Google Gemini API (5s timeout) or fallback classifier.
    Supports context_type: 'checkout' (with seams for 'subscription' and 'invoice').
    """
    short_history = history[-6:] if len(history) > 6 else history
    
    api_key = settings.GEMINI_API_KEY
    if api_key and not api_key.startswith("AIzaSy_your"):
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
            
            system_prompt = build_system_prompt(item_name, item_price, context_type=context_type)
            tools_declarations = get_tools_for_context(context_type=context_type)
            
            gemini_contents = []
            for m in short_history:
                role = "user" if m.get("role") == "user" else "model"
                gemini_contents.append({"role": role, "parts": [{"text": m.get("content", "")}]})
            gemini_contents.append({"role": "user", "parts": [{"text": user_message}]})
            
            payload = {
                "system_instruction": {
                    "parts": [{"text": system_prompt}]
                },
                "contents": gemini_contents,
                "tools": tools_declarations
            }
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        reply_text = ""
                        action_data = {}
                        
                        for part in parts:
                            if "text" in part:
                                reply_text += part["text"]
                            elif "functionCall" in part:
                                fn = part["functionCall"]
                                fn_name = fn.get("name")
                                fn_args = fn.get("args", {})
                                
                                if fn_name == "offer_discount":
                                    percent = float(fn_args.get("percent", 10))

                                    policy_result = await validate_discount(
                                        original_price=item_price,
                                        discount_percent=percent,
                                        merchant_id="demo-merchant",
                                    )

                                    if policy_result["allowed"]:
                                        disc_price = policy_result["final_price"]

                                        action_data["objection_type"] = "price"
                                        action_data["resolution_offered"] = (
                                            f"{percent:g}% discount"
                                        )
                                        action_data["discount_percent"] = percent

                                        if not reply_text:
                                            reply_text = (
                                                f"I understand! I can offer an instant "
                                                f"{percent:g}% discount, bringing your total "
                                                f"to ₹{disc_price:,.0f}."
                                            )

                                    else:
                                        action_data["objection_type"] = "price"
                                        action_data["resolution_offered"] = (
                                            "Discount rejected by merchant policy"
                                        )
                                        action_data["discount_percent"] = None

                                        reply_text = (
                                            "I’m sorry, but I can’t offer that discount. "
                                            f"{policy_result['reason']}"
                                        )

                                elif fn_name == "switch_payment_method":
                                    method = str(
                                        fn_args.get("method", "upi")
                                    ).lower()

                                    policy_result = await validate_payment_method(
                                        method=method,
                                        merchant_id="demo-merchant",
                                    )

                                    action_data["objection_type"] = "payment_method"

                                    if policy_result["allowed"]:
                                        action_data["resolution_offered"] = (
                                            f"{method.upper()} option"
                                        )
                                        action_data["payment_method"] = method

                                        if not reply_text:
                                            reply_text = (
                                                f"We support {method.upper()} payment, "
                                                "so you can complete your purchase easily."
                                            )

                                    else:
                                        action_data["resolution_offered"] = (
                                            "Payment method rejected by merchant policy"
                                        )
                                        action_data["payment_method"] = None

                                        reply_text = (
                                            f"Sorry, {method.upper()} isn't available for "
                                            "this merchant. "
                                            f"{policy_result['reason']}"
                                        )
                                        
                                elif fn_name == "create_payment_link":
                                    # Never trust the amount proposed by the LLM.
                                    # Calculate the final amount from the validated
                                    # product price and current approved discount.

                                    discount_result = await validate_discount(
                                        original_price=item_price,
                                        discount_percent=current_discount,
                                        merchant_id="demo-merchant",
                                    )

                                    if not discount_result["allowed"]:
                                        action_data["objection_type"] = "checkout_blocked"
                                        action_data["resolution_offered"] = (
                                            "Checkout blocked by merchant policy"
                                        )

                                        reply_text = (
                                            "I can't create the payment link because "
                                            f"{discount_result['reason']}"
                                        )

                                    else:
                                        amount = discount_result["final_price"]

                                        link_res = create_payment_link_service(
                                            amount=amount,
                                            description=f"{item_name} Checkout",
                                            session_id=session_id,
                                        )

                                        action_data["objection_type"] = "checkout_ready"
                                        action_data["resolution_offered"] = (
                                            "Payment link generated"
                                        )
                                        action_data["payment_link"] = link_res["payment_url"]

                                        if not reply_text:
                                            reply_text = (
                                                f"Here is your secure payment link for "
                                                f"₹{amount:,.0f}. Click below to finish your order!"
                                            )
                        
                        if reply_text:
                            return {
                                "reply": reply_text,
                                "objection_type": action_data.get("objection_type", "general"),
                                "resolution_offered": action_data.get("resolution_offered", "Customer support"),
                                "payment_link": action_data.get("payment_link"),
                                "discount_percent": action_data.get("discount_percent"),
                                "payment_method": action_data.get("payment_method")
                            }
                else:
                    logger.warning(f"Gemini API returned HTTP {res.status_code}: {res.text}. Falling back.")
                    
        except Exception as e:
            logger.warning(f"Gemini LLM API call failed or timed out (5s limit): {e}. Using fallback classifier.")
            
    # Fallback Classifier if Gemini API key missing, invalid, or timed out
    reply_text, action = fallback_keyword_classifier(
        user_message, item_name, item_price, current_discount, context_type=context_type
    )
    return {
        "reply": reply_text,
        "objection_type": action.get("objection_type", "general"),
        "resolution_offered": action.get("resolution_offered", "Assistance offered"),
        "payment_link": action.get("payment_link"),
        "discount_percent": action.get("discount_percent"),
        "payment_method": action.get("payment_method")
    }
