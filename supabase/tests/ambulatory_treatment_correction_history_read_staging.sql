-- Test on staging after applying the patch in the same transaction, then roll back.
-- Staging needs the existing production permission on original executions for this test.
grant select on public.clinical_treatment_executions to authenticated;
create policy treatment_history_fixture_original
on public.clinical_treatment_executions for select to authenticated
using (tenant_id = public.current_tenant_id() and public.has_permission('pflege.treatment.view'));

do $fixture$
declare
  own_tenant uuid := gen_random_uuid();
  other_tenant uuid := gen_random_uuid();
  reader uuid := gen_random_uuid();
  without_permission uuid := gen_random_uuid();
  reader_role uuid := gen_random_uuid();
  other_role uuid := gen_random_uuid();
  reader_session uuid := gen_random_uuid();
  other_session uuid := gen_random_uuid();
  expired_session uuid := gen_random_uuid();
  own_client uuid := gen_random_uuid();
  unassigned_client uuid := gen_random_uuid();
  deleted_client uuid := gen_random_uuid();
  inactive_client uuid := gen_random_uuid();
  foreign_client uuid := gen_random_uuid();
  own_original uuid := gen_random_uuid();
  own_history uuid := gen_random_uuid();
  next_history uuid := gen_random_uuid();
  wound uuid := gen_random_uuid();
  wound_original uuid := gen_random_uuid();
  dressing uuid := gen_random_uuid();
  wound_history uuid := gen_random_uuid();
  own_claims jsonb;
  observed uuid[];
begin
  insert into public.tenants(id, name) values
    (own_tenant, 'Synthetischer Behandlungspflege-Test'),
    (other_tenant, 'Synthetischer Fremdmandant');
  insert into public.roles(id, key, name) values
    (reader_role, 'fixture_treatment_view_' || reader_role, 'Synthetisches Leserecht'),
    (other_role, 'fixture_treatment_other_' || other_role, 'Synthetische Rolle');
  insert into public.role_permissions(role_id, permission_key, can_view) values
    (reader_role, 'pflege.access', true), (reader_role, 'pflege.treatment.view', true), (reader_role, 'office.clients.view', true),
    (other_role, 'pflege.access', true), (other_role, 'office.clients.view', true);
  insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data) values
    (reader, reader || '@example.invalid', '{}', '{}'),
    (without_permission, without_permission || '@example.invalid', '{}', '{}');
  update public.profiles set tenant_id = own_tenant, role_id = reader_role, role_key = 'pfleger',
    is_active = true, status = 'active' where id = reader;
  update public.profiles set tenant_id = own_tenant, role_id = other_role, role_key = 'pfleger',
    is_active = true, status = 'active' where id = without_permission;
  insert into auth.sessions(id, user_id, not_after, aal) values
    (reader_session, reader, clock_timestamp() + interval '1 hour', 'aal2'),
    (other_session, without_permission, clock_timestamp() + interval '1 hour', 'aal2'),
    (expired_session, reader, clock_timestamp() - interval '1 minute', 'aal2');

  insert into public.clients(id, tenant_id, first_name, last_name, status, lifecycle_status, deleted_at) values
    (own_client, own_tenant, 'Synthetischer', 'Pflegefall', 'aktiv', 'aktiv', null),
    (unassigned_client, own_tenant, 'Synthetischer', 'Fall ohne Zuordnung', 'aktiv', 'aktiv', null),
    (deleted_client, own_tenant, 'Synthetischer', 'Gelöschter Pflegefall', 'aktiv', 'aktiv', clock_timestamp()),
    (inactive_client, own_tenant, 'Synthetischer', 'Archivierter Pflegefall', 'archiviert', 'archiviert', null),
    (foreign_client, other_tenant, 'Synthetischer', 'Fremder Pflegefall', 'aktiv', 'aktiv', null);
  insert into public.client_module_assignments(tenant_id, client_id, module_key, status, is_active) values
    (own_tenant, own_client, 'pflege', 'active', true),
    (own_tenant, deleted_client, 'pflege', 'active', true),
    (own_tenant, inactive_client, 'pflege', 'active', true),
    (other_tenant, foreign_client, 'pflege', 'active', true);

  with originals as (
    insert into public.clinical_treatment_executions(id, tenant_id, client_id, treatment_type, title, outcome, details, recorded_by, recorded_by_name)
    select case when c.id = own_client then own_original else gen_random_uuid() end,
      c.tenant_id, c.id, 'other', 'Synthetischer Originalnachweis', 'performed', '{}', reader, 'Synthetisches Testkonto'
    from public.clients c where c.id in (own_client, unassigned_client, deleted_client, inactive_client, foreign_client)
    returning *
  )
  insert into public.clinical_treatment_corrections(id, tenant_id, client_id, execution_id, version, section, execution_snapshot,
    original_section, corrected_statement, reason, evidence_basis, clinical_impact, communication, person_decision, recorded_by, recorded_by_name)
  select case when e.id = own_original then own_history else gen_random_uuid() end,
    e.tenant_id, e.client_id, e.id, 1, 'action', to_jsonb(e), '{"details": {}, "deviation_reason": null}',
    'Synthetischer Berichtigungstext', 'Prüffall', 'Prüffall', 'Prüffall', 'Prüffall', 'Prüffall', reader, 'Synthetisches Testkonto'
  from originals e;

  insert into public.clinical_treatment_corrections(id, tenant_id, client_id, execution_id, version, previous_id, section,
    execution_snapshot, original_section, corrected_statement, reason, evidence_basis, clinical_impact, communication, person_decision, recorded_by, recorded_by_name)
  select next_history, c.tenant_id, c.client_id, c.execution_id, 2, c.id, c.section,
    c.execution_snapshot, c.original_section, c.corrected_statement, c.reason, c.evidence_basis, c.clinical_impact,
    c.communication, c.person_decision, c.recorded_by, c.recorded_by_name
  from public.clinical_treatment_corrections c where c.id = own_history;

  -- A correction's client and snapshot must belong to its original, even with valid case IDs.
  insert into public.clinical_treatment_corrections(tenant_id, client_id, execution_id, version, section, execution_snapshot,
    original_section, corrected_statement, reason, evidence_basis, clinical_impact, communication, person_decision, recorded_by, recorded_by_name)
  select own_tenant, own_client, c.execution_id, 3, c.section, c.execution_snapshot,
    c.original_section, c.corrected_statement, c.reason, c.evidence_basis, c.clinical_impact, c.communication, c.person_decision, c.recorded_by, c.recorded_by_name
  from public.clinical_treatment_corrections c where c.client_id = unassigned_client
  union all
  select own_tenant, own_client, c.execution_id, 4, c.section, jsonb_set(c.execution_snapshot, '{client_id}', to_jsonb(foreign_client)),
    c.original_section, c.corrected_statement, c.reason, c.evidence_basis, c.clinical_impact, c.communication, c.person_decision, c.recorded_by, c.recorded_by_name
  from public.clinical_treatment_corrections c where c.id = own_history;

  insert into public.clinical_wound_cases(id, tenant_id, client_id, body_location, wound_type, recorded_by, recorded_by_name)
    values(wound, own_tenant, own_client, 'Synthetische Stelle', 'Synthetischer Befund', reader, 'Synthetisches Testkonto');
  insert into public.clinical_treatment_executions(id, tenant_id, client_id, treatment_type, title, outcome, details, recorded_by, recorded_by_name)
    values(wound_original, own_tenant, own_client, 'wound_dressing', 'Synthetischer Verbandwechsel', 'performed', '{}', reader, 'Synthetisches Testkonto');
  insert into public.ambulatory_wound_dressings(id, tenant_id, client_id, wound_case_id, execution_id, occurred_at,
    outcome, basis_state, details, recorded_by, recorded_by_name)
  select dressing, e.tenant_id, e.client_id, wound, e.id, e.performed_at, e.outcome, 'unconfirmed', '{}', e.recorded_by, e.recorded_by_name
  from public.clinical_treatment_executions e where e.id = wound_original;
  insert into public.clinical_treatment_corrections(id, tenant_id, client_id, execution_id, version, dressing_id,
    wound_case_id, section, execution_snapshot, original_section, corrected_statement, reason, evidence_basis,
    clinical_impact, communication, person_decision, recorded_by, recorded_by_name)
  select wound_history, e.tenant_id, e.client_id, e.id, 1, dressing, wound, 'action', to_jsonb(e),
    '{"details": {}, "deviation_reason": null}', 'Synthetischer Verbandwechselvermerk', 'Prüffall', 'Prüffall',
    'Prüffall', 'Prüffall', 'Prüffall', e.recorded_by, e.recorded_by_name
  from public.clinical_treatment_executions e where e.id = wound_original;

  own_claims := jsonb_build_object('sub', reader, 'role', 'authenticated', 'session_id', reader_session,
    'aal', 'aal2', 'exp', extract(epoch from clock_timestamp() + interval '30 minutes')::bigint);
  perform set_config('request.jwt.claims', own_claims::text, true);
  set local role authenticated;
  assert exists (select 1 from public.clinical_treatment_executions where id = own_original), 'Originalnachweis im Prüfumfeld fehlt';
  select array_agg(id order by version) into observed from public.clinical_treatment_corrections
    where tenant_id = own_tenant;
  assert observed is not distinct from array[own_history, next_history], 'Eigener vollständiger Verlauf oder Fallgrenze fehlerhaft';
  assert not exists (select 1 from public.clinical_treatment_corrections where tenant_id = other_tenant), 'Fremder Mandant wurde gelesen';
  assert not exists (select 1 from public.clinical_treatment_corrections where id = wound_history), 'Verbandwechsel ohne Wundleserecht gelesen';
  assert not has_table_privilege('authenticated', 'public.clinical_treatment_corrections', 'insert,update,delete'), 'Schreibrecht erteilt';
  begin
    update public.clinical_treatment_corrections set corrected_statement = 'Test' where id = own_history;
    raise exception 'Berichtigung wurde verändert';
  exception when insufficient_privilege then null;
  end;

  reset role;
  insert into public.role_permissions(role_id, permission_key, can_view) values (reader_role, 'pflege.wounds.view', true);
  set local role authenticated;
  assert not exists (select 1 from public.clinical_treatment_corrections where id = wound_history), 'Verbandwechsel ohne Anordnungsleserecht gelesen';
  reset role;
  insert into public.role_permissions(role_id, permission_key, can_view) values (reader_role, 'pflege.orders.view', true);
  set local role authenticated;
  assert exists (select 1 from public.clinical_treatment_corrections where id = wound_history), 'Zugänglicher Verbandwechselverlauf fehlt';

  perform set_config('request.jwt.claims', (own_claims || jsonb_build_object('sub', without_permission, 'session_id', other_session))::text, true);
  assert not exists (select 1 from public.clinical_treatment_corrections), 'Konto ohne Fachrecht erhielt Verlauf';
  perform set_config('request.jwt.claims', (own_claims || jsonb_build_object('session_id', expired_session))::text, true);
  assert not exists (select 1 from public.clinical_treatment_corrections), 'Abgelaufene Sitzung erhielt Verlauf';
  perform set_config('request.jwt.claims', (own_claims || '{"app_metadata":{"portal_type":"employee"}}')::text, true);
  assert not exists (select 1 from public.clinical_treatment_corrections), 'Portal-Sitzung erhielt Verlauf';
  perform set_config('request.jwt.claims', '{}', true);
  assert not exists (select 1 from public.clinical_treatment_corrections), 'Sitzungsloser Zugriff erhielt Verlauf';
  reset role;

  set local role anon;
  begin
    perform 1 from public.clinical_treatment_corrections;
    raise exception 'Anonymer Zugriff erhielt Tabellenrecht';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$fixture$;
