-- Migration 12: COD & Prepaid Payment Reconciliation tables

-- Shiprocket COD remittance CSV upload history
create table if not exists cod_remittance_uploads (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references brands(id) on delete cascade,
  filename        text not null,
  period_start    date not null,
  period_end      date not null,
  uploaded_by     uuid not null,
  row_count       int  not null default 0,
  status          text not null default 'DONE' check (status in ('DONE','ERROR')),
  error_message   text,
  created_at      timestamptz not null default now()
);

-- Parsed rows from Shiprocket COD remittance CSV
create table if not exists cod_remittance_rows (
  id               uuid primary key default gen_random_uuid(),
  upload_id        uuid not null references cod_remittance_uploads(id) on delete cascade,
  brand_id         uuid not null references brands(id) on delete cascade,
  order_number     text not null,
  awb_number       text,
  delivery_date    date,
  collected_amount numeric(12,2) not null default 0,
  remitted_amount  numeric(12,2) not null default 0,
  remittance_date  date,
  deductions       numeric(12,2) not null default 0,
  status           text not null check (status in ('REMITTED','PENDING','SHORT_PAID','DEDUCTED','CANCELLED')),
  shiprocket_ref   text,
  created_at       timestamptz not null default now()
);

-- Reconciliation report summaries (one record per report run)
create table if not exists reconciliation_reports (
  id                   uuid primary key default gen_random_uuid(),
  brand_id             uuid not null references brands(id) on delete cascade,
  period_start         date not null,
  period_end           date not null,
  report_type          text not null check (report_type in ('COD','PREPAID','COMBINED')),
  -- COD metrics
  cod_orders           int  not null default 0,
  cod_order_value      numeric(12,2) not null default 0,
  cod_collected        numeric(12,2) not null default 0,
  cod_remitted         numeric(12,2) not null default 0,
  cod_pending_count    int  not null default 0,
  cod_short_paid_count int  not null default 0,
  cod_unremitted_count int  not null default 0,
  cod_discrepancy      numeric(12,2) not null default 0,
  -- Prepaid metrics
  prepaid_orders       int  not null default 0,
  prepaid_collected    numeric(12,2) not null default 0,
  prepaid_fees         numeric(12,2) not null default 0,
  prepaid_settled      numeric(12,2) not null default 0,
  -- Links
  cod_upload_id        uuid references cod_remittance_uploads(id),
  generated_by         uuid,
  created_at           timestamptz not null default now()
);

-- Indexes
create index if not exists cod_rows_brand_upload_idx on cod_remittance_rows(brand_id, upload_id);
create index if not exists cod_rows_order_number_idx on cod_remittance_rows(brand_id, order_number);
create index if not exists recon_reports_brand_idx   on reconciliation_reports(brand_id, created_at desc);

-- RLS
alter table cod_remittance_uploads  enable row level security;
alter table cod_remittance_rows     enable row level security;
alter table reconciliation_reports  enable row level security;

create policy "cod_uploads_brand_member" on cod_remittance_uploads
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));

create policy "cod_rows_brand_member" on cod_remittance_rows
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));

create policy "recon_reports_brand_member" on reconciliation_reports
  for all using (brand_id in (select brand_id from brand_members where user_id = auth.uid()));
