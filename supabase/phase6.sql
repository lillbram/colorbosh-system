-- Phase 6: payment proof capture. Additive, idempotent.

do $$ begin
  create type cash_source as enum ('manual','bulk_excel','bank_csv','receipt_scan');
exception when duplicate_object then null; end $$;
do $$ begin
  create type cash_status as enum ('draft','confirmed');
exception when duplicate_object then null; end $$;

alter type cash_related_type add value if not exists 'salary';

alter table cash_transactions add column if not exists bank_ref text;
alter table cash_transactions add column if not exists period_month text;
alter table cash_transactions add column if not exists counterparty text;
alter table cash_transactions add column if not exists source cash_source not null default 'manual';
alter table cash_transactions add column if not exists status cash_status not null default 'confirmed';

create unique index if not exists cash_transactions_bank_ref_uniq
  on cash_transactions (bank_ref)
  where bank_ref is not null and not is_deleted;
create index if not exists cash_transactions_period_month_idx on cash_transactions (period_month);
