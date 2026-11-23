-- Phase 4: working capital snapshots + month closing. Additive, idempotent.
create table if not exists marketplace_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id),
  snapshot_date date not null,
  awaiting_delivery numeric(14,2) not null default 0,
  settlement_processing numeric(14,2) not null default 0,
  refund_processing numeric(14,2) not null default 0,
  note text,
  created_at timestamptz default now(),
  created_by uuid references users(id)
);
create index if not exists marketplace_snapshots_date_idx on marketplace_balance_snapshots (snapshot_date);

create table if not exists month_closings (
  id uuid primary key default gen_random_uuid(),
  month text not null unique,
  snapshot jsonb not null,
  note text,
  closed_at timestamptz default now(),
  closed_by uuid references users(id)
);

-- Owner only (no admin access to salary / closing data through the public API either).
do $$
declare t text;
begin
  foreach t in array array['marketplace_balance_snapshots','month_closings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all using (public.current_user_role() = ''owner'') with check (public.current_user_role() = ''owner'')', t);
  end loop;
end $$;
