-- Nexus Shield SaaS MVP — Supabase schema
-- Run in Supabase SQL Editor (Project → SQL Editor → New query)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stripe_customer_id text,
  stripe_subscription_status text not null default 'free'
    check (stripe_subscription_status in ('free', 'active', 'canceled')),
  api_key text not null unique,
  monthly_scan_limit integer not null default 50,
  -- Links this organization to an installed GitHub App instance so incoming
  -- webhook events (push / pull_request) can be attributed for quota checks.
  github_installation_id bigint unique,
  created_at timestamptz not null default now()
);

-- Safe to re-run against an already-provisioned database: adds the column
-- when missing without touching existing rows.
alter table public.organizations
  add column if not exists github_installation_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_github_installation_id_key'
  ) then
    alter table public.organizations
      add constraint organizations_github_installation_id_key unique (github_installation_id);
  end if;
end $$;

create index if not exists idx_organizations_api_key on public.organizations (api_key);
create index if not exists idx_organizations_github_installation_id
  on public.organizations (github_installation_id);

-- ---------------------------------------------------------------------------
-- scan_results
-- ---------------------------------------------------------------------------
create table if not exists public.scan_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  repo_name text not null,
  commit_sha text not null,
  pr_number integer,
  findings jsonb not null default '[]'::jsonb,
  status text not null check (status in ('passed', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_scan_results_org_id on public.scan_results (org_id);
create index if not exists idx_scan_results_org_created_at on public.scan_results (org_id, created_at);

-- ---------------------------------------------------------------------------
-- findings
-- ---------------------------------------------------------------------------
-- Normalized, per-leak rows for a scan_results entry. `scan_results.findings`
-- keeps a jsonb summary for quick reads (dashboard/telemetry); this table
-- enables querying/filtering individual leaks (e.g. by secret_type).
create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  scan_result_id uuid not null references public.scan_results (id) on delete cascade,
  secret_type text not null,
  file_path text not null,
  line_number integer,
  masked_preview text,
  created_at timestamptz not null default now()
);

create index if not exists idx_findings_scan_result_id on public.findings (scan_result_id);

-- ---------------------------------------------------------------------------
-- waitlist
-- ---------------------------------------------------------------------------
-- Email capture from the marketing landing page's "Join Private Beta" form.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- The telemetry API authenticates organizations via `x-nexus-api-key` and
-- writes using the Supabase service role key (bypasses RLS). RLS is enabled
-- here to prevent direct anon/public access to these tables from the client.
alter table public.organizations enable row level security;
alter table public.scan_results enable row level security;
alter table public.findings enable row level security;
alter table public.waitlist enable row level security;

-- No policies are defined for anon/authenticated roles: all access goes
-- through the server-side API using the service role key.
