-- Migration 06: Subscriptions (plan checkout payments, pre-brand)
-- Stores plan purchases from the public checkout page.
-- No brand_id — users pay before signing up.

create table if not exists subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null,
  plan                 text not null,
  razorpay_order_id    text not null unique,
  razorpay_payment_id  text,
  amount               numeric(10,2) not null,
  status               text not null default 'PENDING'
                         check (status in ('PENDING','PAID','FAILED','REFUNDED')),
  created_at           timestamptz not null default now(),
  paid_at              timestamptz
);

create index if not exists subscriptions_email_idx on subscriptions(email);
create index if not exists subscriptions_razorpay_order_idx on subscriptions(razorpay_order_id);
create index if not exists subscriptions_status_idx on subscriptions(status);
