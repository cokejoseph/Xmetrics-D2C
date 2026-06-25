-- Migration 13: OMS Push Tracking, Approval Audit Log, NDR Events

-- ─── 1. OMS push tracking columns on orders ──────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS routing_decision   TEXT
    CHECK (routing_decision IN ('READY_FOR_PUSH','EXCEPTION_HOLD','AUTO_PUSHED','MANUALLY_PUSHED')),
  ADD COLUMN IF NOT EXISTS routing_decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oms_push_status    TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (oms_push_status IN ('PENDING','PUSHED','FAILED','NOT_APPLICABLE')),
  ADD COLUMN IF NOT EXISTS oms_pushed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oms_order_id       TEXT,
  ADD COLUMN IF NOT EXISTS oms_push_error     TEXT;

CREATE INDEX IF NOT EXISTS orders_routing_decision_idx
  ON orders (brand_id, routing_decision);

CREATE INDEX IF NOT EXISTS orders_oms_push_pending_idx
  ON orders (brand_id, oms_push_status)
  WHERE oms_push_status = 'PENDING';

-- ─── 2. OMS push log ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS oms_push_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_id       UUID        NOT NULL REFERENCES orders(id),
  order_number   TEXT        NOT NULL,
  push_type      TEXT        NOT NULL CHECK (push_type IN ('AUTO','MANUAL','RETRY')),
  pushed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload        JSONB       NOT NULL DEFAULT '{}',
  http_status    INT,
  response_body  JSONB,
  success        BOOLEAN     NOT NULL DEFAULT false,
  error_message  TEXT,
  attempt_number INT         NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS oms_push_log_brand_idx   ON oms_push_log (brand_id, pushed_at DESC);
CREATE INDEX IF NOT EXISTS oms_push_log_order_idx   ON oms_push_log (order_id);
CREATE INDEX IF NOT EXISTS oms_push_log_failed_idx  ON oms_push_log (brand_id, success)
  WHERE success = false;

ALTER TABLE oms_push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oms_push_log_brand_member" ON oms_push_log
  FOR ALL USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

-- ─── 3. Approval audit log ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_audit_log (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_id           UUID        NOT NULL REFERENCES orders(id),
  order_number       TEXT        NOT NULL,
  exception_id       UUID        REFERENCES exceptions(id),
  action_type        TEXT        NOT NULL CHECK (action_type IN (
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
    'AUTO_PUSHED_TO_OMS'
  )),
  actor_id           UUID        REFERENCES auth.users(id),
  actor_name         TEXT,
  actor_role         TEXT,
  action_timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  original_rto_score INT,
  new_rto_score      INT,
  original_status    TEXT,
  new_status         TEXT,
  reason             TEXT,
  notes              TEXT,
  metadata           JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS approval_audit_log_brand_idx
  ON approval_audit_log (brand_id, action_timestamp DESC);
CREATE INDEX IF NOT EXISTS approval_audit_log_order_idx
  ON approval_audit_log (order_id);

ALTER TABLE approval_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_audit_log_select" ON approval_audit_log
  FOR SELECT USING (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

CREATE POLICY "approval_audit_log_insert" ON approval_audit_log
  FOR INSERT WITH CHECK (
    brand_id IN (SELECT brand_id FROM brand_members WHERE user_id = auth.uid())
  );

-- ─── 4. Patch exceptions: resolution tracking ─────────────────────────────────

ALTER TABLE exceptions
  ADD COLUMN IF NOT EXISTS resolved_by       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS resolved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
  ADD COLUMN IF NOT EXISTS resolution_notes  TEXT,
  ADD COLUMN IF NOT EXISTS audit_log_id      UUID REFERENCES approval_audit_log(id);

-- ─── 5. NDR events ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ndr_events (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  order_id             UUID        NOT NULL REFERENCES orders(id),
  awb_number           TEXT        NOT NULL,
  shiprocket_ndr_id    TEXT,
  attempt_number       INT         NOT NULL DEFAULT 1,
  ndr_reason           TEXT,
  ndr_reason_code      TEXT,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Recovery action taken
  recovery_action      TEXT CHECK (recovery_action IN (
    'RESCHEDULE','ADDRESS_UPDATE','ACCEPT_RTO','CUSTOMER_NOTIFIED','PENDING'
  )) DEFAULT 'PENDING',
  recovery_action_at   TIMESTAMPTZ,
  recovery_actor       TEXT CHECK (recovery_actor IN ('FOUNDER','CUSTOMER','AUTO')),
  rescheduled_date     DATE,
  updated_address      JSONB,

  -- WhatsApp comms
  wa_customer_sent_at  TIMESTAMPTZ,
  wa_founder_sent_at   TIMESTAMPTZ,
  customer_response    TEXT CHECK (customer_response IN (
    'RESCHEDULE','UPDATE_ADDRESS','ACCEPT_RTO','NO_RESPONSE'
  )),
  customer_responded_at TIMESTAMPTZ,

  -- Final outcome
  final_outcome        TEXT CHECK (final_outcome IN (
    'DELIVERED','RTO','PENDING','ESCALATED'
  )) DEFAULT 'PENDING',
  final_outcome_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ndr_events_brand_idx   ON ndr_events (brand_id);
CREATE INDEX IF NOT EXISTS ndr_events_order_idx   ON ndr_events (order_id);
CREATE INDEX IF NOT EXISTS ndr_events_awb_idx     ON ndr_events (awb_number);
CREATE INDEX IF NOT EXISTS ndr_events_pending_idx ON ndr_events (brand_id, final_outcome)
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
