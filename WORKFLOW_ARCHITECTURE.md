# Xmetrics — Workflow Architecture Analysis
**Answering 6 questions on UI, APIs, schema, bulk ops, and automation**
*Based on codebase audit (12 migrations, 23 edge functions, 17 pages) + complete workflow spec*

---

## CURRENT STATE: WHAT'S ALREADY BUILT

Before answering any question, it's critical to know what exists to avoid rebuilding things.

### Already built and working
| Area | Status | Notes |
|---|---|---|
| Orders table | ✅ Complete | Has rto_risk_score, rto_review_status, razorpay_payment_id, shipping_cost, shiprocket_shipment_id |
| Exceptions table | ✅ Exists | 8 exception types, severity levels, status workflow |
| Returns table | ✅ Complete | Full 9-stage pipeline, Shiprocket AWB, Razorpay refund fields |
| Reconciliation tables | ✅ Complete | cod_remittance_uploads, cod_remittance_rows, reconciliation_reports |
| Shipments table | ✅ Exists | AWB, tracking, status pipeline, pickup scheduling |
| Order timeline table | ✅ Exists | Event log per order |
| OrderList page | ✅ Exists | Tabs: all/ready/review, bulk select, RTO score, CSV export |
| Exception Center | ✅ Exists | Resolve/dismiss/restore, severity display |
| Fulfillment page | ✅ Exists | 7-tab pipeline: packing → delivered/rto |
| Returns page | ✅ Exists | Full pipeline UI, approval modal, refund trigger |
| Reconciliation page | ✅ Exists | COD + Razorpay, date filter, CSV/PDF export |
| Daily Brief | ✅ Exists | Generated daily, history, date navigation |
| Analytics | ✅ Exists | Revenue, RTO, forecast, reorder |
| Settings / Integrations | ✅ Exists | Shopify, Razorpay, Shiprocket, WhatsApp, Unicommerce |
| RTO scoring edge function | ✅ Exists | 5-factor scoring: COD, pincode, customer history, first-time, AOV |
| Shopify webhooks | ✅ Exists | Real-time order sync |
| Shiprocket webhooks | ✅ Exists | NDR, tracking, return events |
| Razorpay proxy | ✅ Exists | Payments + settlement sync (sync_range action) |
| WhatsApp send | ✅ Exists | Outbound messaging |
| Returns initiate/approve | ✅ Exists | Edge functions for both |

### What's missing or needs redesign
These are the actual gaps the workflow spec exposes.

---

## QUESTION 1: WHAT UI SCREENS MUST BE BUILT OR REDESIGNED?

### SCREEN 1: Order Intelligence Hub (Orders page — MAJOR REDESIGN)
**What it is now:** A generic order list with filters and bulk select.
**What it needs to become:** The routing decision center.

**Current gaps:**
- No "Ready to Push to OMS" section distinct from general order list
- No OMS push status column (pushed / pending / failed)
- No single-click [Push to OMS] button on individual orders
- No auto-push status indicator ("Auto-push ON — GREEN orders push instantly")
- No routing decision label (READY_FOR_PUSH / EXCEPTION_HOLD / PUSHED)
- Bulk "Start Packing" goes to internal fulfillment tab — should become "Push to OMS"

**Redesign scope:**
```
ORDER INTELLIGENCE HUB
──────────────────────────────────────────────────────
[Tab: Needs Decision (12)] [Tab: Ready to Push (34)] [Tab: All Orders]

Auto-push status: GREEN auto-push ON · YELLOW requires review
─────────────────────────────────────────────────────────────

[Needs Decision tab — sorted by urgency]
┌──────────────────────────────────────────────────────────────────────┐
│ ● SH-002    Priya Mehta    ₹1,200    COD    [RTO: 72 HIGH] [ADDRESS ⚠]  │
│  High RTO + invalid pincode · 2 exceptions          [Review] [Hold]  │
│                                                                        │
│ ○ SH-003    Rahul Singh    ₹850     COD    [RTO: 55 MED]              │
│  First-time buyer, rural pincode                    [Approve] [Hold] │
└──────────────────────────────────────────────────────────────────────┘

[Ready to Push tab]
┌──────────────────────────────────────────────────────────────────────┐
│ ○ SH-001    Ananya Roy    ₹2,500    UPI    [RTO: 22 LOW]  [PUSHED ✓] │
│ ○ SH-004    Deepa Kumar   ₹900     COD    [RTO: 38 LOW]  [PENDING → OMS]│
│                                                          [Push to OMS]│
└──────────────────────────────────────────────────────────────────────┘
Bulk: [Select All] → [Push Selected to OMS] [Hold Selected] [Export CSV]
```

**MVP: YES — this is the core workflow screen**

---

### SCREEN 2: Exception Center (REDESIGN — action-specific, not generic resolve)
**What it is now:** Cards with generic resolve/dismiss buttons.
**What it needs:** Exception-specific action buttons with different flows per exception type.

**Redesign scope:**
```
EXCEPTION CENTER                             3 unresolved · 1 critical
─────────────────────────────────────────────────────────────────────

🔴 CRITICAL  SH-002 · Priya Mehta
  High RTO Risk: Score 72 (COD + rural + first-time buyer)
  Customer phone: +91-98765-43210

  [✓ Approve Anyway] → Opens reason modal → writes audit log
  [✏ Correct Address] → Opens address form → re-validate → re-score
  [⏸ Hold] → Stays in queue, reminder at 4h

─────────────────────────────────────────────────────────────────────
🟡 HIGH     SH-007 · Rahul Kumar
  Invalid Address: Pincode 560999 not serviceable by Shiprocket
  
  [✏ Correct Address] → Pincode correction form → re-validate → re-score  
  [✓ Approve Without Correction] → Audit log: "approved unserviceable pincode"
  [🚫 Cancel Order] → Cancel with customer notification

─────────────────────────────────────────────────────────────────────
🟡 MEDIUM   SH-010 · Arun Sharma  
  Low Inventory: Order requests 3 units of PROD-123, only 2 available
  
  [Adjust Inventory] → Opens Products → PROD-123 inventory edit
  [✓ Approve Anyway] → Ships 2 units, flags partial fulfillment
  [🚫 Cancel Order]
```

**Key additions needed:**
- Reason-required modal on "Approve Anyway" → writes to `approval_audit_log`
- Address correction inline form with India Post API validation
- Re-scoring after address correction (calls `rto-score` edge function)
- Per-exception suggested action (different for HIGH_RTO vs ADDRESS_ISSUE vs LOW_INVENTORY)
- Batch approve with shared reason

**MVP: YES — this is the risk management core**

---

### SCREEN 3: Approval Audit Log (NEW SCREEN)
**What it is:** A compliance record of every override decision made.
**Why it matters:** When a high-RTO order is approved and it RTOs, the founder needs to know who approved it and why. Required for accountability and for future ML training.

**Wireframe:**
```
APPROVAL AUDIT LOG                          Search: [___________] [Filter: This Month ▾]
─────────────────────────────────────────────────────────────────────────────────────────
Order #    Customer       Action              By               When        Score    Reason
SH-002     Priya Mehta    Approved (HIGH RTO) Rohan Sharma     25 Jun 11:05  72    "Customer confirmed address via WA"
SH-007     Rahul Kumar    Held               Priya Singh      25 Jun 09:45  —     "Will call customer first"
SH-010     Arun Sharma    Cancelled          Rohan Sharma     25 Jun 08:30  —     "Out of stock, customer notified"
SH-015     Deepa Roy      Approved (ADDRESS) System (auto)    24 Jun 14:00  38    Auto-approved (GREEN)

[Export Audit Log CSV]
```

**Route:** `/audit-log` or as a tab within the Exception Center.
**MVP: YES — essential for accountability and for the enterprise story**

---

### SCREEN 4: OMS Push Settings + Webhook Config (Settings — NEW section)
**What it is:** Configuration panel for the OMS integration.
**Current gap:** Settings → Integrations has Shopify, Razorpay, Shiprocket, WhatsApp — but NO OMS webhook and NO auto-push rules.

**Wireframe (add to Integrations page):**
```
OMS (ORDER MANAGEMENT SYSTEM)                              [Connected ✅]
────────────────────────────────────────────────────────────────────────
Webhook URL    https://youroms.app/webhooks/xmetrics        [Edit]
Last push      25 Jun · 3:15 PM  (34 orders)
Failed         0 failed in last 7 days
               [Test Webhook] [View Push Log] [Resend Failed] [Disconnect]

AUTO-PUSH RULES
─────────────────────────────────────────────────────────────────────
GREEN orders (RTO < 50)   Auto-push immediately   [● ON]
YELLOW orders (RTO 50-60) Require manual review   [○ OFF → ON]
RED orders (RTO ≥ 60)     Always manual            [Locked ON]

Push format: JSON payload  [View Sample Payload]
Secret token (HMAC):  ****-****-8b3f            [Regenerate]
[Save Settings]
```

**MVP: YES — without this, the OMS routing workflow cannot work**

---

### SCREEN 5: NDR Recovery Center (Fulfillment NDR tab — REDESIGN)
**What it is now:** A list of orders with status = NDR.
**What it needs:** Active recovery center with specific actions per attempt count.

**Redesign:**
```
NDR RECOVERY CENTER                   14 active NDRs · 5 first attempt · 9 second attempt
────────────────────────────────────────────────────────────────────────────────────────

[First Attempt (5)]  [Second Attempt (9)]  [Resolved (47)]

FIRST ATTEMPT — reschedule window open
SH-001  Priya Mehta  AWB: SHIP12345  Delhivery  Reason: Customer not available
  WA alert sent: ✅ 25 Jun 14:31  |  Customer response: None
  [📅 Reschedule] [📍 Update Address] [↩ Accept RTO]

SECOND ATTEMPT — escalate or finalize
SH-008  Rahul Roy   AWB: SHIP98765  Ecom       Reason: Customer refused
  Attempt 2 of 3  |  Recovery action: Rescheduled 24 Jun (failed again)
  [📅 Try Once More] [↩ Accept RTO — Final]
  ⚠ If not resolved in 24h, courier will auto-RTO

Bulk: [Reschedule All First-Attempt] [Accept RTO for Selected]
```

**MVP: YES — NDR recovery directly affects RTO rate and cash recovery**

---

### SCREEN 6: Zoho Books Integration (Settings — NEW integration card)
**What it is:** Adds Zoho Books as a 5th integration in Settings → Integrations.
**Why:** The workflow specifies Zoho Books API push of reconciliation data.

**Card:**
```
ZOHO BOOKS                                           [Connect]
────────────────────────────────────────────────────────────
Push reconciliation journal entries to Zoho Books automatically.
Credentials: Client ID, Client Secret, Organization ID
Last sync: Yesterday 9:00 PM
Journal entries created: 12
[Connect] / [Sync Now] [View Log] [Disconnect]
```

**MVP: Phase 2** (valuable but not core to order routing)

---

### SCREEN 7: Customer Return Portal (NEW — public page, no auth)
**What it is:** Public URL the customer lands on from email/WhatsApp to initiate a return.
**Route:** `/returns/portal?order={order_number}&token={one_time_token}`

**Flow:**
```
Step 1: Verify
Enter your Order # and registered phone number
[Order #: ___________]  [Phone: ___________]
[Verify →]

Step 2: Select return reason
Why are you returning?
○ Defective / Not working
○ Wrong item received
○ Changed my mind
○ Size / fit issue
[Add description (optional): ________]
[Upload photo (optional): 📷]
[Submit Return Request →]

Step 3: Confirmation
Return request submitted ✅
You'll receive a shipping label on WhatsApp/email within 24 hours.
Return ID: RTN-001
[Track your return →]
```

**MVP: Phase 2** (important UX but returns can be founder-initiated for now)

---

### SCREEN 8: Daily Brief — Add Action CTAs (ENHANCEMENT)
**What it is now:** A read-only daily summary.
**What it needs:** Each insight should have an action button that deepens to the relevant screen.

**Add to existing brief:**
- "Pending Exceptions: 3" → [Review Exceptions] button → routes to `/exceptions`
- "Ready to Push: 23 orders" → [Push Now] button → routes to `/orders?tab=ready` and triggers bulk push
- "Low Stock: 2 SKUs" → [Reorder Now] → routes to `/analytics?tab=forecast`
- "COD Reconciliation: SHORT_PAID ₹700" → [Investigate] → routes to `/reconciliation`

**MVP: YES for the CTAs (small change, high impact)**

---

### SCREEN 9: Order Detail — Add OMS Routing Panel (ENHANCEMENT)
**What it is:** Add a section to the existing Order Detail page showing:
- Routing decision (READY_FOR_PUSH / EXCEPTION_HOLD / PUSHED_TO_OMS)
- OMS push status + timestamp
- Audit log for this order (all approval/hold/push events)
- Net profit breakdown (GMV - COGS - fees - shipping)

**MVP: YES** (the per-order financial view is the core value proposition in demos)

---

### SCREEN PRIORITY MATRIX

| Screen | MVP or Phase 2 | Founder Impact (1-5) | Build Complexity (1-5) |
|---|---|---|---|
| Order Intel Hub (Orders redesign) | **MVP** | 5 | 3 |
| Exception Center redesign | **MVP** | 5 | 3 |
| Approval Audit Log | **MVP** | 4 | 2 |
| OMS Auto-push Settings | **MVP** | 5 | 2 |
| NDR Recovery Center redesign | **MVP** | 4 | 3 |
| Daily Brief action CTAs | **MVP** | 4 | 1 |
| Order Detail — routing + P&L panel | **MVP** | 5 | 2 |
| Zoho Books integration | Phase 2 | 3 | 3 |
| Customer Return Portal | Phase 2 | 3 | 3 |

---

## QUESTION 2: WHICH SCREENS ARE MOST IMPORTANT?

### Ranked by founder impact (what they'd miss most)

**1. Order Detail — Routing + P&L panel**
The single most powerful demo moment. When a founder opens an order and sees: GMV ₹1,200 → COGS ₹240 → Fee ₹29 → Shipping ₹65 → **Net Profit: ₹866 (72.2%)** — that is the "aha." Nothing else creates desire faster. This is currently missing from the Order Detail page.

**2. Exception Center with audit log**
This is what makes Xmetrics different from every other tool in the market. A hold queue with approval reasons is the unfair advantage. The current exception center is too generic.

**3. Order Intel Hub / OMS routing**
The operational workflow breaks without the "Ready to Push → Push to OMS" flow. Every single working day starts here.

**4. NDR Recovery Center**
Because every NDR that converts to RTO is money lost. When NDR recovery is fast (single-tap from WhatsApp), recovery rates improve. The current Fulfillment NDR tab is passive.

**5. Daily Brief action CTAs**
The brief is already built. Adding 4 action buttons takes 2 hours and immediately improves daily retention.

### Ranked by operational complexity (hardest to build)

**1. OMS Webhook Integration** — requires external contract, error handling, retry logic, HMAC signing, push log, resend
**2. Exception Center redesign** — most logic-dense screen (multiple flows per exception type, re-scoring, audit log writes)
**3. NDR Recovery Center** — requires real Shiprocket API calls for reschedule/address-update/accept-rto
**4. Order Intel Hub** — high visual complexity, routing decision state machine
**5. Approval Audit Log** — relatively simple once the schema exists

---

## QUESTION 3: WHAT API INTEGRATIONS AND WEBHOOKS ARE REQUIRED?

### Already built (confirm before rebuilding)
| Integration | Direction | Edge function | Status |
|---|---|---|---|
| Shopify → Xmetrics | Inbound webhook | `shopify-webhooks` | ✅ |
| Xmetrics → Shiprocket | Outbound API | `shiprocket-proxy` | ✅ |
| Shiprocket → Xmetrics | Inbound webhook | `shiprocket-webhooks` | ✅ |
| Razorpay → Xmetrics | Inbound webhook | `webhooks-razorpay` | ✅ |
| Xmetrics → Razorpay | Outbound API | `razorpay-proxy` | ✅ |
| Xmetrics → WhatsApp | Outbound | `whatsapp-send` | ✅ |
| Returns initiation | Internal | `returns-initiate` | ✅ |
| Returns approval | Internal | `returns-approve` | ✅ |
| Shiprocket return tracking | Inbound webhook | `shiprocket-return-webhook` | ✅ |

### Must be built (net-new)

#### API 1: OMS Push (Xmetrics → OMS)
**Function name:** `oms-push`
**Trigger:** Order approved or auto-push threshold met
**Direction:** Xmetrics → OMS (outbound webhook to configured URL)

```typescript
// Request to OMS
POST https://youroms.app/webhooks/xmetrics
Headers: { X-Xmetrics-Signature: HMAC(payload, secret) }
Body: {
  order_id: "SH-001",
  status: "ready_for_fulfillment",
  rto_score: 35,
  rto_decision: "auto_approved" | "manually_approved_by_founder",
  exception_resolved: boolean,
  audit_log_id: "audit_12345" | null,
  customer: { name, phone, email },
  items: [{ sku, name, quantity, unit_price, cogs }],
  shipping_address: { street, city, state, pincode },
  payment_method: "COD" | "PREPAID",
  payment_status: "awaiting_collection" | "paid",
  channel: "shopify" | "whatsapp" | "manual",
  intelligence_timestamp: ISO8601,
  xmetrics_order_url: "https://app.xmetrics.in/orders/SH-001"
}

// Success response from OMS
{ ok: true, oms_order_id: "OMS-00234" }

// Failure response
{ ok: false, error: "SKU not found in OMS" }
```

**Error handling:** Retry 3× with exponential backoff. After 3 failures, create an exception of type `FAILED_WEBHOOK`. Log to `oms_push_log` table.

---

#### API 2: OMS Status Sync (OMS → Xmetrics)
**Direction:** OMS → Xmetrics (inbound webhook)
**Function name:** `oms-status-sync` (new edge function)

```typescript
// OMS sends when order status changes
POST /functions/v1/oms-status-sync
Body: {
  order_id: "SH-001",
  status: "shipped" | "packing" | "ready_to_ship" | "cancelled",
  awb: "SHIP12345",
  tracking_url: "https://...",
  shipped_timestamp: ISO8601
}
```

---

#### API 3: Shiprocket NDR Actions — Reschedule / Address Update / Accept RTO
**Current state:** `shiprocket-proxy` exists but confirm these specific actions are implemented.

**Must verify in `shiprocket-proxy/index.ts`:**
```typescript
// Check if these actions exist; if not, add them
if (action === 'reschedule_delivery') {
  // POST /courier/courierServiceability/
}
if (action === 'update_ndr_address') {
  // POST /orders/address/update
}
if (action === 'accept_rto') {
  // POST /courier/return
}
```

**These are critical for the NDR recovery flow.**

---

#### API 4: Razorpay Refund (Xmetrics → Razorpay)
**Current state:** `razorpay-proxy` has `sync_range` action. Need `create_refund` action.

```typescript
if (action === 'create_refund') {
  const { payment_id, amount, reason } = body
  const res = await fetch(`${RZP_BASE}/payments/${payment_id}/refund`, {
    method: 'POST',
    headers: rzpHeaders,
    body: JSON.stringify({ amount: amount * 100, notes: { reason } })
  })
  // Return refund ID and status
}
```

---

#### API 5: Zoho Books Journal Entry (Xmetrics → Zoho Books)
**Direction:** Xmetrics → Zoho Books (outbound API, OAuth2)
**Function name:** `zoho-books-sync` (new edge function)

```typescript
// Push reconciliation data as journal entry
POST https://books.zoho.in/api/v3/journalentries
Authorization: Zoho-oauthtoken {token}
Body: {
  journal_date: "2026-06-25",
  reference_number: "RECON-2026-06",
  notes: "COD Reconciliation - June 2026",
  line_items: [
    { account_name: "Shiprocket COD Receivable", debit_or_credit: "debit", amount: 48300 },
    { account_name: "COD Short-Paid", debit_or_credit: "credit", amount: 700 }
  ]
}
```

**Trigger:** After founder clicks "Sync to Zoho" on the Reconciliation page, or auto-nightly.

---

### Real-time vs. Polling Summary

| Integration | Mode | Latency |
|---|---|---|
| Shopify order created | Webhook (push) | < 5s |
| Shiprocket NDR event | Webhook (push) | < 2 min |
| Shiprocket tracking update | Webhook (push) | < 5 min |
| Shiprocket return delivery | Webhook (push) | < 5 min |
| Razorpay payment captured | Webhook (push) | < 10s |
| Razorpay settlement sync | Polling (API pull) | Hourly / on-demand |
| OMS order push | Outbound webhook (on event) | < 1s |
| OMS status sync | Inbound webhook | OMS-dependent |
| Zoho Books sync | Polling (manual/nightly) | Nightly or on-demand |
| RTO scoring | Sync call at order creation | < 500ms |

---

## QUESTION 4: WHAT DATABASE SCHEMA MIGRATIONS ARE NEEDED?

### Migration 13: OMS Integration & Auto-Push

```sql
-- Add OMS push tracking to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS oms_push_status    TEXT DEFAULT 'PENDING'
    CHECK (oms_push_status IN ('PENDING', 'PUSHED', 'FAILED', 'NOT_APPLICABLE')),
  ADD COLUMN IF NOT EXISTS oms_pushed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oms_push_error     TEXT,
  ADD COLUMN IF NOT EXISTS oms_order_id       TEXT,
  ADD COLUMN IF NOT EXISTS routing_decision   TEXT
    CHECK (routing_decision IN ('READY_FOR_PUSH', 'EXCEPTION_HOLD', 'AUTO_PUSHED', 'MANUALLY_PUSHED')),
  ADD COLUMN IF NOT EXISTS routing_decided_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_oms_push_status_idx
  ON orders (brand_id, oms_push_status)
  WHERE oms_push_status = 'PENDING';

-- OMS push log for audit and retry
CREATE TABLE IF NOT EXISTS oms_push_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_id        UUID        NOT NULL REFERENCES orders(id),
  order_number    TEXT        NOT NULL,
  push_type       TEXT        NOT NULL CHECK (push_type IN ('AUTO', 'MANUAL', 'RETRY')),
  pushed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload         JSONB       NOT NULL,
  http_status     INT,
  response_body   JSONB,
  success         BOOLEAN     NOT NULL DEFAULT false,
  error_message   TEXT,
  attempt_number  INT         NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS oms_push_log_brand_id_idx ON oms_push_log (brand_id);
CREATE INDEX IF NOT EXISTS oms_push_log_order_id_idx ON oms_push_log (order_id);
CREATE INDEX IF NOT EXISTS oms_push_log_success_idx  ON oms_push_log (brand_id, success)
  WHERE success = false;
```

---

### Migration 14: Approval Audit Log

```sql
CREATE TABLE IF NOT EXISTS approval_audit_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_id              UUID        NOT NULL REFERENCES orders(id),
  order_number          TEXT        NOT NULL,
  exception_id          UUID        REFERENCES exceptions(id),
  action_type           TEXT        NOT NULL CHECK (action_type IN (
    'AUTO_APPROVED',
    'MANUALLY_APPROVED',
    'APPROVED_HIGH_RTO',
    'APPROVED_INVALID_ADDRESS',
    'APPROVED_LOW_INVENTORY',
    'APPROVED_PAYMENT_MISMATCH',
    'HELD',
    'RELEASED_FROM_HOLD',
    'ADDRESS_CORRECTED',
    'ORDER_CANCELLED',
    'PUSHED_TO_OMS'
  )),
  actor_id              UUID        REFERENCES auth.users(id),
  actor_name            TEXT,
  actor_role            TEXT,
  action_timestamp      TIMESTAMPTZ NOT NULL DEFAULT now(),
  original_rto_score    INT,
  new_rto_score         INT,
  original_status       TEXT,
  new_status            TEXT,
  reason                TEXT,
  notes                 TEXT,
  metadata              JSONB       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS approval_audit_log_brand_id_idx
  ON approval_audit_log (brand_id, action_timestamp DESC);
CREATE INDEX IF NOT EXISTS approval_audit_log_order_id_idx
  ON approval_audit_log (order_id);

ALTER TABLE approval_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON approval_audit_log
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );
CREATE POLICY "audit_log_insert" ON approval_audit_log
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

-- Link audit log to exceptions table
ALTER TABLE exceptions
  ADD COLUMN IF NOT EXISTS resolved_by       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS resolved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
  ADD COLUMN IF NOT EXISTS audit_log_id      UUID REFERENCES approval_audit_log(id);
```

---

### Migration 15: NDR Event Tracking

```sql
CREATE TABLE IF NOT EXISTS ndr_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_id          UUID        NOT NULL REFERENCES orders(id),
  awb_number        TEXT        NOT NULL,
  ndr_id            TEXT,
  attempt_number    INT         NOT NULL DEFAULT 1,
  ndr_reason        TEXT,
  ndr_reason_code   TEXT,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Recovery action taken
  recovery_action   TEXT        CHECK (recovery_action IN (
    'RESCHEDULE', 'ADDRESS_UPDATE', 'ACCEPT_RTO', 'PENDING', 'CUSTOMER_NOTIFIED'
  )),
  recovery_action_at TIMESTAMPTZ,
  recovery_actor    TEXT        CHECK (recovery_actor IN ('FOUNDER', 'CUSTOMER', 'AUTO')),
  rescheduled_date  DATE,
  updated_address   JSONB,

  -- WhatsApp comms
  wa_customer_sent_at    TIMESTAMPTZ,
  wa_founder_sent_at     TIMESTAMPTZ,
  customer_response      TEXT        CHECK (customer_response IN (
    'RESCHEDULE', 'UPDATE_ADDRESS', 'ACCEPT_RTO', 'NO_RESPONSE'
  )),
  customer_responded_at  TIMESTAMPTZ,

  -- Final outcome
  final_outcome     TEXT        CHECK (final_outcome IN (
    'DELIVERED', 'RTO', 'PENDING', 'ESCALATED'
  )),
  final_outcome_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ndr_events_brand_id_idx  ON ndr_events (brand_id);
CREATE INDEX IF NOT EXISTS ndr_events_order_id_idx  ON ndr_events (order_id);
CREATE INDEX IF NOT EXISTS ndr_events_awb_idx       ON ndr_events (awb_number);
CREATE INDEX IF NOT EXISTS ndr_events_pending_idx   ON ndr_events (brand_id, final_outcome)
  WHERE final_outcome = 'PENDING';

ALTER TABLE ndr_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ndr_events_select" ON ndr_events
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );
CREATE POLICY "ndr_events_insert" ON ndr_events
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );
CREATE POLICY "ndr_events_update" ON ndr_events
  FOR UPDATE USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );
```

---

### Migration 16: Brand Auto-Push Settings (extend brands.settings JSONB)

No schema change needed — use existing `brands.settings JSONB` column:

```json
{
  "auto_push_green": true,
  "auto_push_yellow": false,
  "oms_webhook_url": "https://youroms.app/webhooks/xmetrics",
  "oms_webhook_secret": "hashed_secret",
  "oms_webhook_enabled": true,
  "zoho_books_enabled": false,
  "zoho_books_org_id": null
}
```

Add a settings schema validator at the app layer.

---

### Migration 17: Return Portal Token (for public return links)

```sql
CREATE TABLE IF NOT EXISTS return_portal_tokens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_id       UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token          TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  used           BOOLEAN     NOT NULL DEFAULT false,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS return_portal_tokens_token_idx ON return_portal_tokens (token);
CREATE INDEX IF NOT EXISTS return_portal_tokens_order_id_idx ON return_portal_tokens (order_id);
```

---

### Frequently queried — confirm indexes exist

| Query | Index needed | Status |
|---|---|---|
| Orders by brand + routing_decision | `orders(brand_id, routing_decision)` | ❌ Add in Migration 13 |
| Orders by brand + oms_push_status | `orders(brand_id, oms_push_status) WHERE = 'PENDING'` | ❌ Add in Migration 13 |
| NDR events pending outcome | `ndr_events(brand_id, final_outcome) WHERE = 'PENDING'` | ❌ Add in Migration 15 |
| Audit log by brand + timestamp | `approval_audit_log(brand_id, action_timestamp DESC)` | ❌ Add in Migration 14 |
| Audit log by order | `approval_audit_log(order_id)` | ❌ Add in Migration 14 |
| Failed OMS pushes | `oms_push_log(brand_id, success) WHERE = false` | ❌ Add in Migration 13 |

---

## QUESTION 5: WHERE DO BULK OPERATIONS BELONG IN THE UI?

### Rule: Bulk selection appears only where bulk action makes operational sense

| Screen | Bulk Operations | Where the bar appears |
|---|---|---|
| Order Intel Hub (Orders) | Push to OMS · Hold · Export CSV | Sticky bottom bar |
| Exception Center | Approve All · Hold All | Sticky bottom bar |
| NDR Recovery Center | Reschedule All · Accept RTO for Selected | Sticky bottom bar |
| Fulfillment | Generate Labels · Schedule Pickup | Sticky bottom bar (already exists) |
| Returns | Approve Selected Returns | Top toolbar (lower frequency) |

### Sticky bottom bar pattern (recommended for all primary screens)

```
─────────────────────────────────────────────────────────────────────────
 ✅  12 orders selected                [Push to OMS] [Hold] [Export CSV] ✕
─────────────────────────────────────────────────────────────────────────
```

**Rules for the bar:**
- Appears only when ≥1 item is checked
- Stays visible while scrolling (position: fixed, bottom: 0)
- Shows count badge ("12 selected")
- ✕ deselects all
- Primary action (most common) is the leftmost blue button
- Secondary and destructive actions are text or grey buttons to the right
- On mobile: collapses to count badge + single primary CTA, reveals full bar on tap

**Bulk actions by screen:**

**Orders (Needs Decision tab):**
- [Approve All Selected] → opens shared reason modal → writes N audit log entries
- [Hold All Selected]
- [Cancel Selected]

**Orders (Ready to Push tab):**
- [Push Selected to OMS] → fires N OMS webhook pushes in parallel
- [Export CSV]

**Exception Center:**
- [Approve All — Same Reason] → shared reason modal
- [Hold All]

**NDR Recovery:**
- [Reschedule All for Tomorrow] → fires N Shiprocket reschedule calls
- [Accept RTO for Selected] → confirm modal (this is destructive — RTO cannot be undone)

**NEVER bulk on:**
- Refunds (each refund is an irreversible financial action — always one-by-one)
- Return inspection (condition must be assessed per item)
- Zoho sync (only one brand at a time)

---

## QUESTION 6: WHAT SHOULD BE AUTO-TRIGGERED VS. MANUALLY APPROVED?

### Decision Matrix

| Trigger | Condition | Auto-trigger? | Why |
|---|---|---|---|
| **ORDER ROUTING** | | | |
| New order created, RTO < 50, valid address, paid | GREEN | Auto-push to OMS **if toggle ON** | Low risk, no decision needed |
| New order created, RTO 50-60 | YELLOW | Manual review **unless toggle ON** | Marginal risk — founder decides their risk appetite |
| New order created, RTO ≥ 60 | RED | Always manual, always exception | High risk — founder must consciously approve |
| New order, invalid pincode | ANY score | Always exception | Cannot ship without valid address |
| New order, COD from customer with >50% RTO history | ANY | Always exception | Customer-level signal overrides score |
| New order, inventory = 0 | ANY | Always exception | Cannot fulfill |
| **NDR RECOVERY** | | | |
| NDR event received (any reason) | First attempt | Auto-send WhatsApp to customer | No human needed — customer can self-serve |
| NDR event received | First attempt | Auto-send WA to founder | Situational awareness, not decision-forcing |
| Customer taps [Reschedule] in WA | Customer-confirmed | Auto-call Shiprocket reschedule API | Customer has confirmed — execute immediately |
| Customer taps [Update Address] | Customer-confirmed | Auto-update address, auto-reschedule | Customer owns the correction |
| Customer taps [Accept RTO] | Customer-confirmed | Auto-initiate RTO via Shiprocket | Customer approved — execute |
| Founder taps [Reschedule] in Xmetrics | Manual | Auto-call Shiprocket reschedule API | Founder approved — execute |
| Second NDR attempt fails | Attempt 2 | Send escalation WA to founder | Not auto-RTO — give founder one more chance |
| Third NDR attempt fails | Attempt 3 | Auto-initiate RTO **if configured** | Some brands prefer to auto-RTO at attempt 3 |
| **RETURNS** | | | |
| Customer initiates return (within return window) | Eligible | Auto-approve + trigger reverse pickup label | Return window policy says it's eligible |
| Customer initiates return (outside window) | Ineligible | Auto-deny with explanation | Policy-based, no human needed |
| Founder initiates return | Any | Auto-approve (founder is approving by clicking) | Founder action = approval |
| RTO arrives at warehouse | RTO type | Auto-mark "Received" in returns | Shiprocket webhook fires — no human needed |
| Inspection decision: Accept | Founder-submitted | Auto-trigger Razorpay refund | Founder submitted form = approval |
| Inspection decision: Partial | Founder-submitted | Auto-trigger partial Razorpay refund | Same |
| Inspection decision: Reject | Founder-submitted | Notify customer (no refund) | Founder decision executed |
| **RECONCILIATION** | | | |
| COD CSV uploaded | Any | Auto-parse + auto-match + auto-flag discrepancies | Fully automatable computation |
| Razorpay settlement sync | Scheduled or manual | Auto-pull API + auto-match | API data is factual — compute automatically |
| Short-paid discrepancy > ₹500 | Significant | Auto-create exception + notify founder | Financial alert, founder must decide action |
| Discrepancy matched ₹0 | Clean | No notification needed | Green state — no action required |
| Zoho Books sync | Nightly | Auto-push journal entries | Accounting sync is non-reversible; run nightly, not on every change |
| **NOTIFICATIONS** | | | |
| High-risk order created | RTO ≥ 60 | Auto-WA to founder | Situational awareness |
| COD remittance short-paid | Amount > ₹200 | Auto-WA to founder | Financial alert |
| SKU predicted to stock out in ≤ 7 days | Any SKU | Auto-WA to founder | Operational urgency |
| NDR customer response received | Any | Auto-WA to founder confirming action taken | Closed-loop confirmation |
| Refund processed successfully | Any | Auto-WA to customer | Customer expects confirmation |

### The configuration panel (Auto-push Settings in Integrations)

Founders should be able to configure which auto-triggers fire. The settings UI should offer:

```
AUTO-TRIGGER RULES
──────────────────────────────────────────────────────
ORDER ROUTING
 ● Auto-push GREEN orders (RTO < 50) immediately    [ON ●]
 ● Auto-push YELLOW orders (RTO 50-60)             [OFF ○]  [← recommended OFF]
 ● Block RED orders (RTO ≥ 60) — always manual     [Locked ON]

NDR RECOVERY
 ● Send WhatsApp to customer on NDR                [ON ●]
 ● Auto-execute customer's 1-tap action (reschedule/address/rto) [ON ●]
 ● Auto-initiate RTO after X failed attempts       [OFF ○] X: [3 ▾]

RETURNS
 ● Auto-approve returns within return window       [ON ●]
 ● Auto-deny returns outside return window         [ON ●]

RECONCILIATION
 ● Auto-sync Razorpay settlements hourly           [ON ●]
 ● Auto-push to Zoho Books nightly                 [OFF ○]
 ● Alert me on COD short-paid > ₹[500]            [ON ●]

[Save Rules]
```

---

## IMPLEMENTATION PRIORITY (BUILD ORDER)

### Phase 1 — MVP (weeks 1-4)

**Week 1:**
- Migration 13 (oms_push_status on orders, oms_push_log)
- Migration 14 (approval_audit_log)
- `oms-push` edge function (webhook to configured OMS URL with HMAC)
- `oms-status-sync` edge function (inbound from OMS)

**Week 2:**
- Orders page redesign: routing decision display, "Ready to Push" tab, bulk push action
- Exception Center redesign: per-exception action buttons, reason modal, address correction form, audit log write
- OMS / Auto-push settings section in Integrations

**Week 3:**
- Migration 15 (ndr_events table)
- NDR Recovery Center (redesign Fulfillment NDR tab with recovery actions)
- Verify/add Shiprocket reschedule/address-update/accept-rto actions in `shiprocket-proxy`
- Add Razorpay `create_refund` action in `razorpay-proxy`

**Week 4:**
- Approval Audit Log page (`/audit-log`)
- Order Detail page: routing status panel + P&L breakdown
- Daily Brief: add action CTAs

### Phase 2 (weeks 5-8)

- Migration 16 (return portal tokens)
- Customer Return Portal (public page)
- Zoho Books integration (`zoho-books-sync` edge function + settings card)
- Auto-trigger configurator (full settings panel)
- OMS push log viewer (debug/retry UI)
- NDR customer WhatsApp action response tracking

---

*Document compiled June 2026. Based on live codebase audit of 12 migrations, 23+ edge functions, 17 UI pages. All schema and API designs are compatible with existing Supabase/Postgres/Deno stack.*
