-- Migration 07: Returns table + critical schema fixes from audit

-- ─── Audit fix 1: rto_review_status missing NOT_REQUIRED ─────────────────

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_rto_review_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_rto_review_status_check
  CHECK (rto_review_status IN ('PENDING', 'APPROVED', 'HELD', 'FLAGGED', 'NOT_REQUIRED'));

-- ─── Audit fix 2: subscriptions missing billing_cycle ────────────────────

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'MONTHLY'
    CHECK (billing_cycle IN ('MONTHLY', 'YEARLY'));

-- ─── Audit fix 3: orders missing webhook-target columns ──────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS razorpay_payment_id    TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_fee           NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS razorpay_tax           NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS shipping_cost          NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS shiprocket_shipment_id BIGINT;

CREATE INDEX IF NOT EXISTS orders_razorpay_payment_id_idx ON orders (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- ─── Returns table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS returns (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                    UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_id                    UUID        NOT NULL REFERENCES orders(id),
  customer_id                 UUID        NOT NULL REFERENCES customers(id),

  return_reason               TEXT        NOT NULL
    CHECK (return_reason IN ('damaged', 'wrong_item', 'changed_mind', 'defective', 'size_issue')),
  customer_comment            TEXT,

  status                      TEXT        NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK (status IN (
      'PENDING_APPROVAL', 'AUTO_DENIED', 'APPROVED',
      'LABEL_GENERATED', 'IN_TRANSIT', 'RECEIVED',
      'REFUND_INITIATED', 'COMPLETED', 'LOST'
    )),
  denial_reason               TEXT,

  return_condition            TEXT
    CHECK (return_condition IN ('GOOD', 'DAMAGED', 'DEFECTIVE', 'LOST')),
  return_eligible_for_resale  BOOLEAN     NOT NULL DEFAULT FALSE,
  return_window_days          INT         NOT NULL DEFAULT 30,

  return_initiation_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  return_approved_date        TIMESTAMPTZ,
  return_approved_by          TEXT,
  return_approval_notes       TEXT,

  shiprocket_awb_number       TEXT,
  shiprocket_order_id         TEXT,
  shiprocket_label_url        TEXT,
  shiprocket_error            TEXT,
  expected_return_delivery    TIMESTAMPTZ,
  actual_return_received_date TIMESTAMPTZ,

  refund_amount               NUMERIC(10, 2),
  refund_method               TEXT
    CHECK (refund_method IN ('RAZORPAY', 'COD_REVERSAL')),
  razorpay_refund_id          TEXT,
  cod_refund_status           TEXT
    CHECK (cod_refund_status IN ('PENDING', 'SENT', 'CONFIRMED')),

  inventory_updated_at        TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_returns_brand_id    ON returns (brand_id);
CREATE INDEX IF NOT EXISTS idx_returns_order_id    ON returns (order_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer_id ON returns (customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_status      ON returns (status);
CREATE INDEX IF NOT EXISTS idx_returns_awb         ON returns (shiprocket_awb_number)
  WHERE shiprocket_awb_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_returns_created_at  ON returns (created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_returns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS returns_updated_at ON returns;
CREATE TRIGGER returns_updated_at
  BEFORE UPDATE ON returns
  FOR EACH ROW EXECUTE FUNCTION update_returns_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "returns_select" ON returns
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

CREATE POLICY "returns_insert" ON returns
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

CREATE POLICY "returns_update" ON returns
  FOR UPDATE USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );
