-- Auth & usage tracking extensions — run after schema.sql

-- Links Supabase Auth users to tenant organizations
create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists idx_org_members_user_id on public.org_members (user_id);

-- Sandbox / playground usage (counts toward monthly quota)
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  visitor_id text,
  event_type text not null default 'sandbox' check (event_type in ('sandbox', 'api')),
  status text not null check (status in ('passed', 'blocked')),
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_org_created on public.usage_events (org_id, created_at);
create index if not exists idx_usage_events_visitor_created on public.usage_events (visitor_id, created_at);

alter table public.org_members enable row level security;
alter table public.usage_events enable row level security;
