-- LOCAL REVIEW ONLY. Existing clinical tables required. No native writer changed.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;
grant usage on schema care_private to authenticated;
alter table public.clinical_wound_cases add column if not exists documentation_details jsonb;
alter table public.clinical_wound_assessments add column if not exists observed_at timestamptz,add column if not exists documentation_details jsonb;
-- Do not relabel historical assessed_at (capture) as an actual observation time.
create table if not exists care_private.wound_requests(
 tenant_id uuid not null,request_id uuid not null,actor_id uuid not null,payload jsonb not null,result_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.wound_requests enable row level security;
revoke all on care_private.wound_requests from public,anon,authenticated;
create or replace function care_private.write_wound_documentation(request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();person_name text;
 subject uuid;w public.clinical_wound_cases%rowtype;receipt care_private.wound_requests%rowtype;d jsonb;keys text[];field text;result_id uuid;
 review_time timestamptz;observed_time timestamptz;length_value numeric;width_value numeric;depth_value numeric;pain_value integer;v numeric;
begin
 if auth.uid() is null or tenant is null or public.has_permission('pflege.wounds.manage') is not true or public.has_permission('pflege.wounds.view') is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active) then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or length(payload::text)>150000
 or (payload-array['action','subjectId','dataJson'])<>'{}'::jsonb or coalesce(payload->>'action','') not in ('create','assessment')
 or jsonb_typeof(payload->'dataJson') is distinct from 'string' or length(payload->>'dataJson')>40000 then raise exception 'Ungültige Wundanfrage.' using errcode='23514';end if;
 if payload->>'action'='create' then subject:=(payload->>'subjectId')::uuid;
 else select * into w from public.clinical_wound_cases c where c.id=(payload->>'subjectId')::uuid and c.tenant_id=tenant;subject:=w.client_id;end if;
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant for update;
 if not found or public.is_active_pfleger_client(subject) is not true then raise exception 'Kein aktiver zugänglicher Pflegefall.' using errcode='42501';end if;
 select * into receipt from care_private.wound_requests r where r.tenant_id=tenant and r.request_id=write_wound_documentation.request_id;
 if receipt.result_id is not null then
  if receipt.actor_id<>actor or receipt.payload<>payload then raise exception 'Anfrage mit anderen Daten verwendet.' using errcode='23514';end if;return receipt.result_id;
 end if;
 d:=(payload->>'dataJson')::jsonb;
 keys:=case when payload->>'action'='create' then array['bodyLocation','side','woundType','etiology','onsetDate','onsetUnknownReason','acquiredWhere','description','basisStatus','basisReference','physician','carePlan','nextReviewAt','reviewStatus','reviewPendingReason']
 else array['observedAt','measurementMethod','lengthState','lengthCm','lengthReason','widthState','widthCm','widthReason','depthState','depthCm','depthReason','woundBed','exudate','odor','woundEdge','surroundingSkin','painState','painScore','painReason','infectionObservation','personalImpact','preferences','selfManagement','actualAction','response','nextReviewAt','reviewStatus','reviewPendingReason'] end;
 if jsonb_typeof(d) is distinct from 'object' or (d-keys)<>'{}'::jsonb then raise exception 'Ungültige Wundangaben.' using errcode='23514';end if;
 foreach field in array keys loop
  if jsonb_typeof(d->field) is distinct from 'string' or length(d->>field)>2000 then raise exception 'Wundangabe fehlt oder ist zu umfangreich.' using errcode='23514';end if;
 end loop;
 if d->>'reviewStatus'='scheduled' then
  if coalesce(d->>'nextReviewAt','') !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' or nullif(btrim(d->>'reviewPendingReason'),'') is not null then raise exception 'Vereinbarten Kontrolltermin prüfen.' using errcode='23514';end if;
  review_time:=(d->>'nextReviewAt')::timestamptz;if review_time<=clock_timestamp() then raise exception 'Kontrolltermin liegt nicht in der Zukunft.' using errcode='23514';end if;
 elsif d->>'reviewStatus'='pending' and d->>'nextReviewAt'='' and nullif(btrim(d->>'reviewPendingReason'),'') is not null then review_time:=null;
 else raise exception 'Kontrolltermin oder offene Terminabstimmung dokumentieren.' using errcode='23514';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into person_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 if payload->>'action'='create' then
  foreach field in array array['bodyLocation','woundType','etiology','acquiredWhere','description','basisReference'] loop
   if nullif(btrim(d->>field),'') is null then raise exception 'Wundbeschreibung und Grundlage fehlen.' using errcode='23514';end if;
  end loop;
  if d->>'side' not in ('left','right','midline','bilateral','not_applicable') or d->>'basisStatus' not in ('documented','pending','not_required')
  or (d->>'basisStatus'='documented' and nullif(btrim(d->>'physician'),'') is null) then raise exception 'Körperseite und ärztliche Grundlage ausdrücklich dokumentieren.' using errcode='23514';end if;
  if d->>'onsetDate'='' then
   if nullif(btrim(d->>'onsetUnknownReason'),'') is null then raise exception 'Unbekanntes Entstehungsdatum begründen.' using errcode='23514';end if;
  elsif (d->>'onsetDate') !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$' or (d->>'onsetDate')::date>(clock_timestamp() at time zone 'Europe/Berlin')::date or nullif(btrim(d->>'onsetUnknownReason'),'') is not null then raise exception 'Entstehungsdatum prüfen.' using errcode='23514';end if;
  insert into public.clinical_wound_cases(tenant_id,client_id,body_location,wound_type,etiology,onset_date,acquired_where,treatment_plan,physician_involved,ordering_physician,status,next_review_at,recorded_by,recorded_by_name,documentation_details)
  values(tenant,subject,btrim(d->>'bodyLocation'),btrim(d->>'woundType'),btrim(d->>'etiology'),nullif(d->>'onsetDate','')::date,btrim(d->>'acquiredWhere'),btrim(d->>'carePlan'),d->>'basisStatus'='documented',btrim(d->>'physician'),'draft',review_time,actor,person_name,d) returning id into result_id;
  -- No invented initial assessment, measurement, bodymap marker or executed treatment.
 else
  select * into w from public.clinical_wound_cases c where c.id=(payload->>'subjectId')::uuid and c.tenant_id=tenant and c.client_id=subject for update;
  if w.id is null or w.status not in ('draft','active','healing','deteriorated') then raise exception 'Wundfall für Assessment nicht offen.' using errcode='40001';end if;
  if coalesce(d->>'observedAt','') !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Assessmentzeitpunkt fehlt.' using errcode='23514';end if;
  observed_time:=(d->>'observedAt')::timestamptz;if observed_time>clock_timestamp() then raise exception 'Assessmentzeitpunkt liegt in der Zukunft.' using errcode='23514';end if;
  foreach field in array array['length','width','depth'] loop
   if d->>(field||'State')='measured' then
    if (d->>(field||'Cm')) !~ '^[ ]*[0-9]+([.,][0-9]+)?[ ]*$' or nullif(btrim(d->>(field||'Reason')),'') is not null then raise exception 'Größe in cm prüfen.' using errcode='23514';end if;
    v:=replace(btrim(d->>(field||'Cm')),',','.')::numeric;if v>1000000 then raise exception 'Technische Zahlengrenze überschritten.' using errcode='23514';end if;
   elsif d->>(field||'State')='not_measurable' and nullif(btrim(d->>(field||'Cm')),'') is null and nullif(btrim(d->>(field||'Reason')),'') is not null then v:=null;
   else raise exception 'Messbarkeit und tatsächlichen Grund dokumentieren.' using errcode='23514';end if;
   if field='length' then length_value:=v;elsif field='width' then width_value:=v;else depth_value:=v;end if;
  end loop;
  foreach field in array array['measurementMethod','woundBed','exudate','odor','woundEdge','surroundingSkin','infectionObservation','personalImpact','preferences','selfManagement','actualAction','response'] loop
   if nullif(btrim(d->>field),'') is null then raise exception 'Wundassessment unvollständig.' using errcode='23514';end if;
  end loop;
  if d->>'painState'='NRS' then
   if d->>'painScore' !~ '^[0-9]{1,2}$' or (d->>'painScore')::integer>10 or nullif(btrim(d->>'painReason'),'') is not null then raise exception 'NRS 0–10 prüfen.' using errcode='23514';end if;pain_value:=(d->>'painScore')::integer;
  elsif d->>'painState'='not_assessable' and nullif(btrim(d->>'painScore'),'') is null and nullif(btrim(d->>'painReason'),'') is not null then pain_value:=null;
  else raise exception 'Schmerzerhebung dokumentieren.' using errcode='23514';end if;
  insert into public.clinical_wound_assessments(tenant_id,client_id,wound_case_id,length_cm,width_cm,depth_cm,wound_bed,exudate,odor,wound_edge,surrounding_skin,pain_score,infection_signs,intervention,response,recorded_by,recorded_by_name,observed_at,documentation_details)
  values(tenant,subject,w.id,length_value,width_value,depth_value,d->>'woundBed',d->>'exudate',d->>'odor',d->>'woundEdge',d->>'surroundingSkin',pain_value,d->>'infectionObservation',d->>'actualAction',d->>'response',actor,person_name,observed_time,d) returning id into result_id;
  -- Assessment is its own event, not an implicit plan/status change or review completion.
 end if;
 insert into care_private.wound_requests(tenant_id,request_id,actor_id,payload,result_id) values(tenant,request_id,actor,payload,result_id);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,subject,case when payload->>'action'='create' then 'wound_case' else 'wound_assessment' end,result_id,'created','Wunddokumentation gespeichert',d,actor,person_name);
 return result_id;
end $$;
create or replace function public.write_ambulatory_wound_documentation(request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.write_wound_documentation(request_id,payload)$$;
revoke all on function care_private.write_wound_documentation(uuid,jsonb),public.write_ambulatory_wound_documentation(uuid,jsonb) from public,anon;
grant execute on function care_private.write_wound_documentation(uuid,jsonb),public.write_ambulatory_wound_documentation(uuid,jsonb) to authenticated;
commit;
