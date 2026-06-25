-- Migration 15: Campaign spend tracking + order coupon attribution
--
-- Supports the Campaign ROI and Discount Leakage analytics. Orders carry the
-- coupon used at checkout; the campaigns table holds manually-entered marketing
-- spend, attributed to orders by coupon_code.

-- ─── 1. Coupon on orders (Campaign ROI / Discount attribution) ───────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_code TEXT;

CREATE INDEX IF NOT EXISTS orders_coupon_idx
  ON orders (brand_id, coupon_code)
  WHERE coupon_code IS NOT NULL;

-- ─── 2. Campaign spend (manual entry) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  coupon_code TEXT        NOT NULL,
  spend       NUMERIC     NOT NULL DEFAULT 0 CHECK (spend >= 0),
  channel     TEXT,
  started_at  DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_brand_idx ON campaigns (brand_id, created_at DESC);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_brand_member" ON campaigns
  FOR ALL USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );
