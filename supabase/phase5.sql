-- Phase 5: PIN screen lock. Additive, idempotent.
create table if not exists user_pins (
  user_id uuid primary key references users(id),
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz default now()
);
-- Server-only (Drizzle as table owner). RLS on with no policies = no access through the public API.
alter table public.user_pins enable row level security;
