-- Realtime + RLS for dashboard live scan history
-- Run in Supabase SQL Editor after schema.sql and schema-auth.sql

drop policy if exists "org_members_select_scan_results" on public.scan_results;
create policy "org_members_select_scan_results"
  on public.scan_results
  for select
  to authenticated
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

drop policy if exists "org_members_select_findings" on public.findings;
create policy "org_members_select_findings"
  on public.findings
  for select
  to authenticated
  using (
    scan_result_id in (
      select sr.id
      from public.scan_results sr
      inner join public.org_members om on om.org_id = sr.org_id
      where om.user_id = auth.uid()
    )
  );

-- Enable Supabase Realtime (safe to re-run — ignore "already member" errors)
do $$
begin
  alter publication supabase_realtime add table public.scan_results;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.findings;
exception
  when duplicate_object then null;
end $$;
