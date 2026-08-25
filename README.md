# CloseIt — Agentic Checkout-Rescue Assistant

**Razorpay AI Builder Internship 2026 — Track 1: AI Growth & Agentic Commerce**

## Problem

Most online stores lose 60–70% of buyers at checkout — not because of price, but because
of friction: too many steps, no personalized nudge, and no one to resolve last-second
doubts ("is COD available?", "can I get EMI?"). Merchants have no way to intervene in
the moment a shopper is about to abandon.

## Solution

CloseIt is an AI agent embedded on a merchant's checkout page. It detects hesitation
signals (mouse leaving the viewport, prolonged idle time, repeated back-navigation),
opens a conversational chat, and actively works to close the sale:

- Answers real objections in natural language (shipping, refunds, EMI, COD)
- Dynamically offers a resolution — a discount code or an alternate payment method —
  based on the specific objection detected
- Generates a live Razorpay Payment Link inside the chat so the user can complete
  payment without leaving the conversation
- Logs the objection type and outcome for every session, so merchants can see *why*
  carts are recovered or lost

## Why This Is Different

Most "AI shopping assistant" entries are general-purpose product Q&A bots. CloseIt is
narrow and metric-driven: it only activates at the moment of exit intent, it always
drives toward one outcome (a completed payment), and it produces a business-relevant
artifact — an objection log — that a merchant can act on. It's an agent with a job,
not a chatbot with a personality.

## Demo Flow (~3 minutes)

1. User adds an item to cart on the demo storefront
2. User hesitates — moves mouse toward the tab bar / browser back button
3. CloseIt chat opens: "Hey, before you go — is something holding you back?"
4. User types an objection (e.g. "too expensive")
5. Agent responds with a resolution (discount code, or switches UI to show EMI option)
6. User agrees; agent generates a Razorpay test Payment Link and the user pays
7. Session outcome logs to a simple results view: objection type, resolution offered,
   recovered amount

## Tech Stack (all free-tier / open-source)

| Layer | Tool |
|---|---|
| LLM | Groq API (free tier) or Google Gemini free tier |
| Agent logic | Plain function-calling — no paid framework required |
| Payments | Razorpay Test Mode — Payment Links API |
| Frontend | React (or plain HTML/JS) — hosted free on Vercel |
| Backend | FastAPI or Node/Express — hosted free on Render/Railway |
| Exit-intent detection | Vanilla JS (mouseleave, visibilitychange, idle timer) |
| Session log | SQLite or a local JSON file (skip a dashboard unless time allows) |

See `ARCHITECTURE.md` for system design and `PROJECT_SPEC.md` for the build plan and
scope boundaries.

## Status

Solo build, hackathon-scoped. Target: ~14–16 hours across 2–3 days. Core flow
(exit-intent → chat → objection handling → payment link → log) is the non-negotiable
deliverable; everything else is a stretch goal.
