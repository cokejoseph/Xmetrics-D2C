-- Migration 14: Broaden the audit log into a true system-wide trail
--
-- The approval_audit_log table (migration 13) only modelled order-approval
-- events. The product now records returns, refunds, cancellations, and
-- integration/settings/export events so the log reads as a real audit log, not
-- just an approval queue. Two changes are required for those to persist in live
-- mode:
--   1. Allow the new action_type values.
--   2. Make order_id nullable — system events (integration connected, settings
--      updated, data exported) are not tied to a specific order.
-- Both changes are additive/relaxing: existing rows and the existing insert
-- path remain valid.

-- ─── 1. Allow system events to omit an order ─────────────────────────────────

ALTER TABLE approval_audit_log
  ALTER COLUMN order_id DROP NOT NULL;

-- ─── 2. Extend the action_type whitelist ─────────────────────────────────────

ALTER TABLE approval_audit_log
  DROP CONSTRAINT IF EXISTS approval_audit_log_action_type_check;

ALTER TABLE approval_audit_log
  ADD CONSTRAINT approval_audit_log_action_type_check CHECK (action_type IN (
    -- Order approvals / holds / pushes (migration 13)
    'AUTO_APPROVED',
    'MANUALLY_APPROVED',
    'APPROVED_HIGH_RTO',
    'APPROVED_INVALID_ADDRESS',
    'APPROVED_LOW_INVENTORY',
    'APPROVED_PAYMENT_MISMATCH',
    'ADDRESS_CORRECTED_AND_APPROVED',
    'HELD',
    'RELEASED_FROM_HOLD',
    'ORDER_CANCELLED',
    'PUSHED_TO_OMS',
    'AUTO_PUSHED_TO_OMS',
    -- System-wide events (migration 14)
    'RETURN_APPROVED',
    'RETURN_REFUNDED',
    'INTEGRATION_CONNECTED',
    'INTEGRATION_DISCONNECTED',
    'SETTINGS_UPDATED',
    'DATA_EXPORTED'
  ));

-- Index to support the new "system events" filter (events with no order).
CREATE INDEX IF NOT EXISTS approval_audit_log_system_idx
  ON approval_audit_log (brand_id, action_timestamp DESC)
  WHERE order_id IS NULL;
