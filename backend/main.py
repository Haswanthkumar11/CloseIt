"""
backend/main.py
Main FastAPI application entry point. Configures middleware, API routers, and Swagger UI documentation.
"""

import os
import sys

# Ensure root workspace directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import health, session, chat, payments, outcomes, products, subscription, invoice, payments_hub

tags_metadata = [
    {
        "name": "Health",
        "description": "System health and MongoDB Atlas connectivity diagnostics.",
    },
    {
        "name": "Products",
        "description": "Backend-driven product catalog stored in MongoDB Atlas.",
    },
    {
        "name": "Subscription & Recharge",
        "description": "Smart Recharge plan discovery, factual recommendations, and policy-governed rescue negotiation.",
    },
    {
        "name": "Customer Payments & Credit Hub",
        "description": "Personal payment hub, credit purchase plans, installment schedules, and user-isolated repayment management.",
    },
    {
        "name": "Invoice Recovery",
        "description": "B2B Invoice recovery, email reminders, policy-governed debt negotiation, and Razorpay links.",
    },
    {
        "name": "Session",
        "description": "Checkout session creation and cart state management.",
    },
    {
        "name": "Chat",
        "description": "Agentic objection handling and interactive rescue chat.",
    },
    {
        "name": "Payments",
        "description": "Razorpay Test Mode payment link generation.",
    },
    {
        "name": "Outcomes",
        "description": "Cart rescue analytics and outcome logging.",
    },
]

app = FastAPI(
    title="CloseIt API — Agentic Checkout-Rescue Assistant",
    description=(
        "CloseIt AI Agent Backend. Intercepts shopper exit intent, resolves checkout objections "
        "via Google Gemini LLM tool calls, issues Razorpay Test Mode Payment Links, and logs recovery metrics to MongoDB Atlas."
    ),
    version="1.0.0",
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for local dev and frontend deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(health.router)
app.include_router(products.router)
app.include_router(subscription.router)
app.include_router(payments_hub.router)
app.include_router(invoice.router)
app.include_router(session.router)
app.include_router(chat.router)
app.include_router(payments.router)
app.include_router(outcomes.router)

@app.on_event("startup")
async def startup_event():
    from backend.db.mongo import seed_products_db, seed_merchant_policy_db, seed_recharge_plans_db, seed_invoices_db, seed_users_and_plans_db
    try:
        await seed_products_db()
        await seed_recharge_plans_db()
        await seed_invoices_db()
        await seed_users_and_plans_db()
        await seed_merchant_policy_db()
    except Exception as e:
        print(f"Startup seeding warning: {e}")

if __name__ == "__main__":
    import uvicorn
    from backend.config import settings
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
