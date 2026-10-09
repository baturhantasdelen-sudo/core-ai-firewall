-- Nexus Shield — Phase 4.1 atomic assurance bundle persistence (apply after schema-assurance.sql)
-- Safe to re-run: CREATE OR REPLACE function; grants are idempotent.

-- ---------------------------------------------------------------------------
-- Atomic bundle write (single PostgreSQL transaction)
-- Callable only by service_role from the application server.
-- org_id must exist in public.organizations (server derives org from API key).
-- ---------------------------------------------------------------------------
create or replace function public.assurance_save_bundle(p_bundle jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_verification_id text;
  v_idempotency_key text;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_existing_verification_id text;
  v_ev jsonb;
  v_uar jsonb;
begin
  if p_bundle is null or p_bundle = 'null'::jsonb then
    raise exception 'assurance_save_bundle: empty bundle';
  end if;

  v_org_id := (p_bundle->>'org_id')::uuid;
  v_verification_id := p_bundle->>'verification_id';
  v_idempotency_key := p_bundle->>'idempotency_key';
  v_fingerprint := p_bundle->>'request_fingerprint';

  if v_org_id is null or v_verification_id is null or v_verification_id = '' then
    raise exception 'assurance_save_bundle: org_id and verification_id required';
  end if;

  if not exists (select 1 from public.organizations o where o.id = v_org_id) then
    raise exception 'assurance_save_bundle: unknown org_id';
  end if;

  if v_idempotency_key is not null and v_idempotency_key <> '' then
    select i.request_fingerprint, i.verification_id
      into v_existing_fingerprint, v_existing_verification_id
      from public.assurance_idempotency i
     where i.org_id = v_org_id and i.idempotency_key = v_idempotency_key;

    if found then
      if v_existing_fingerprint is distinct from v_fingerprint then
        raise exception 'assurance_idempotency_conflict'
          using errcode = '23505';
      end if;
      return jsonb_build_object(
        'status', 'idempotent_replay',
        'verification_id', v_existing_verification_id
      );
    end if;
  end if;

  insert into public.assurance_verifications (
    verification_id, org_id, action_id, agent_id, status, verification_state,
    record_provenance, authoritative_source, false_success_detected,
    post_block_side_effect_detected, side_effect_status, transaction_integrity,
    temporal_status, verifier_version, verification_latency_ms, idempotency_key,
    request_fingerprint, expected_outcome, actual_outcome, outcome_diff, integrity,
    divergence_reason, adapter_id, mock_fixture, environment, completed_at
  ) values (
    v_verification_id,
    v_org_id,
    p_bundle->>'action_id',
    p_bundle->>'agent_id',
    p_bundle->>'status',
    p_bundle->>'verification_state',
    p_bundle->>'record_provenance',
    p_bundle->>'authoritative_source',
    coalesce((p_bundle->>'false_success_detected')::boolean, false),
    coalesce((p_bundle->>'post_block_side_effect_detected')::boolean, false),
    p_bundle->>'side_effect_status',
    p_bundle->>'transaction_integrity',
    p_bundle->>'temporal_status',
    p_bundle->>'verifier_version',
    nullif(p_bundle->>'verification_latency_ms', '')::integer,
    nullif(v_idempotency_key, ''),
    v_fingerprint,
    coalesce(p_bundle->'expected_outcome', '{}'::jsonb),
    p_bundle->'actual_outcome',
    coalesce(p_bundle->'outcome_diff', '[]'::jsonb),
    coalesce(p_bundle->'integrity', '{}'::jsonb),
    p_bundle->>'divergence_reason',
    p_bundle->>'adapter_id',
    p_bundle->>'mock_fixture',
    coalesce(p_bundle->>'environment', 'sandbox'),
    coalesce((p_bundle->>'completed_at')::timestamptz, now())
  );

  for v_ev in select * from jsonb_array_elements(coalesce(p_bundle->'evidence', '[]'::jsonb))
  loop
    insert into public.assurance_evidence (
      evidence_id, verification_id, org_id, source, source_type, resource, resource_id,
      observed_state_hash, observed_at, adapter, query_fingerprint, integrity_hash,
      previous_hash, sensitivity_classification, metadata
    ) values (
      v_ev->>'evidence_id',
      v_verification_id,
      v_org_id,
      v_ev->>'source',
      v_ev->>'source_type',
      v_ev->>'resource',
      v_ev->>'resource_id',
      v_ev->>'observed_state_hash',
      (v_ev->>'observed_at')::timestamptz,
      v_ev->>'adapter',
      v_ev->>'query_fingerprint',
      v_ev->>'integrity_hash',
      nullif(v_ev->>'previous_hash', ''),
      coalesce(v_ev->>'sensitivity_classification', 'internal'),
      coalesce(v_ev->'metadata', '{}'::jsonb)
    );
  end loop;

  v_uar := p_bundle->'uar';
  if v_uar is not null and v_uar <> 'null'::jsonb then
    insert into public.assurance_uar (
      uar_id, verification_id, org_id, uar_version, verification_status, payload, integrity_hash
    ) values (
      v_uar->>'uar_id',
      v_verification_id,
      v_org_id,
      coalesce(v_uar->>'uar_version', '2.0'),
      v_uar->>'verification_status',
      coalesce(v_uar->'payload', '{}'::jsonb),
      v_uar->>'integrity_hash'
    );
  end if;

  if v_idempotency_key is not null and v_idempotency_key <> '' then
    insert into public.assurance_idempotency (org_id, idempotency_key, request_fingerprint, verification_id)
    values (v_org_id, v_idempotency_key, v_fingerprint, v_verification_id);
  end if;

  insert into public.assurance_lifecycle_events (verification_id, org_id, from_state, to_state)
  values (
    v_verification_id,
    v_org_id,
    coalesce(p_bundle->>'lifecycle_from_state', 'EXPECTED'),
    p_bundle->>'verification_state'
  );

  return jsonb_build_object('status', 'committed', 'verification_id', v_verification_id);
exception
  when unique_violation then
    if v_idempotency_key is not null then
      select i.request_fingerprint, i.verification_id
        into v_existing_fingerprint, v_existing_verification_id
        from public.assurance_idempotency i
       where i.org_id = v_org_id and i.idempotency_key = v_idempotency_key;
      if found then
        if v_existing_fingerprint is distinct from v_fingerprint then
          raise exception 'assurance_idempotency_conflict' using errcode = '23505';
        end if;
        return jsonb_build_object(
          'status', 'idempotent_replay',
          'verification_id', v_existing_verification_id
        );
      end if;
    end if;
    raise;
end;
$$;

revoke all on function public.assurance_save_bundle(jsonb) from public;
revoke all on function public.assurance_save_bundle(jsonb) from anon;
revoke all on function public.assurance_save_bundle(jsonb) from authenticated;
grant execute on function public.assurance_save_bundle(jsonb) to service_role;

-- Assurance tables: no policies for anon/authenticated (service role + RLS enabled = deny by default)
comment on function public.assurance_save_bundle(jsonb) is
  'Atomic assurance bundle write. Server-only via service_role. org_id must exist in organizations.';
