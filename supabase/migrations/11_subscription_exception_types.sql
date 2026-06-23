-- Migration 11: extend exceptions.type CHECK to include subscription lifecycle event types
-- The subscription-renewal-check edge function emits SUBSCRIPTION_EXPIRED and
-- SUBSCRIPTION_PAYMENT_FAILED exceptions, but these were missing from the original
-- CHECK constraint defined in migration 03, causing silent failures (Postgres would
-- reject the INSERT and the exception would never reach the brand's Exceptions view).

ALTER TABLE exceptions
  DROP CONSTRAINT IF EXISTS exceptions_type_check;

ALTER TABLE exceptions
  ADD CONSTRAINT exceptions_type_check
    CHECK (type IN (
      -- Logistics
      'RTO_RISK', 'NDR', 'LOST_SHIPMENT',
      -- Payments
      'PAYMENT_FAILED', 'PAYMENT_PENDING', 'COD_PENDING_COLLECTION',
      -- Inventory
      'LOW_INVENTORY', 'OUT_OF_STOCK',
      -- Operations
      'RETURN_INITIATED', 'RETURN_DAMAGED',
      -- Subscription lifecycle (renewal-check emits these)
      'SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_PAYMENT_FAILED'
    ));
