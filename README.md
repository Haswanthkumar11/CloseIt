# CloseIt — Agentic Checkout & Revenue Recovery Assistant

**Razorpay AI Builder Internship 2026 — Track 1: AI Growth & Agentic Commerce**

## Problem

Most online businesses lose revenue across the customer lifecycle — from cart abandonment at checkout to unpaid subscription renewals and overdue B2B invoices. Traditional reminders are passive notice emails ("Your invoice is overdue") that lack interactive negotiation or immediate payment resolution.

## Solution

CloseIt is a unified, multi-context AI revenue recovery agent embedded across a merchant's storefront, subscription portal, and invoicing dashboard. It operates across **3 Commercial Contexts** under strict **Merchant Policy Guardrails**:

1. **E-Commerce Checkout Rescue (`🛍️ Shop`)**: Intercepts shopper exit intent, resolves price/shipping friction, and offers policy-approved discounts or 3-Month Credit Payment Plans (20% down today) for storefront products.
2. **Smart Recharge & Plan Rescue (`📱 Recharge`)**: Compares telecom recharge plans (Jio, Airtel, Vi) based on factual data (validity, OTT bundles, 5G), negotiates policy-approved discounts, and drives plan upgrades.
3. **Customer Payment & Credit Hub (`💳 My Payments`)**: Connects storefront credit purchases directly into the customer's personal payment center. Displays upcoming installment alerts (₹1,333 due Oct 1), tracks purchase history, and lets CloseIt negotiate compliant payment plan extensions or partial downpayments.

---

## Unified Multi-Context Architecture

```
                         CLOSEIT
              Revenue Recovery Agent Engine
                            │
                            ▼
                   NEGOTIATION ENGINE
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
    CHECKOUT            SMART RECHARGE       INVOICE
     RESCUE                 RESCUE          RECOVERY
  (Storefront)         (Subscription)      (B2B Invoices)
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                     POLICY ENGINE
  (Max Cart Discount, Max Recharge Discount, Min 30% Partial Pay, Max 30d Extension)
                            │
                            ▼
                   APPROVED ACTION
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
     Razorpay Links      Email Reminders   MongoDB Audit Trail
```

---

## Key Security Rule: Policy Engine Authorization

The LLM may propose a commercial arrangement, but it is **NEVER authoritative for payment amounts, discount limits, due-date extensions, or policy authorization**. The backend and Policy Engine deterministically calculate and validate all values before any Razorpay Payment Link is created.

---

## 3 Demo Scenarios in Module 3 (Invoice Recovery)

- **Scenario A — Partial Payment (Compliant)**:
  - Client asks: *"I'm having cash-flow issues. Can I pay ₹4,000 now and the rest next month?"*
  - Evaluation: ₹4,000 / ₹12,500 = 32% (≥ 30% min upfront requirement).
  - Outcome: ✅ Approved -> Generates structured 30% down arrangement -> Razorpay link for ₹4,000.
- **Scenario B — Due Date Extension (Compliant)**:
  - Client asks: *"Can you give me another 15 days to pay the full amount?"*
  - Evaluation: 15-day extension (≤ 30 days maximum limit).
  - Outcome: ✅ Approved -> Updates due date -> Confirms extension.
- **Scenario C — Excessive Request (Non-Compliant / Rejected)**:
  - Client asks: *"Can I pay ₹1,000 now and the remaining amount after 90 days?"*
  - Evaluation: 8% upfront (< 30% min limit) & 90 days (> 30d max limit).
  - Outcome: ❌ Rejected with transparent policy explanation (*"Requires at least 30% upfront and max 30 days extension"*).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **LLM & Function Calling** | Google Gemini 2.5 Flash / Groq API (Direct Function Calling) |
| **Backend Engine** | Python FastAPI with CORS & Swagger UI (`/docs`) |
| **Database & Persistence** | MongoDB Atlas (Async Motor driver) with 6 seeded collections |
| **Payments** | Razorpay Test Mode — Payment Links API (`create_payment_link_service`) |
| **Email Dispatch** | SMTP Email Reminders & Demo Simulation (`backend/services/email.py`) |
| **Frontend UI** | React + Vite with Lucide icons & Glassmorphic CSS |
| **Exit-Intent & Routing** | Dynamic context switching (`checkout`, `subscription`, `invoice`) |
| **Policy Engine** | Strict backend validation rules (`policy_engine.py`) |
| **Analytics Dashboard** | Outcomes Log table & Audit Trail view (`/outcomes`) |

---

## Status: ✅ All 3 Modules Implemented & Verified

- [x] **Module 1: E-Commerce Checkout Rescue**: Exit intent detection, price objection resolution, EMI/UPI options, Razorpay links.
- [x] **Module 2: Smart Recharge Rescue**: Factual plan comparison, OTT/5G bundle recommendation, policy discount negotiation.
- [x] **Module 3: Invoice Recovery & Debt Negotiation**: Overdue invoice tracking, custom invoice creation in UI & Atlas, email reminders, 3 policy simulation scenarios, Razorpay links, and MongoDB Audit Trail.

