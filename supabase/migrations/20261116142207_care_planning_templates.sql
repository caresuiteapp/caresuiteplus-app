-- Own reusable wording and standards. Copied wording belongs to the plan version.
begin;
create table public.care_planning_templates (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  kind text not null check (kind in ('problem','cause','resource','goal','measure','standard')),
  domain text not null check (domain in (
    'communication','orientation','movement','positioning','cleansing','clothing','meals','drinks',
    'elimination','breathing','temperature','sleep','safety','routine','relationships','intimacy',
    'development','meaning','treatment','learning'
  )),
  model text not null check (model in ('atl','aedl','fedl','roper','orem','henderson')),
  setting text not null check (setting in ('ambulant','stationaer')),
  title text not null check (title=btrim(title) and char_length(title) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  updated_by uuid not null default public.resolve_current_profile_id() references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (tenant_id,id)
);

alter table public.care_planning_templates enable row level security;
revoke all on public.care_planning_templates from public, anon, authenticated;
grant select on public.care_planning_templates to authenticated;
grant insert (tenant_id,id,kind,domain,model,setting,title,body) on public.care_planning_templates to authenticated;
grant update (kind,domain,model,title,body) on public.care_planning_templates to authenticated;
create index care_planning_templates_lookup on public.care_planning_templates (tenant_id,setting,model,title,id);

create policy care_planning_templates_view on public.care_planning_templates for select to authenticated using (
  tenant_id=(select public.current_tenant_id()) and (select auth.uid()) is not null
  and (select coalesce(public.current_portal_type(),'business'))='business'
  and case setting when 'ambulant' then (select public.has_permission('pflege.plans.view'))
    when 'stationaer' then (select public.has_permission('stationaer.residents.view')) else false end
);
create policy care_planning_templates_insert on public.care_planning_templates for insert to authenticated with check (
  tenant_id=(select public.current_tenant_id()) and (select auth.uid()) is not null
  and updated_by=(select public.resolve_current_profile_id())
  and (select coalesce(public.current_portal_type(),'business'))='business'
  and case setting when 'ambulant' then (select public.has_permission('pflege.plans.view') and public.has_permission('pflege.plans.manage'))
    when 'stationaer' then (select public.has_permission('stationaer.residents.view') and public.has_permission('stationaer.assessments.manage')) else false end
);
create policy care_planning_templates_edit on public.care_planning_templates for update to authenticated using (
  tenant_id=(select public.current_tenant_id()) and (select auth.uid()) is not null
  and (select coalesce(public.current_portal_type(),'business'))='business'
  and case setting when 'ambulant' then (select public.has_permission('pflege.plans.view') and public.has_permission('pflege.plans.manage'))
    when 'stationaer' then (select public.has_permission('stationaer.residents.view') and public.has_permission('stationaer.assessments.manage')) else false end
);

create function public.stamp_care_planning_template_update() returns trigger
language plpgsql set search_path='' as $$
begin
  new.updated_at:=clock_timestamp();
  new.updated_by:=public.resolve_current_profile_id();
  return new;
end;
$$;
revoke all on function public.stamp_care_planning_template_update() from public,anon,authenticated;
create trigger care_planning_templates_revision before update on public.care_planning_templates
for each row execute function public.stamp_care_planning_template_update();
commit;
