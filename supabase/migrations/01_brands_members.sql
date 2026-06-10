-- Migration 01: Brands and Brand Members
-- Multi-tenant foundation: each brand is isolated by RLS

create table if not exists brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  market_type text not null default 'D2C' check (market_type in ('D2C', 'B2B', 'Hybrid')),
  status      text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists brand_members (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'EDITOR' check (role in ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER')),
  name       text not null,
  email      text not null,
  avatar     text,
  created_at timestamptz not null default now(),
  unique (brand_id, user_id)
);

create index if not exists brand_members_user_id_idx on brand_members(user_id);
create index if not exists brand_members_brand_id_idx on brand_members(brand_id);

-- RLS
alter table brands enable row level security;
alter table brand_members enable row level security;

-- Brands: readable by members, writable by owner
create policy "brands_select" on brands
  for select using (
    id in (select brand_id from brand_members where user_id = auth.uid())
  );

create policy "brands_insert" on brands
  for insert with check (owner_id = auth.uid());

create policy "brands_update" on brands
  for update using (owner_id = auth.uid());

-- Brand members: readable by same brand, managed by admin+
create policy "brand_members_select" on brand_members
  for select using (
    brand_id in (select brand_id from brand_members where user_id = auth.uid())
  );

create policy "brand_members_insert" on brand_members
  for insert with check (
    brand_id in (
      select brand_id from brand_members
      where user_id = auth.uid() and role in ('OWNER', 'ADMIN')
    )
  );

create policy "brand_members_delete" on brand_members
  for delete using (
    brand_id in (
      select brand_id from brand_members
      where user_id = auth.uid() and role in ('OWNER', 'ADMIN')
    )
    and user_id != auth.uid()
  );
