-- Row Level Security policies per CLAUDE.md section 5.9.
-- Our app's own Drizzle connection uses the `postgres` role (table owner),
-- which bypasses RLS entirely — these policies only govern access through
-- Supabase's public PostgREST API (the anon/authenticated keys), which is
-- otherwise open to anyone who has the anon key.
--
-- Rules:
--   Owner: full access on every table.
--   Admin: full CRUD on procurement/production/sales/disbursement/cashflow,
--          read-only on master data (settings) and audit_logs.

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role::text from public.users where id = auth.uid() and is_active = true
$$;

-- Tables where Owner + Admin both get full CRUD (operational tables)
do $$
declare
  t text;
begin
  foreach t in array array[
    'purchase_orders', 'purchase_order_items', 'purchase_order_payments',
    'production_batches', 'production_batch_products', 'tailor_payments',
    'sales_entries', 'sales_live_sessions',
    'payout_expectations', 'payouts', 'payout_sales_link',
    'cash_transactions'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_admin_all on public.%I', t);
    execute format(
      'create policy owner_admin_all on public.%I for all using (public.current_user_role() in (''owner'',''admin'')) with check (public.current_user_role() in (''owner'',''admin''))',
      t
    );
  end loop;
end $$;

-- Master data / settings tables: Owner full CRUD, Admin read-only
do $$
declare
  t text;
begin
  foreach t in array array[
    'suppliers', 'tailors', 'products', 'channels', 'categories', 'accounts', 'users',
    'production_cost_components'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('drop policy if exists admin_read on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all using (public.current_user_role() = ''owner'') with check (public.current_user_role() = ''owner'')',
      t
    );
    execute format(
      'create policy admin_read on public.%I for select using (public.current_user_role() in (''owner'',''admin''))',
      t
    );
  end loop;
end $$;

-- audit_logs: Owner + Admin read-only, no writes via API
alter table public.audit_logs enable row level security;
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select
  using (public.current_user_role() in ('owner', 'admin'));
