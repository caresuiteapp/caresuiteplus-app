-- LOCAL REVIEW ONLY; requires wound_documentation, wound_lifecycle and existing care_medical_orders.
-- Documents plans and actual events. Does not issue prescriptions, certify qualification or create billing proofs.
begin;
create table if not exists public.ambulatory_wound_plan_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),wound_case_id uuid not null references public.clinical_wound_cases(id),
 version integer not null check(version>0),previous_id uuid references public.ambulatory_wound_plan_versions(id),
 effective_from timestamptz not null,effective_until timestamptz,basis_state text not null check(basis_state in ('linked','pending','not_required')),
 medical_order_id uuid references public.care_medical_orders(id),order_snapshot jsonb,details jsonb not null,
 recorded_by uuid not null,recorded_by_name text not null,created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,wound_case_id,version),unique(tenant_id,wound_case_id,effective_from),check(effective_until is null or effective_until>effective_from)
);
create table if not exists public.ambulatory_wound_dressings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id),wound_case_id uuid not null references public.clinical_wound_cases(id),
 plan_id uuid references public.ambulatory_wound_plan_versions(id),plan_snapshot jsonb,
 execution_id uuid not null unique references public.clinical_treatment_executions(id),
 occurred_at timestamptz not null,outcome text not null check(outcome in ('performed','partial','omitted','refused','failed')),
 basis_state text not null check(basis_state in ('linked','unconfirmed')),details jsonb not null,
 recorded_by uuid not null,recorded_by_name text not null,created_at timestamptz not null default clock_timestamp()
);
create index if not exists wound_plan_history on public.ambulatory_wound_plan_versions(tenant_id,wound_case_id,created_at desc,id desc);
create index if not exists wound_dressing_history on public.ambulatory_wound_dressings(tenant_id,wound_case_id,created_at desc,id desc);
do $$declare tbl text;extra text;begin
 foreach tbl in array array['ambulatory_wound_plan_versions','ambulatory_wound_dressings'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('drop policy if exists wound_care_read on public.%I',tbl);
  execute format('create policy wound_care_read on public.%I for select to authenticated using(true)',tbl);
  execute format('drop policy if exists wound_care_scope on public.%I',tbl);
  extra:=case when tbl='ambulatory_wound_dressings' then ' and public.has_permission(''pflege.treatment.view'')' else '' end;
  execute format('create policy wound_care_scope on public.%1$I as restrictive for select to authenticated using(
   auth.uid() is not null and tenant_id=public.current_tenant_id() and public.has_permission(''pflege.wounds.view'') and public.has_permission(''pflege.orders.view'')
   and public.is_active_pfleger_client(client_id)
   and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=%1$I.tenant_id and p.is_active)
   and exists(select 1 from public.clinical_wound_cases w where w.id=%1$I.wound_case_id and w.tenant_id=%1$I.tenant_id and w.client_id=%1$I.client_id)%2$s)',tbl,extra);
 end loop;
end $$;
create table if not exists care_private.wound_care_requests(
 tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,payload jsonb not null,result_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.wound_care_requests enable row level security;
revoke all on care_private.wound_care_requests from public,anon,authenticated;
create or replace function care_private.check_wound_order(o public.care_medical_orders,tenant uuid,subject uuid,from_time timestamptz,until_time timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if o.id is null or o.tenant_id<>tenant or o.client_id<>subject or o.status<>'active' or o.valid_from is null or o.ordered_at is null
 or nullif(btrim(o.description),'') is null or nullif(btrim(o.ordering_physician),'') is null
 or (from_time at time zone 'Europe/Berlin')::date<o.valid_from or (from_time at time zone 'Europe/Berlin')::date<o.ordered_at
 or (o.valid_until is not null and (coalesce(until_time,from_time) at time zone 'Europe/Berlin')::date>o.valid_until)
 then raise exception 'Anordnung gehört nicht zur Akte oder deckt den angegebenen Zeitraum nicht ab.' using errcode='23514';end if;
 -- Insurer status is retained independently, not treated as professional permission or automatically approved.
end $$;
revoke all on function care_private.check_wound_order(public.care_medical_orders,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
create or replace function care_private.write_wound_care(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();actor_name text;subject uuid;
 w public.clinical_wound_cases%rowtype;previous public.ambulatory_wound_plan_versions%rowtype;p public.ambulatory_wound_plan_versions%rowtype;
 o public.care_medical_orders%rowtype;receipt care_private.wound_care_requests%rowtype;
 d jsonb;keys text[];field text;at_time timestamptz;until_time timestamptz;review_time timestamptz;result_id uuid;execution uuid;materials jsonb;m jsonb;value numeric;
begin
 if auth.uid() is null or tenant is null or public.has_permission('pflege.wounds.view') is not true or public.has_permission('pflege.wounds.manage') is not true
 or public.has_permission('pflege.orders.view') is not true or not exists(select 1 from public.profiles x where x.id=actor and x.tenant_id=tenant and x.is_active)
 then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or (payload-array['action','woundId','dataJson'])<>'{}'::jsonb
 or payload->>'action' not in ('plan','dressing') or jsonb_typeof(payload->'action') is distinct from 'string'
 or jsonb_typeof(payload->'woundId') is distinct from 'string' or jsonb_typeof(payload->'dataJson') is distinct from 'string' or length(payload->>'dataJson')>120000
 then raise exception 'Ungültige Wundversorgungsanfrage.' using errcode='23514';end if;
 if payload->>'action'='dressing' and (public.has_permission('pflege.treatment.view') is not true or public.has_permission('pflege.treatment.manage') is not true) then raise exception 'Behandlungspflegeberechtigung fehlt.' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-care:'||request_id::text,0));
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant;subject:=w.client_id;
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant for no key update;
 if not found or public.is_active_pfleger_client(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into receipt from care_private.wound_care_requests r where r.tenant_id=tenant and r.request_id=write_wound_care.request_id;
 if receipt.result_id is not null then
  if receipt.actor_id<>actor or receipt.payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return receipt.result_id;
 end if;
 select * into w from public.clinical_wound_cases c where c.id=(payload->>'woundId')::uuid and c.tenant_id=tenant and c.client_id=subject for update;
 if w.id is null then raise exception 'Wundfall geändert oder nicht zugänglich.' using errcode='40001';end if;
 d:=(payload->>'dataJson')::jsonb;
 keys:=case when payload->>'action'='plan' then array['expectedPreviousId','effectiveFrom','effectiveUntil','basisState','medicalOrderId','expectedOrderJson','basisReason','professionalBasis','changeReason','goal','plannedCare','plannedMaterials','frequency','hygienePlan','painPlan','warningSigns','escalationPath','personDecision','reviewStatus','nextReviewAt','reviewPendingReason']
 else array['occurredAt','outcome','basisState','planId','basisReason','actualCleaning','actualTechnique','hygiene','materialsJson','noMaterialReason','painBeforeState','painBeforeScore','painBeforeReason','painAfterState','painAfterScore','painAfterReason','response','deviation','contact','personDecision','qualificationBasis','reviewStatus','nextReviewAt','reviewPendingReason'] end;
 if jsonb_typeof(d) is distinct from 'object' or (d-keys)<>'{}'::jsonb then raise exception 'Wundversorgungsangaben ungültig.' using errcode='23514';end if;
 foreach field in array keys loop
  if jsonb_typeof(d->field) is distinct from 'string' or length(d->>field)>case field when 'expectedOrderJson' then 80000 when 'materialsJson' then 20000 else 2000 end then raise exception 'Angaben fehlen oder sind zu umfangreich.' using errcode='23514';end if;
 end loop;
 if d->>'reviewStatus'='scheduled' then
  if d->>'nextReviewAt' !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' or nullif(btrim(d->>'reviewPendingReason'),'') is not null then raise exception 'Kontrolltermin prüfen.' using errcode='23514';end if;
  review_time:=(d->>'nextReviewAt')::timestamptz;if review_time<=clock_timestamp() then raise exception 'Kontrolltermin liegt nicht in der Zukunft.' using errcode='23514';end if;
 elsif d->>'reviewStatus'='pending' and d->>'nextReviewAt'='' and nullif(btrim(d->>'reviewPendingReason'),'') is not null then review_time:=null;
 else raise exception 'Kontrolle oder offene Abstimmung dokumentieren.' using errcode='23514';end if;
 field:=case when payload->>'action'='plan' then 'effectiveFrom' else 'occurredAt' end;
 if d->>field !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Tatsächlichen Zeitpunkt prüfen.' using errcode='23514';end if;at_time:=(d->>field)::timestamptz;
 select coalesce(nullif(x.display_name,''),x.email,'Pflegekraft') into actor_name from public.profiles x where x.id=actor and x.tenant_id=tenant and x.is_active;
 if payload->>'action'='plan' then
  if w.status not in ('draft','active','healing','deteriorated') then raise exception 'Planänderung benötigt einen offenen Wundfall.' using errcode='40001';end if;
  foreach field in array array['professionalBasis','changeReason','goal','plannedCare','plannedMaterials','frequency','hygienePlan','painPlan','warningSigns','escalationPath','personDecision','basisReason'] loop
   if nullif(btrim(d->>field),'') is null then raise exception 'Plan und fachliche Grundlage unvollständig.' using errcode='23514';end if;
  end loop;
  if d->>'effectiveUntil'<>'' then
   if d->>'effectiveUntil' !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Planende prüfen.' using errcode='23514';end if;
   until_time:=(d->>'effectiveUntil')::timestamptz;if until_time<=at_time then raise exception 'Planende liegt nicht nach Beginn.' using errcode='23514';end if;
  end if;
  select * into previous from public.ambulatory_wound_plan_versions x where x.tenant_id=tenant and x.wound_case_id=w.id and x.client_id=subject order by version desc limit 1;
  if coalesce(previous.id::text,'')<>coalesce(nullif(d->>'expectedPreviousId','')::uuid::text,'') or (previous.id is not null and at_time<=previous.effective_from) then raise exception 'Planfassung geändert oder Beginn nicht nach vorheriger Fassung.' using errcode='40001';end if;
  if exists(select 1 from public.ambulatory_wound_dressings x where x.tenant_id=tenant and x.wound_case_id=w.id and x.client_id=subject and x.plan_id is not null and x.occurred_at>=at_time) then raise exception 'Neue Planung darf bereits dokumentierte planbezogene Versorgung nicht rückwirkend ersetzen.' using errcode='40001';end if;
  if d->>'basisState'='linked' then
   select * into o from public.care_medical_orders x where x.id=nullif(d->>'medicalOrderId','')::uuid and x.tenant_id=tenant and x.client_id=subject for share;
   perform care_private.check_wound_order(o,tenant,subject,at_time,until_time);
   if to_jsonb(o) is distinct from (d->>'expectedOrderJson')::jsonb then raise exception 'Anordnung seit dem Laden geändert. Grundlage erneut prüfen.' using errcode='40001';end if;
  elsif d->>'basisState' in ('pending','not_required') and d->>'medicalOrderId'='' and d->>'expectedOrderJson'='' then o:=null;
  else raise exception 'Ärztliche Grundlage ausdrücklich und widerspruchsfrei dokumentieren.' using errcode='23514';end if;
  insert into public.ambulatory_wound_plan_versions(tenant_id,client_id,wound_case_id,version,previous_id,effective_from,effective_until,basis_state,medical_order_id,order_snapshot,details,recorded_by,recorded_by_name)
  values(tenant,subject,w.id,coalesce(previous.version,0)+1,previous.id,at_time,until_time,d->>'basisState',o.id,case when o.id is not null then to_jsonb(o) else null end,d-'expectedOrderJson',actor,actor_name) returning id into result_id;
 else
  if at_time>clock_timestamp() or d->>'outcome' not in ('performed','partial','omitted','refused','failed') then raise exception 'Tatsächlichen Zeitpunkt und Ergebnis prüfen.' using errcode='23514';end if;
  foreach field in array array['actualCleaning','actualTechnique','hygiene','response','contact','personDecision','qualificationBasis'] loop
   if nullif(btrim(d->>field),'') is null then raise exception 'Tatsächliche Durchführung oder begründete Nichtdurchführung unvollständig.' using errcode='23514';end if;
  end loop;
  if d->>'outcome'<>'performed' and nullif(btrim(d->>'deviation'),'') is null then raise exception 'Abweichung von vollständiger Durchführung begründen.' using errcode='23514';end if;
  if d->>'basisState'='linked' then
   if w.status in ('healed','archived') and coalesce(at_time>(select e.occurred_at from public.ambulatory_wound_lifecycle_events e where e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=w.id and e.action='close' order by e.created_at desc,e.id desc limit 1),true) then raise exception 'Versorgung nach Fallabschluss mit tatsächlichem Klärungsbedarf dokumentieren oder Fall begründet wiederöffnen.' using errcode='40001';end if;
   select * into p from public.ambulatory_wound_plan_versions x where x.tenant_id=tenant and x.client_id=subject and x.wound_case_id=w.id and x.effective_from<=at_time order by effective_from desc limit 1;
   if p.id is null or p.id is distinct from nullif(d->>'planId','')::uuid or (p.effective_until is not null and at_time>=p.effective_until) or p.basis_state<>'linked' or nullif(btrim(d->>'basisReason'),'') is not null then raise exception 'Passende Planfassung mit zugeordneter Anordnung fehlt.' using errcode='40001';end if;
   if exists(select 1 from public.ambulatory_wound_lifecycle_events e where e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=w.id and e.action='reopen' and e.occurred_at<=at_time and e.created_at>p.created_at) then raise exception 'Nach Wiederöffnung Versorgung erneut beurteilen und neue Planfassung dokumentieren.' using errcode='40001';end if;
   select * into o from public.care_medical_orders x where x.id=p.medical_order_id and x.tenant_id=tenant and x.client_id=subject for share;
   perform care_private.check_wound_order(o,tenant,subject,at_time,null);
   if to_jsonb(o) is distinct from p.order_snapshot then raise exception 'Anordnung geändert. Aktuelle Planung prüfen oder tatsächliche ungeklärte Grundlage dokumentieren.' using errcode='40001';end if;
  elsif d->>'basisState'='unconfirmed' and d->>'planId'='' and nullif(btrim(d->>'basisReason'),'') is not null and nullif(btrim(d->>'deviation'),'') is not null then p:=null;
  else raise exception 'Planbezug oder tatsächliche ungeklärte Grundlage mit Abweichung dokumentieren.' using errcode='23514';end if;
  materials:=(d->>'materialsJson')::jsonb;
  if jsonb_typeof(materials) is distinct from 'array' or jsonb_array_length(materials)>20 then raise exception 'Materialliste ungültig.' using errcode='23514';end if;
  for m in select item from jsonb_array_elements(materials) as entries(item) loop
   if jsonb_typeof(m) is distinct from 'object' or (m-array['name','quantity','unit','purpose'])<>'{}'::jsonb then raise exception 'Materialposition ungültig.' using errcode='23514';end if;
   foreach field in array array['name','quantity','unit','purpose'] loop
    if jsonb_typeof(m->field) is distinct from 'string' or length(m->>field)>200 or nullif(btrim(m->>field),'') is null then raise exception 'Materialposition unvollständig.' using errcode='23514';end if;
   end loop;
   if m->>'quantity' !~ '^[0-9]+([.,][0-9]+)?$' or m->>'purpose' not in ('wound','preparation','waste') then raise exception 'Tatsächliche Materialmenge und Verwendung prüfen.' using errcode='23514';end if;
   value:=replace(m->>'quantity',',','.')::numeric;if value<=0 or value>1000000 then raise exception 'Materialmenge ungültig.' using errcode='23514';end if;
  end loop;
  if (jsonb_array_length(materials)=0 and nullif(btrim(d->>'noMaterialReason'),'') is null) or (jsonb_array_length(materials)>0 and nullif(btrim(d->>'noMaterialReason'),'') is not null) then raise exception 'Fehlenden tatsächlichen Verbrauch ausdrücklich und widerspruchsfrei begründen.' using errcode='23514';end if;
  foreach field in array array['painBefore','painAfter'] loop
   if d->>(field||'State')='NRS' then
    if d->>(field||'Score') !~ '^[0-9]{1,2}$' or (d->>(field||'Score'))::integer>10 or nullif(btrim(d->>(field||'Reason')),'') is not null then raise exception 'Erhobene NRS 0–10 prüfen.' using errcode='23514';end if;
   elsif d->>(field||'State')='not_assessable' and nullif(btrim(d->>(field||'Score')),'') is null and nullif(btrim(d->>(field||'Reason')),'') is not null then null;
   else raise exception 'Schmerz vor und nach der Versorgung ausdrücklich dokumentieren.' using errcode='23514';end if;
  end loop;
  insert into public.clinical_treatment_executions(tenant_id,client_id,medical_order_id,treatment_type,title,performed_at,outcome,details,deviation_reason,escalation,qualification_snapshot,recorded_by,recorded_by_name)
  values(tenant,subject,p.medical_order_id,'wound_dressing','Wundversorgung / Verbandwechsel',at_time,d->>'outcome',d::text,d->>'deviation',d->>'contact',d->>'qualificationBasis',actor,actor_name) returning id into execution;
  insert into public.ambulatory_wound_dressings(tenant_id,client_id,wound_case_id,plan_id,plan_snapshot,execution_id,occurred_at,outcome,basis_state,details,recorded_by,recorded_by_name)
  values(tenant,subject,w.id,p.id,case when p.id is not null then to_jsonb(p) else null end,execution,at_time,d->>'outcome',d->>'basisState',d,actor,actor_name) returning id into result_id;
  -- Actual events remain documentable without verified source. No plan/status/alert/billing mutation.
 end if;
 update public.clinical_wound_cases set updated_at=clock_timestamp() where id=w.id and tenant_id=tenant;
 insert into care_private.wound_care_requests(tenant_id,request_id,actor_id,payload,result_id) values(tenant,request_id,actor,payload,result_id);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,subject,case when payload->>'action'='plan' then 'wound_plan_version' else 'wound_dressing' end,result_id,'created','Wundplanung / tatsächliche Versorgung dokumentiert',d-'expectedOrderJson',actor,actor_name);
 return result_id;
end $$;
create or replace function public.write_ambulatory_wound_care(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.write_wound_care(request_id,payload)$$;
revoke all on function care_private.write_wound_care(uuid,jsonb),public.write_ambulatory_wound_care(uuid,jsonb) from public,anon;
grant execute on function care_private.write_wound_care(uuid,jsonb),public.write_ambulatory_wound_care(uuid,jsonb) to authenticated;
-- Cross-workflow concurrency: new care records advance the parent technical revision.
-- Status decisions are parent-locked by wound_lifecycle; do not close before documented actual care.
create or replace function care_private.guard_wound_care_closure()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.action='close' and exists(select 1 from public.ambulatory_wound_dressings d where d.tenant_id=new.tenant_id and d.client_id=new.client_id and d.wound_case_id=new.wound_case_id and d.occurred_at>new.occurred_at)
 then raise exception 'Abschluss darf nicht vor einer dokumentierten tatsächlichen Versorgung liegen.' using errcode='23514';end if;
 return new;
end $$;
revoke all on function care_private.guard_wound_care_closure() from public,anon,authenticated;
drop trigger if exists guard_wound_care_closure on public.ambulatory_wound_lifecycle_events;
create trigger guard_wound_care_closure before insert on public.ambulatory_wound_lifecycle_events for each row execute function care_private.guard_wound_care_closure();
commit;
