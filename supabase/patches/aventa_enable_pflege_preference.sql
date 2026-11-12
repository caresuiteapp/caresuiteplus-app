-- Optional one-time operation. Review and run explicitly in the intended
-- Supabase project by a database administrator. Not a migration or deploy step.
-- Only AVENTA's existing launcher preference is changed; no entitlement,
-- platform decision, role, permission, or access policy is modified.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

do $repair$
declare
  target constant uuid := '56180c22-b894-4fab-b55e-a563c94dd6e7';
  platform_status text;
  product public.tenant_products%rowtype;
  before_settings public.tenant_module_settings%rowtype;
  after_settings public.tenant_module_settings%rowtype;
  updated_count integer;
begin
  perform 1 from public.tenants
  where id = target and slug = 'helferhasen' and name = 'AVENTA – Ambulante Alltagsbegleitung'
  for share;
  if not found then raise exception 'Der geprüfte AVENTA-Mandant wurde nicht eindeutig gefunden.'; end if;

  select status::text into strict platform_status from public.platform_tenants where tenant_id = target for share;
  if platform_status is distinct from 'active' then
    raise exception 'Der AVENTA-Mandant ist auf der Plattform nicht aktiv.';
  end if;

  select * into strict product from public.tenant_products where tenant_id = target and product_key = 'pflege' for share;
  if product.status::text is distinct from 'active' or product.is_active is not true
     or product.billing_status::text = 'admin_disabled' or product.access_source::text = 'disabled'
     or product.starts_at > now() or product.ends_at <= now() then
    raise exception 'Die bestehende Pflege-Produktfreigabe ist nicht aktiv.';
  end if;

  -- Prevent a concurrent insertion/change of an overriding platform decision.
  -- The current application maps the Pflege product to the platform key care.
  lock table public.platform_tenant_modules in share mode;
  if exists (
    select 1 from public.platform_tenant_modules
    where tenant_id = target and module_key in ('care', 'pflege', 'office')
      and (status::text in ('enabled', 'beta_enabled', 'trial') is not true
        or starts_at > now() or ends_at <= now()
        or (is_trial is true and trial_ends_at <= now()))
  ) then
    raise exception 'Eine Plattformfreigabe für Pflege oder Office fehlt oder ist gesperrt.';
  end if;

  select * into strict before_settings from public.tenant_module_settings where tenant_id = target for update;
  if before_settings.pflege_enabled is true then
    raise notice 'Die Pflege-Anzeige für AVENTA ist bereits aktiviert.';
    return;
  end if;
  if before_settings.pflege_enabled is distinct from false then
    raise exception 'Der bisherige AVENTA-Schalter ist nicht eindeutig deaktiviert.';
  end if;

  update public.tenant_module_settings
  set pflege_enabled = true, updated_at = now()
  where tenant_id = target and pflege_enabled is false
  returning * into after_settings;
  get diagnostics updated_count = row_count;
  if updated_count <> 1 or after_settings.pflege_enabled is not true
     or (to_jsonb(after_settings) - 'pflege_enabled' - 'updated_at')
        is distinct from (to_jsonb(before_settings) - 'pflege_enabled' - 'updated_at') then
    raise exception 'Die Änderung betrifft nicht ausschließlich den geprüften AVENTA-Schalter.';
  end if;

  insert into public.audit_logs(tenant_id, profile_id, action, table_name, record_id, title, description, old_data, new_data)
  values (target, null, 'update', 'tenant_module_settings', target, 'Pflege-Anzeige für AVENTA aktiviert',
    'Administrativer Nachtrag zur bestehenden Pflege-Freigabe; Produktfreigaben und Rechte unverändert.',
    jsonb_build_object('pflege_enabled', false, 'updated_at', before_settings.updated_at),
    jsonb_build_object('pflege_enabled', true, 'updated_at', after_settings.updated_at));
  raise notice 'Der Pflege-Schalter für AVENTA wurde aktiviert und protokolliert.';
end
$repair$;

commit;
