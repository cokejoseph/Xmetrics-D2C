-- Migration 03: Orders, Payments, Shipments, Exceptions

create table if not exists orders (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references brands(id) on delete cascade,
  customer_id          uuid references customers(id),
  order_number         text not null,
  channel              text not null check (channel in ('SHOPIFY','WOOCOMMERCE','AMAZON','FLIPKART','MEESHO','MANUAL','WHATSAPP')),
  fulfillment_status   text not null default 'CONFIRMED' check (fulfillment_status in (
    'CONFIRMED','PROCESSING','PACKING','READY_TO_SHIP',
    'SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED',
    'RTO_INITIATED','CANCELLED'
  )),
  payment_status       text not null default 'PENDING' check (payment_status in (
    'PENDING','AWAITING_PAYMENT','PAID','FAILED'
  )),
  payment_method       text not null default 'UPI' check (payment_method in (
    'COD','UPI','CARD','NETBANKING','WALLET','PREPAID'
  )),
  rto_review_status    text not null default 'PENDING' check (rto_review_status in (
    'PENDING','APPROVED','HELD','FLAGGED'
  )),
  rto_risk_level       text check (rto_risk_level in ('LOW','MEDIUM','HIGH')),
  rto_risk_score       integer not null default 0,
  gross_amount         numeric(12,2) not null default 0,
  discount_amount      numeric(12,2) not null default 0,
  shipping_charge      numeric(10,2) not null default 0,
  shipping_address     jsonb not null default '{}',
  warehouse_id         uuid references warehouses(id),
  notes                text,
  external_ref         text,
  created_at           timestamptz not null default now(),
  unique (brand_id, order_number)
);

create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  product_id   uuid references products(id),
  product_name text,
  sku          text not null,
  quantity     integer not null default 1,
  unit_price   numeric(10,2) not null,
  cost_price   numeric(10,2) not null default 0,
  unique (order_id, sku)
);

create table if not exists payments (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references brands(id) on delete cascade,
  order_id            uuid references orders(id),
  order_number        text,
  amount              numeric(12,2) not null,
  method              text not null check (method in ('COD','UPI','CARD','NETBANKING','WALLET','PREPAID')),
  status              text not null default 'PENDING' check (status in (
    'PENDING','PAID','FAILED','REFUNDED','SETTLED'
  )),
  gateway_ref         text,
  gateway_fee         numeric(10,2),
  settlement_amount   numeric(12,2),
  settled_at          timestamptz,
  created_at          timestamptz not null default now(),
  unique (brand_id, gateway_ref)
);

create table if not exists shipments (
  id                    uuid primary key default gen_random_uuid(),
  brand_id              uuid not null references brands(id) on delete cascade,
  order_id              uuid not null references orders(id) on delete cascade,
  courier               text not null,
  awb_number            text,
  tracking_number       text,
  status                text not null default 'LABEL_CREATED' check (status in (
    'LABEL_CREATED','PICKUP_SCHEDULED','PICKED_UP','IN_TRANSIT',
    'OUT_FOR_DELIVERY','DELIVERED','RTO_INITIATED','RTO_DELIVERED','LOST'
  )),
  pickup_scheduled_at   timestamptz,
  delivered_at          timestamptz,
  created_at            timestamptz not null default now(),
  unique (order_id, awb_number)
);

create table if not exists order_timeline (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  event       text not null,
  actor       text,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists exceptions (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  order_id     uuid references orders(id),
  type         text not null check (type in (
    'HIGH_RTO_RISK','FAILED_PAYMENT','STUCK_SHIPMENT','RTO_INITIATED',
    'LOW_INVENTORY','PENDING_SETTLEMENT','FAILED_WEBHOOK','ADDRESS_ISSUE'
  )),
  severity     text not null check (severity in ('CRITICAL','HIGH','MEDIUM','LOW')),
  status       text not null default 'UNRESOLVED' check (status in (
    'UNRESOLVED','IN_PROGRESS','RESOLVED','DISMISSED'
  )),
  title        text not null,
  description  text,
  created_at   timestamptz not null default now()
);

create index if not exists orders_brand_id_idx on orders(brand_id);
create index if not exists orders_created_at_idx on orders(brand_id, created_at desc);
create index if not exists orders_fulfillment_idx on orders(brand_id, fulfillment_status);
create index if not exists orders_rto_review_idx on orders(brand_id, rto_review_status);
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists payments_brand_id_idx on payments(brand_id);
create index if not exists payments_gateway_ref_idx on payments(gateway_ref);
create index if not exists shipments_order_id_idx on shipments(order_id);
create index if not exists shipments_awb_idx on shipments(awb_number);
create index if not exists exceptions_brand_id_idx on exceptions(brand_id);
create index if not exists exceptions_status_idx on exceptions(brand_id, status);

-- RLS
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table shipments enable row level security;
alter table order_timeline enable row level security;
alter table exceptions enable row level security;

create policy "orders_brand_member" on orders
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));

create policy "order_items_via_order" on order_items
  for all using (order_id in (select id from orders where brand_id in (
    select brand_id from brand_members where user_id = auth.uid()
  )));

create policy "payments_brand_member" on payments
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));

create policy "shipments_brand_member" on shipments
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));

create policy "timeline_via_order" on order_timeline
  for all using (order_id in (select id from orders where brand_id in (
    select brand_id from brand_members where user_id = auth.uid()
  )));

create policy "exceptions_brand_member" on exceptions
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));
