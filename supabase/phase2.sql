-- Phase 2 (docs/COLORBOSH_DEV_SPEC.md §2). Additive only. Idempotent.

create table if not exists product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  alias text not null unique,
  created_at timestamptz default now()
);

create table if not exists settings (
  id integer primary key default 1,
  salary_pct numeric(5,2) not null default 1.00,
  return_reserve_pct numeric(5,2) not null default 0,
  capital_reserve_pct numeric(5,2) not null default 0,
  low_stock_threshold integer not null default 10,
  updated_at timestamptz default now(),
  constraint settings_single_row check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;

do $$ begin
  create type return_status as enum ('processing','completed','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type return_source as enum ('tiktok_import','manual');
exception when duplicate_object then null; end $$;
do $$ begin
  create type stock_movement_type as enum ('opening','production_in','sale_out','return_in','adjustment','opname');
exception when duplicate_object then null; end $$;

create table if not exists sales_returns (
  id uuid primary key default gen_random_uuid(),
  sales_entry_id uuid references sales_entries(id),
  channel_id uuid references channels(id),
  product_id uuid references products(id),
  external_return_id text unique,
  external_order_id text,
  requested_at timestamptz not null,
  refunded_at timestamptz,
  qty integer not null,
  refund_amount numeric(12,2) not null,
  hpp_per_unit numeric(12,2) not null default 0,
  restock boolean not null default true,
  status return_status not null default 'processing',
  reason text,
  buyer_note text,
  source return_source not null default 'manual',
  created_at timestamptz default now(),
  created_by uuid references users(id),
  is_deleted boolean not null default false
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  movement_date date not null,
  type stock_movement_type not null,
  qty integer not null,
  ref_type text,
  ref_id uuid,
  note text,
  created_at timestamptz default now(),
  created_by uuid references users(id)
);
create index if not exists stock_movements_product_idx on stock_movements(product_id);
create index if not exists stock_movements_ref_idx on stock_movements(ref_type, ref_id);

-- RLS: operational tables owner+admin; settings/aliases owner full, admin read.
do $$
declare t text;
begin
  foreach t in array array['sales_returns','stock_movements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_admin_all on public.%I', t);
    execute format('create policy owner_admin_all on public.%I for all using (public.current_user_role() in (''owner'',''admin'')) with check (public.current_user_role() in (''owner'',''admin''))', t);
  end loop;
  foreach t in array array['product_aliases','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('drop policy if exists admin_read on public.%I', t);
    execute format('create policy owner_all on public.%I for all using (public.current_user_role() = ''owner'') with check (public.current_user_role() = ''owner'')', t);
    execute format('create policy admin_read on public.%I for select using (public.current_user_role() = ''admin'')', t);
  end loop;
end $$;
