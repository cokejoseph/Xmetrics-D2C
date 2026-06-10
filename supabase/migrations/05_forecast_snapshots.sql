-- Migration 05: Forecast Snapshots

create table if not exists forecast_snapshots (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  snapshot_date date not null,
  forecasts   jsonb not null default '[]',
  summary     jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (brand_id, snapshot_date)
);

create index if not exists forecast_snapshots_brand_date_idx on forecast_snapshots(brand_id, snapshot_date desc);

alter table forecast_snapshots enable row level security;

create policy "forecast_snapshots_brand_member" on forecast_snapshots
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));

-- Utility function: return brand_id for the current user's active brand
-- Used by edge functions to resolve brand context from JWT
create or replace function get_my_brand_id()
returns uuid
language sql
security definer
as $$
  select brand_id
  from brand_members
  where user_id = auth.uid()
    and role in ('OWNER', 'ADMIN', 'EDITOR')
  order by created_at asc
  limit 1;
$$;
