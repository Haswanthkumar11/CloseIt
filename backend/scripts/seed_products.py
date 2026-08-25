"""
backend/scripts/seed_products.py
One-time database seed script inserting/upserting the 6 demo products into MongoDB Atlas products collection.
Run manually via: python backend/scripts/seed_products.py
"""

import sys
import os
import asyncio

# Ensure root directory is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.db.mongo import seed_products_db, check_db_health

async def main():
    print("--- CloseIt Product Catalog Seeder ---")
    health = await check_db_health()
    print(f"Database Health: {health}")
    count = await seed_products_db()
    print(f"Successfully seeded {count} demo products into MongoDB Atlas 'products' collection!")

if __name__ == "__main__":
    asyncio.run(main())
