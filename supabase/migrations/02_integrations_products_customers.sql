-- Migration 02: Integrations, Products, Customers

create table if not exists integrations (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  platform        text not null check (platform in ('SHOPIFY','WHATSAPP','SHIPROCKET','RAZORPAY','SHIPPO','EASYPOST')),
  status          text not null default 'DISCONNECTED' check (status in ('CONNECTED','DISCONNECTED','ERROR','PENDING')),
  credentials     jsonb not null default '{}',
  last_sync_at    timestamptz,
  error_message   text,
  created_at      timestamptz not null default now(),
  unique (brand_id, platform)
);

create table if not exists warehouses (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  name          text not null,
  address       text not null,
  city          text not null,
  state         text not null,
  pincode       text not null,
  contact_name  text not null,
  contact_phone text not null,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references brands(id) on delete cascade,
  name              text not null,
  sku               text not null,
  category          text not null,
  selling_price     numeric(10,2) not null default 0,
  cost_price        numeric(10,2) not null default 0,
  inventory_count   integer not null default 0,
  reorder_threshold integer not null default 10,
  weight_grams      integer not null default 500,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (brand_id, sku)
);

create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  name          text not null,
  phone         text not null,
  email         text,
  address       text,
  city          text not null,
  state         text not null,
  pincode       text not null,
  total_orders  integer not null default 0,
  total_spent   numeric(12,2) not null default 0,
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  unique (brand_id, phone)
);

create index if not exists products_brand_id_idx on products(brand_id);
create index if not exists customers_brand_id_idx on customers(brand_id);
create index if not exists customers_phone_idx on customers(brand_id, phone);

-- RLS: all tables scoped to brand membership
alter table integrations enable row level security;
alter table warehouses enable row level security;
alter table products enable row level security;
alter table customers enable row level security;

create policy "integrations_brand_member" on integrations
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));

create policy "warehouses_brand_member" on warehouses
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));

create policy "products_brand_member" on products
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));

create policy "customers_brand_member" on customers
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));
