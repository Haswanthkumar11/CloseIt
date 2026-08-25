# CloseIt — Architecture

## 1. System Overview

```
┌─────────────────────┐        ┌──────────────────────┐        ┌─────────────────┐
│  Demo Storefront     │        │  CloseIt Backend      │        │  External APIs   │
│  (React / HTML+JS)   │        │  (FastAPI or Node)     │        │                  │
│                      │        │                        │        │                  │
│ - Product page       │  HTTP  │ - /session/start       │  HTTP  │ - Groq/Gemini    │
│ - Exit-intent JS     │───────▶│ - /chat (agent turn)   │───────▶│   (LLM calls)    │
│ - Chat widget UI     │◀───────│ - /resolve-objection   │◀───────│ - Razorpay Test  │
│ - Checkout button    │  JSON  │ - /create-payment-link │        │   (Payment Links)│
└─────────────────────┘        │ - /log-outcome          │        └─────────────────┘
                                │                        │
                                │  Session store (in-mem  │
                                │  dict or SQLite)        │
                                └──────────────────────┘
```

## 2. Components

### 2.1 Frontend (Storefront + Widget)
- A minimal single-product demo storefront (doesn't need to be a real store).
- **Exit-intent detector**: listens for
  - `mouseleave` events where `clientY < 0` (cursor moving toward browser chrome)
  - `visibilitychange` → tab going hidden
  - an idle timer (e.g. 20s of no interaction on the checkout page)
- On trigger, opens the **chat widget** (a simple floating panel).
- Chat widget sends user messages to the backend `/chat` endpoint and renders
  responses, including any generated payment link as a clickable button.

### 2.2 Backend (Agent Orchestrator)
- **`POST /session/start`** — creates a session id, stores cart context
  (item, price, quantity).
- **`POST /chat`** — receives the user's message + session id:
  1. Loads session context.
  2. Sends a system prompt + conversation history + user message to the LLM,
     with function/tool definitions for:
     - `offer_discount(percent)`
     - `switch_payment_method(method)` (e.g. EMI, UPI, COD info)
     - `create_payment_link(amount)`
  3. If the LLM calls a function, backend executes it (e.g. calls Razorpay API)
     and returns the result to the LLM for a final natural-language reply.
  4. Returns the assistant's reply (+ any payment link URL) to the frontend.
- **`POST /log-outcome`** — called when a session ends (payment completed, or
  user leaves anyway). Stores: objection type (classified by the LLM or a
  simple keyword rule), resolution offered, and whether it converted.

### 2.3 LLM / Agent Logic
- System prompt establishes the agent's role: a checkout-rescue assistant for
  a specific store, with the current cart context injected.
- Function-calling is used instead of a full agent framework — keeps the
  build simple and avoids extra dependencies.
- Objection classification can start as a simple keyword match (e.g. "expensive",
  "cod", "emi", "shipping") and be upgraded to an LLM classification call if
  time allows.

### 2.4 Payments (Razorpay Test Mode)
- Backend holds Test Mode `KEY_ID` / `KEY_SECRET` in environment variables.
- `create_payment_link` calls Razorpay's Payment Links API with the (possibly
  discounted) amount and returns the short_url to the frontend.
- No webhook verification needed for the demo — polling the Payment Link
  status or just showing the Razorpay test checkout completing is enough.

### 2.5 Data / Session Store
- For the hackathon: an in-memory Python dict or a single SQLite file is
  sufficient. No need for Postgres/Redis.
- Schema (conceptual):
  - `sessions`: id, cart_item, price, created_at
  - `messages`: session_id, role, content, timestamp
  - `outcomes`: session_id, objection_type, resolution, converted (bool),
    recovered_amount

## 3. Request Flow (Happy Path)

1. Shopper lands on product page → `POST /session/start` → session_id stored
   client-side (cookie or localStorage).
2. Exit-intent fires → chat widget opens → first agent message shown
   (can be a canned opener, no LLM call needed yet).
3. User types objection → `POST /chat` → LLM decides a function call
   (e.g. `offer_discount(5)`) → backend applies it → LLM crafts reply →
   frontend shows reply + updated price.
4. User agrees to pay → LLM calls `create_payment_link` → backend hits
   Razorpay Test API → link returned → frontend shows "Pay Now" button.
5. User completes test payment → frontend detects completion (redirect or
   manual "I've paid" confirmation for demo purposes) → `POST /log-outcome`.

## 4. Environment Variables

```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
LLM_API_KEY=          # Groq or Gemini
LLM_PROVIDER=groq     # or gemini
```

## 5. Deployment (all free tier)

- Frontend → Vercel (static/React) or just serve via the backend for simplicity.
- Backend → Render or Railway free web service.
- No database service needed if using SQLite (ships as a file with the app).

## 6. Deliberately Out of Scope (for hackathon time budget)

- Real merchant onboarding / multi-tenant support
- Webhook-based payment confirmation (poll or manual confirm instead)
- Full analytics dashboard (a simple table/log view is enough)
- Authentication (not needed for a single demo storefront)
