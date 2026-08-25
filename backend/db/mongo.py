"""
backend/db/mongo.py
MongoDB client setup using Motor async driver. Provides database access and connectivity health checks.
Includes in-memory fallback store if MongoDB Atlas is unreachable during offline/local demo testing.
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from backend.config import settings

logger = logging.getLogger("closeit.db")

# Global async MongoDB client instance
mongo_client: AsyncIOMotorClient | None = None

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

# Fallback in-memory store if Mongo connection fails or isn't set up yet
_in_memory_sessions = {}
_in_memory_outcomes = []
_in_memory_products = DEFAULT_PRODUCTS.copy()

def get_mongo_client() -> AsyncIOMotorClient | None:
    global mongo_client
    if mongo_client is None and settings.MONGODB_URI:
        try:
            mongo_client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=10000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000
            )
        except Exception as e:
            logger.warning(f"Could not initialize MongoDB client: {e}")
            mongo_client = None
    return mongo_client

def get_database():
    client = get_mongo_client()
    if client:
        # Extract DB name from URI or default to 'closeit'
        return client.get_default_database(default="closeit")
    return None

async def check_db_health() -> dict:
    """Verifies connection to MongoDB Atlas."""
    client = get_mongo_client()
    if not client:
        return {"connected": False, "status": "In-Memory Fallback Active", "error": "No URI provided"}
    try:
        # Ping the server
        await client.admin.command('ping')
        return {"connected": True, "status": "Connected to MongoDB Atlas"}
    except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
        logger.warning(f"MongoDB ping failed: {e}")
        return {"connected": False, "status": "In-Memory Fallback Active", "error": str(e)}

# Helper methods for collections with fallback
async def save_session_db(session_data: dict):
    db = get_database()
    if db is not None:
        try:
            await db.sessions.update_one(
                {"session_id": session_data["session_id"]},
                {"$set": session_data},
                upsert=True
            )
            return
        except Exception as e:
            logger.error(f"Error saving session to Mongo: {e}")
    _in_memory_sessions[session_data["session_id"]] = session_data

async def get_session_db(session_id: str) -> dict | None:
    db = get_database()
    if db is not None:
        try:
            doc = await db.sessions.find_one({"session_id": session_id})
            if doc:
                doc.pop("_id", None)
                return doc
        except Exception as e:
            logger.error(f"Error reading session from Mongo: {e}")
    return _in_memory_sessions.get(session_id)

async def save_outcome_db(outcome_data: dict):
    db = get_database()
    if db is not None:
        try:
            await db.outcomes.insert_one(outcome_data.copy())
            return
        except Exception as e:
            logger.error(f"Error saving outcome to Mongo: {e}")
    _in_memory_outcomes.append(outcome_data)

async def get_outcomes_db() -> list[dict]:
    db = get_database()
    if db is not None:
        try:
            cursor = db.outcomes.find({}, {"_id": 0}).sort("timestamp", -1)
            docs = await cursor.to_list(length=100)
            return docs
        except Exception as e:
            logger.error(f"Error getting outcomes from Mongo: {e}")
    # Return memory store newest first
    return sorted(_in_memory_outcomes, key=lambda x: x.get("timestamp", ""), reverse=True)

async def get_products_db() -> list[dict]:
    db = get_database()
    if db is not None:
        try:
            cursor = db.products.find({}, {"_id": 0})
            docs = await cursor.to_list(length=100)
            if docs:
                return docs
        except Exception as e:
            logger.error(f"Error getting products from Mongo: {e}")
    return _in_memory_products

async def seed_products_db() -> int:
    """Seeds default demo products into MongoDB Atlas products collection if empty."""
    db = get_database()
    if db is not None:
        try:
            for p in DEFAULT_PRODUCTS:
                await db.products.update_one(
                    {"id": p["id"]},
                    {"$set": p},
                    upsert=True
                )
            return len(DEFAULT_PRODUCTS)
        except Exception as e:
            logger.error(f"Error seeding products into Mongo: {e}")
    return len(DEFAULT_PRODUCTS)
