-- Migration 16: Webhook integrity — idempotency + dead-letter
--
-- Webhook handlers (Shopify, Shiprocket, Razorpay) were not idempotent: a
-- duplicate/retried delivery re-ran side-effects (customer counters, payment
-- rows, exceptions). And a handler that threw mid-flight returned 200, so the
-- event was silently lost. These two tables fix both.

-- ─── 1. Idempotency ledger ───────────────────────────────────────────────────
-- A handler inserts (provider, event_id) before processing; a UNIQUE violation
-- means "already processed" → ack and skip.

CREATE TABLE IF NOT EXISTS webhook_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT        NOT NULL,           -- 'shopify' | 'shiprocket' | 'razorpay'
  event_id    TEXT        NOT NULL,           -- provider's unique webhook/event id
  brand_id    UUID        REFERENCES brands(id) ON DELETE CASCADE,
  topic       TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS webhook_events_brand_idx ON webhook_events (brand_id, received_at DESC);

-- Old idempotency keys aren't useful after a few weeks; callers may prune.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_events_brand_member" ON webhook_events
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

-- ─── 2. Dead-letter for failed webhook processing ────────────────────────────

CREATE TABLE IF NOT EXISTS failed_webhooks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT        NOT NULL,
  event_id    TEXT,
  brand_id    UUID        REFERENCES brands(id) ON DELETE CASCADE,
  topic       TEXT,
  payload     JSONB,
  error       TEXT,
  resolved    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS failed_webhooks_unresolved_idx
  ON failed_webhooks (brand_id, created_at DESC) WHERE resolved = false;

ALTER TABLE failed_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "failed_webhooks_brand_member" ON failed_webhooks
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

-- ─── 3. Fulfillment source-of-truth precedence ───────────────────────────────
-- Shopify and Shiprocket both write orders.fulfillment_status. Last-writer-wins
-- let a late Shopify "fulfilled" (= SHIPPED) overwrite a courier "DELIVERED".
-- This function only advances the status — never regresses it — in a single
-- atomic statement, so concurrent webhooks can't drift the order backwards.

CREATE OR REPLACE FUNCTION set_fulfillment_status_forward(p_order_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rank_map JSONB := '{
    "CONFIRMED":1,"PROCESSING":2,"PACKING":3,"READY_TO_SHIP":4,"SHIPPED":5,
    "IN_TRANSIT":6,"OUT_FOR_DELIVERY":7,"RTO_INITIATED":9,"CANCELLED":9,"LOST":9,
    "DELIVERED":10
  }';
  cur TEXT;
BEGIN
  SELECT fulfillment_status INTO cur FROM orders WHERE id = p_order_id;
  IF cur IS NULL THEN
    RETURN;
  END IF;
  -- Advance only when the incoming status ranks at least as high as the current.
  IF COALESCE((rank_map->>p_status)::int, 0) >= COALESCE((rank_map->>cur)::int, 0) THEN
    UPDATE orders SET fulfillment_status = p_status WHERE id = p_order_id;
  END IF;
END;
$$;
