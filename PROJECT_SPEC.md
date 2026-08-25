# CloseIt — Build Spec / Agent Brief

Use this file as the instruction set when asking a coding agent (e.g. Antigravity)
to scaffold this project. Read `README.md` for context and `ARCHITECTURE.md` for
system design before generating code.

## Goal

Scaffold a working end-to-end base for CloseIt: a checkout-rescue chat agent that
detects exit intent, negotiates with the shopper via an LLM, and generates a
Razorpay Test Mode payment link.

## Build Order (ask the agent to follow this sequence, not build everything at once)

1. **Backend skeleton**
   - FastAPI (or Express) app with routes: `/session/start`, `/chat`,
     `/create-payment-link`, `/log-outcome`
   - In-memory or SQLite session store per `ARCHITECTURE.md` section 2.5
   - `.env.example` file listing required environment variables

2. **Razorpay integration**
   - A `payments.py` (or `payments.js`) module wrapping the Razorpay Payment
     Links API using Test Mode credentials
   - A standalone test script that creates one payment link and prints the URL,
     so it can be verified in isolation before wiring it to the chat flow

3. **LLM agent logic**
   - A module that builds the system prompt (store name, cart context) and
     defines the three functions: `offer_discount`, `switch_payment_method`,
     `create_payment_link`
   - Wire this into `/chat`: user message in → LLM turn → function execution
     if requested → final reply out
   - Start with a keyword-based objection classifier; leave a clear seam to
     swap in an LLM-based classifier later

4. **Frontend demo storefront**
   - One product page with a price, an "Add to cart" and "Checkout" button
   - Exit-intent JS (mouseleave/visibilitychange/idle timer) that opens the
     chat widget
   - Chat widget: message list + input box, renders a "Pay Now" button when
     a payment link is returned

5. **Outcome logging**
   - Simple `/log-outcome` write to the session store
   - A minimal `/outcomes` view (plain HTML table is fine) to show recovered
     carts and objection types for the demo

## Non-Goals for the Base Scaffold

Do not build: authentication, multi-merchant support, webhook signature
verification, or a polished dashboard. These are explicitly out of scope —
see `ARCHITECTURE.md` section 6.

## Acceptance Check for the Base Build

The scaffold is "done" when this flow works locally end-to-end with test
credentials:

1. Load the storefront page
2. Trigger exit intent → chat opens
3. Type an objection → get a relevant reply with a function call executed
4. Receive a real Razorpay Test Mode payment link
5. See the session appear in the outcomes log

## Notes for the Coding Agent

- Keep dependencies minimal — no heavyweight agent frameworks required;
  direct LLM function-calling is sufficient and easier to debug under time
  pressure.
- Prioritize the backend + Razorpay integration working correctly before
  polishing the frontend UI.
- Ask for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `LLM_API_KEY` as
  environment variables — never hardcode them.
