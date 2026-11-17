begin;

create table public.care_plan_respiratory_assessments (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  care_plan_id uuid not null references public.care_plans(id),
  observed_on date not null,
  instrument text not null check (length(btrim(instrument)) between 1 and 120),
  instrument_version text not null check (length(btrim(instrument_version)) between 1 and 80),
  score numeric(6,2) not null check (score >= 0 and score <= maximum),
  maximum numeric(6,2) not null check (maximum > 0 and maximum <= 999),
  findings text not null check (length(btrim(findings)) between 1 and 4000),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);
create index care_plan_respiratory_assessments_scope on public.care_plan_respiratory_assessments
  (tenant_id,care_plan_id,observed_on desc, id);

alter table public.care_plan_respiratory_assessments enable row level security;
revoke all on public.care_plan_respiratory_assessments from public,anon,authenticated;
grant select on public.care_plan_respiratory_assessments to authenticated;
grant insert (id,tenant_id,care_plan_id,observed_on,instrument,instrument_version,score,maximum,findings)
  on public.care_plan_respiratory_assessments to authenticated;

create policy care_plan_respiratory_assessments_read on public.care_plan_respiratory_assessments for select to authenticated using (
  tenant_id=(select public.current_tenant_id()) and (select auth.uid()) is not null
  and (select coalesce(public.current_portal_type(),'business'))='business'
  and (select public.has_permission('pflege.plans.view') and public.has_permission('pflege.vitals.view'))
  and exists(select 1 from public.care_plans p where p.id=care_plan_id and p.tenant_id=care_plan_respiratory_assessments.tenant_id)
);

create policy care_plan_respiratory_assessments_add on public.care_plan_respiratory_assessments for insert to authenticated with check (
  tenant_id=(select public.current_tenant_id()) and created_by=(select auth.uid())
  and (select coalesce(public.current_portal_type(),'business'))='business'
  and (select public.has_permission('pflege.plans.view') and public.has_permission('pflege.vitals.view')
    and public.has_permission('pflege.vitals.manage'))
  and observed_on<=(statement_timestamp() at time zone 'Europe/Berlin')::date
  and exists(select 1 from public.care_plans p where p.id=care_plan_id and p.tenant_id=care_plan_respiratory_assessments.tenant_id
    and p.status not in ('archived', 'completed') and public.is_active_pfleger_client(p.client_id))
);

commit;
