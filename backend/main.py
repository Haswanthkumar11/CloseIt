"""
backend/main.py
Main FastAPI application entry point. Configures middleware, API routers, and Swagger UI documentation.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import health, session, chat, payments, outcomes, products

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
        "via Groq LLM tool calls, issues Razorpay Test Mode Payment Links, and logs recovery metrics to MongoDB Atlas."
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
app.include_router(session.router)
app.include_router(chat.router)
app.include_router(payments.router)
app.include_router(outcomes.router)

if __name__ == "__main__":
    import uvicorn
    from backend.config import settings
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
