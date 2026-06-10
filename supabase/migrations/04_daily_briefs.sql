-- Migration 04: Daily Briefs

create table if not exists daily_briefs (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references brands(id) on delete cascade,
  date         date not null,
  headline     jsonb not null default '{}',
  delivery_health  jsonb not null default '{}',
  channel_performance jsonb not null default '[]',
  product_performance jsonb not null default '[]',
  customer_health     jsonb not null default '{}',
  actions      jsonb not null default '[]',
  generated_by text,
  created_at   timestamptz not null default now(),
  unique (brand_id, date)
);

create index if not exists daily_briefs_brand_date_idx on daily_briefs(brand_id, date desc);

alter table daily_briefs enable row level security;

create policy "daily_briefs_brand_member" on daily_briefs
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));
