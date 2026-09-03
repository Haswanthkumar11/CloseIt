import asyncio
import os
import sys

# Ensure root workspace directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.db.mongo import seed_products_db, seed_recharge_plans_db, seed_invoices_db, seed_merchant_policy_db, save_audit_event_db, get_database

async def main():
    print("Connecting to MongoDB Atlas...")
    db = get_database()
    if db is None:
        print("Error: Could not obtain database handle.")
        return

    print("Seeding products...")
    p_count = await seed_products_db()
    print(f"Seeded {p_count} products into 'products' collection.")

    print("Seeding recharge_plans...")
    r_count = await seed_recharge_plans_db()
    print(f"Seeded {r_count} recharge plans into 'recharge_plans' collection.")

    print("Seeding invoices...")
    i_count = await seed_invoices_db()
    print(f"Seeded {i_count} invoices into 'invoices' collection.")

    print("Seeding users, orders & payment_plans...")
    from backend.db.mongo import seed_users_and_plans_db
    u_count = await seed_users_and_plans_db()
    print(f"Seeded {u_count} credit plans into 'payment_plans' collection.")

    print("Seeding merchant_policies...")
    policy = await seed_merchant_policy_db()
    print("Seeded 'merchant_policies' collection.")

    print("Seeding initial audit_events...")
    await save_audit_event_db({
        "event_type": "PLAN_RECOMMENDED",
        "context_type": "subscription",
        "selected_plan_id": "plan_349",
        "recommended_plan_id": "plan_399",
        "allowed": True,
        "reason": "Initial seed event for Smart Recharge Audit Trail",
        "timestamp": "2026-09-01T12:00:00Z"
    })
    print("Seeded initial 'audit_events' collection.")
    print("ALL MONGODB ATLAS COLLECTIONS SEEDED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
