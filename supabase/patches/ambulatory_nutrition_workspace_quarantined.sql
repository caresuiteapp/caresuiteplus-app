-- DRAFT quarantined Nutrition/Elimination technical workspace; freeze hash required before Staging apply.
-- Existing native schemas catalogued 2026-10-22. No native/shared writers are changed.
-- Missing actual-event/quantity-quality/performer/consent/device provenance remains blocked.
-- No production activation or clinical approval is provided by technical source capture.
create schema if not exists care_private;

create or replace function care_private.nutrition_require(ok boolean,message text)
returns void language plpgsql security invoker set search_path='' as $$begin if ok is not true then raise exception '%',message using errcode='23514';end if;end$$;
create or replace function care_private.nutrition_fields(v jsonb,keys text[])
returns boolean language sql immutable security invoker set search_path='' as $$select jsonb_typeof(v)='object' and v ?& keys and not exists(select 1 from jsonb_object_keys(v) k where not(k=any(keys)))$$;
-- Match Web String.trim and UTF-16 length without altering the retained original.
create or replace function care_private.nutrition_text(v jsonb,minimum integer default 0,maximum integer default 8000)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare raw text;trimmed text;units integer:=0;i integer;
begin
 if jsonb_typeof(v) is distinct from 'string' or minimum is null or maximum is null or minimum<0 or maximum<minimum then return false;end if;
 raw:=v#>>'{}';
 -- One UTF-16 unit cannot require more than four UTF-8 bytes. Reject before iteration.
 if octet_length(raw)::bigint>maximum::bigint*4 then return false;end if;
 for i in 1..length(raw) loop units:=units+case when ascii(substr(raw,i,1))>65535 then 2 else 1 end;if units>maximum then return false;end if;end loop;
 trimmed:=btrim(raw,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
 units:=0;
 for i in 1..length(trimmed) loop units:=units+case when ascii(substr(trimmed,i,1))>65535 then 2 else 1 end;end loop;
 return units>=minimum;
end$$;
create or replace function care_private.nutrition_uuid(v jsonb)
returns boolean language sql immutable security invoker set search_path='' as $$select jsonb_typeof(v)='string' and(v#>>'{}')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'$$;
create or replace function care_private.nutrition_time(v jsonb)
returns timestamptz language plpgsql immutable security invoker set search_path='' as $$declare t timestamptz;begin
 perform care_private.nutrition_require(jsonb_typeof(v)='string' and(v#>>'{}')~'^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]([01]\d|2[0-3]):?[0-5]\d)$','Zeitpunkt mit ausdrücklicher Zeitzone fehlt.');
 t:=(v#>>'{}')::timestamptz;perform care_private.nutrition_require(isfinite(t),'Endlicher Zeitpunkt fehlt.');return t;
end$$;
create or replace function care_private.nutrition_fingerprint(v jsonb)
returns text language sql immutable strict security invoker set search_path='' as $$select 'sha256:'||encode(extensions.digest(convert_to(v::text,'UTF8'),'sha256'),'hex')$$;

create or replace function care_private.nutrition_own_permission(required text)
returns boolean language plpgsql security definer set search_path='' as $$declare t uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();role_ref uuid;role_key_ref text;begin
 perform care_private.require_workspace_session(t,actor);
 select p.role_id,r.key into role_ref,role_key_ref from public.profiles p join public.roles r on r.id=p.role_id where p.id=actor and p.tenant_id=t and p.is_active and p.status='active' for share of p,r;
 -- Permission changes are rare administrative operations; the table SHARE locks also cover a newly inserted override.
 lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;
 if exists(select 1 from public.role_permission_sets p where p.tenant_id=t and p.role_key=role_key_ref) then
  return exists(select 1 from public.role_permission_sets p where p.tenant_id=t and p.role_key=role_key_ref and p.permission_key=required);
 end if;
 return exists(select 1 from public.role_permissions p where p.role_id=role_ref and p.permission_key=required);
end$$;

-- Pure original field validation retained from the prepared Nutrition contract.
-- PREPARED ONLY. Apply before committing new G requests; no data writes or fixtures here.
create or replace function care_private.validate_nutrition_entry(e jsonb,s jsonb)
returns void language plpgsql security definer set search_path='' as $$declare k text;v jsonb;item jsonb;actual boolean;begin
 if jsonb_typeof(e) is distinct from 'object' or not(e ?& array['kind','title','plannedAt','occurredAt','planVersionId','measureId','visitId','assessmentId','planSnapshotSha256','decision','assistance','intake','elimination','swallowing','enteral','device','weight','execution','followUp','lifecycle']) then raise exception 'Vollständiger Eintrag fehlt.' using errcode='23514';end if;
 foreach k in array array['decision','assistance','intake','elimination','swallowing','enteral','device','weight','execution','followUp'] loop
  if jsonb_typeof(e->k) is distinct from 'object' then raise exception 'Eintragsabschnitt fehlt.' using errcode='23514';end if;
 end loop;
 if care_private.nutrition_text(e->'title',3,300) is not true or coalesce(e#>>'{execution,outcome}','') not in('planned','offered','performed','partial','refused','not_performed')
 or coalesce(e#>>'{assistance,level}','') not in('independent','prompting','partial_assist','full_assist') or coalesce(e#>>'{intake,unit}','') not in('none','g','ml','percent')
 or coalesce(e#>>'{intake,targetUnit}','') not in('none','g','ml') or coalesce(e#>>'{enteral,unit}','') not in('none','g','ml') or coalesce(e#>>'{elimination,unit}','') not in('none','ml')
 or coalesce(e#>>'{followUp,state}','') not in('not_required','open','closed') or jsonb_typeof(e#>'{followUp,required}') is distinct from 'boolean' or jsonb_typeof(e#>'{elimination,complete}') is distinct from 'boolean' then raise exception 'Status oder Originaleinheit ist ungültig.' using errcode='23514';end if;
 foreach v in array array[e#>'{execution,performedBy}',e#>'{assistance,helpers}'] loop
  if jsonb_typeof(v) is distinct from 'array' then raise exception 'Personenliste fehlt.' using errcode='23514';end if;
  if jsonb_array_length(v)>100 or(select count(distinct x) from jsonb_array_elements_text(v) x)<>jsonb_array_length(v) then raise exception 'Personenliste ist doppelt oder übergroß.' using errcode='23514';end if;
  for item in select x from jsonb_array_elements(v) x loop if jsonb_typeof(item) is distinct from 'string' then raise exception 'Personenidentität fehlt.' using errcode='23514';end if;perform (item#>>'{}')::uuid;end loop;
 end loop;
 foreach v in array array[e#>'{intake,offered}',e#>'{intake,actual}',e#>'{intake,target}',e#>'{elimination,input}',e#>'{elimination,output}',e#>'{enteral,amount}',e#>'{enteral,durationMinutes}',e#>'{enteral,flushMl}',e#>'{weight,value}'] loop
  if v is null or jsonb_typeof(v) not in('null','string') or jsonb_typeof(v)='string' and(v#>>'{}')!~'^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$' then raise exception 'Menge ist weder exakter Dezimalwert noch ausdrücklich fehlend.' using errcode='23514';end if;
 end loop;
 actual:=e#>>'{execution,outcome}' in('performed','partial');
 if not actual and(jsonb_array_length(e#>'{execution,performedBy}')<>0 or btrim(coalesce(e#>>'{execution,result}',''))<>'' or e#>'{intake,actual}' is distinct from 'null'::jsonb or e#>'{elimination,input}' is distinct from 'null'::jsonb or e#>'{elimination,output}' is distinct from 'null'::jsonb) then raise exception 'Planung oder Nichtdurchführung darf keine tatsächlichen Mengen oder Durchführung enthalten.' using errcode='23514';end if;
 if e#>>'{intake,unit}'='percent' and(e#>>'{intake,actual}')::numeric>100 then raise exception 'Portionsanteil überschreitet 100 Prozent.' using errcode='23514';end if;
 if e#>>'{execution,outcome}'='refused' and(e#>>'{decision,state}' is distinct from 'refused' or length(btrim(coalesce(e#>>'{decision,reason}','')))<1 or length(btrim(coalesce(e#>>'{decision,consultation}','')))<3 or e#>>'{followUp,required}' is distinct from 'true') then raise exception 'Ablehnung benötigt Grund, Beratung und weiteres Vorgehen.' using errcode='23514';end if;
 if e#>>'{execution,outcome}' in('partial','not_performed') and length(btrim(coalesce(e#>>'{execution,deviation}','')))<3 then raise exception 'Konkrete Abweichung fehlt.' using errcode='23514';end if;
 if e#>>'{followUp,required}'='true' then
  if e#>>'{followUp,state}'='not_required' or care_private.nutrition_text(e#>'{followUp,reason}',3) is not true or e#>>'{followUp,responsibleProfileId}' is null or e#>>'{followUp,dueAt}' is null then raise exception 'Verantwortung, Anlass oder Frist fehlt.' using errcode='23514';end if;
  perform(e#>>'{followUp,responsibleProfileId}')::uuid;perform(e#>>'{followUp,dueAt}')::timestamptz;
  if e#>>'{followUp,state}'='closed' and(length(btrim(coalesce(e#>>'{followUp,closureEvidence}','')))<3 or not exists(select 1 from jsonb_array_elements(s->'tasks') task where task->>'id'=e#>>'{followUp,taskId}' and task->>'state'='completed' and task->>'dueAt'=e#>>'{followUp,dueAt}')) then raise exception 'Tatsächlich erledigtes Auftragsoriginal mit derselben Frist fehlt.' using errcode='23514';end if;
 else
  if e#>>'{followUp,state}' is distinct from 'not_required' or e#>>'{followUp,reason}' is distinct from '' or e#>>'{followUp,closureEvidence}' is distinct from '' or e#>'{followUp,responsibleProfileId}' is distinct from 'null'::jsonb or e#>'{followUp,dueAt}' is distinct from 'null'::jsonb or e#>'{followUp,taskId}' is distinct from 'null'::jsonb then raise exception 'Ohne Folgeauftrag dürfen keine Folgebelege entstehen.' using errcode='23514';end if;
 end if;
 if actual and e->>'kind' in('enteral_nutrition','catheter_care','stoma_care','tube_observation') and not exists(select 1 from jsonb_array_elements(s->'devices') d where d->>'id'=case when e->>'kind'='enteral_nutrition' then e#>>'{enteral,deviceId}' else e#>>'{device,deviceId}' end and d->>'status'='active') then raise exception 'Aktives Geräteoriginal fehlt.' using errcode='23514';end if;
 if e->>'kind' in('meal_support','drink_protocol') and actual and e#>'{intake,actual}'='null'::jsonb then raise exception 'Tatsächliche Aufnahme fehlt.' using errcode='23514';end if;
 if e->>'kind' in('enteral_nutrition','catheter_care','stoma_care','tube_observation','continence_support') and not exists(
  select 1 from jsonb_array_elements(s->'protocols') protocol where protocol->>'id'=case e->>'kind' when 'enteral_nutrition' then e#>>'{enteral,prescriptionId}' when 'continence_support' then e#>>'{elimination,profileId}' else e#>>'{device,changeBasisId}' end
  and protocol->>'kind'=case e->>'kind' when 'enteral_nutrition' then 'prescription' when 'continence_support' then 'continence_profile' else 'device_change_basis' end
 ) then raise exception 'Passende Verordnung, Wechselgrundlage oder Kontinenzprofil als Quelloriginal fehlt.' using errcode='23514';end if;
 if e->>'kind'='fluid_balance' and(e#>>'{elimination,unit}' is distinct from 'ml' or e#>'{elimination,input}'='null'::jsonb and e#>'{elimination,output}'='null'::jsonb or e#>>'{elimination,complete}' is distinct from 'false' or length(btrim(coalesce(e#>>'{elimination,observation}','')))<3) then raise exception 'Unvollständiger Mengenausschnitt fehlt.' using errcode='23514';end if;
end$$;

-- Immutable prepared journal schema; no native clinical tables are rewritten.
create table if not exists public.nutrition_elimination_plan_bindings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 plan_version_id uuid not null,measure_id uuid not null references public.care_plan_items(id),visit_id uuid not null references public.care_tour_stops(id),assessment_id uuid not null,
 kind text not null check(kind in('nutrition_assessment','meal_support','drink_protocol','swallowing_support','enteral_nutrition','fluid_balance','continence_support','stool_protocol','catheter_care','stoma_care','tube_observation','weight_followup')),
 title text not null check(btrim(title)<>''),planned_at timestamptz not null,plan_snapshot_sha256 text not null check(plan_snapshot_sha256~'^sha256:[0-9a-f]{64}$'),
 source_originals jsonb not null,plan_original jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(tenant_id,client_id,plan_version_id,measure_id,visit_id,kind)
);
create table if not exists public.nutrition_elimination_roots(id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),kind text not null,plan_binding_id uuid not null references public.nutrition_elimination_plan_bindings(id),created_at timestamptz not null,unique(id,tenant_id,client_id));
create table if not exists public.nutrition_elimination_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,root_id uuid not null,revision integer not null check(revision>0),previous_id uuid,request_id uuid not null,actor_id uuid not null references public.profiles(id),actor_name text not null check(btrim(actor_name)<>''),recorded_at timestamptz not null,reason text not null,payload jsonb not null,content_fingerprint text not null check(content_fingerprint~'^sha256:[0-9a-f]{64}$'),packet jsonb not null,
 unique(root_id,revision),unique(tenant_id,request_id),unique(id,root_id),foreign key(root_id,tenant_id,client_id) references public.nutrition_elimination_roots(id,tenant_id,client_id),foreign key(previous_id,root_id) references public.nutrition_elimination_events(id,root_id),check((revision=1)=(previous_id is null))
);
create table if not exists public.nutrition_elimination_receipts(request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,actor_id uuid not null,root_id uuid not null,event_id uuid not null,packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,foreign key(event_id,root_id) references public.nutrition_elimination_events(id,root_id));
create index if not exists nutrition_elimination_scope on public.nutrition_elimination_roots(tenant_id,client_id,created_at desc,id desc);
alter table public.nutrition_elimination_plan_bindings enable row level security;alter table public.nutrition_elimination_roots enable row level security;alter table public.nutrition_elimination_events enable row level security;alter table public.nutrition_elimination_receipts enable row level security;
revoke all on public.nutrition_elimination_plan_bindings,public.nutrition_elimination_roots,public.nutrition_elimination_events,public.nutrition_elimination_receipts from public,anon,authenticated;

create or replace function care_private.nutrition_elimination_original(root_ref uuid)
returns jsonb language sql security definer set search_path='' stable as $$select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,'kind',r.kind,'recordedAt',to_char(h.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',h.actor_id::text,'recordedByName',h.actor_name,'payload',h.payload,'contentFingerprint',h.content_fingerprint,'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',case when e.previous_id is null then null else e.previous_id::text end,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',e.actor_id::text,'recordedByName',e.actor_name,'reason',e.reason,'payload',e.payload,'contentFingerprint',e.content_fingerprint) order by e.revision) from public.nutrition_elimination_events e where e.root_id=r.id),'voided',false) from public.nutrition_elimination_roots r join lateral(select e.* from public.nutrition_elimination_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref$$;

-- Retained review schema; new clinical decisions remain blocked below.
-- No production execution or automatic qualification/clinical acceptance.
-- A privileged, separately approved scope is necessary; a generic valid qualification is insufficient.
create schema if not exists care_private;
create table if not exists care_private.nutrition_review_scopes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 employee_id uuid not null references public.employees(id),qualification_id uuid not null references public.employee_qualifications(id),
 kind text not null check(kind in('nutrition_assessment','meal_support','drink_protocol','swallowing_support','enteral_nutrition','fluid_balance','continence_support','stool_protocol','catheter_care','stoma_care','tube_observation','weight_followup')),
 qualification_fingerprint text not null check(qualification_fingerprint~'^sha256:[0-9a-f]{64}$'),
 document_fingerprint text not null check(document_fingerprint~'^sha256:[0-9a-f]{64}$'),
 approved_by uuid not null references public.profiles(id),approved_at timestamptz not null,
 valid_until timestamptz not null,revoked_at timestamptz,check(valid_until>approved_at)
);
create table if not exists public.nutrition_review_roots(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,care_root_id uuid not null,care_head_id uuid not null,
 care_fingerprint text not null,care_kind text not null,created_at timestamptz not null,
 unique(id,tenant_id,client_id),unique(tenant_id,client_id,care_head_id),
 foreign key(care_root_id,tenant_id,client_id) references public.nutrition_elimination_roots(id,tenant_id,client_id),
 foreign key(care_head_id,care_root_id) references public.nutrition_elimination_events(id,root_id)
);
create table if not exists public.nutrition_review_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,root_id uuid not null,
 revision integer not null check(revision in(1,2)),previous_id uuid,request_id uuid not null unique,
 action text not null check(action in('request','return','accept')),actor_id uuid not null references public.profiles(id),actor_name text not null,
 recorded_at timestamptz not null,reason text not null,required_change text not null,rationale text not null,
 care_head_id uuid not null,care_fingerprint text not null,qualification_original jsonb,fingerprint text not null,packet jsonb not null,
 unique(root_id,revision),unique(id,root_id),foreign key(root_id,tenant_id,client_id) references public.nutrition_review_roots(id,tenant_id,client_id),
 foreign key(previous_id,root_id) references public.nutrition_review_events(id,root_id),
 check((revision=1)=(previous_id is null)),check((action='request')=(revision=1)),check((action='request')=(qualification_original is null))
);
create table if not exists public.nutrition_review_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,actor_id uuid not null,
 root_id uuid not null,event_id uuid not null,packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,
 foreign key(event_id,root_id) references public.nutrition_review_events(id,root_id)
);
create index if not exists nutrition_review_scope on public.nutrition_review_roots(tenant_id,client_id,created_at desc,id desc);
alter table care_private.nutrition_review_scopes enable row level security;
alter table public.nutrition_review_roots enable row level security;
alter table public.nutrition_review_events enable row level security;
alter table public.nutrition_review_receipts enable row level security;
revoke all on care_private.nutrition_review_scopes,public.nutrition_review_roots,public.nutrition_review_events,public.nutrition_review_receipts from public,anon,authenticated;

create or replace function care_private.nutrition_immutable()
returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Originale und Quittungen sind unveränderlich.' using errcode='23514';end$$;
do $$declare tab text;begin
 foreach tab in array array['nutrition_elimination_roots','nutrition_elimination_events','nutrition_elimination_receipts','nutrition_review_roots','nutrition_review_events','nutrition_review_receipts'] loop
  execute format('drop trigger if exists nutrition_immutable on public.%I',tab);
  execute format('create trigger nutrition_immutable before update or delete on public.%I for each row execute function care_private.nutrition_immutable()',tab);
 end loop;
end$$;

create or replace function care_private.nutrition_review_original(root_ref uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',h.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'rootId',r.id::text,'headId',h.id::text,'revision',h.revision,
 'careRootId',r.care_root_id::text,'careHeadId',r.care_head_id::text,'careFingerprint',r.care_fingerprint,'careKind',r.care_kind,
 'status',case h.action when 'request' then 'requested' when 'return' then 'returned' else 'accepted' end,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id::text,'revision',e.revision,'previousId',e.previous_id::text,'requestId',e.request_id::text,
 'action',e.action,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id::text,'actorName',e.actor_name,
 'reason',e.reason,'requiredChange',e.required_change,'rationale',e.rationale,'careHeadId',e.care_head_id::text,'careFingerprint',e.care_fingerprint,
 'qualification',e.qualification_original,'fingerprint',e.fingerprint) order by e.revision) from public.nutrition_review_events e where e.root_id=r.id))
 from public.nutrition_review_roots r join lateral(select e.* from public.nutrition_review_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;

-- Quarantined technical capture uses explicit table SHARE locks to cover legacy insert phantoms.
-- This does not authorize legacy clinical execution; it briefly serializes the full native source read.
create or replace function care_private.nutrition_lock_native_sources()
returns void language plpgsql security definer set search_path='' as $$begin
 lock table public.care_plans,public.care_plan_versions,public.care_plan_items,
 public.care_tours,public.care_tour_stops,public.care_assessments,public.care_assessment_topics,
 public.care_assessment_risks,public.care_assessment_measures,care_private.assessment_instrument_selections,
 care_private.assessment_models,care_private.assessment_instruments,public.care_protocol_roots,
 public.care_protocol_events,public.vital_sign_measurements,public.vital_measurement_invalidations,
 public.care_operations_tasks,public.profiles in share mode;
end$$;

-- Final bounded implementation. Exact own profile/session, never a linked profile's role.
create or replace function care_private.nutrition_elimination_actor(requested_tenant uuid,requested_client uuid,requested_actor uuid,write_access boolean)
returns uuid language plpgsql security definer set search_path='' as $$begin
 if requested_tenant is null or requested_client is null or requested_actor is null or requested_tenant is distinct from public.current_tenant_id() or requested_actor is distinct from public.resolve_current_profile_id() then raise exception 'Eigener Ernährungsbereich ist nicht bestätigt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('nutrition-client:'||requested_tenant::text||':'||requested_client::text,0));
 perform care_private.require_workspace_session(requested_tenant,requested_actor);
 if care_private.nutrition_own_permission('pflege.plans.view') is not true or care_private.nutrition_own_permission('pflege.documentation.view') is not true or care_private.nutrition_own_permission('pflege.vitals.view') is not true or(write_access and care_private.nutrition_own_permission('pflege.documentation.create') is not true) then raise exception 'Eigene aktuelle Quellen-/Dokumentationsrechte fehlen.' using errcode='42501';end if;
 perform 1 from public.clients c where c.id=requested_client and c.tenant_id=requested_tenant and c.status::text in('active','aktiv') and c.lifecycle_status::text in('active','aktiv') and to_jsonb(c)->>'deleted_at' is null and to_jsonb(c)->>'archived_at' is null for share;
 if not found then raise exception 'Aktiver eigener Pflegefall fehlt.' using errcode='42501';end if;
 perform 1 from public.client_module_assignments a where a.tenant_id=requested_tenant and a.client_id=requested_client and a.module_key='pflege' and a.is_active and a.status in('active','aktiv') for share;
 if not found then raise exception 'Aktuelle eigene Pflegezuordnung fehlt.' using errcode='42501';end if;
 perform care_private.nutrition_lock_native_sources();
 perform care_private.require_workspace_session(requested_tenant,requested_actor);
 return requested_actor;
end$$;

create table if not exists care_private.nutrition_binding_captures(
 tenant_id uuid not null,client_id uuid not null,actor_id uuid not null,auth_user_id uuid not null,request_id uuid not null,binding_id uuid not null references public.nutrition_elimination_plan_bindings(id),packet jsonb not null,native_originals jsonb not null,original jsonb not null,recorded_at timestamptz not null,
 primary key(tenant_id,request_id),unique(binding_id)
);
alter table care_private.nutrition_binding_captures enable row level security;
revoke all on care_private.nutrition_binding_captures from public,anon,authenticated,service_role;
-- Preserve unknown historical ownership; no backfill from today's profile-to-account link.
alter table public.nutrition_elimination_receipts add column if not exists auth_user_id uuid;
alter table public.nutrition_review_receipts add column if not exists auth_user_id uuid;

create or replace function care_private.nutrition_native_foundation(t uuid,c uuid,pv uuid,mi uuid,vi uuid,ai uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.care_plans%rowtype;v public.care_plan_versions%rowtype;m public.care_plan_items%rowtype;s public.care_tour_stops%rowtype;tr public.care_tours%rowtype;a public.care_assessments%rowtype;items jsonb;selection jsonb;model jsonb;instruments jsonb;
begin
 select * into v from public.care_plan_versions x where x.id=pv and x.tenant_id=t for share;
 select * into p from public.care_plans x where x.id=v.care_plan_id and x.tenant_id=t and x.client_id=c for share;
 select * into m from public.care_plan_items x where x.id=mi and x.tenant_id=t and x.care_plan_id=p.id for share;
 select * into s from public.care_tour_stops x where x.id=vi and x.tenant_id=t and x.client_id=c for share;
 select * into tr from public.care_tours x where x.id=s.tour_id and x.tenant_id=t for share;
 select * into a from public.care_assessments x where x.id=ai and x.tenant_id=t and x.subject_type='client' and x.subject_id=c and x.variant='ambulant' for share;
 if v.id is null or p.id is null or m.id is null or s.id is null or tr.id is null or a.id is null then raise exception 'Vollständige eigene native Plan-/Maßnahmen-/Besuchs-/Assessmentbindung fehlt.' using errcode='42501';end if;
 perform care_private.nutrition_require(p.status in('active','aktiv') and m.status::text='active' and s.status='planned' and tr.status in('draft','published') and a.status in('draft','in_progress','professional_review','approved'),'Native Grundlage ist nicht aktuell planbar.');
 perform care_private.nutrition_require(not exists(select 1 from public.care_plan_versions x where x.tenant_id=t and x.care_plan_id=p.id and x.version>v.version),'Eine neuere native Planfassung liegt vor.');
 perform 1 from public.care_plan_items x where x.tenant_id=t and x.care_plan_id=p.id for share;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into items from public.care_plan_items x where x.tenant_id=t and x.care_plan_id=p.id;
 perform care_private.nutrition_require(jsonb_typeof(v.snapshot->'plan')='object' and jsonb_typeof(v.snapshot->'items')='array','Native Planfassung enthält keinen vollständigen Snapshot.');
 perform care_private.nutrition_require(v.snapshot->'plan'=to_jsonb(p) and(select coalesce(jsonb_agg(x order by x->>'id'),'[]'::jsonb) from jsonb_array_elements(v.snapshot->'items') x)=items,'Native Planfassung, vollständige Maßnahmensammlung oder unveränderte Planzeile stimmen nicht überein.');
 perform 1 from public.care_assessment_topics x where x.tenant_id=t and x.assessment_id=a.id for share;
 perform 1 from public.care_assessment_risks x where x.tenant_id=t and x.assessment_id=a.id for share;
 perform 1 from public.care_assessment_measures x where x.tenant_id=t and x.assessment_id=a.id for share;
 perform 1 from care_private.assessment_instrument_selections x where x.tenant_id=t and x.assessment_id=a.id for share;
 select to_jsonb(x) into selection from care_private.assessment_instrument_selections x where x.tenant_id=t and x.assessment_id=a.id and x.subject_id=c;
 if selection is not null then
  perform 1 from care_private.assessment_models x where x.model_key=selection->>'model_key' for share;
  select to_jsonb(x) into model from care_private.assessment_models x where x.model_key=selection->>'model_key';
  perform 1 from care_private.assessment_instruments x where x.id in(select value::uuid from jsonb_array_elements_text(selection->'selected_instrument_ids')) for share;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into instruments from care_private.assessment_instruments x where x.id in(select value::uuid from jsonb_array_elements_text(selection->'selected_instrument_ids'));
 else instruments:='[]'::jsonb;end if;
 return jsonb_build_object('plan',to_jsonb(p),'planVersion',to_jsonb(v),'measure',to_jsonb(m),'visit',to_jsonb(s),'tour',to_jsonb(tr),'assessment',to_jsonb(a),
 'assessmentTopics',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.care_assessment_topics x where x.tenant_id=t and x.assessment_id=a.id),
 'assessmentRisks',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.care_assessment_risks x where x.tenant_id=t and x.assessment_id=a.id),
 'assessmentMeasures',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.care_assessment_measures x where x.tenant_id=t and x.assessment_id=a.id),
 'instrumentSelection',selection,'model',model,'instruments',instruments);
end$$;

-- These are native source references, not assertions that the new G entry was performed.
-- The assessment fingerprint covers the complete source bundle, including unknown/invalidated rows.
create or replace function care_private.nutrition_native_sources(t uuid,c uuid,ai uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.care_assessments%rowtype;bundle jsonb;result jsonb;instrument text;all_refs jsonb;ref jsonb;
begin
 select * into a from public.care_assessments x where x.id=ai and x.tenant_id=t and x.subject_type='client' and x.subject_id=c for share;
 perform care_private.nutrition_require(a.id is not null and a.version>0 and length(btrim(a.schema_version))>0,'Assessmentoriginal ohne bekannte Modell-/Schemafassung.');
 perform 1 from public.care_protocol_roots x where x.tenant_id=t and x.client_id=c for share;
 perform 1 from public.care_protocol_events x where x.tenant_id=t and x.client_id=c for share;
 perform 1 from public.vital_sign_measurements x where x.tenant_id=t and x.client_id=c and x.vital_key='weight' for share;
 perform 1 from public.vital_measurement_invalidations x where x.tenant_id=t and x.client_id=c for share;
 perform 1 from public.care_operations_tasks x where x.tenant_id=t and x.client_id=c for share;
 bundle:=jsonb_build_object('assessment',to_jsonb(a),
 'topics',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.care_assessment_topics x where x.tenant_id=t and x.assessment_id=ai),
 'risks',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.care_assessment_risks x where x.tenant_id=t and x.assessment_id=ai),
 'measures',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.care_assessment_measures x where x.tenant_id=t and x.assessment_id=ai),
 'selection',(select to_jsonb(x) from care_private.assessment_instrument_selections x where x.tenant_id=t and x.assessment_id=ai),
 'protocolRoots',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.care_protocol_roots x where x.tenant_id=t and x.client_id=c),
 'protocolEvents',(select coalesce(jsonb_agg(to_jsonb(x) order by x.root_id,x.sequence),'[]'::jsonb) from public.care_protocol_events x where x.tenant_id=t and x.client_id=c),
 'weights',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.vital_sign_measurements x where x.tenant_id=t and x.client_id=c and x.vital_key='weight'),
 'invalidations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.vital_measurement_invalidations x where x.tenant_id=t and x.client_id=c),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.care_operations_tasks x where x.tenant_id=t and x.client_id=c));
 select case when count(*)=1 then min(i.instrument_version) else null end into instrument from care_private.assessment_instrument_selections s join care_private.assessment_instruments i on i.id=any(s.selected_instrument_ids) where s.tenant_id=t and s.assessment_id=ai;
 select jsonb_build_object('assessment',jsonb_build_object('id',a.id,'revision',a.version,'recordedAt',to_char(a.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.nutrition_fingerprint(bundle),'modelVersion',a.schema_version,'instrumentVersion',instrument),
 'protocols',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'revision',h.sequence,'recordedAt',to_char(h.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.nutrition_fingerprint(jsonb_build_object('root',to_jsonb(r),'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.sequence),'[]'::jsonb) from public.care_protocol_events e where e.root_id=r.id and e.tenant_id=t and e.client_id=c))),'kind',r.kind) order by r.id) from public.care_protocol_roots r join lateral(select x.sequence,x.recorded_at from public.care_protocol_events x where x.root_id=r.id and x.tenant_id=t and x.client_id=c order by x.sequence desc limit 1) h on true where r.tenant_id=t and r.client_id=c),'[]'::jsonb),
 'weights',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'revision',1,'recordedAt',to_char(m.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.nutrition_fingerprint(to_jsonb(m)),'measuredAt',to_char(m.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'value',case when m.values->>'value'~'^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$' then m.values->>'value' else null end,'unit',m.unit,'conditions',m.context::text) order by m.id) from public.vital_sign_measurements m where m.tenant_id=t and m.client_id=c and m.vital_key='weight' and m.unit='kg' and m.occurred_at is not null and isfinite(m.occurred_at) and m.occurred_at<=clock_timestamp() and jsonb_typeof(m.context)='object' and m.context<>'{}'::jsonb and not exists(select 1 from public.vital_measurement_invalidations i where i.tenant_id=t and i.client_id=c and i.measurement_id=m.id)),'[]'::jsonb),
 'devices','[]'::jsonb,'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'revision',1,'recordedAt',to_char(x.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.nutrition_fingerprint(to_jsonb(x)),'state',x.status,'dueAt',null) order by x.id) from public.care_operations_tasks x where x.tenant_id=t and x.client_id=c),'[]'::jsonb)) into result;
 perform care_private.nutrition_require(octet_length(bundle::text)<=2097152 and jsonb_array_length(result->'protocols')+jsonb_array_length(result->'weights')+jsonb_array_length(result->'tasks')<=2000,'Native Quellen überschreiten den vollständig lesbaren Rahmen.');
 -- Reject unrepresentable native facts; never truncate, invent a version, or substitute a capture time.
 perform care_private.nutrition_require(care_private.nutrition_uuid(result#>'{assessment,id}') and care_private.nutrition_text(result#>'{assessment,modelVersion}',1) and(result#>'{assessment,instrumentVersion}'='null'::jsonb or care_private.nutrition_text(result#>'{assessment,instrumentVersion}',1)),'Assessmentfassung überschreitet den unverändert lesbaren Quellenvertrag.');
 perform care_private.nutrition_time(result#>'{assessment,recordedAt}');
 all_refs:=(result->'protocols')||(result->'weights')||(result->'tasks');
 perform care_private.nutrition_require((select count(distinct x->>'id') from jsonb_array_elements(all_refs) x)=jsonb_array_length(all_refs),'Quellenkennungen sind über die nativen Familien nicht eindeutig.');
 for ref in select value from jsonb_array_elements(all_refs) loop
  perform care_private.nutrition_require(care_private.nutrition_uuid(ref->'id') and jsonb_typeof(ref->'revision')='number' and(ref->>'revision')~'^[1-9][0-9]{0,15}$' and(ref->>'revision')::numeric<=9007199254740991,'Native Quellenkennung oder Quellenrevision ist nicht exakt lesbar.');
  perform care_private.nutrition_time(ref->'recordedAt');
 end loop;
 for ref in select value from jsonb_array_elements(result->'protocols') loop perform care_private.nutrition_require(care_private.nutrition_text(ref->'kind',1),'Ursprüngliche Protokollart ist nicht unverändert lesbar.');end loop;
 for ref in select value from jsonb_array_elements(result->'weights') loop perform care_private.nutrition_require(care_private.nutrition_text(ref->'unit',1) and care_private.nutrition_text(ref->'conditions',1),'Ursprüngliche Gewichtseinheit oder Messbedingungen sind nicht unverändert lesbar.');perform care_private.nutrition_time(ref->'measuredAt');end loop;
 for ref in select value from jsonb_array_elements(result->'tasks') loop perform care_private.nutrition_require(care_private.nutrition_text(ref->'state',1),'Ursprünglicher Auftragsstatus ist nicht unverändert lesbar.');end loop;
 return result;
end$$;

create or replace function care_private.nutrition_binding_context(t uuid,c uuid,actor uuid,pv uuid,mi uuid,vi uuid,ai uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare native jsonb;sources jsonb;before_state text;begin
 perform care_private.nutrition_elimination_actor(t,c,actor,false);
 before_state:=care_private.nutrition_state_fingerprint(t,c);
 native:=care_private.nutrition_native_foundation(t,c,pv,mi,vi,ai);sources:=care_private.nutrition_native_sources(t,c,ai);
 perform care_private.nutrition_require(octet_length(native::text)<=2097152,'Native Plan-/Assessmentoriginale überschreiten den vollständig lesbaren Rahmen.');
 perform care_private.nutrition_elimination_actor(t,c,actor,false);
 perform care_private.nutrition_require(before_state=care_private.nutrition_state_fingerprint(t,c),'Vollständiger nativer Bestand wurde während des Quellenlesens geändert.');
 return jsonb_build_object('nativeOriginals',native,'sources',sources,'planSnapshotSha256',care_private.nutrition_fingerprint(native),
 'blockedReasons',jsonb_build_array('actual_execution_provenance_unbound','native_device_and_continence_sources_unavailable','legacy_clinical_writers_not_closed','date_only_task_deadlines_are_not_instants'));
end$$;

create or replace function care_private.capture_nutrition_plan_binding(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;pv uuid:=(p->>'planVersionId')::uuid;mi uuid:=(p->>'measureId')::uuid;vi uuid:=(p->>'visitId')::uuid;ai uuid:=(p->>'assessmentId')::uuid;context jsonb;native jsonb;sources jsonb;planned timestamptz;local_time timestamp;existing care_private.nutrition_binding_captures%rowtype;b public.nutrition_elimination_plan_bindings%rowtype;binding jsonb;recorded timestamptz;
begin
 perform care_private.nutrition_elimination_actor(t,c,actor,true);
 if care_private.nutrition_own_permission('pflege.plans.manage') is not true then raise exception 'Eigene technische Planbindung darf nicht erfasst werden.' using errcode='42501';end if;
 perform care_private.nutrition_require(care_private.nutrition_fields(p,array['schemaVersion','requestId','tenantId','clientId','actorId','planVersionId','measureId','visitId','assessmentId','kind','title','plannedAt','nativeOriginals','sources']) and p->'schemaVersion'='"1"'::jsonb,'Vollständiges unverändertes Bindungspaket fehlt.');
 perform care_private.nutrition_require(care_private.nutrition_uuid(p->'requestId') and care_private.nutrition_uuid(p->'planVersionId') and care_private.nutrition_uuid(p->'measureId') and care_private.nutrition_uuid(p->'visitId') and care_private.nutrition_uuid(p->'assessmentId') and care_private.nutrition_text(p->'title',3,300),'Bindungskennungen und ursprünglicher Titel fehlen.');
 if p->>'kind' not in('nutrition_assessment','meal_support','drink_protocol','swallowing_support','stool_protocol','weight_followup') or p->>'kind' is null then raise exception 'Für diese Vorgangsart fehlen die unabhängig gebundenen nativen Voraussetzungen.' using errcode='42501';end if;
 select * into existing from care_private.nutrition_binding_captures x where x.tenant_id=t and x.request_id=req;
 if existing.request_id is not null then
  if existing.auth_user_id is distinct from auth.uid() then raise exception 'Ursprüngliches eigenes Konto des Auftrags ist nicht bestätigt.' using errcode='42501';end if;
  if existing.client_id<>c or existing.actor_id<>actor or existing.packet is distinct from p then raise exception 'Anfragekennung wurde mit einer anderen Planbindung verwendet.' using errcode='40001';end if;
  return existing.original;
 end if;
 begin context:=care_private.nutrition_binding_context(t,c,actor,pv,mi,vi,ai);exception when sqlstate '23514' or sqlstate '42501' then raise exception 'Ausgewählte native Originale sind nicht mehr unverändert zugänglich.' using errcode='40001';end;
 native:=context->'nativeOriginals';sources:=context->'sources';
 if p->'nativeOriginals' is distinct from native or p->'sources' is distinct from sources then raise exception 'Vollständige native Plan-/Assessment-/Quelloriginale wurden geändert.' using errcode='40001';end if;
 planned:=care_private.nutrition_time(p->'plannedAt');local_time:=planned at time zone 'Europe/Berlin';
 perform care_private.nutrition_require(p->>'kind'=native#>>'{measure,category}' and p->>'title'=native#>>'{measure,title}' and local_time::date=(native#>>'{tour,tour_date}')::date and local_time::time>=(native#>>'{visit,planned_start}')::time and local_time::time<(native#>>'{visit,planned_end}')::time and local_time::date>=(native#>>'{plan,valid_from}')::date and(native#>>'{plan,valid_until}' is null or local_time::date<=(native#>>'{plan,valid_until}')::date),'Vorgangsart, ausdrücklicher Zeitpunkt oder Titel passen nicht zur nativen Maßnahme und zum Besuchsfenster.');
 select * into b from public.nutrition_elimination_plan_bindings x where x.tenant_id=t and x.client_id=c and x.plan_version_id=pv and x.measure_id=mi and x.visit_id=vi and x.kind=p->>'kind';
 if b.id is not null then raise exception 'Eine ursprüngliche Bindung für diese Planfassung und diesen Besuch besteht bereits; ursprünglichen Auftrag bestätigen.' using errcode='40001';end if;
 if care_private.nutrition_native_foundation(t,c,pv,mi,vi,ai) is distinct from native or care_private.nutrition_native_sources(t,c,ai) is distinct from sources then raise exception 'Native Originale wurden vor der Erfassung geändert.' using errcode='40001';end if;
 perform care_private.nutrition_elimination_actor(t,c,actor,true);recorded:=clock_timestamp();
 insert into public.nutrition_elimination_plan_bindings(tenant_id,client_id,plan_version_id,measure_id,visit_id,assessment_id,kind,title,planned_at,plan_snapshot_sha256,source_originals,plan_original,created_at)
 values(t,c,pv,mi,vi,ai,p->>'kind',p->>'title',planned,context->>'planSnapshotSha256',sources,native,recorded) returning * into b;
 binding:=jsonb_build_object('id',b.id,'tenantId',t,'clientId',c,'planVersionId',pv,'measureId',mi,'visitId',vi,'assessmentId',ai,'planSnapshotSha256',b.plan_snapshot_sha256,'kind',b.kind,'title',b.title,'plannedAt',to_char(planned at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sources',sources,'nativeOriginals',native,'capturedBy',actor,'capturedAt',to_char(recorded at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
 context:=jsonb_build_object('requestId',req,'packet',p,'binding',binding);
 insert into care_private.nutrition_binding_captures(tenant_id,client_id,actor_id,auth_user_id,request_id,binding_id,packet,native_originals,original,recorded_at)values(t,c,actor,auth.uid(),req,b.id,p,native,context,recorded);
 return context;
end$$;

create or replace function care_private.confirm_nutrition_plan_binding(t uuid,c uuid,actor uuid,req uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r care_private.nutrition_binding_captures%rowtype;begin
 perform care_private.nutrition_elimination_actor(t,c,actor,false);
 select * into r from care_private.nutrition_binding_captures x where x.tenant_id=t and x.client_id=c and x.actor_id=actor and x.request_id=req;
 if r.request_id is null or r.auth_user_id is distinct from auth.uid() or r.packet is distinct from p then raise exception 'Passende ursprüngliche Bindungsquittung fehlt.' using errcode='P0G02';end if;
 perform care_private.nutrition_elimination_actor(t,c,actor,false);
 return r.original;
end$$;

create or replace function care_private.nutrition_validate_planned(e jsonb,s jsonb,t uuid,c uuid)
returns void language plpgsql security definer set search_path='' as $$declare part record;v jsonb;profile_ref text;begin
 perform care_private.nutrition_require(care_private.nutrition_fields(e,array['kind','title','plannedAt','occurredAt','planVersionId','measureId','visitId','assessmentId','planSnapshotSha256','decision','assistance','intake','elimination','swallowing','enteral','device','weight','execution','followUp','lifecycle']),'Vollständige Eintragsfelder fehlen.');
 if e#>>'{execution,outcome}' is distinct from 'planned' or e->>'lifecycle' is distinct from 'open' then raise exception 'Tatsächliche Durchführung, Mengenbilanz und klinischer Abschluss sind ohne unabhängig gebundene native Ereignis-/Qualitäts-/Einwilligungsbelege gesperrt.' using errcode='42501';end if;
 if e->>'kind' not in('nutrition_assessment','meal_support','drink_protocol','swallowing_support','stool_protocol','weight_followup') or e->>'kind' is null then raise exception 'Geräte-, Kontinenz- oder tatsächliche Bilanzgrundlagen fehlen.' using errcode='42501';end if;
 for part in select key,value from jsonb_each('{
 "decision":["state","recordedAt","reason","consultation"],"assistance":["level","helpers","aids","details"],"intake":["offered","actual","unit","item","dietForm","target","targetUnit"],
 "elimination":["input","output","unit","complete","profileId","support","stool","observation"],"swallowing":["approvedDiet","instruction","deviation","escalation"],
 "enteral":["deviceId","prescriptionId","product","amount","unit","durationMinutes","flushMl","positionCheck","skin","tolerance"],
 "device":["deviceId","changeBasisId","type","materialChange","skin","positionCheck","output","complication"],
 "weight":["value","unit","measurementId","instrumentVersion","conditions","professionalAssessment","reaction","reviewAt"],
 "execution":["outcome","performedBy","result","deviation"],"followUp":["required","reason","responsibleProfileId","dueAt","taskId","state","closureEvidence"]}'::jsonb) loop
  perform care_private.nutrition_require(care_private.nutrition_fields(e->part.key,array(select jsonb_array_elements_text(part.value))),'Eintragsabschnitt ist nicht vollständig und ausdrücklich gebunden.');
 end loop;
 perform care_private.validate_nutrition_entry(e,s);
 perform care_private.nutrition_require(care_private.nutrition_text(e->'title',3,300) and e->'occurredAt'='null'::jsonb and e#>>'{decision,state}'='not_asked' and e#>'{decision,recordedAt}'='null'::jsonb and e#>'{execution,performedBy}'='[]'::jsonb and e#>>'{execution,result}'='' and e#>'{intake,offered}'='null'::jsonb and e#>'{intake,actual}'='null'::jsonb and e#>'{elimination,input}'='null'::jsonb and e#>'{elimination,output}'='null'::jsonb and e#>'{elimination,complete}'='false'::jsonb and e#>'{elimination,profileId}'='null'::jsonb,'Geplanter Eintrag darf keine tatsächliche Entscheidung, Aufnahme, Ausfuhr oder Durchführung enthalten.');
 perform care_private.nutrition_require(e->'enteral'='{"deviceId":null,"prescriptionId":null,"product":"","amount":null,"unit":"none","durationMinutes":null,"flushMl":null,"positionCheck":"","skin":"","tolerance":""}'::jsonb and e->'device'='{"deviceId":null,"changeBasisId":null,"type":"none","materialChange":"","skin":"","positionCheck":"","output":"","complication":""}'::jsonb,'Nicht belegte Geräte- oder enterale Angaben dürfen nicht als Original entstehen.');
 foreach profile_ref in array array['decision.reason','decision.consultation','assistance.details','intake.item','intake.dietForm','elimination.support','elimination.stool','elimination.observation','swallowing.approvedDiet','swallowing.instruction','swallowing.deviation','swallowing.escalation','weight.instrumentVersion','weight.conditions','weight.professionalAssessment','weight.reaction','execution.deviation','followUp.reason','followUp.closureEvidence'] loop
  perform care_private.nutrition_require(care_private.nutrition_text(e#>string_to_array(profile_ref,'.'),0,8000),'Erzählung fehlt oder besitzt keinen unveränderten Textwert.');
 end loop;
 perform care_private.nutrition_require(jsonb_typeof(e#>'{assistance,aids}')='array' and jsonb_array_length(e#>'{assistance,aids}')<=100,'Hilfsmittelliste fehlt oder ist zu umfangreich.');
 for v in select value from jsonb_array_elements(e#>'{assistance,aids}') value loop perform care_private.nutrition_require(care_private.nutrition_text(v,1,500),'Hilfsmittelbezeichnung fehlt.');end loop;
 if e#>>'{assistance,level}'<>'independent' then perform care_private.nutrition_require(care_private.nutrition_text(e#>'{assistance,details}',3),'Geplanter Hilfeumfang ist nicht erläutert.');end if;
 for profile_ref in select value from jsonb_array_elements_text(e#>'{assistance,helpers}') value union select e#>>'{followUp,responsibleProfileId}' where e#>>'{followUp,responsibleProfileId}' is not null loop
  perform 1 from public.profiles p where p.id=profile_ref::uuid and p.tenant_id=t and p.is_active and p.status='active' for share;
  if not found then raise exception 'Geplante eigene aktive Verantwortung fehlt.' using errcode='42501';end if;
 end loop;
 if e->>'kind' in('meal_support','drink_protocol') then perform care_private.nutrition_require(care_private.nutrition_text(e#>'{intake,item}',1) and((e#>'{intake,target}'='null'::jsonb and e#>>'{intake,targetUnit}'='none')or(e#>'{intake,target}'<>'null'::jsonb and e#>>'{intake,targetUnit}' in('g','ml'))),'Geplanter Gegenstand oder ausdrückliche Zieleinheit fehlt.');end if;
 if e->>'kind' in('nutrition_assessment','weight_followup') then perform care_private.nutrition_require(care_private.nutrition_text(s#>'{assessment,instrumentVersion}',1) and e#>'{weight,instrumentVersion}'=s#>'{assessment,instrumentVersion}','Ausdrücklich ausgewählte native Assessmentinstrumentfassung fehlt oder wurde ersetzt.');end if;
 if e->>'kind'='nutrition_assessment' then perform care_private.nutrition_require(care_private.nutrition_text(e#>'{weight,instrumentVersion}',1) and care_private.nutrition_text(e#>'{weight,professionalAssessment}',3),'Geplante Assessmentfassung und Begründung fehlen.');end if;
 if e->>'kind'='swallowing_support' then perform care_private.nutrition_require(care_private.nutrition_text(e#>'{swallowing,approvedDiet}',1) and care_private.nutrition_text(e#>'{swallowing,instruction}',3) and(e#>>'{swallowing,deviation}'='' or(care_private.nutrition_text(e#>'{swallowing,escalation}',3) and e#>'{followUp,required}'='true'::jsonb)),'Geplante Kostform/Anweisung oder sichtbarer Folgeweg fehlt.');end if;
 if e->>'kind'='stool_protocol' then perform care_private.nutrition_require(care_private.nutrition_text(e#>'{elimination,stool}',1) and care_private.nutrition_text(e#>'{elimination,observation}',1),'Geplante Stuhldokumentation benötigt ihren ausdrücklichen Inhalt.');end if;
 if e->>'kind'='weight_followup' then
  perform care_private.nutrition_require(care_private.nutrition_uuid(e#>'{weight,measurementId}') and e#>'{weight,value}'<>'null'::jsonb and e#>>'{weight,unit}'='kg' and care_private.nutrition_text(e#>'{weight,instrumentVersion}',1) and care_private.nutrition_text(e#>'{weight,conditions}',1) and care_private.nutrition_text(e#>'{weight,professionalAssessment}',3) and care_private.nutrition_text(e#>'{weight,reaction}',3),'Geplanter Gewichtsfolgebezug ist unvollständig.');
  perform care_private.nutrition_time(e#>'{weight,reviewAt}');
 end if;
 if e#>'{weight,value}'='null'::jsonb then perform care_private.nutrition_require(e#>'{weight,measurementId}'='null'::jsonb,'Fehlender Gewichtswert darf keine Messung vortäuschen.');
 else
  perform care_private.nutrition_require(e#>>'{weight,unit}'='kg' and exists(select 1 from jsonb_array_elements(s->'weights') x where x->'id'=e#>'{weight,measurementId}' and x->'value'=e#>'{weight,value}' and x->'unit'=e#>'{weight,unit}' and x->'conditions'=e#>'{weight,conditions}' and care_private.nutrition_time(x->'measuredAt')<=care_private.nutrition_time(e->'plannedAt')),'Gewichtsbezug ist nicht exakt an ein früheres tatsächliches Original gebunden.');
 end if;
 if e#>'{followUp,required}'='true'::jsonb then perform care_private.nutrition_time(e#>'{followUp,dueAt}');perform care_private.nutrition_require(care_private.nutrition_text(e#>'{followUp,reason}',3) and e#>>'{followUp,state}'='open' and e#>'{followUp,taskId}'='null'::jsonb and e#>>'{followUp,closureEvidence}'='','Ein geplanter Folgeauftrag darf keine tatsächliche Erledigung behaupten.');end if;
end$$;

create or replace function care_private.commit_nutrition_elimination_packet(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;event_ref uuid:=gen_random_uuid();root_ref uuid;expected integer;prior public.nutrition_elimination_events%rowtype;b public.nutrition_elimination_plan_bindings%rowtype;captured care_private.nutrition_binding_captures%rowtype;r public.nutrition_elimination_receipts%rowtype;native jsonb;sources jsonb;original jsonb;recorded timestamptz;name text;
begin
 perform care_private.nutrition_elimination_actor(t,c,actor,true);
 perform care_private.nutrition_require(care_private.nutrition_fields(p,array['schemaVersion','action','requestId','tenantId','clientId','actorId','expectedHeadId','expectedRevision','entry','reason','original','sources']) and p->'schemaVersion'='"1"'::jsonb and p->>'action' in('create','revise') and care_private.nutrition_uuid(p->'requestId') and jsonb_typeof(p->'expectedRevision')='number' and(p->>'expectedRevision')~'^(0|[1-9][0-9]{0,3})$' and care_private.nutrition_text(p->'reason',0,2000),'Vollständiges ursprüngliches G-Paket fehlt.');
 expected:=(p->>'expectedRevision')::integer;perform care_private.nutrition_require(expected<2000,'Historienrahmen ist ausgeschöpft.');
 select * into r from public.nutrition_elimination_receipts x where x.tenant_id=t and x.request_id=req;
 if r.request_id is not null then
  if r.auth_user_id is distinct from auth.uid() then raise exception 'Ursprüngliches eigenes Konto des Auftrags ist nicht bestätigt.' using errcode='42501';end if;
  if r.client_id<>c or r.actor_id<>actor or r.packet is distinct from p then raise exception 'Anfragekennung wurde anders verwendet.' using errcode='40001';end if;
  return jsonb_build_object('requestId',req,'packet',r.packet,'original',r.original);
 end if;
 if p#>>'{entry,execution,outcome}' is distinct from 'planned' or p#>>'{entry,lifecycle}' is distinct from 'open' or p#>>'{entry,kind}' not in('nutrition_assessment','meal_support','drink_protocol','swallowing_support','stool_protocol','weight_followup') then raise exception 'Tatsächliche/abgeschlossene Versorgung oder unbelegte Geräte-/Bilanzgrundlage ist gesperrt.' using errcode='42501';end if;
 select * into b from public.nutrition_elimination_plan_bindings x where x.tenant_id=t and x.client_id=c and x.plan_version_id=(p#>>'{entry,planVersionId}')::uuid and x.measure_id=(p#>>'{entry,measureId}')::uuid and x.visit_id=(p#>>'{entry,visitId}')::uuid and x.assessment_id=(p#>>'{entry,assessmentId}')::uuid and x.kind=p#>>'{entry,kind}' for share;
 select * into captured from care_private.nutrition_binding_captures x where x.tenant_id=t and x.client_id=c and x.binding_id=b.id for share;
 if b.id is null or captured.request_id is null then raise exception 'Unabhängig erhaltene native Bindungsquittung fehlt.' using errcode='40001';end if;
 begin native:=care_private.nutrition_native_foundation(t,c,b.plan_version_id,b.measure_id,b.visit_id,b.assessment_id);exception when sqlstate '23514' or sqlstate '42501' then raise exception 'Ursprüngliche native Grundlage ist nicht mehr unverändert zugänglich.' using errcode='40001';end;
 sources:=care_private.nutrition_native_sources(t,c,b.assessment_id);
 if captured.native_originals is distinct from native or b.plan_original is distinct from native or b.plan_snapshot_sha256<>care_private.nutrition_fingerprint(native) or p#>>'{entry,planSnapshotSha256}'<>b.plan_snapshot_sha256 or care_private.nutrition_time(p#>'{entry,plannedAt}')<>b.planned_at or p->'sources' is distinct from sources then raise exception 'Plan, Besuch, Assessment oder vollständige aktuelle Quellen wurden geändert.' using errcode='40001';end if;
 perform care_private.nutrition_require(p#>'{entry,title}'=to_jsonb(b.title),'Eintragstitel ist nicht der erhaltene native Maßnahmentitel.');
 perform care_private.nutrition_validate_planned(p->'entry',sources,t,c);
 if p->>'action'='create' then
  perform care_private.nutrition_require(expected=0 and p->'original'='null'::jsonb and p->'expectedHeadId'='null'::jsonb and p->>'reason'='','Neuanlage darf kein historisches Original vortäuschen.');root_ref:=event_ref;
 else
  root_ref:=(p#>>'{original,rootId}')::uuid;
  perform 1 from public.nutrition_elimination_roots x where x.id=root_ref and x.tenant_id=t and x.client_id=c and x.plan_binding_id=b.id and x.kind=b.kind for update;
  if not found then raise exception 'Ursprüngliche Akten-/Planbindung des Verlaufs fehlt.' using errcode='40001';end if;
  select * into prior from public.nutrition_elimination_events x where x.root_id=root_ref and x.tenant_id=t and x.client_id=c order by x.revision desc limit 1 for update;
  if prior.id is null or prior.id::text is distinct from p->>'expectedHeadId' or prior.revision<>expected or care_private.nutrition_elimination_original(root_ref) is distinct from p->'original' or prior.payload=p->'entry' then raise exception 'Vollständiges Original, CAS oder echte Änderung wurde nicht bestätigt.' using errcode='40001';end if;
  perform care_private.nutrition_require(care_private.nutrition_text(p->'reason',10,2000),'Fortschreibungsgrund fehlt.');
 end if;
 select nullif(x.display_name,'') into name from public.profiles x where x.id=actor and x.tenant_id=t and x.is_active and x.status='active';
 if care_private.nutrition_text(to_jsonb(name),1,500) is not true then raise exception 'Ursprünglicher eigener Akteurname fehlt.' using errcode='42501';end if;
 if care_private.nutrition_native_sources(t,c,b.assessment_id) is distinct from sources then raise exception 'Native Quellen wurden vor dem Speichern geändert.' using errcode='40001';end if;
 perform care_private.nutrition_elimination_actor(t,c,actor,true);recorded:=clock_timestamp();
 perform care_private.nutrition_require(prior.id is null or recorded>=prior.recorded_at,'Tatsächliche Erfassungsuhr liegt vor dem unveränderten Vorgänger.');
 if p->>'action'='create' then insert into public.nutrition_elimination_roots(id,tenant_id,client_id,kind,plan_binding_id,created_at)values(root_ref,t,c,b.kind,b.id,recorded);end if;
 insert into public.nutrition_elimination_events(id,tenant_id,client_id,root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,reason,payload,content_fingerprint,packet)values(event_ref,t,c,root_ref,expected+1,prior.id,req,actor,name,recorded,p->>'reason',p->'entry',care_private.nutrition_fingerprint(p->'entry'),p);
 original:=care_private.nutrition_elimination_original(root_ref);
 insert into public.nutrition_elimination_receipts(request_id,tenant_id,client_id,actor_id,root_id,event_id,packet,original,recorded_at,auth_user_id)values(req,t,c,actor,root_ref,event_ref,p,original,recorded,auth.uid());
 return jsonb_build_object('requestId',req,'packet',p,'original',original);
end$$;

-- Final own-account-bound confirmation and bounded review implementation.
create or replace function care_private.confirm_nutrition_elimination_packet(requested_tenant uuid,requested_client uuid,requested_actor uuid,requested_request uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.nutrition_elimination_receipts%rowtype;begin
 perform care_private.nutrition_elimination_actor(requested_tenant,requested_client,requested_actor,false);
 select * into r from public.nutrition_elimination_receipts x where x.tenant_id=requested_tenant and x.client_id=requested_client and x.actor_id=requested_actor and x.request_id=requested_request;
 if r.request_id is null or r.auth_user_id is distinct from auth.uid() or r.packet is distinct from p then raise exception 'Keine passende ursprüngliche eigene G-Quittung.' using errcode='P0G02';end if;
 perform care_private.nutrition_elimination_actor(requested_tenant,requested_client,requested_actor,false);
 return jsonb_build_object('requestId',r.request_id,'packet',r.packet,'original',r.original);
end$$;

-- A complete scoped mutation token, not a clinical completeness or authorization claim.
create or replace function care_private.nutrition_state_fingerprint(t uuid,c uuid)
returns text language sql volatile security definer set search_path='' as $$
 select care_private.nutrition_fingerprint(coalesce(jsonb_agg(jsonb_build_object('pool',pool,'id',id,'fingerprint',fingerprint) order by pool,id),'[]'::jsonb)) from(
 select 'plans' pool,x.id::text id,care_private.nutrition_fingerprint(to_jsonb(x)) fingerprint from public.care_plans x where x.tenant_id=t and x.client_id=c
 union all select 'planVersions',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_plan_versions x join public.care_plans p on p.id=x.care_plan_id and p.tenant_id=t and p.client_id=c where x.tenant_id=t
 union all select 'planItems',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_plan_items x join public.care_plans p on p.id=x.care_plan_id and p.tenant_id=t and p.client_id=c where x.tenant_id=t
 union all select 'visits',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_tour_stops x where x.tenant_id=t and x.client_id=c
 union all select 'tours',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_tours x where x.tenant_id=t and exists(select 1 from public.care_tour_stops s where s.tenant_id=t and s.client_id=c and s.tour_id=x.id)
 union all select 'assessments',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_assessments x where x.tenant_id=t and x.subject_type='client' and x.subject_id=c
 union all select 'assessmentTopics',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_assessment_topics x join public.care_assessments a on a.id=x.assessment_id and a.tenant_id=t and a.subject_type='client' and a.subject_id=c where x.tenant_id=t
 union all select 'assessmentRisks',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_assessment_risks x join public.care_assessments a on a.id=x.assessment_id and a.tenant_id=t and a.subject_type='client' and a.subject_id=c where x.tenant_id=t
 union all select 'assessmentMeasures',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_assessment_measures x join public.care_assessments a on a.id=x.assessment_id and a.tenant_id=t and a.subject_type='client' and a.subject_id=c where x.tenant_id=t
 union all select 'assessmentSelections',x.assessment_id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from care_private.assessment_instrument_selections x where x.tenant_id=t and x.subject_id=c
 union all select 'models',x.model_key,care_private.nutrition_fingerprint(to_jsonb(x)) from care_private.assessment_models x where exists(select 1 from care_private.assessment_instrument_selections s where s.tenant_id=t and s.subject_id=c and s.model_key=x.model_key)
 union all select 'instruments',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from care_private.assessment_instruments x where exists(select 1 from care_private.assessment_instrument_selections s where s.tenant_id=t and s.subject_id=c and x.id=any(s.selected_instrument_ids))
 union all select 'protocolRoots',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_protocol_roots x where x.tenant_id=t and x.client_id=c
 union all select 'protocolEvents',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_protocol_events x where x.tenant_id=t and x.client_id=c
 union all select 'weights',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)||jsonb_build_object('actual_time_current',x.occurred_at is not null and x.occurred_at<=clock_timestamp())) from public.vital_sign_measurements x where x.tenant_id=t and x.client_id=c and x.vital_key='weight'
 union all select 'weightInvalidations',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.vital_measurement_invalidations x where x.tenant_id=t and x.client_id=c
 union all select 'tasks',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.care_operations_tasks x where x.tenant_id=t and x.client_id=c
 union all select 'profiles',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.profiles x where x.tenant_id=t
 union all select 'bindings',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.nutrition_elimination_plan_bindings x where x.tenant_id=t and x.client_id=c
 union all select 'bindingReceipts',x.request_id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from care_private.nutrition_binding_captures x where x.tenant_id=t and x.client_id=c
 union all select 'careRoots',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.nutrition_elimination_roots x where x.tenant_id=t and x.client_id=c
 union all select 'careEvents',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.nutrition_elimination_events x where x.tenant_id=t and x.client_id=c
 union all select 'careReceipts',x.request_id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.nutrition_elimination_receipts x where x.tenant_id=t and x.client_id=c
 union all select 'reviewRoots',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.nutrition_review_roots x where x.tenant_id=t and x.client_id=c
 union all select 'reviewEvents',x.id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.nutrition_review_events x where x.tenant_id=t and x.client_id=c
 union all select 'reviewReceipts',x.request_id::text,care_private.nutrition_fingerprint(to_jsonb(x)) from public.nutrition_review_receipts x where x.tenant_id=t and x.client_id=c
 ) native_rows
$$;

create or replace function care_private.read_nutrition_elimination_prerequisites(requested_tenant uuid,requested_client uuid,requested_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.nutrition_elimination_plan_bindings%rowtype;native jsonb;before_state text;plans jsonb:='[]';blocked jsonb:='[]';sources jsonb;
begin
 perform care_private.nutrition_elimination_actor(requested_tenant,requested_client,requested_actor,false);before_state:=care_private.nutrition_state_fingerprint(requested_tenant,requested_client);
 perform care_private.nutrition_require((select count(*) from public.nutrition_elimination_plan_bindings x where x.tenant_id=requested_tenant and x.client_id=requested_client)<=500,'Vollständiger Bindungsbestand überschreitet den sicheren Rahmen.');
 for b in select x.* from public.nutrition_elimination_plan_bindings x where x.tenant_id=requested_tenant and x.client_id=requested_client order by x.planned_at,x.id loop
  if not exists(select 1 from care_private.nutrition_binding_captures r where r.tenant_id=requested_tenant and r.client_id=requested_client and r.binding_id=b.id) then blocked:=blocked||jsonb_build_array(jsonb_build_object('bindingId',b.id,'reason','retained_native_capture_missing'));continue;end if;
  begin native:=care_private.nutrition_native_foundation(requested_tenant,requested_client,b.plan_version_id,b.measure_id,b.visit_id,b.assessment_id);exception when sqlstate '23514' or sqlstate '42501' then blocked:=blocked||jsonb_build_array(jsonb_build_object('bindingId',b.id,'reason','native_foundation_changed'));continue;end;
  if native is distinct from b.plan_original or b.plan_snapshot_sha256<>care_private.nutrition_fingerprint(native) then blocked:=blocked||jsonb_build_array(jsonb_build_object('bindingId',b.id,'reason','native_foundation_changed'));continue;end if;
  sources:=care_private.nutrition_native_sources(requested_tenant,requested_client,b.assessment_id);
  plans:=plans||jsonb_build_array(jsonb_build_object('planVersionId',b.plan_version_id,'measureId',b.measure_id,'visitId',b.visit_id,'assessmentId',b.assessment_id,'planSnapshotSha256',b.plan_snapshot_sha256,'kind',b.kind,'title',b.title,'plannedAt',to_char(b.planned_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sources',sources));
 end loop;
 perform care_private.nutrition_elimination_actor(requested_tenant,requested_client,requested_actor,false);
 perform care_private.nutrition_require(before_state=care_private.nutrition_state_fingerprint(requested_tenant,requested_client),'Vollständiger Ernährungsbestand wurde während des Lesens geändert.');
 return jsonb_build_object('plans',plans,'stateFingerprint',before_state,'blockedReasons',blocked);
end$$;

create or replace function care_private.read_nutrition_elimination_page(requested_tenant uuid,requested_client uuid,requested_actor uuid,cursor_recorded_at timestamptz,cursor_id uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;state text;begin
 perform care_private.nutrition_elimination_actor(requested_tenant,requested_client,requested_actor,false);state:=care_private.nutrition_state_fingerprint(requested_tenant,requested_client);
 if page_size is null or page_size not between 1 and 100 or(cursor_recorded_at is null)<>(cursor_id is null) or(cursor_recorded_at is not null and not isfinite(cursor_recorded_at)) then raise exception 'Ungültige vollständige G-Seite.' using errcode='22023';end if;
 if cursor_id is not null and not exists(select 1 from public.nutrition_elimination_roots x where x.tenant_id=requested_tenant and x.client_id=requested_client and x.id=cursor_id and x.created_at=cursor_recorded_at) then raise exception 'Cursor gehört nicht zum aktuellen eigenen G-Bestand.' using errcode='22023';end if;
 with page as materialized(select x.* from public.nutrition_elimination_roots x where x.tenant_id=requested_tenant and x.client_id=requested_client and(cursor_recorded_at is null or(x.created_at,x.id)<(cursor_recorded_at,cursor_id)) order by x.created_at desc,x.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.nutrition_elimination_original(x.id) order by x.created_at desc,x.id desc) from page x),'[]'::jsonb),'nextCursorRecordedAt',(select to_char(x.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page x order by x.created_at,x.id limit 1),'nextCursorId',(select x.id from page x order by x.created_at,x.id limit 1),'stateFingerprint',state) into result;
 perform care_private.nutrition_elimination_actor(requested_tenant,requested_client,requested_actor,false);perform care_private.nutrition_require(state=care_private.nutrition_state_fingerprint(requested_tenant,requested_client),'Vollständiger G-Bestand wurde während des Lesens geändert.');return result;
end$$;
create or replace function care_private.read_nutrition_review_page(t uuid,c uuid,actor uuid,at_cursor timestamptz,id_cursor uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;state text;begin
 perform care_private.nutrition_elimination_actor(t,c,actor,false);state:=care_private.nutrition_state_fingerprint(t,c);
 if page_size is null or page_size not between 1 and 100 or(at_cursor is null)<>(id_cursor is null) or(at_cursor is not null and not isfinite(at_cursor)) then raise exception 'Ungültige vollständige Prüfseite.' using errcode='22023';end if;
 if id_cursor is not null and not exists(select 1 from public.nutrition_review_roots x where x.tenant_id=t and x.client_id=c and x.id=id_cursor and x.created_at=at_cursor) then raise exception 'Prüfcursor gehört nicht zum eigenen Bestand.' using errcode='22023';end if;
 with page as materialized(select x.* from public.nutrition_review_roots x where x.tenant_id=t and x.client_id=c and(at_cursor is null or(x.created_at,x.id)<(at_cursor,id_cursor)) order by x.created_at desc,x.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.nutrition_review_original(x.id) order by x.created_at desc,x.id desc) from page x),'[]'::jsonb),'nextCursorRecordedAt',(select to_char(x.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page x order by x.created_at,x.id limit 1),'nextCursorId',(select x.id from page x order by x.created_at,x.id limit 1),'stateFingerprint',state) into result;
 perform care_private.nutrition_elimination_actor(t,c,actor,false);perform care_private.nutrition_require(state=care_private.nutrition_state_fingerprint(t,c),'Vollständiger Prüfbestand wurde während des Lesens geändert.');return result;
end$$;

drop trigger if exists nutrition_immutable on public.nutrition_elimination_plan_bindings;
create trigger nutrition_immutable before update or delete on public.nutrition_elimination_plan_bindings for each row execute function care_private.nutrition_immutable();
drop trigger if exists nutrition_immutable on care_private.nutrition_binding_captures;
create trigger nutrition_immutable before update or delete on care_private.nutrition_binding_captures for each row execute function care_private.nutrition_immutable();

-- Matching scoped access paths; no performance benchmark is implied.
create index if not exists nutrition_native_plan_version on public.care_plan_versions(tenant_id,care_plan_id,version desc,id);
create index if not exists nutrition_native_plan_item on public.care_plan_items(tenant_id,care_plan_id,id);
create index if not exists nutrition_native_protocol_root on public.care_protocol_roots(tenant_id,client_id,id);
create index if not exists nutrition_native_protocol_event on public.care_protocol_events(tenant_id,client_id,root_id,sequence);
create index if not exists nutrition_native_weight on public.vital_sign_measurements(tenant_id,client_id,vital_key,occurred_at,id);
create index if not exists nutrition_native_task on public.care_operations_tasks(tenant_id,client_id,id);

-- Read a retained historical actual original and request inspection. This does not authorize a clinical decision.
create or replace function care_private.commit_nutrition_review(p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenantId')::uuid;c uuid:=(p->>'clientId')::uuid;actor uuid:=(p->>'actorId')::uuid;req uuid:=(p->>'requestId')::uuid;care_root uuid:=(p#>>'{careOriginal,rootId}')::uuid;care jsonb;r public.nutrition_review_receipts%rowtype;event_ref uuid:=gen_random_uuid();name text;recorded timestamptz;original jsonb;
begin
 perform care_private.nutrition_elimination_actor(t,c,actor,p->>'action'='request');
 perform care_private.nutrition_require(care_private.nutrition_fields(p,array['schemaVersion','action','requestId','tenantId','clientId','actorId','expectedHeadId','expectedRevision','careOriginal','reviewOriginal','reason','requiredChange','rationale']) and p->'schemaVersion'='"1"'::jsonb and p->>'action' in('request','return','accept') and care_private.nutrition_uuid(p->'requestId') and care_private.nutrition_text(p->'reason',0,2000) and care_private.nutrition_text(p->'requiredChange',0,4000) and care_private.nutrition_text(p->'rationale',0,4000),'Vollständiges unverändertes Prüfpaket fehlt.');
 select * into r from public.nutrition_review_receipts x where x.tenant_id=t and x.request_id=req;
 if r.request_id is not null then
  if r.auth_user_id is distinct from auth.uid() then raise exception 'Ursprüngliches eigenes Konto der Prüfung fehlt.' using errcode='42501';end if;
  if r.client_id<>c or r.actor_id<>actor or r.packet is distinct from p then raise exception 'Prüfanfragekennung wurde anders verwendet.' using errcode='40001';end if;
  return jsonb_build_object('requestId',req,'packet',r.packet,'original',r.original);
 end if;
 if p->>'action' in('return','accept') then
  if care_private.nutrition_own_permission('pflege.documentation.sign') is not true then raise exception 'Eigenes aktuelles Prüfrecht fehlt.' using errcode='42501';end if;
  -- A second linked profile is not an independent authenticated person.
  if exists(select 1 from jsonb_array_elements(coalesce(p#>'{careOriginal,history}','[]'::jsonb)) h join public.profiles x on x.id=(h->>'recordedBy')::uuid and x.tenant_id=t where x.id=actor or coalesce(x.auth_user_id,x.id)=auth.uid()) then raise exception 'Dieselbe angemeldete Person darf die eigene Fassung nicht unabhängig entscheiden.' using errcode='42501';end if;
  raise exception 'Klinische Annahme/Rückgabe bleibt ohne nachgewiesene ausführungsgebundene Qualifikations-/Einwilligungsoriginale und geschlossene native Schreiber gesperrt.' using errcode='42501';
 end if;
 perform 1 from public.nutrition_elimination_roots x where x.id=care_root and x.tenant_id=t and x.client_id=c for update;
 if not found then raise exception 'Eigenes historisches Pflegeoriginal fehlt.' using errcode='40001';end if;
 care:=care_private.nutrition_elimination_original(care_root);
 if care is distinct from p->'careOriginal' or care->>'voided' is distinct from 'false' or care#>>'{payload,execution,outcome}' in('planned','offered') or care#>>'{payload,execution,outcome}' is null then raise exception 'Unverändertes historisches tatsächliches Original fehlt.' using errcode='40001';end if;
 perform care_private.nutrition_require(p->'expectedRevision'='0'::jsonb and p->'expectedHeadId'='null'::jsonb and p->'reviewOriginal'='null'::jsonb and care_private.nutrition_text(p->'reason',10,2000) and p->>'requiredChange'='' and p->>'rationale'='','Prüfanfrage darf weder Entscheidung noch fremden Kopf enthalten.');
 select nullif(x.display_name,'') into name from public.profiles x where x.id=actor and x.tenant_id=t and x.is_active and x.status='active';
 if care_private.nutrition_text(to_jsonb(name),1,500) is not true then raise exception 'Ursprünglicher eigener Name fehlt.' using errcode='42501';end if;
 perform care_private.nutrition_elimination_actor(t,c,actor,true);recorded:=clock_timestamp();
 insert into public.nutrition_review_roots(id,tenant_id,client_id,care_root_id,care_head_id,care_fingerprint,care_kind,created_at)values(event_ref,t,c,care_root,(care->>'headId')::uuid,care->>'contentFingerprint',care->>'kind',recorded);
 insert into public.nutrition_review_events(id,tenant_id,client_id,root_id,revision,previous_id,request_id,action,actor_id,actor_name,recorded_at,reason,required_change,rationale,care_head_id,care_fingerprint,qualification_original,fingerprint,packet)
 values(event_ref,t,c,event_ref,1,null,req,'request',actor,name,recorded,p->>'reason','','',(care->>'headId')::uuid,care->>'contentFingerprint',null,care_private.nutrition_fingerprint(jsonb_build_object('packet',p,'qualification',null)),p);
 original:=care_private.nutrition_review_original(event_ref);
 insert into public.nutrition_review_receipts(request_id,tenant_id,client_id,actor_id,root_id,event_id,packet,original,recorded_at,auth_user_id)values(req,t,c,actor,event_ref,event_ref,p,original,recorded,auth.uid());
 return jsonb_build_object('requestId',req,'packet',p,'original',original);
end$$;
create or replace function care_private.confirm_nutrition_review(t uuid,c uuid,actor uuid,req uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.nutrition_review_receipts%rowtype;begin
 perform care_private.nutrition_elimination_actor(t,c,actor,false);
 select * into r from public.nutrition_review_receipts x where x.tenant_id=t and x.client_id=c and x.actor_id=actor and x.request_id=req;
 if r.request_id is null or r.auth_user_id is distinct from auth.uid() or r.packet is distinct from p then raise exception 'Keine passende ursprüngliche eigene Prüfquittung.' using errcode='P0G03';end if;
 perform care_private.nutrition_elimination_actor(t,c,actor,false);
 return jsonb_build_object('requestId',r.request_id,'packet',r.packet,'original',r.original);
end$$;

-- Public entry points are declared only after their private dependencies exist.
create or replace function public.web_read_nutrition_elimination_prerequisites(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_nutrition_elimination_prerequisites(p_tenant_id,p_client_id,p_actor_profile_id)$$;
create or replace function public.web_read_nutrition_elimination_page(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_nutrition_elimination_page(p_tenant_id,p_client_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_nutrition_elimination_packet(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_nutrition_elimination_packet(p_packet)$$;
create or replace function public.web_confirm_nutrition_elimination_packet(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_nutrition_elimination_packet(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet)$$;
create or replace function public.web_read_nutrition_review_page(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_nutrition_review_page(p_tenant_id,p_client_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_nutrition_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_nutrition_review(p_packet)$$;
create or replace function public.web_confirm_nutrition_review(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_nutrition_review(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet)$$;
create or replace function public.web_read_nutrition_elimination_binding_context(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_plan_version_id uuid,p_measure_id uuid,p_visit_id uuid,p_assessment_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.nutrition_binding_context(p_tenant_id,p_client_id,p_actor_profile_id,p_plan_version_id,p_measure_id,p_visit_id,p_assessment_id)$$;
create or replace function public.web_capture_nutrition_elimination_plan_binding(p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.capture_nutrition_plan_binding(p_packet)$$;
create or replace function public.web_confirm_nutrition_elimination_plan_binding(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_nutrition_plan_binding(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet)$$;

-- Full quarantine: exact function identities in this family, no global helper replacement.
do $quarantine$declare fn record;begin
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='care_private' and p.proname in('capture_nutrition_plan_binding','commit_nutrition_elimination_packet','commit_nutrition_review','confirm_nutrition_elimination_packet','confirm_nutrition_plan_binding','confirm_nutrition_review','nutrition_binding_context','nutrition_elimination_actor','nutrition_elimination_original','nutrition_fields','nutrition_fingerprint','nutrition_immutable','nutrition_lock_native_sources','nutrition_native_foundation','nutrition_native_sources','nutrition_own_permission','nutrition_require','nutrition_review_original','nutrition_state_fingerprint','nutrition_text','nutrition_time','nutrition_uuid','nutrition_validate_planned','read_nutrition_elimination_page','read_nutrition_elimination_prerequisites','read_nutrition_review_page','validate_nutrition_entry'))or(n.nspname='public' and p.proname in('web_read_nutrition_elimination_binding_context','web_capture_nutrition_elimination_plan_binding','web_confirm_nutrition_elimination_plan_binding','web_read_nutrition_elimination_prerequisites','web_read_nutrition_elimination_page','web_commit_nutrition_elimination_packet','web_confirm_nutrition_elimination_packet','web_read_nutrition_review_page','web_commit_nutrition_review','web_confirm_nutrition_review')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.oid::regprocedure);
 end loop;
end$quarantine$;
revoke all on care_private.nutrition_binding_captures,care_private.nutrition_review_scopes from public,anon,authenticated,service_role;
revoke all on public.nutrition_elimination_plan_bindings,public.nutrition_elimination_roots,public.nutrition_elimination_events,public.nutrition_elimination_receipts,public.nutrition_review_roots,public.nutrition_review_events,public.nutrition_review_receipts from public,anon,authenticated,service_role;
