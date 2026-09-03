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

SUBSCRIPTION_TOOLS = [
    {
        "name": "switch_subscription_plan",
        "description": "Switch the customer's selected plan to a higher-value, longer-validity, or cheaper alternative plan.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "new_plan_id": {
                    "type": "STRING",
                    "description": "The target plan ID (e.g. plan_399, plan_299, plan_499)."
                }
            },
            "required": ["new_plan_id"]
        }
    },
    {
        "name": "offer_discount",
        "description": "Offer a policy-approved percentage discount (up to 10% max) on the selected recharge plan.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "percent": {
                    "type": "INTEGER",
                    "description": "Discount percentage to offer (e.g. 5, 10)."
                }
            },
            "required": ["percent"]
        }
    },
    {
        "name": "create_payment_link",
        "description": "Generate a Razorpay Payment Link when the customer confirms plan selection.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "amount": {
                    "type": "NUMBER",
                    "description": "Final price after any approved discount."
                }
            },
            "required": ["amount"]
        }
    }
]

INVOICE_TOOLS = [
    {
        "name": "propose_partial_payment",
        "description": "Propose paying an initial amount now and deferring the remaining balance to a future date.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "amount_now": {
                    "type": "NUMBER",
                    "description": "Initial upfront payment amount offered today."
                },
                "later_date": {
                    "type": "STRING",
                    "description": "Deferred payment date for the balance (e.g. 2026-09-30)."
                }
            },
            "required": ["amount_now"]
        }
    },
    {
        "name": "propose_new_due_date",
        "description": "Propose extending the due date of the full invoice amount by a specified number of days.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "extension_days": {
                    "type": "INTEGER",
                    "description": "Number of days to extend the invoice due date."
                }
            },
            "required": ["extension_days"]
        }
    },
    {
        "name": "offer_discount",
        "description": "Offer an instant policy-approved discount (up to 10% max) on the invoice.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "percent": {
                    "type": "INTEGER",
                    "description": "Discount percentage to offer (e.g. 5, 10)."
                }
            },
            "required": ["percent"]
        }
    },
    {
        "name": "create_payment_link",
        "description": "Generate a Razorpay Payment Link for the validated payable amount.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "amount": {
                    "type": "NUMBER",
                    "description": "Suggested payment amount."
                }
            }
        }
    }
]

def get_tools_for_context(context_type: str = "checkout") -> List[Dict[str, Any]]:
    """Returns function declarations scoped to the specific commercial context."""
    if context_type == "subscription":
        return [{"function_declarations": SUBSCRIPTION_TOOLS}]
    if context_type == "invoice":
        return [{"function_declarations": INVOICE_TOOLS}]
    return [{"function_declarations": CHECKOUT_TOOLS}]

# 2. System Prompt Builders Scoped by Context Type
def build_system_prompt(item_name: str, item_price: float, context_type: str = "checkout", extra_context: str = "") -> str:
    """Builds dynamic system prompt based on context_type and record metadata."""
    if context_type in ["payments", "invoice"]:
        return f"""You are CloseIt, an intelligent AI Payment Assistant for My Payments & Credit Hub.
Your goal is to help the customer manage an existing store payment plan, track installment schedules, and structure policy-compliant payment arrangements.

Active Customer Payment Context:
- Customer Account: user_demo_001
- Product / Plan: {item_name}
- Total Price / Installment Amount: ₹{item_price:,.2f}
{extra_context}

Guidelines:
1. Tone: Warm, helpful, sympathetic, and clear. Speak like a personal financial advisor ("Your next installment is ₹1,166 due on September 12. Would you like to pay it now or explore available options?"), NOT a debt collector.
2. Merchant Policy Rules (STRICT): Minimum 30% upfront for downpayments, maximum 30 days due-date extension, maximum 10% discount.
3. Keep responses short (1-2 concise sentences).
4. If customer asks for partial installment downpayment, call `propose_partial_payment(amount_now, later_date)`.
5. If customer asks for a due-date extension, call `propose_new_due_date(extension_days)`.
6. If customer is ready to pay their installment, call `create_payment_link(amount)`.
"""
    if context_type == "subscription":
        return f"""You are CloseIt, an intelligent AI Plan Assistant for Smart Recharge & Subscriptions.
Your goal is to help customers choose better value based on factual plan comparisons.

Selected Recharge Plan Context:
- Current Selected Plan: {item_name}
- Price: ₹{item_price:,.2f}
{extra_context}

Available OTT Subscription Packs in Catalog:
- plan_349: "5G Plus & Streaming Pack" (₹349 / 28 Days) — Includes JioHotstar Mobile, Prime Video Mobile & SonyLIV.
- plan_839: "Quarterly Pro 2GB + OTT" (₹839 / 84 Days) — Includes 1-Year JioHotstar Mobile.
- plan_999: "Heavy User Unlimited 5G Pack" (₹999 / 84 Days) — Includes JioHotstar Mobile & Zee5.
- plan_2999: "Annual Ultra Unlimited 365" (₹2,999 / 365 Days) — Includes 1-Year JioHotstar Premium & Prime Video.

Guidelines:
1. Explain recommendations using EXACT backend facts. NEVER say "I can't provide that information". If the customer asks about OTT apps, streaming, Hotstar, SonyLIV, Prime Video, or 5G, explicitly present the OTT plans listed above!
2. Keep responses short (1-2 sentences), helpful, and conversational.
3. If the user wants a better plan or agrees to switch, call function `switch_subscription_plan(new_plan_id)`.
4. If the user asks for a discount, call `offer_discount(percent)`.
5. If the user accepts a plan or says they are ready to recharge, call `create_payment_link(amount)`.
"""
    if context_type == "checkout":
        return f"""You are CloseIt, a helpful AI Checkout Assistant for {settings.STORE_NAME}.
Your goal is to prevent cart abandonment, resolve shopper hesitations, and warmly close the sale.

Current Cart Context:
- Item: {item_name}
- Regular Price: ₹{item_price:,.2f}

Guidelines:
1. Speak warmly and empathetically ("Looks like you're thinking twice about this purchase. Would you like a 10% instant discount or a 3-month credit payment plan?").
2. Keep replies short (1-2 concise sentences max).
3. If the user mentions price, cost, or budget, call function `offer_discount(percent)`.
4. If the user mentions payment methods, installments, UPI, or COD, call function `switch_payment_method(method)`.
5. If the user accepts an offer or says they are ready to buy/pay, call function `create_payment_link(amount)`.
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
    Supports 'checkout', 'subscription', and 'invoice' context types.
    """
    msg = user_message.lower()
    effective_price = base_price * (1 - (current_discount / 100))

    if context_type in ["payments", "invoice"]:
        # Scenario C: Excessive / Non-Compliant Request (e.g. ₹1,000 upfront or 90 days)
        if ("1000" in msg and "90" in msg) or ("1,000" in msg and "90" in msg) or ("excessive" in msg) or ("1000" in msg and "now" in msg):
            reply = f"I cannot approve a 90-day extension or ₹1,000 initial payment because merchant policy requires at least 30% upfront (minimum ₹{round(base_price * 0.30):,.0f}) and extensions up to 30 days. I can offer a compliant option of ₹4,000 today and 30-day balance extension."
            return reply, {
                "tool_called": "propose_partial_payment",
                "objection_type": "invoice_excessive_denied",
                "resolution_offered": "Excessive request denied by Policy Engine",
                "allowed": False
            }
        # Scenario A: Partial Payment (Compliant - e.g. ₹4,000 now)
        elif any(k in msg for k in ["4000", "4,000", "cash-flow", "cash flow", "partial", "part", "split", "down"]):
            amount_now = 4000.0 if base_price >= 4000 else round(base_price * 0.35, 2)
            amount_later = round(base_price - amount_now, 2)
            actual_pct = round((amount_now / base_price) * 100, 1)
            reply = f"I understand! Per merchant policy (min 30% upfront), I can structure a compliant payment plan: Pay ₹{amount_now:,.0f} ({actual_pct}% upfront) today, and the remaining ₹{amount_later:,.0f} by next month. Would you like to confirm this plan?"
            return reply, {
                "tool_called": "propose_partial_payment",
                "objection_type": "invoice_partial_approved",
                "resolution_offered": f"Approved 30% partial payment (₹{amount_now:,.0f} now)",
                "allowed": True,
                "amount_now": amount_now,
                "amount_later": amount_later
            }
        # Scenario B: Extension (Compliant - e.g. 15 days)
        elif any(k in msg for k in ["15 days", "15-day", "extension", "extend", "delay", "extra time", "later date"]):
            reply = f"I can approve a 15-day due-date extension for invoice {cart_item}. This is within our maximum 30-day extension limit. Would you like to confirm this new due date?"
            return reply, {
                "tool_called": "propose_new_due_date",
                "objection_type": "invoice_extension_approved",
                "resolution_offered": "15-day due date extension approved",
                "allowed": True,
                "extension_days": 15
            }
        # Invoice Discount Inquiry (Compliant up to 10%)
        elif any(k in msg for k in ["discount", "percent", "cheaper", "lower", "off", "reduce"]):
            discount = 10
            new_price = round(base_price * (1 - (discount / 100)), 2)
            reply = f"I can apply an approved 10% discount on invoice {cart_item}, bringing your final total to ₹{new_price:,.0f}."
            return reply, {
                "tool_called": "offer_discount",
                "objection_type": "invoice_discount_approved",
                "resolution_offered": "10% invoice discount approved",
                "discount_percent": discount
            }
        # Invoice Pay Now / Get Link
        elif any(k in msg for k in ["pay", "buy", "link", "confirm", "yes", "ok", "okay", "send", "sure", "great", "deal"]):
            link_res = create_payment_link_service(
                amount=effective_price,
                description=f"Invoice Payment: {cart_item}",
                session_id="invoice_fallback_session"
            )
            reply = f"Awesome! Here is your secure Razorpay payment link for ₹{effective_price:,.0f}. Click the button below to complete your payment!"
            return reply, {
                "tool_called": "create_payment_link",
                "objection_type": "invoice_converted",
                "resolution_offered": "Invoice Payment Link generated",
                "payment_link": link_res["payment_url"]
            }
        # Default Invoice Response
        else:
            reply = f"I'm here to help resolve invoice {cart_item} (₹{base_price:,.0f}). We offer flexible options: 30% partial payment down, 15-day extension, or 10% instant discount."
            return reply, {
                "tool_called": None,
                "objection_type": "invoice_general",
                "resolution_offered": "General invoice negotiation assistance"
            }
    
    if context_type == "subscription":
        # 1. OTT / Streaming / Validity / 5G Features Inquiry
        if any(k in msg for k in ["ott", "hotstar", "sonyliv", "prime", "netflix", "zee5", "streaming", "movie", "cinema", "tv", "options"]):
            reply = "Great question! We have 4 top recharge packs with included OTT subscriptions:\n1. ₹349 Streaming Pack (28 Days) — JioHotstar, Prime Video & SonyLIV\n2. ₹839 Quarterly Pack (84 Days) — 1-Year JioHotstar Mobile\n3. ₹999 Heavy 5G Pack (84 Days) — JioHotstar & Zee5\n4. ₹2,999 Annual Pack (365 Days) — 1-Year JioHotstar Premium & Prime Video\nWhich plan would you like to select?"
            return reply, {
                "tool_called": "recommend_subscription",
                "objection_type": "subscription_ott_inquiry",
                "resolution_offered": "OTT catalog recommendation provided"
            }
        # 2. Price / Discount Objection for Subscription
        elif any(k in msg for k in ["expensive", "price", "cost", "cheaper", "discount", "budget", "high", "money", "afford", "offer"]):
            discount = 10
            new_price = round(base_price * (1 - (discount / 100)), 2)
            reply = f"I completely understand! How about an exclusive 10% instant discount on the {cart_item} plan? That brings it down to ₹{new_price:,.0f}."
            return reply, {
                "tool_called": "offer_discount",
                "objection_type": "subscription_price",
                "resolution_offered": "10% recharge discount",
                "discount_percent": discount
            }
        # 2. OTT / Validity / 5G Features Inquiry
        elif any(k in msg for k in ["ott", "validity", "5g", "hotstar", "netflix", "data", "pack", "bundle"]):
            reply = f"The {cart_item} pack offers high-speed data and network connectivity. I can also help you switch to a higher-validity pack or apply a 10% discount on this plan!"
            return reply, {
                "tool_called": "recommend_subscription",
                "objection_type": "subscription_features",
                "resolution_offered": "Plan feature comparison"
            }
        # 3. Intent to Buy / Request Payment Link for Subscription
        elif any(k in msg for k in ["pay", "buy", "link", "recharge", "checkout", "deal", "yes", "ok", "okay", "send", "sure", "great"]):
            link_res = create_payment_link_service(
                amount=effective_price,
                description=f"Smart Recharge: {cart_item}",
                session_id="subscription_fallback_session"
            )
            reply = f"Awesome! Here is your secure Razorpay payment link to recharge with the {cart_item} for ₹{effective_price:,.0f}. Click the button below to complete your recharge!"
            return reply, {
                "tool_called": "create_payment_link",
                "objection_type": "recharge_converted",
                "resolution_offered": "Recharge Payment Link generated",
                "payment_link": link_res["payment_url"]
            }
        # 4. Default Subscription Response
        else:
            reply = f"I'm here to help you get the best value on your {cart_item} recharge! Would you like a 10% discount or a quick comparison with longer validity plans?"
            return reply, {
                "tool_called": None,
                "objection_type": "subscription_general",
                "resolution_offered": "General subscription assistance"
            }
    
    # Standard Checkout context
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
