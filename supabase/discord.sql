-- Discord bot: pending confirmations for /catat. Additive, idempotent.
-- RLS on with no policy = only the server (direct DB connection) can read/write.
create table if not exists discord_pending (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null,
  discord_user_id text not null,
  status text not null default 'pending',
  created_at timestamptz default now()
);
alter table public.discord_pending enable row level security;
