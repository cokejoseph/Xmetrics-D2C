-- Migration 09: Billing Infrastructure
-- Renames the old checkout subscriptions table → checkout_payments (preserves test payment)
-- Creates the authoritative brand subscriptions table with full billing lifecycle
-- Adds subscription_history (event log) and plan_config (plan catalogue)

-- ─── 1. Preserve existing checkout_payments data ──────────────────────────────

ALTER TABLE subscriptions RENAME TO checkout_payments;

DROP INDEX IF EXISTS subscriptions_email_idx;
DROP INDEX IF EXISTS subscriptions_razorpay_order_idx;
DROP INDEX IF EXISTS subscriptions_status_idx;

CREATE INDEX IF NOT EXISTS checkout_payments_email_idx          ON checkout_payments(email);
CREATE INDEX IF NOT EXISTS checkout_payments_razorpay_order_idx ON checkout_payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS checkout_payments_status_idx         ON checkout_payments(status);

-- ─── 2. Brand subscriptions (authoritative, post-signup) ─────────────────────

CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                UUID NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  plan_type               TEXT NOT NULL CHECK (plan_type IN ('STARTER','GROWTH','SCALE','ENTERPRISE')),

  -- Razorpay linkage
  razorpay_customer_id    TEXT,
  razorpay_subscription_id TEXT,
  razorpay_order_id       TEXT,
  razorpay_payment_id     TEXT,

  -- Billing cycle
  billing_start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  billing_end_date        DATE,
  next_renewal_date       DATE,
  renewal_attempt_count   INT NOT NULL DEFAULT 0,

  -- Status machine
  status                  TEXT NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('TRIAL','ACTIVE','PAYMENT_FAILED','PAUSED','CANCELLED','EXPIRED')),
  status_updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Financial
  plan_amount_paise       INT NOT NULL,
  paid_amount_paise       INT NOT NULL DEFAULT 0,
  payment_method          TEXT DEFAULT 'RAZORPAY',

  -- Usage counters (updated by usage-check cron + actions)
  orders_this_month       INT NOT NULL DEFAULT 0,
  team_members_count      INT NOT NULL DEFAULT 1,
  integrations_connected  INT NOT NULL DEFAULT 0,

  -- Plan limits (denormalised from plan_config for fast reads)
  max_orders_per_month    INT,
  max_team_members        INT,
  max_integrations        INT,
  feature_flags           JSONB NOT NULL DEFAULT
    '{"daily_brief":true,"churn_detection":true,"forecast":true,"exports":true}'::jsonb,

  -- Cancellation
  cancellation_reason     TEXT,
  cancelled_at            TIMESTAMPTZ,

  -- Metadata
  email                   TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_brand_id       ON subscriptions(brand_id);
CREATE INDEX idx_subscriptions_status         ON subscriptions(status);
CREATE INDEX idx_subscriptions_rzp_sub_id     ON subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;
CREATE INDEX idx_subscriptions_next_renewal   ON subscriptions(next_renewal_date)
  WHERE status = 'ACTIVE';

-- ─── 3. Subscription event log ────────────────────────────────────────────────

CREATE TABLE subscription_history (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id      UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event                TEXT NOT NULL,   -- CREATED | ACTIVATED | PAYMENT_SUCCESS | PAYMENT_FAILED
                                        -- PLAN_UPGRADED | PLAN_DOWNGRADED | CANCELLED | RENEWED | PAUSED | RESUMED
  old_status           TEXT,
  new_status           TEXT,
  razorpay_event_id    TEXT UNIQUE,     -- de-dup webhook events
  metadata             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_history_subscription_id  ON subscription_history(subscription_id);
CREATE INDEX idx_sub_history_event            ON subscription_history(event);
CREATE INDEX idx_sub_history_rzp_event_id     ON subscription_history(razorpay_event_id)
  WHERE razorpay_event_id IS NOT NULL;

-- ─── 4. Plan catalogue ────────────────────────────────────────────────────────

CREATE TABLE plan_config (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type          TEXT NOT NULL UNIQUE,
  display_name       TEXT NOT NULL,
  amount_paise       INT  NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'INR',
  max_orders         INT,
  max_team_members   INT,
  max_integrations   INT,
  features           JSONB,
  description        TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO plan_config
  (plan_type, display_name, amount_paise, max_orders, max_team_members, max_integrations, features, description)
VALUES
  ('STARTER',    'Starter',    99900,  500,   1,    3,    '{"daily_brief":true,"churn_detection":false,"forecast":true,"exports":false}',                                         '₹999/mo — perfect for solo founders'),
  ('GROWTH',     'Growth',     299900, 2000,  3,    5,    '{"daily_brief":true,"churn_detection":true,"forecast":true,"exports":true}',                                           '₹2,999/mo — growing D2C brands'),
  ('SCALE',      'Scale',      799900, 10000, 10,   10,   '{"daily_brief":true,"churn_detection":true,"forecast":true,"exports":true,"api_access":true}',                        '₹7,999/mo — high-volume operations'),
  ('ENTERPRISE', 'Enterprise', 0,      NULL,  NULL, NULL, '{"daily_brief":true,"churn_detection":true,"forecast":true,"exports":true,"api_access":true,"sso":true,"sla":true}',  'Custom pricing — enterprise teams');

-- ─── 5. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

CREATE POLICY "subscriptions_update" ON subscriptions
  FOR UPDATE USING (
    brand_id IN (
      SELECT brand_id FROM brand_members
      WHERE user_id = auth.uid() AND role IN ('OWNER','ADMIN')
    )
  );

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_history_select" ON subscription_history
  FOR SELECT USING (
    subscription_id IN (
      SELECT id FROM subscriptions WHERE brand_id IN (
        SELECT brand_id FROM brand_members WHERE user_id = auth.uid()
      )
    )
  );

ALTER TABLE plan_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_config_public_read" ON plan_config FOR SELECT USING (true);

-- ─── 6. updated_at auto-trigger ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─── 7. Monthly usage reset (called by cron edge function) ────────────────────

CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE subscriptions
  SET
    orders_this_month = 0,
    updated_at        = now()
  WHERE
    status = 'ACTIVE'
    AND billing_start_date <= CURRENT_DATE - INTERVAL '30 days';
END;
$$;

-- ─── 8. Orphan subscription guard ─────────────────────────────────────────────
-- Run this query to verify data integrity (no orphan rows):
-- SELECT s.id FROM subscriptions s
-- LEFT JOIN brands b ON s.brand_id = b.id
-- WHERE b.id IS NULL;
