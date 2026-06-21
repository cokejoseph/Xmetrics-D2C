-- Migration 10: fix CHECK constraints to align with application types
-- NDR is a valid FulfillmentStatus in the TypeScript types and is referenced
-- by the Fulfillment page, but was missing from the DB CHECK constraint.
-- Drop and re-add the constraint to include it.

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_fulfillment_status_check
    CHECK (fulfillment_status IN (
      'CONFIRMED','PROCESSING','PACKING','READY_TO_SHIP',
      'SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED',
      'RTO_INITIATED','NDR','CANCELLED'
    ));
