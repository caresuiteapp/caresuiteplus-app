-- Apply after the wound workspace and V10 record patches. Keep the existing
-- account-session requirements and grant only the wound endpoints used by the app.
create or replace function care_private.require_wound_workspace_session(t uuid, a uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_id uuid;
begin
  if auth.uid() is null or t is null or a is null
     or t is distinct from public.current_tenant_id()
     or a is distinct from public.resolve_current_profile_id()
     or coalesce((auth.jwt()->>'exp')::bigint, 0) <= extract(epoch from clock_timestamp())
     or account_security.allowed_session() is not true then
    raise exception 'Aktuelle eigene Sitzung fehlt.' using errcode = '42501';
  end if;

  -- PostgREST table reads are read-only transactions. The authenticated write
  -- path retains the row locks on identity and permissions through commit.
  if current_setting('transaction_read_only') = 'off' then
    session_id := nullif(auth.jwt()->>'session_id', '')::uuid;
    perform 1 from auth.sessions s
      where s.id = session_id and s.user_id = auth.uid()
        and (s.not_after is null or s.not_after > clock_timestamp())
      for share;
    if not found then
      raise exception 'Sitzung wurde beendet.' using errcode = '42501';
    end if;
    perform 1 from public.profiles p
      where p.id = a and p.tenant_id = t and p.is_active and p.status = 'active'
        and (p.auth_user_id = auth.uid() or (p.auth_user_id is null and p.id = auth.uid()))
      for share;
    if not found then
      raise exception 'Aktives eigenes Mandantenprofil fehlt.' using errcode = '42501';
    end if;
  elsif not exists (
    select 1 from public.profiles p
     where p.id = a and p.tenant_id = t and p.is_active and p.status = 'active'
       and (p.auth_user_id = auth.uid() or (p.auth_user_id is null and p.id = auth.uid()))
  ) then
    raise exception 'Aktives eigenes Mandantenprofil fehlt.' using errcode = '42501';
  end if;
end
$$;

create or replace function care_private.wound_has_permission(required text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant uuid := public.current_tenant_id();
  actor uuid := public.resolve_current_profile_id();
  own_role uuid;
begin
  perform care_private.require_wound_workspace_session(tenant, actor);
  select p.role_id into own_role from public.profiles p
    where p.id = actor and p.tenant_id = tenant;
  if current_setting('transaction_read_only') = 'off' then
    perform 1 from public.role_permissions rp
      where rp.role_id = own_role
        and coalesce(to_jsonb(rp)->>'tenant_id', tenant::text) = tenant::text
      for share;
  end if;
  return exists (
    select 1 from public.role_permissions rp
    where rp.role_id = own_role
      and coalesce(to_jsonb(rp)->>'tenant_id', tenant::text) = tenant::text
      and (rp.permission_key = required
        or (rp.permission_key = split_part(required, '.', 2)
          and ((required like '%.view' and coalesce(rp.can_view, false))
            or (required like '%.manage' and coalesce(rp.can_update, false)))))
  );
end
$$;

create or replace function care_private.wound_active_client(subject uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  tenant uuid := public.current_tenant_id();
  actor uuid := public.resolve_current_profile_id();
begin
  perform care_private.require_wound_workspace_session(tenant, actor);
  if current_setting('transaction_read_only') = 'off' then
    perform 1 from public.clients c
      where c.id = subject and c.tenant_id = tenant for share;
    perform 1 from public.client_module_assignments a
      where a.tenant_id = tenant and a.client_id = subject and a.module_key = 'pflege'
      for share;
  end if;
  return exists (
    select 1
    from public.clients c
    join public.client_module_assignments a on a.tenant_id = c.tenant_id and a.client_id = c.id
    where c.id = subject and c.tenant_id = tenant
      and c.status::text in ('active', 'aktiv')
      and c.lifecycle_status::text in ('active', 'aktiv')
      and to_jsonb(c)->>'deleted_at' is null
      and a.module_key = 'pflege' and a.is_active and a.status in ('active', 'aktiv')
  );
end
$$;

revoke all on function care_private.require_wound_workspace_session(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function care_private.wound_has_permission(text), care_private.wound_active_client(uuid)
  from public, anon, authenticated, service_role;
revoke all on schema care_private from public, anon;
grant usage on schema care_private to authenticated;

grant execute on function care_private.wound_has_permission(text), care_private.wound_active_client(uuid)
  to authenticated;

-- Older installations already expose the original cases and findings under
-- their own RLS policies. Add a scoped read only where that access is absent.
do $foundation$
declare
  relation text;
  case_column text;
begin
  foreach relation in array array['clinical_wound_cases', 'clinical_wound_assessments'] loop
    if not has_table_privilege('authenticated', 'public.' || relation, 'select') then
      case_column := case relation when 'clinical_wound_cases' then 'id' else 'wound_case_id' end;
      execute format(
        'create policy wound_release_foundation on public.%I for select to authenticated
         using (care_private.wound_record_allowed(tenant_id, client_id, %I, false))',
        relation, case_column
      );
      execute format('grant select on public.%I to authenticated', relation);
    end if;
  end loop;
end
$foundation$;

-- These source tables already have per-case RLS from the workspace patch.
grant select on public.ambulatory_wound_assessment_corrections,
  public.ambulatory_wound_lifecycle_events, public.ambulatory_wound_plan_versions,
  public.ambulatory_wound_dressings, public.ambulatory_wound_photo_links
  to authenticated;

-- An expired or revoked consent also removes the legacy photo metadata from
-- direct reads. Recording the photo never grants permission to a different case.
drop policy if exists wound_release_photo_consent on public.ambulatory_wound_photo_links;
create policy wound_release_photo_consent on public.ambulatory_wound_photo_links
  as restrictive for select to authenticated
  using (care_private.wound_record_media_visible(
    tenant_id, client_id, wound_case_id, 'wound_photo', consent_id, captured_at
  ));

grant execute on function
  public.write_ambulatory_wound_documentation(uuid, jsonb),
  public.write_ambulatory_wound_lifecycle(uuid, jsonb),
  public.write_ambulatory_wound_care(uuid, jsonb),
  public.write_ambulatory_wound_assessment_correction(uuid, jsonb),
  care_private.write_wound_documentation(uuid, jsonb),
  care_private.write_wound_lifecycle(uuid, jsonb),
  care_private.write_wound_care(uuid, jsonb),
  care_private.write_wound_assessment_correction(uuid, jsonb),
  public.web_read_wound_path_context(uuid, uuid, uuid, uuid),
  public.web_read_wound_path_page(uuid, uuid, uuid, uuid, timestamptz, uuid, integer),
  public.web_commit_wound_path_packet(jsonb),
  public.web_confirm_wound_path_packet(uuid, uuid, uuid, uuid, uuid, jsonb),
  care_private.read_wound_path_context_impl(uuid, uuid, uuid, uuid),
  care_private.read_wound_path_page_impl(uuid, uuid, uuid, uuid, timestamptz, uuid, integer),
  care_private.commit_wound_path_packet_impl(jsonb),
  care_private.confirm_wound_path_packet_impl(uuid, uuid, uuid, uuid, uuid, jsonb),
  public.web_read_wound_path_review_page(uuid, uuid, uuid, uuid, timestamptz, uuid, integer),
  public.web_commit_wound_path_review(jsonb),
  public.web_confirm_wound_path_review(uuid, uuid, uuid, uuid, uuid, jsonb),
  care_private.read_wound_path_review_page(uuid, uuid, uuid, uuid, timestamptz, uuid, integer),
  care_private.commit_wound_path_review(jsonb),
  care_private.confirm_wound_path_review(uuid, uuid, uuid, uuid, uuid, jsonb)
  to authenticated;
