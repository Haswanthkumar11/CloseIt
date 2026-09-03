"""
backend/db/mongo.py
MongoDB client setup using Motor async driver. Provides database access and connectivity health checks.
Includes in-memory fallback store if MongoDB Atlas is unreachable during offline/local demo testing.
"""

import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from backend.config import settings

logger = logging.getLogger("closeit.db")

# Global async MongoDB client instance
mongo_client: AsyncIOMotorClient | None = None

# In-memory fallback stores
_in_memory_sessions = {}
_in_memory_outcomes = []
_in_memory_audit_events = []

DEFAULT_PRODUCTS = [
    {
        "id": "p1",
        "name": "Apex Pro Wireless Noise-Cancelling Headphones",
        "category": "Electronics",
        "price": 4999.0,
        "description": "Studio-grade active noise cancellation with 40-hour battery life and ultra-soft memory foam earcups.",
        "rating": 4.9,
        "reviews": 1420,
        "icon": "🎧"
    },
    {
        "id": "p2",
        "name": "Aura 4K Cinema Soundbar Pro",
        "category": "Electronics",
        "price": 8999.0,
        "description": "Dolby Atmos 3D surround sound audio with wireless 10-inch subwoofer and Bluetooth 5.3.",
        "rating": 4.8,
        "reviews": 890,
        "icon": "🔊"
    },
    {
        "id": "p3",
        "name": "Velocity Sport Smartwatch Ultra",
        "category": "Fashion",
        "price": 6499.0,
        "description": "Aerospace-grade titanium casing with 1.96-inch AMOLED display, GPS & SpO2 health tracking.",
        "rating": 4.9,
        "reviews": 2150,
        "icon": "⌚"
    },
    {
        "id": "p4",
        "name": "Urban Stealth Waterproof Tech Backpack",
        "category": "Fashion",
        "price": 2999.0,
        "description": "Anti-theft compartmentalized design with TSA lock, powerbank USB port & rainproof fabric.",
        "rating": 4.7,
        "reviews": 640,
        "icon": "🎒"
    },
    {
        "id": "p5",
        "name": "Organic Cold-Pressed EVOO & Herb Gift Set",
        "category": "Groceries",
        "price": 1499.0,
        "description": "Artisanal Italian extra virgin olive oil with organic rosemary & Tuscan garlic infusion.",
        "rating": 4.9,
        "reviews": 430,
        "icon": "🫒"
    },
    {
        "id": "p6",
        "name": "Single-Origin Himalayan Arabica Coffee Beans (1kg)",
        "category": "Groceries",
        "price": 999.0,
        "description": "Hand-picked 100% Arabica dark roast whole coffee beans roasted in micro-batches.",
        "rating": 4.8,
        "reviews": 1120,
        "icon": "☕"
    }
]

_in_memory_products = DEFAULT_PRODUCTS.copy()

DEFAULT_RECHARGE_PLANS = [
    {
        "id": "plan_219",
        "name": "Super Saver Data & Voice",
        "price": 219.0,
        "currency": "INR",
        "validity_days": 30,
        "data_per_day": "1GB",
        "total_data": "30GB",
        "network": "4G / LTE",
        "ott_benefits": [],
        "category": "budget",
        "badge": "Value Pack",
        "active": True
    },
    {
        "id": "plan_299",
        "name": "Standard Daily Data Pack",
        "price": 299.0,
        "currency": "INR",
        "validity_days": 28,
        "data_per_day": "1.5GB",
        "total_data": "42GB",
        "network": "Unlimited 5G",
        "ott_benefits": [],
        "category": "popular",
        "badge": "Popular",
        "active": True
    },
    {
        "id": "plan_349",
        "name": "5G Plus & Streaming Pack",
        "price": 349.0,
        "currency": "INR",
        "validity_days": 28,
        "data_per_day": "2GB",
        "total_data": "56GB",
        "network": "Unlimited 5G",
        "ott_benefits": ["JioHotstar Mobile (3 Months)"],
        "category": "popular",
        "badge": "Best Seller",
        "active": True
    },
    {
        "id": "plan_399",
        "name": "Double Validity 5G Max",
        "price": 399.0,
        "currency": "INR",
        "validity_days": 56,
        "data_per_day": "2GB",
        "total_data": "112GB",
        "network": "Unlimited 5G",
        "ott_benefits": ["JioHotstar Mobile (3 Months)", "SonyLIV"],
        "category": "long_validity",
        "badge": "Double Validity",
        "active": True
    },
    {
        "id": "plan_499",
        "name": "Entertainment Super Bundle",
        "price": 499.0,
        "currency": "INR",
        "validity_days": 28,
        "data_per_day": "3GB",
        "total_data": "84GB",
        "network": "Unlimited 5G",
        "ott_benefits": ["JioHotstar Mobile", "Prime Video Mobile", "SonyLIV"],
        "category": "ott",
        "badge": "OTT Bundle",
        "active": True
    },
    {
        "id": "plan_719",
        "name": "Quarterly Freedom Pack",
        "price": 719.0,
        "currency": "INR",
        "validity_days": 84,
        "data_per_day": "1.5GB",
        "total_data": "126GB",
        "network": "Unlimited 5G",
        "ott_benefits": [],
        "category": "long_validity",
        "badge": "84 Days Pack",
        "active": True
    },
    {
        "id": "plan_839",
        "name": "Quarterly Pro 2GB + OTT",
        "price": 839.0,
        "currency": "INR",
        "validity_days": 84,
        "data_per_day": "2GB",
        "total_data": "168GB",
        "network": "Unlimited 5G",
        "ott_benefits": ["JioHotstar Mobile (1 Year)"],
        "category": "popular",
        "badge": "Best Value 84D",
        "active": True
    },
    {
        "id": "plan_149",
        "name": "High Speed Data Add-on",
        "price": 149.0,
        "currency": "INR",
        "validity_days": 28,
        "data_per_day": "1GB",
        "total_data": "28GB",
        "network": "4G / LTE",
        "ott_benefits": [],
        "category": "data",
        "badge": "Data Booster",
        "active": True
    },
    {
        "id": "plan_999",
        "name": "Heavy User Unlimited 5G Pack",
        "price": 999.0,
        "currency": "INR",
        "validity_days": 84,
        "data_per_day": "3GB",
        "total_data": "252GB",
        "network": "Unlimited 5G",
        "ott_benefits": ["JioHotstar Mobile", "Zee5"],
        "category": "5g",
        "badge": "Heavy Data",
        "active": True
    },
    {
        "id": "plan_2999",
        "name": "Annual Ultra Unlimited 365",
        "price": 2999.0,
        "currency": "INR",
        "validity_days": 365,
        "data_per_day": "2.5GB",
        "total_data": "912.5GB",
        "network": "Unlimited 5G",
        "ott_benefits": ["JioHotstar Premium (1 Year)", "Prime Video"],
        "category": "long_validity",
        "badge": "Annual Plan",
        "active": True
    }
]

_in_memory_recharge_plans = DEFAULT_RECHARGE_PLANS.copy()

# Global async MongoDB client instance
mongo_client: AsyncIOMotorClient | None = None

_mongo_disabled = False

def get_mongo_client() -> AsyncIOMotorClient | None:
    global mongo_client, _mongo_disabled
    if _mongo_disabled:
        return None
    if mongo_client is None and settings.MONGODB_URI:
        try:
            mongo_client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=1000,
                connectTimeoutMS=1000,
                socketTimeoutMS=1000,
                tlsAllowInvalidCertificates=True
            )
        except Exception as e:
            logger.warning(f"Could not initialize MongoDB client: {e}")
            mongo_client = None
            _mongo_disabled = True
    return mongo_client

def get_database():
    global _mongo_disabled
    if _mongo_disabled:
        return None
    client = get_mongo_client()
    if client:
        return client.get_default_database(default="closeit")
    return None

async def check_db_health() -> dict:
    """Verifies connection to MongoDB Atlas."""
    global _mongo_disabled
    if _mongo_disabled:
        return {"connected": False, "status": "In-Memory Fallback Active", "error": "Mongo disabled due to DNS/network timeout"}
    client = get_mongo_client()
    if not client:
        return {"connected": False, "status": "In-Memory Fallback Active", "error": "No URI provided"}
    try:
        await asyncio.wait_for(client.admin.command('ping'), timeout=1.0)
        return {"connected": True, "status": "Connected to MongoDB Atlas"}
    except Exception as e:
        logger.warning(f"MongoDB ping failed: {e}. Switching to instant in-memory mode.")
        _mongo_disabled = True
        return {"connected": False, "status": "In-Memory Fallback Active", "error": str(e)}

async def save_session_db(session_data: dict):
    global _mongo_disabled
    db = get_database()
    if db is not None:
        try:
            await asyncio.wait_for(
                db.sessions.update_one(
                    {"session_id": session_data["session_id"]},
                    {"$set": session_data},
                    upsert=True
                ),
                timeout=1.0
            )
            return
        except Exception as e:
            logger.warning(f"Error saving session to Mongo: {e}")
            _mongo_disabled = True
    _in_memory_sessions[session_data["session_id"]] = session_data

async def get_session_db(session_id: str) -> dict | None:
    global _mongo_disabled
    db = get_database()
    if db is not None:
        try:
            doc = await asyncio.wait_for(
                db.sessions.find_one({"session_id": session_id}),
                timeout=1.0
            )
            if doc:
                doc.pop("_id", None)
                return doc
        except Exception as e:
            logger.warning(f"Error reading session from Mongo: {e}")
            _mongo_disabled = True
    return _in_memory_sessions.get(session_id)

async def save_outcome_db(outcome_data: dict):
    global _mongo_disabled
    db = get_database()
    if db is not None:
        try:
            await asyncio.wait_for(
                db.outcomes.insert_one(outcome_data.copy()),
                timeout=1.0
            )
            return
        except Exception as e:
            logger.warning(f"Error saving outcome to Mongo: {e}")
            _mongo_disabled = True
    _in_memory_outcomes.append(outcome_data)

async def get_outcomes_db() -> list[dict]:
    global _mongo_disabled
    db = get_database()
    if db is not None:
        try:
            async def _fetch():
                cursor = db.outcomes.find({}, {"_id": 0}).sort("timestamp", -1)
                return await cursor.to_list(length=100)
            docs = await asyncio.wait_for(_fetch(), timeout=1.0)
            if docs:
                return docs
        except Exception as e:
            logger.warning(f"Error getting outcomes from Mongo: {e}")
            _mongo_disabled = True
    return sorted(_in_memory_outcomes, key=lambda x: x.get("timestamp", ""), reverse=True)

async def get_products_db() -> list[dict]:
    global _mongo_disabled
    db = get_database()
    if db is not None:
        try:
            async def _fetch():
                cursor = db.products.find({}, {"_id": 0})
                return await cursor.to_list(length=100)
            docs = await asyncio.wait_for(_fetch(), timeout=1.0)
            if docs:
                return docs
        except Exception as e:
            logger.warning(f"Error getting products from Mongo: {e}")
            _mongo_disabled = True
    return _in_memory_products

async def seed_products_db() -> int:
    global _mongo_disabled
    db = get_database()
    if db is not None:
        try:
            async def _seed():
                for p in DEFAULT_PRODUCTS:
                    await db.products.update_one(
                        {"id": p["id"]},
                        {"$set": p},
                        upsert=True
                    )
            await asyncio.wait_for(_seed(), timeout=1.0)
            return len(DEFAULT_PRODUCTS)
        except Exception as e:
            logger.warning(f"Error seeding products into Mongo: {e}")
            _mongo_disabled = True
    return len(DEFAULT_PRODUCTS)

async def get_recharge_plans_db() -> list[dict]:
    global _mongo_disabled
    db = get_database()
    if db is not None:
        try:
            async def _fetch():
                cursor = db.recharge_plans.find({}, {"_id": 0})
                return await cursor.to_list(length=100)
            docs = await asyncio.wait_for(_fetch(), timeout=1.0)
            if docs:
                return docs
        except Exception as e:
            logger.warning(f"Error getting recharge plans from Mongo: {e}")
            _mongo_disabled = True
    return _in_memory_recharge_plans

async def seed_recharge_plans_db() -> int:
    """Seeds default demo recharge plans into MongoDB Atlas recharge_plans collection."""
    db = get_database()
    if db is not None:
        try:
            async def _seed():
                for plan in DEFAULT_RECHARGE_PLANS:
                    await db.recharge_plans.update_one(
                        {"id": plan["id"]},
                        {"$set": plan},
                        upsert=True
                    )
            await asyncio.wait_for(_seed(), timeout=10.0)
            return len(DEFAULT_RECHARGE_PLANS)
        except Exception as e:
            logger.warning(f"Error seeding recharge plans into Mongo: {e}")
    return len(DEFAULT_RECHARGE_PLANS)

async def save_audit_event_db(event_data: dict):
    db = get_database()
    if db is not None:
        try:
            await asyncio.wait_for(
                db.audit_events.insert_one(event_data.copy()),
                timeout=5.0
            )
            return
        except Exception as e:
            logger.warning(f"Error saving audit event to Mongo: {e}")
    _in_memory_audit_events.append(event_data)

async def get_audit_events_db() -> list[dict]:
    db = get_database()
    if db is not None:
        try:
            async def _fetch():
                cursor = db.audit_events.find({}, {"_id": 0}).sort("timestamp", -1)
                return await cursor.to_list(length=100)
            docs = await asyncio.wait_for(_fetch(), timeout=5.0)
            if docs:
                return docs
        except Exception as e:
            logger.warning(f"Error getting audit events from Mongo: {e}")
    return sorted(_in_memory_audit_events, key=lambda x: x.get("timestamp", ""), reverse=True)

DEFAULT_INVOICES = [
    {
        "id": "inv_001",
        "client_name": "Demo Shopper",
        "client_email": "demo@example.com",
        "amount": 1333.07,
        "total_purchase_amount": 4999.0,
        "paid_today": 999.80,
        "remaining_balance": 3999.20,
        "due_date": "2026-10-01",
        "status": "overdue",
        "description": "Apex Pro Wireless Headphones (3-Month Payment Plan)",
        "installment_info": "Installment 1 of 3",
        "negotiation_history": []
    },
    {
        "id": "inv_002",
        "client_name": "Demo Shopper",
        "client_email": "demo@example.com",
        "amount": 8999.0,
        "total_purchase_amount": 8999.0,
        "paid_today": 8999.0,
        "remaining_balance": 0.0,
        "due_date": "2026-08-15",
        "status": "paid_in_full",
        "description": "Aura Studio Soundbar",
        "installment_info": "Paid in Full",
        "negotiation_history": []
    },
    {
        "id": "inv_003",
        "client_name": "Demo Shopper",
        "client_email": "demo@example.com",
        "amount": 1733.07,
        "total_purchase_amount": 6499.0,
        "paid_today": 1299.80,
        "remaining_balance": 5199.20,
        "due_date": "2026-09-15",
        "status": "pending",
        "description": "Velocity Smartwatch Series 5 (3-Month Payment Plan)",
        "installment_info": "Installment 1 of 3",
        "negotiation_history": []
    }
]

_in_memory_invoices = DEFAULT_INVOICES.copy()

async def get_invoices_db() -> list[dict]:
    db = get_database()
    if db is not None:
        try:
            async def _fetch():
                cursor = db.invoices.find({}, {"_id": 0})
                return await cursor.to_list(length=100)
            docs = await asyncio.wait_for(_fetch(), timeout=5.0)
            if docs:
                return docs
        except Exception as e:
            logger.warning(f"Error getting invoices from Mongo: {e}")
    return _in_memory_invoices

async def get_invoice_by_id_db(invoice_id: str) -> dict | None:
    db = get_database()
    if db is not None:
        try:
            doc = await asyncio.wait_for(
                db.invoices.find_one({"id": invoice_id}, {"_id": 0}),
                timeout=5.0
            )
            if doc:
                return doc
        except Exception as e:
            logger.warning(f"Error finding invoice in Mongo: {e}")
    for inv in _in_memory_invoices:
        if inv["id"] == invoice_id:
            return inv
    return None

async def save_invoice_db(invoice_data: dict):
    db = get_database()
    if db is not None:
        try:
            await asyncio.wait_for(
                db.invoices.update_one(
                    {"id": invoice_data["id"]},
                    {"$set": invoice_data},
                    upsert=True
                ),
                timeout=5.0
            )
            return
        except Exception as e:
            logger.warning(f"Error saving invoice to Mongo: {e}")
    found = False
    for idx, inv in enumerate(_in_memory_invoices):
        if inv["id"] == invoice_data["id"]:
            _in_memory_invoices[idx] = invoice_data
            found = True
            break
    if not found:
        _in_memory_invoices.append(invoice_data)

async def seed_invoices_db() -> int:
    """Seeds default demo invoices into MongoDB Atlas invoices collection."""
    db = get_database()
    if db is not None:
        try:
            async def _seed():
                for inv in DEFAULT_INVOICES:
                    await db.invoices.update_one(
                        {"id": inv["id"]},
                        {"$set": inv},
                        upsert=True
                    )
            await asyncio.wait_for(_seed(), timeout=10.0)
            return len(DEFAULT_INVOICES)
        except Exception as e:
            logger.warning(f"Error seeding invoices into Mongo: {e}")
    return len(DEFAULT_INVOICES)

DEFAULT_MERCHANT_POLICY = {
    "merchant_name": "AuraCommerce & Smart Recharge",
    "negotiation": {
        "enabled": True,
        "max_discount_percent": 20.0,
        "max_subscription_discount_percent": 10.0,
        "max_invoice_discount_percent": 10.0,
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
    "invoice_rules": {
        "max_invoice_discount_percent": 10.0,
        "maximum_due_date_extension_days": 30,
        "minimum_partial_payment_percent": 30.0,
    },
    "agent_limits": {
        "max_quantity": 10,
        "maximum_validity_extension_days": 28,
        "allowed_plan_switch": True,
    },
}

async def seed_merchant_policy_db() -> dict:
    """Seeds default merchant policy into MongoDB Atlas merchant_policies collection if empty."""
    db = get_database()
    if db is not None:
        try:
            async def _seed_policy():
                count = await db.merchant_policies.count_documents({})
                if count == 0:
                    await db.merchant_policies.insert_one(DEFAULT_MERCHANT_POLICY.copy())
                    logger.info("Seeded merchant policy into MongoDB Atlas merchant_policies collection.")
                doc = await db.merchant_policies.find_one({}, {"_id": 0})
                if doc:
                    return doc
                return DEFAULT_MERCHANT_POLICY

            return await asyncio.wait_for(_seed_policy(), timeout=5.0)
        except Exception as e:
            logger.warning(f"Error seeding/fetching merchant policy in Mongo: {e}")
    return DEFAULT_MERCHANT_POLICY


# ==========================================
# USER-ISOLATED CUSTOMER PAYMENTS & CREDIT LIFECYCLE
# ==========================================

DEFAULT_USERS = [
    {
        "user_id": "user_demo_001",
        "name": "Demo Shopper",
        "email": "demo@example.com",
        "created_at": "2026-08-01T00:00:00Z"
    }
]

DEFAULT_ORDERS = [
    {
        "order_id": "order_001",
        "user_id": "user_demo_001",
        "product_id": "p1",
        "product_name": "Apex Pro Wireless Headphones",
        "total_amount": 4999.0,
        "payment_type": "credit",
        "status": "active_plan",
        "created_at": "2026-08-12T10:00:00Z"
    },
    {
        "order_id": "order_002",
        "user_id": "user_demo_001",
        "product_id": "p2",
        "product_name": "Aura Studio Soundbar Pro",
        "total_amount": 8999.0,
        "payment_type": "full",
        "status": "paid_in_full",
        "created_at": "2026-08-15T14:30:00Z"
    },
    {
        "order_id": "order_003",
        "user_id": "user_demo_001",
        "product_id": "p3",
        "product_name": "Velocity Sport Smartwatch Ultra",
        "total_amount": 6499.0,
        "payment_type": "credit",
        "status": "active_plan",
        "created_at": "2026-08-20T11:15:00Z"
    }
]

DEFAULT_PAYMENT_PLANS = [
    {
        "plan_id": "plan_001",
        "user_id": "user_demo_001",
        "order_id": "order_001",
        "product_id": "p1",
        "product_name": "Apex Pro Wireless Headphones",
        "total_amount": 4999.0,
        "amount_paid": 1500.0,
        "remaining_amount": 3499.0,
        "installment_amount": 1166.33,
        "total_installments": 3,
        "installments_paid": 0,
        "installments_remaining": 3,
        "next_payment_date": "2026-09-12",
        "status": "overdue",
        "schedule": [
            {"installment_no": 1, "due_date": "2026-08-12", "amount": 1500.0, "status": "paid", "payment_date": "2026-08-12"},
            {"installment_no": 2, "due_date": "2026-09-12", "amount": 1166.33, "status": "upcoming"},
            {"installment_no": 3, "due_date": "2026-10-12", "amount": 1166.33, "status": "upcoming"},
            {"installment_no": 4, "due_date": "2026-11-12", "amount": 1166.34, "status": "upcoming"}
        ],
        "created_at": "2026-08-12T10:00:00Z"
    },
    {
        "plan_id": "plan_003",
        "user_id": "user_demo_001",
        "order_id": "order_003",
        "product_id": "p3",
        "product_name": "Velocity Sport Smartwatch Ultra",
        "total_amount": 6499.0,
        "amount_paid": 1299.80,
        "remaining_amount": 5199.20,
        "installment_amount": 1733.07,
        "total_installments": 3,
        "installments_paid": 0,
        "installments_remaining": 3,
        "next_payment_date": "2026-09-15",
        "status": "active",
        "schedule": [
            {"installment_no": 1, "due_date": "2026-08-20", "amount": 1299.80, "status": "paid", "payment_date": "2026-08-20"},
            {"installment_no": 2, "due_date": "2026-09-15", "amount": 1733.07, "status": "upcoming"},
            {"installment_no": 3, "due_date": "2026-10-15", "amount": 1733.07, "status": "upcoming"},
            {"installment_no": 4, "due_date": "2026-11-15", "amount": 1733.06, "status": "upcoming"}
        ],
        "created_at": "2026-08-20T11:15:00Z"
    }
]

DEFAULT_PAYMENT_LOGS = [
    {
        "payment_id": "pay_001",
        "user_id": "user_demo_001",
        "order_id": "order_001",
        "amount": 1500.0,
        "payment_type": "downpayment",
        "status": "settled",
        "created_at": "2026-08-12T10:05:00Z"
    },
    {
        "payment_id": "pay_002",
        "user_id": "user_demo_001",
        "order_id": "order_002",
        "amount": 8999.0,
        "payment_type": "full",
        "status": "settled",
        "created_at": "2026-08-15T14:35:00Z"
    }
]

_in_memory_users = DEFAULT_USERS.copy()
_in_memory_orders = DEFAULT_ORDERS.copy()
_in_memory_plans = DEFAULT_PAYMENT_PLANS.copy()
_in_memory_payments = DEFAULT_PAYMENT_LOGS.copy()

async def get_user_orders_db(user_id: str) -> list[dict]:
    db = get_database()
    if db is not None:
        try:
            async def _fetch():
                cursor = db.orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
                return await cursor.to_list(length=100)
            docs = await asyncio.wait_for(_fetch(), timeout=5.0)
            if docs:
                return docs
        except Exception as e:
            logger.warning(f"Error fetching user orders from Mongo: {e}")
    return [o for o in _in_memory_orders if o.get("user_id") == user_id]

async def get_user_payment_plans_db(user_id: str) -> list[dict]:
    db = get_database()
    if db is not None:
        try:
            async def _fetch():
                cursor = db.payment_plans.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
                return await cursor.to_list(length=100)
            docs = await asyncio.wait_for(_fetch(), timeout=5.0)
            if docs:
                return docs
        except Exception as e:
            logger.warning(f"Error fetching payment plans from Mongo: {e}")
    return [p for p in _in_memory_plans if p.get("user_id") == user_id]

async def get_user_payments_history_db(user_id: str) -> list[dict]:
    db = get_database()
    if db is not None:
        try:
            async def _fetch():
                cursor = db.payments.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
                return await cursor.to_list(length=100)
            docs = await asyncio.wait_for(_fetch(), timeout=5.0)
            if docs:
                return docs
        except Exception as e:
            logger.warning(f"Error fetching payment receipts from Mongo: {e}")
    return [p for p in _in_memory_payments if p.get("user_id") == user_id]

async def get_payment_plan_by_id_db(plan_id: str) -> dict | None:
    db = get_database()
    if db is not None:
        try:
            doc = await asyncio.wait_for(
                db.payment_plans.find_one({"plan_id": plan_id}, {"_id": 0}),
                timeout=5.0
            )
            if doc:
                return doc
        except Exception as e:
            logger.warning(f"Error finding plan in Mongo: {e}")
    for p in _in_memory_plans:
        if p["plan_id"] == plan_id:
            return p
    return None

async def create_user_order_with_plan_db(order_data: dict, plan_data: dict | None = None) -> dict:
    """Saves a new order and optional payment plan under user_id."""
    db = get_database()
    user_id = order_data.get("user_id", "user_demo_001")
    order_data["user_id"] = user_id

    if db is not None:
        try:
            await db.orders.update_one({"order_id": order_data["order_id"]}, {"$set": order_data}, upsert=True)
            if plan_data:
                plan_data["user_id"] = user_id
                await db.payment_plans.update_one({"plan_id": plan_data["plan_id"]}, {"$set": plan_data}, upsert=True)
        except Exception as e:
            logger.warning(f"Error creating order/plan in Mongo: {e}")

    _in_memory_orders.insert(0, order_data)
    if plan_data:
        _in_memory_plans.insert(0, plan_data)

    return {"order": order_data, "plan": plan_data}

async def save_payment_receipt_db(payment_data: dict):
    """Saves an installment payment receipt to MongoDB payments collection."""
    db = get_database()
    if db is not None:
        try:
            await db.payments.update_one({"payment_id": payment_data["payment_id"]}, {"$set": payment_data}, upsert=True)
            return
        except Exception as e:
            logger.warning(f"Error saving payment receipt to Mongo: {e}")
    _in_memory_payments.insert(0, payment_data)

async def update_payment_plan_installment_db(plan_id: str, payment_amount: float) -> dict | None:
    """Updates payment plan state after an installment is settled and logs payment receipt."""
    plan = await get_payment_plan_by_id_db(plan_id)
    if not plan:
        return None

    import datetime
    import uuid

    plan["amount_paid"] = round(plan.get("amount_paid", 0) + payment_amount, 2)
    plan["remaining_amount"] = max(0.0, round(plan.get("total_amount", 0) - plan["amount_paid"], 2))
    plan["installments_paid"] = plan.get("installments_paid", 0) + 1
    plan["installments_remaining"] = max(0, plan.get("installments_remaining", 1) - 1)

    today_str = datetime.date.today().isoformat()

    # Advance schedule item status
    schedule = plan.get("schedule", [])
    updated_schedule = False
    for item in schedule:
        if item.get("status") == "upcoming" and not updated_schedule:
            item["status"] = "paid"
            item["payment_date"] = today_str
            updated_schedule = True

    # Advance next payment date if more upcoming
    upcoming_items = [item for item in schedule if item.get("status") == "upcoming"]
    if upcoming_items:
        plan["next_payment_date"] = upcoming_items[0].get("due_date")
        plan["status"] = "active"
    else:
        plan["status"] = "paid_in_full"

    # Save payment receipt to history
    payment_receipt = {
        "payment_id": f"pay_{uuid.uuid4().hex[:8]}",
        "user_id": plan.get("user_id", "user_demo_001"),
        "order_id": plan.get("order_id"),
        "plan_id": plan_id,
        "amount": payment_amount,
        "payment_type": "installment",
        "status": "settled",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    await save_payment_receipt_db(payment_receipt)

    db = get_database()
    if db is not None:
        try:
            await db.payment_plans.update_one({"plan_id": plan_id}, {"$set": plan}, upsert=True)
        except Exception as e:
            logger.warning(f"Error updating payment plan in Mongo: {e}")

    for idx, p in enumerate(_in_memory_plans):
        if p["plan_id"] == plan_id:
            _in_memory_plans[idx] = plan
            break

    return plan

async def seed_users_and_plans_db() -> int:
    """Seeds default demo users, orders, and payment_plans into MongoDB Atlas collections."""
    db = get_database()
    if db is not None:
        try:
            async def _seed():
                for u in DEFAULT_USERS:
                    await db.users.update_one({"user_id": u["user_id"]}, {"$set": u}, upsert=True)
                for o in DEFAULT_ORDERS:
                    await db.orders.update_one({"order_id": o["order_id"]}, {"$set": o}, upsert=True)
                for p in DEFAULT_PAYMENT_PLANS:
                    await db.payment_plans.update_one({"plan_id": p["plan_id"]}, {"$set": p}, upsert=True)
                for log in DEFAULT_PAYMENT_LOGS:
                    await db.payments.update_one({"payment_id": log["payment_id"]}, {"$set": log}, upsert=True)
            await asyncio.wait_for(_seed(), timeout=10.0)
            return len(DEFAULT_PAYMENT_PLANS)
        except Exception as e:
            logger.warning(f"Error seeding users/plans into Mongo: {e}")
    return len(DEFAULT_PAYMENT_PLANS)

