-- Nexus Shield — Assurance persistence (verification, evidence, UAR, idempotency)
-- Run in Supabase SQL Editor after schema.sql

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- assurance_verifications
-- ---------------------------------------------------------------------------
create table if not exists public.assurance_verifications (
  verification_id text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  action_id text not null,
  agent_id text not null,
  status text not null check (status in ('VERIFIED', 'UNVERIFIED', 'FAILED', 'BLOCKED')),
  verification_state text not null,
  record_provenance text not null check (record_provenance in ('REAL', 'DEMO', 'ESTIMATE', 'UNKNOWN')),
  authoritative_source text,
  false_success_detected boolean not null default false,
  post_block_side_effect_detected boolean not null default false,
  side_effect_status text,
  transaction_integrity text,
  temporal_status text,
  verifier_version text,
  verification_latency_ms integer,
  idempotency_key text,
  request_fingerprint text,
  expected_outcome jsonb not null,
  actual_outcome jsonb,
  outcome_diff jsonb not null default '[]'::jsonb,
  integrity jsonb not null default '{}'::jsonb,
  divergence_reason text,
  adapter_id text,
  mock_fixture text,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index if not exists idx_assurance_verifications_org_created
  on public.assurance_verifications (org_id, created_at desc);
create index if not exists idx_assurance_verifications_org_action
  on public.assurance_verifications (org_id, action_id);
create index if not exists idx_assurance_verifications_org_status
  on public.assurance_verifications (org_id, status);

-- ---------------------------------------------------------------------------
-- assurance_evidence
-- ---------------------------------------------------------------------------
create table if not exists public.assurance_evidence (
  evidence_id text primary key,
  verification_id text not null references public.assurance_verifications (verification_id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  source text not null,
  source_type text not null,
  resource text not null,
  resource_id text not null,
  observed_state_hash text not null,
  observed_at timestamptz not null,
  adapter text not null,
  query_fingerprint text not null,
  integrity_hash text not null,
  previous_hash text,
  sensitivity_classification text not null default 'internal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assurance_evidence_verification
  on public.assurance_evidence (verification_id);
create index if not exists idx_assurance_evidence_org
  on public.assurance_evidence (org_id);

-- ---------------------------------------------------------------------------
-- assurance_uar
-- ---------------------------------------------------------------------------
create table if not exists public.assurance_uar (
  uar_id text primary key,
  verification_id text not null references public.assurance_verifications (verification_id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  uar_version text not null default '2.0',
  verification_status text not null,
  payload jsonb not null,
  integrity_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_assurance_uar_verification
  on public.assurance_uar (verification_id);

-- ---------------------------------------------------------------------------
-- assurance_idempotency
-- ---------------------------------------------------------------------------
create table if not exists public.assurance_idempotency (
  org_id uuid not null references public.organizations (id) on delete cascade,
  idempotency_key text not null,
  request_fingerprint text not null,
  verification_id text not null references public.assurance_verifications (verification_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, idempotency_key)
);

-- ---------------------------------------------------------------------------
-- assurance_lifecycle_events
-- ---------------------------------------------------------------------------
create table if not exists public.assurance_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  verification_id text not null references public.assurance_verifications (verification_id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  from_state text,
  to_state text not null,
  event_at timestamptz not null default now()
);

create index if not exists idx_assurance_lifecycle_verification
  on public.assurance_lifecycle_events (verification_id);

alter table public.assurance_verifications enable row level security;
alter table public.assurance_evidence enable row level security;
alter table public.assurance_uar enable row level security;
alter table public.assurance_idempotency enable row level security;
alter table public.assurance_lifecycle_events enable row level security;

-- Phase 4.1: apply schema-assurance-atomic.sql for atomic assurance_save_bundle RPC.
-- Authorization model: RLS enabled, no anon/authenticated policies; server uses service_role only.
