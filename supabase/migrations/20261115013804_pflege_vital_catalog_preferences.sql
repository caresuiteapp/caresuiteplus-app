-- Change availability for one active care case without touching thresholds, schedules
-- or settings that belong to the separate clinical approval workflow.
create or replace function public.configure_ambulatory_vital_choice(
  p_client_id uuid, p_vital_key text, p_enabled boolean,
  p_catalog_version timestamptz, p_configuration_version text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := vital_workspace.assert_vital_actor('pflege.vitals.manage');
  tenant uuid := public.current_tenant_id();
  catalog public.vital_sign_catalog%rowtype;
  setting public.client_vital_sign_settings%rowtype;
begin
  if p_enabled is null or vital_workspace.vital_client_active(p_client_id) is not true then
    raise exception 'Aktiver Pflegefall und neue Auswahl sind erforderlich.' using errcode = '42501';
  end if;

  select * into catalog from public.vital_sign_catalog c
  where c.key = p_vital_key and c.is_active for share;
  if catalog.key is null or catalog.updated_at is distinct from p_catalog_version then
    raise exception 'Der Messkatalog wurde geändert. Bitte neu laden.' using errcode = '40001';
  end if;

  select * into setting from public.client_vital_sign_settings s
  where s.tenant_id = tenant and s.client_id = p_client_id and s.vital_key = p_vital_key for update;

  if setting.id is null then
    if p_configuration_version is distinct from 'none' then
      raise exception 'Die Messkonfiguration wurde geändert. Bitte neu laden.' using errcode = '40001';
    end if;
    if catalog.default_enabled = p_enabled then return p_enabled; end if;

    insert into public.client_vital_sign_settings (tenant_id, client_id, vital_key, enabled, created_by, updated_by)
    values (tenant, p_client_id, p_vital_key, p_enabled, actor, actor)
    on conflict (tenant_id, client_id, vital_key) do nothing;
    if not found then
      raise exception 'Die Messkonfiguration wurde geändert. Bitte neu laden.' using errcode = '40001';
    end if;
  else
    if setting.active is not true or setting.source_kind is not null or setting.approved_by is not null
      or setting.valid_from is not null or setting.valid_to is not null then
      raise exception 'Diese Einstellung wird über die fachliche Freigabe verwaltet.' using errcode = '42501';
    end if;
    if nullif(p_configuration_version, 'none')::timestamptz is distinct from setting.updated_at then
      raise exception 'Die Messkonfiguration wurde geändert. Bitte neu laden.' using errcode = '40001';
    end if;
    if setting.enabled is distinct from p_enabled then
      update public.client_vital_sign_settings s set enabled = p_enabled, updated_by = actor where s.id = setting.id;
    end if;
  end if;

  return p_enabled;
end $$;

revoke all on function public.configure_ambulatory_vital_choice(uuid, text, boolean, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.configure_ambulatory_vital_choice(uuid, text, boolean, timestamptz, text)
  to authenticated;

notify pgrst, 'reload schema';
