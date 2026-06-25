-- Migration 17: RTO feedback loop — turn the score from an opinion into a model
--
-- Until now the RTO score was written to the order and never reconciled against
-- what actually happened, so "does a 70 RTO more than a 40?" was unanswerable —
-- an unvalidated rules engine. This captures every prediction at creation and
-- every terminal outcome, entirely via DB triggers, so it works for ALL order
-- paths (Shopify webhook, manual, future channels) with no app changes, and the
-- data compounds from day one.

-- ─── 1. Prediction + outcome ledger ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rto_predictions (
  order_id        UUID        PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  brand_id        UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  predicted_score INT         NOT NULL,
  predicted_band  TEXT        NOT NULL,           -- LOW | MEDIUM | HIGH
  predicted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actual_outcome  TEXT,                            -- DELIVERED | RTO | NULL (pending)
  outcome_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS rto_predictions_brand_band_idx
  ON rto_predictions (brand_id, predicted_band);
CREATE INDEX IF NOT EXISTS rto_predictions_pending_idx
  ON rto_predictions (brand_id) WHERE actual_outcome IS NULL;

ALTER TABLE rto_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rto_predictions_brand_member" ON rto_predictions
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION rto_band(p_score INT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_score >= 60 THEN 'HIGH'
              WHEN p_score >= 30 THEN 'MEDIUM'
              ELSE 'LOW' END;
$$;

-- ─── 2. Capture the prediction at the moment of decision ─────────────────────
-- Fires on insert and on the score-finalisation update (Shopify inserts a 0
-- placeholder then writes the real score). We only update while the outcome is
-- still pending, so a prediction is frozen once the order's fate is known.

CREATE OR REPLACE FUNCTION capture_rto_prediction() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO rto_predictions (order_id, brand_id, predicted_score, predicted_band)
  VALUES (NEW.id, NEW.brand_id, NEW.rto_risk_score, rto_band(NEW.rto_risk_score))
  ON CONFLICT (order_id) DO UPDATE
    SET predicted_score = EXCLUDED.predicted_score,
        predicted_band  = EXCLUDED.predicted_band
    WHERE rto_predictions.actual_outcome IS NULL;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_capture_rto_prediction
  AFTER INSERT OR UPDATE OF rto_risk_score ON orders
  FOR EACH ROW EXECUTE FUNCTION capture_rto_prediction();

-- ─── 3. Capture the actual outcome when the order settles ────────────────────
-- Fires from any source that moves the order to a terminal state (Shiprocket
-- webhook, manual change). First terminal status wins.

CREATE OR REPLACE FUNCTION capture_rto_outcome() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fulfillment_status IN ('DELIVERED', 'RTO_INITIATED')
     AND OLD.fulfillment_status IS DISTINCT FROM NEW.fulfillment_status THEN
    UPDATE rto_predictions
      SET actual_outcome = CASE WHEN NEW.fulfillment_status = 'RTO_INITIATED' THEN 'RTO' ELSE 'DELIVERED' END,
          outcome_at     = now()
      WHERE order_id = NEW.id AND actual_outcome IS NULL;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_capture_rto_outcome
  AFTER UPDATE OF fulfillment_status ON orders
  FOR EACH ROW EXECUTE FUNCTION capture_rto_outcome();

-- ─── 4. Calibration view — predicted band vs ACTUAL RTO rate ─────────────────
-- The proof. "Our HIGH band RTOs at 31%, LOW at 6%" — the sentence no
-- rules-engine clone can say. security_invoker so it respects the caller's RLS.

CREATE OR REPLACE VIEW rto_calibration
WITH (security_invoker = true) AS
SELECT
  brand_id,
  predicted_band,
  count(*)                                              AS predictions,
  count(*) FILTER (WHERE actual_outcome IS NOT NULL)    AS settled,
  count(*) FILTER (WHERE actual_outcome = 'RTO')        AS rto,
  round(
    100.0 * count(*) FILTER (WHERE actual_outcome = 'RTO')
    / NULLIF(count(*) FILTER (WHERE actual_outcome IS NOT NULL), 0)
  , 1)                                                  AS actual_rto_rate_pct,
  round(avg(predicted_score) FILTER (WHERE actual_outcome IS NOT NULL), 1) AS avg_predicted_score
FROM rto_predictions
GROUP BY brand_id, predicted_band;
