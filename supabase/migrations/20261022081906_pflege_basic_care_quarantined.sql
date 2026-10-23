-- Quarantined BasicCare Staging contract. No clinical defaults, grants or production activation.
-- Native shared/Android writers remain unchanged; only prepared BasicCare originals become immutable.
-- Requires native care tables and care_private.require_workspace_session(uuid,uuid).
create schema if not exists care_private;

create table if not exists public.basic_care_plan_bindings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 plan_version_id uuid not null,measure_id uuid not null references public.care_plan_items(id),visit_id uuid not null references public.care_tour_stops(id),
 kind text not null check(kind in('body_care','oral_care','dressing','transfer_positioning','pressure_prevention','fall_prevention','contracture_prevention','individual_prevention')),
 title text not null check(btrim(title)<>''),planned_at timestamptz not null,plan_snapshot_sha256 text not null check(plan_snapshot_sha256~'^sha256:[0-9a-f]{64}$'),
 second_person_required boolean not null default false,pressure_originals jsonb,fall_originals jsonb,plan_original jsonb not null,created_at timestamptz not null default clock_timestamp(),
 check((kind='pressure_prevention')=(pressure_originals is not null)),check((kind='fall_prevention')=(fall_originals is not null)),
 unique(tenant_id,client_id,plan_version_id,measure_id,visit_id)
);
create table if not exists public.basic_care_roots(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),kind text not null,
 plan_binding_id uuid not null references public.basic_care_plan_bindings(id),created_at timestamptz not null,unique(id,tenant_id,client_id)
);
create table if not exists public.basic_care_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,root_id uuid not null,revision integer not null check(revision>0),previous_id uuid,
 request_id uuid not null,actor_id uuid not null references public.profiles(id),actor_name text not null check(btrim(actor_name)<>''),recorded_at timestamptz not null,
 reason text not null,payload jsonb not null,content_fingerprint text not null check(content_fingerprint~'^sha256:[0-9a-f]{64}$'),packet jsonb not null,
 unique(root_id,revision),unique(tenant_id,request_id),unique(id,root_id),foreign key(root_id,tenant_id,client_id) references public.basic_care_roots(id,tenant_id,client_id),
 foreign key(previous_id,root_id) references public.basic_care_events(id,root_id),check((revision=1)=(previous_id is null))
);
create table if not exists public.basic_care_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,actor_id uuid not null,root_id uuid not null,event_id uuid not null,
 packet jsonb not null,original jsonb not null,recorded_at timestamptz not null,foreign key(event_id,root_id) references public.basic_care_events(id,root_id)
);
create index if not exists basic_care_scope on public.basic_care_roots(tenant_id,client_id,created_at desc,id desc);
alter table public.basic_care_plan_bindings enable row level security;
alter table public.basic_care_roots enable row level security;
alter table public.basic_care_events enable row level security;
alter table public.basic_care_receipts enable row level security;
revoke all on public.basic_care_plan_bindings,public.basic_care_roots,public.basic_care_events,public.basic_care_receipts from public,anon,authenticated;

create table if not exists public.basic_care_review_roots(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 basic_care_root_id uuid not null references public.basic_care_roots(id),care_head_id uuid not null unique references public.basic_care_events(id),
 care_content_fingerprint text not null check(care_content_fingerprint~'^sha256:[0-9a-f]{64}$'),created_at timestamptz not null
);
create table if not exists public.basic_care_review_events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,review_root_id uuid not null references public.basic_care_review_roots(id),
 revision integer not null check(revision in(1,2)),previous_id uuid references public.basic_care_review_events(id),request_id uuid not null,
 actor_id uuid not null references public.profiles(id),actor_name text not null check(btrim(actor_name)<>''),recorded_at timestamptz not null,
 kind text not null check(kind in('review_request','review_return','review_acceptance')),reason text not null,required_change text not null,rationale text not null,
 qualification_original jsonb,care_head_id uuid not null references public.basic_care_events(id),care_content_fingerprint text not null check(care_content_fingerprint~'^sha256:[0-9a-f]{64}$'),
 content_fingerprint text not null check(content_fingerprint~'^sha256:[0-9a-f]{64}$'),packet jsonb not null,
 unique(review_root_id,revision),unique(tenant_id,request_id),check((revision=1)=(previous_id is null))
);
create table if not exists public.basic_care_review_receipts(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,actor_id uuid not null,review_root_id uuid not null references public.basic_care_review_roots(id),
 event_id uuid not null references public.basic_care_review_events(id),packet jsonb not null,original jsonb not null,recorded_at timestamptz not null
);
create index if not exists basic_care_review_scope on public.basic_care_review_roots(tenant_id,client_id,created_at desc,id desc);
alter table public.basic_care_review_roots enable row level security;
alter table public.basic_care_review_events enable row level security;
alter table public.basic_care_review_receipts enable row level security;
revoke all on public.basic_care_review_roots,public.basic_care_review_events,public.basic_care_review_receipts from public,anon,authenticated;


alter table public.basic_care_events add column if not exists auth_user_id uuid;
alter table public.basic_care_events add column if not exists involved_auth jsonb;
alter table public.basic_care_review_events add column if not exists auth_user_id uuid;
create table if not exists care_private.basic_care_binding_requests(
 request_id uuid primary key,tenant_id uuid not null,client_id uuid not null,actor_id uuid not null,auth_user_id uuid not null,
 packet jsonb not null,binding_id uuid not null references public.basic_care_plan_bindings(id),original jsonb not null,created_at timestamptz not null default clock_timestamp()
);
create table if not exists care_private.basic_care_review_scopes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),employee_id uuid not null references public.employees(id),qualification_id uuid not null references public.employee_qualifications(id),
 kind text not null check(kind='basic_care_review'),qualification_fingerprint text not null check(qualification_fingerprint~'^sha256:[0-9a-f]{64}$'),document_fingerprint text not null check(document_fingerprint~'^sha256:[0-9a-f]{64}$'),
 approved_by uuid not null references public.profiles(id),approved_at timestamptz not null,valid_until timestamptz not null,revoked_at timestamptz,check(isfinite(approved_at) and isfinite(valid_until) and valid_until>approved_at)
);
alter table care_private.basic_care_binding_requests enable row level security;
alter table care_private.basic_care_review_scopes enable row level security;
revoke all on care_private.basic_care_binding_requests,care_private.basic_care_review_scopes from public,anon,authenticated,service_role;

create or replace function care_private.basic_care_require(value boolean,p_message text)returns void language plpgsql immutable set search_path='' as $$begin if value is distinct from true then raise exception '%',p_message using errcode='23514';end if;end$$;
create or replace function care_private.basic_care_keys(value jsonb,keys text[])returns boolean language sql immutable set search_path='' as $$select case when jsonb_typeof(value)='object' then value?&keys and value-keys='{}'::jsonb else false end$$;
create or replace function care_private.basic_care_uuid(value jsonb)returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(value)='string' and value#>>'{}'~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)$$;
create or replace function care_private.basic_care_text(value jsonb,minimum integer default 0,maximum integer default 8000)returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(value)='string' and length(btrim(value#>>'{}'))>=minimum and length(value#>>'{}')<=maximum,false)$$;
create or replace function care_private.basic_care_time(value jsonb)returns timestamptz language plpgsql immutable set search_path='' as $$declare result timestamptz;begin
 perform care_private.basic_care_require(jsonb_typeof(value)='string' and value#>>'{}'~'^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$','Expliziter endlicher Zeitpunkt mit höchstens sechs Nachkommastellen fehlt.');
 result:=(value#>>'{}')::timestamptz;perform care_private.basic_care_require(isfinite(result),'Unendlicher Zeitpunkt ist unzulässig.');return result;
end$$;
create or replace function care_private.basic_care_fingerprint(value jsonb)returns text language sql immutable set search_path='' as $$select 'sha256:'||encode(extensions.digest(pg_catalog.convert_to(value::text,'UTF8'),'sha256'),'hex')$$;
create or replace function care_private.basic_care_strings(value jsonb,uuids boolean default false)returns boolean language plpgsql immutable set search_path='' as $$declare x jsonb;seen text[]:=array[]::text[];begin
 if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value)>50 then return false;end if;
 for x in select jsonb_array_elements(value) loop if (uuids and not care_private.basic_care_uuid(x)) or(not uuids and not care_private.basic_care_text(x,1,1000)) or x#>>'{}'=any(seen) then return false;end if;seen:=array_append(seen,x#>>'{}');end loop;return true;
end$$;
create or replace function care_private.basic_care_has(required text)returns boolean language plpgsql security definer set search_path='' as $$declare t uuid:=public.current_tenant_id();a uuid:=public.resolve_current_profile_id();r uuid;role_key_value text;begin
 perform care_private.require_workspace_session(t,a);
 lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;
 select p.role_id,z.key into r,role_key_value from public.profiles p join public.roles z on z.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active' for share of p,z;
 if r is null then return false;end if;
 if exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=role_key_value) then
  return exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=role_key_value and z.permission_key=required);
 end if;
 return exists(select 1 from public.role_permissions z where z.role_id=r and z.permission_key=required);
end$$;
create or replace function care_private.basic_care_actor(requested_tenant uuid,requested_client uuid,requested_actor uuid,write_access boolean)returns uuid language plpgsql security definer set search_path='' as $$begin
 perform care_private.require_workspace_session(requested_tenant,requested_actor);
 if requested_tenant is distinct from public.current_tenant_id() or requested_actor is distinct from public.resolve_current_profile_id() or requested_client is null then raise exception 'Eigener Grundpflegefall fehlt.' using errcode='42501';end if;
 perform 1 from public.clients c where c.id=requested_client and c.tenant_id=requested_tenant and c.status::text in('active','aktiv') and c.lifecycle_status::text in('active','aktiv') and c.deleted_at is null and c.archived_at is null for share;
 if not found then raise exception 'Aktiver eigener Pflegefall fehlt.' using errcode='42501';end if;
 perform 1 from public.client_module_assignments x where x.tenant_id=requested_tenant and x.client_id=requested_client and x.module_key='pflege' and x.is_active and x.status in('active','aktiv') for share;
 if not found or care_private.basic_care_has('pflege.plans.view') is not true or care_private.basic_care_has('pflege.documentation.view') is not true or(write_access and care_private.basic_care_has('pflege.documentation.create') is not true) then raise exception 'Aktuelle eigene Grundpflegeberechtigung oder Pflegezuordnung fehlt.' using errcode='42501';end if;return requested_actor;
end$$;

-- Exact native selection. Existing version format is the native save_live_care_plan {plan,items} snapshot.
create or replace function care_private.basic_care_native_sources(t uuid,c uuid,v uuid,m uuid,s uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare pv public.care_plan_versions;p public.care_plans;i public.care_plan_items;st public.care_tour_stops;tr public.care_tours;items jsonb;begin
 -- Serialize against existing native writers, including inserts of a newer version/item.
 lock table public.care_plans,public.care_plan_items,public.care_plan_versions,public.care_tour_stops,public.care_tours in share mode;
 select * into pv from public.care_plan_versions x where x.id=v and x.tenant_id=t for share;
 select * into p from public.care_plans x where x.id=pv.care_plan_id and x.tenant_id=t and x.client_id=c for share;
 select * into i from public.care_plan_items x where x.id=m and x.tenant_id=t and x.care_plan_id=p.id for share;
 select * into st from public.care_tour_stops x where x.id=s and x.tenant_id=t and x.client_id=c for share;
 select * into tr from public.care_tours x where x.id=st.tour_id and x.tenant_id=t for share;
 if pv.id is null or p.id is null or i.id is null or st.id is null or tr.id is null then raise exception 'Native Planfassung, Maßnahme oder eigener Einsatz fehlt.' using errcode='40001';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into items from public.care_plan_items x where x.tenant_id=t and x.care_plan_id=p.id;
 if not care_private.basic_care_keys(pv.snapshot,array['plan','items']) or pv.snapshot->'plan' is distinct from to_jsonb(p) or jsonb_typeof(pv.snapshot->'items') is distinct from 'array'
 or (select coalesce(jsonb_agg(x order by x->>'id'),'[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(pv.snapshot->'items')='array' then pv.snapshot->'items' else '[]'::jsonb end)x) is distinct from items
 or exists(select 1 from public.care_plan_versions n where n.tenant_id=t and n.care_plan_id=p.id and n.version>pv.version)
 or p.status not in('active','aktiv') or i.status::text<>'active' or tr.status not in('published','in_progress','completed') or st.status not in('planned','arrived','in_progress','completed') then raise exception 'Vollständige aktuelle native Plan- oder Einsatzgrundlage ist ungeklärt.' using errcode='40001';end if;
 return jsonb_build_object('planVersion',to_jsonb(pv),'plan',to_jsonb(p),'measure',to_jsonb(i),'visit',to_jsonb(st),'tour',to_jsonb(tr));
end$$;
create or replace function care_private.basic_care_binding_facts(s jsonb)returns jsonb language sql immutable set search_path='' as $$select s||jsonb_build_object('visit',(s->'visit')-array['status','updated_at'],'tour',(s->'tour')-array['status','updated_at','updated_by'])$$;
create or replace function care_private.basic_care_binding_current(b public.basic_care_plan_bindings)returns boolean language plpgsql security definer set search_path='' as $$declare s jsonb;begin
 if b.plan_original->>'version' is distinct from 'basic-care-native-binding/1' or b.plan_original->>'timeZone' is distinct from 'Europe/Berlin' or not care_private.basic_care_uuid(b.plan_original->'issuedBy') or not care_private.basic_care_uuid(b.plan_original->'issuedByAuthUser') then return false;end if;
 s:=care_private.basic_care_native_sources(b.tenant_id,b.client_id,b.plan_version_id,b.measure_id,b.visit_id);
 return care_private.basic_care_binding_facts(s)=care_private.basic_care_binding_facts(b.plan_original->'sources') and b.plan_snapshot_sha256=care_private.basic_care_fingerprint(b.plan_original)
 and b.planned_at=care_private.basic_care_time(b.plan_original->'plannedAt') and b.kind=s#>>'{measure,category}' and b.title=s#>>'{measure,title}' and b.second_person_required=(b.plan_original->>'secondPersonRequired')::boolean;
exception when serialization_failure then return false;end$$;
create or replace function care_private.issue_basic_care_binding(p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid;c uuid;a uuid;req uuid;v uuid;m uuid;s uuid;native jsonb;proof jsonb;b public.basic_care_plan_bindings;prior care_private.basic_care_binding_requests;actual timestamptz;zone text;local_time timestamp;begin
 perform care_private.basic_care_require(care_private.basic_care_keys(p,array['schemaVersion','requestId','tenantId','clientId','actorId','planVersionId','measureId','visitId','plannedAt','timeZone','secondPersonRequired','reason','sources']) and p->'schemaVersion'='"1"'::jsonb and jsonb_typeof(p->'secondPersonRequired')='boolean' and care_private.basic_care_text(p->'reason',10,2000) and p->>'timeZone'='Europe/Berlin','Explizite native Planbindung mit eigener Planungsentscheidung fehlt.');
 foreach zone in array array['requestId','tenantId','clientId','actorId','planVersionId','measureId','visitId'] loop perform care_private.basic_care_require(care_private.basic_care_uuid(p->zone),'Ungültige native Bindungskennung.');end loop;
 t:=(p->>'tenantId')::uuid;c:=(p->>'clientId')::uuid;a:=(p->>'actorId')::uuid;req:=(p->>'requestId')::uuid;v:=(p->>'planVersionId')::uuid;m:=(p->>'measureId')::uuid;s:=(p->>'visitId')::uuid;
 perform care_private.basic_care_actor(t,c,a,true);if care_private.basic_care_has('pflege.plans.manage') is not true then raise exception 'Eigene Planungsberechtigung fehlt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('basic-care-request:'||req,0));perform pg_advisory_xact_lock(hashtextextended('basic-care:'||t||':'||c,0));
 perform care_private.basic_care_actor(t,c,a,true);if care_private.basic_care_has('pflege.plans.manage') is not true then raise exception 'Aktuelles eigenes Planungsrecht fehlt.' using errcode='42501';end if;
 select * into prior from care_private.basic_care_binding_requests r where r.request_id=req for share;
 if found then if prior.tenant_id<>t or prior.client_id<>c or prior.actor_id<>a or prior.auth_user_id<>auth.uid() or prior.packet is distinct from p then raise exception 'Bindungsanfrage ist anders belegt.' using errcode='40001';end if;return prior.original;end if;
 if exists(select 1 from public.basic_care_plan_bindings x where x.tenant_id=t and x.client_id=c and x.plan_version_id=v and x.measure_id=m and x.visit_id=s) then raise exception 'Für diese nativen Originale besteht bereits eine unveränderte Planbindung.' using errcode='40001';end if;
 native:=care_private.basic_care_native_sources(t,c,v,m,s);
 if native is distinct from p->'sources' then raise exception 'Native Bindungsoriginale wurden geändert.' using errcode='40001';end if;
 perform care_private.basic_care_require(native#>>'{measure,category}' in('body_care','oral_care','dressing','transfer_positioning','contracture_prevention','individual_prevention'),'Dekubitus-/Sturzoriginale oder eindeutige native Maßnahmenart sind noch nicht gebunden.');
 perform care_private.basic_care_require(care_private.basic_care_text(native#>'{measure,title}',3,300),'Der ursprüngliche native Maßnahmentitel ist unvollständig.');
 actual:=care_private.basic_care_time(p->'plannedAt');local_time:=actual at time zone 'Europe/Berlin';
 perform care_private.basic_care_require(local_time::date=(native#>>'{tour,tour_date}')::date and local_time::time=(native#>>'{visit,planned_start}')::time and local_time::date>=(native#>>'{plan,valid_from}')::date and(native#>>'{plan,valid_until}' is null or local_time::date<=(native#>>'{plan,valid_until}')::date),'Explizite Planzeit stimmt nicht mit lokaler Tourzeit oder Planlaufzeit überein.');
 proof:=jsonb_build_object('version','basic-care-native-binding/1','sources',native,'timeZone','Europe/Berlin','plannedAt',p->'plannedAt','secondPersonRequired',p->'secondPersonRequired','planningReason',p->'reason','issuedBy',a,'issuedByAuthUser',auth.uid());
 perform care_private.basic_care_actor(t,c,a,true);if care_private.basic_care_has('pflege.plans.manage') is not true then raise exception 'Planungsrecht wurde beendet.' using errcode='42501';end if;
 insert into public.basic_care_plan_bindings(tenant_id,client_id,plan_version_id,measure_id,visit_id,kind,title,planned_at,plan_snapshot_sha256,second_person_required,pressure_originals,fall_originals,plan_original)
 values(t,c,v,m,s,native#>>'{measure,category}',native#>>'{measure,title}',actual,care_private.basic_care_fingerprint(proof),(p->>'secondPersonRequired')::boolean,null,null,proof) returning * into b;
 proof:=jsonb_build_object('requestId',req,'packet',p,'bindingId',b.id,'plan',jsonb_build_object('planVersionId',v,'measureId',m,'visitId',s,'planSnapshotSha256',b.plan_snapshot_sha256,'kind',b.kind,'title',b.title,'plannedAt',to_char(b.planned_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'secondPersonRequired',b.second_person_required,'pressureOriginals',null,'fallOriginals',null));
 insert into care_private.basic_care_binding_requests(request_id,tenant_id,client_id,actor_id,auth_user_id,packet,binding_id,original)values(req,t,c,a,auth.uid(),p,b.id,proof);return proof;
end$$;

create or replace function care_private.basic_care_person(t uuid,p uuid)returns void language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.profiles x where x.id=p and x.tenant_id=t and x.is_active and x.status='active' for share;if not found then raise exception 'Aktuelle verantwortliche oder ausführende Person fehlt.' using errcode='42501';end if;
end$$;
create or replace function care_private.validate_basic_care_entry(e jsonb,t uuid,b public.basic_care_plan_bindings)returns void language plpgsql security definer set search_path='' as $$
declare consent jsonb:=e->'consent';assistance jsonb:=e->'assistance';observation jsonb:=e->'observation';execution jsonb:=e->'execution';prevention jsonb:=e->'prevention';followup jsonb:=e->'followUp';outcome text;kind text;field text;x jsonb;actual timestamptz;now_at timestamptz:=clock_timestamp();begin
 perform care_private.basic_care_require(care_private.basic_care_keys(e,array['kind','title','plannedAt','occurredAt','planVersionId','measureId','visitId','planSnapshotSha256','consent','assistance','observation','execution','prevention','followUp','lifecycle']) and e->>'kind'=b.kind and e->>'title'=b.title and e->>'planVersionId'=b.plan_version_id::text and e->>'measureId'=b.measure_id::text and e->>'visitId'=b.visit_id::text and e->>'planSnapshotSha256'=b.plan_snapshot_sha256 and care_private.basic_care_time(e->'plannedAt')=b.planned_at and e->>'lifecycle' in('open','completed'),'Vollständiger unveränderter nativer Plan-, Maßnahmen- und Einsatzbezug fehlt.');
 kind:=e->>'kind';
 perform care_private.basic_care_require(kind not in('pressure_prevention','fall_prevention'),'Dekubitus- oder Sturzoriginale sind noch nicht nativ gebunden.');
 perform care_private.basic_care_require(care_private.basic_care_keys(consent,array['state','recordedAt','statedReason','consultation']) and consent->>'state' in('not_asked','consented','refused','withdrawn') and care_private.basic_care_text(consent->'statedReason',0,2000) and care_private.basic_care_text(consent->'consultation',0,4000),'Expliziter Einwilligungsstand fehlt.');
 if consent->'recordedAt'<>'null'::jsonb then perform care_private.basic_care_require(care_private.basic_care_time(consent->'recordedAt')<=now_at,'Einwilligungszeit darf nicht in der Zukunft liegen.');end if;
 perform care_private.basic_care_require(care_private.basic_care_keys(assistance,array['level','secondPersonRequired','helpers','aids','technique']) and assistance->>'level' in('independent','prompting','partial_assist','full_assist','two_person_assist') and jsonb_typeof(assistance->'secondPersonRequired')='boolean' and(assistance->>'secondPersonRequired')::boolean=b.second_person_required and b.second_person_required=(assistance->>'level'='two_person_assist') and care_private.basic_care_strings(assistance->'helpers',true) and care_private.basic_care_strings(assistance->'aids',false) and care_private.basic_care_text(assistance->'technique',case when assistance->>'level'='independent' then 0 else 3 end,4000),'Hilfebedarf oder ausdrücklich geplante zweite Person wurde verändert.');
 perform care_private.basic_care_require(care_private.basic_care_keys(observation,array['baseline','skin','mobility','oral','tolerance','oralAbnormality','skinChange']) and jsonb_typeof(observation->'oralAbnormality')='boolean' and jsonb_typeof(observation->'skinChange')='boolean','Vollständige ausdrückliche Beobachtung fehlt.');
 foreach field in array array['baseline','skin','mobility','oral','tolerance'] loop perform care_private.basic_care_require(care_private.basic_care_text(observation->field,0,4000),'Beobachtungsangabe fehlt.');end loop;
 perform care_private.basic_care_require(care_private.basic_care_keys(execution,array['outcome','bodyScope','performedBy','interventions','result','deviation']) and execution->>'outcome' in('planned','offered','performed','partial','refused','not_performed') and care_private.basic_care_strings(execution->'performedBy',true) and care_private.basic_care_strings(execution->'interventions',false) and care_private.basic_care_text(execution->'result',0,8000) and care_private.basic_care_text(execution->'deviation',0,4000),'Tatsächlicher Durchführungsstand ist unvollständig.');
 outcome:=execution->>'outcome';
 if outcome='planned' then perform care_private.basic_care_require(e->'occurredAt'='null'::jsonb,'Planung darf kein tatsächliches Ereignis vortäuschen.');
 else actual:=care_private.basic_care_time(e->'occurredAt');perform care_private.basic_care_require(actual<=now_at,'Tatsächliches Ereignis liegt in der Zukunft.');end if;
 if outcome in('performed','partial') then
  perform care_private.basic_care_require(consent->>'state'='consented' and consent->'recordedAt'<>'null'::jsonb and care_private.basic_care_time(consent->'recordedAt')<=actual and jsonb_array_length(execution->'performedBy')>0 and jsonb_array_length(execution->'interventions')>0 and care_private.basic_care_text(execution->'result',1,8000),'Durchführung benötigt tatsächliche Einwilligung, ausführende Personen, Maßnahmen und Ergebnis.');
 else perform care_private.basic_care_require(jsonb_array_length(execution->'performedBy')=0 and jsonb_array_length(execution->'interventions')=0 and execution->>'result'='','Angebot, Ablehnung oder Nichtdurchführung darf keine erbrachte Versorgung vortäuschen.');end if;
 if outcome='refused' then perform care_private.basic_care_require(consent->>'state'='refused' and care_private.basic_care_text(consent->'statedReason',1,2000) and care_private.basic_care_text(consent->'consultation',3,4000) and followup->'required'='true'::jsonb,'Ablehnung benötigt eigenen Grund, Beratung und weiteres Vorgehen.');
 else perform care_private.basic_care_require(consent->>'state'<>'refused','Ablehnung widerspricht dem Leistungsstand.');end if;
 if outcome in('partial','not_performed') then perform care_private.basic_care_require(care_private.basic_care_text(execution->'deviation',3,4000),'Teil- oder Nichtdurchführung benötigt tatsächliche Abweichung.');end if;
 if b.second_person_required then perform care_private.basic_care_require(case when outcome in('planned','offered') then jsonb_array_length(assistance->'helpers')>=2 else jsonb_array_length(execution->'performedBy')>=2 end,'Erforderliche zweite Person ist nicht belegt.');end if;
 for x in select jsonb_array_elements(assistance->'helpers') union select jsonb_array_elements(execution->'performedBy') loop perform care_private.basic_care_person(t,(x#>>'{}')::uuid);end loop;
 perform care_private.basic_care_require(case when kind='body_care' then execution->>'bodyScope' in('partial','full') else execution->>'bodyScope'='not_applicable' end,'Körperpflegeumfang widerspricht der Maßnahmenart.');
 perform care_private.basic_care_require(care_private.basic_care_keys(prevention,array['risk','professionalBasis','individualMeasure','reviewAt','fallOccurred','incidentId','reassessmentId']) and jsonb_typeof(prevention->'fallOccurred')='boolean' and care_private.basic_care_text(prevention->'risk',0,8000) and care_private.basic_care_text(prevention->'professionalBasis',0,8000) and care_private.basic_care_text(prevention->'individualMeasure',0,8000),'Individueller Präventionsstand fehlt.');
 if prevention->'reviewAt'<>'null'::jsonb then perform care_private.basic_care_time(prevention->'reviewAt');end if;
 perform care_private.basic_care_require(prevention->'fallOccurred'='false'::jsonb and prevention->'incidentId'='null'::jsonb and prevention->'reassessmentId'='null'::jsonb,'Ein Sturzereignis benötigt den noch nicht verfügbaren nativen Ereignis- und Neubewertungsweg.');
 if kind='individual_prevention' then perform care_private.basic_care_require(care_private.basic_care_text(prevention->'risk',3,8000) and care_private.basic_care_text(prevention->'professionalBasis',10,8000) and care_private.basic_care_text(prevention->'individualMeasure',10,8000),'Individuelle Prophylaxe benötigt eigene fachliche Grundlage und Maßnahme.');end if;
 if kind='contracture_prevention' and outcome in('performed','partial') then perform care_private.basic_care_require(care_private.basic_care_text(observation->'mobility',1,4000) and care_private.basic_care_text(observation->'tolerance',1,4000) and exists(select 1 from jsonb_array_elements_text(execution->'interventions')x where x~*'anleit|beweg|aktiv'),'Kontrakturprävention benötigt tatsächliche Bewegung oder Anleitung und Verträglichkeit.');end if;
 perform care_private.basic_care_require(care_private.basic_care_keys(followup,array['required','reason','responsibleProfileId','dueAt','taskId','state','closureEvidence']) and jsonb_typeof(followup->'required')='boolean' and care_private.basic_care_text(followup->'reason',0,8000) and care_private.basic_care_text(followup->'closureEvidence',0,8000),'Weiteres Vorgehen ist unvollständig.');
 -- No task is invented or completed while the native control-task relation is absent.
 perform care_private.basic_care_require(followup->'taskId'='null'::jsonb and followup->>'state'<>'closed','Auftragsgebundener Abschluss ist ohne nativen Kontrollauftrag noch gesperrt.');
 if followup->'required'='true'::jsonb then
  perform care_private.basic_care_require(followup->>'state'='open' and care_private.basic_care_text(followup->'reason',3,8000) and care_private.basic_care_uuid(followup->'responsibleProfileId') and followup->'closureEvidence'='""'::jsonb,'Offenes weiteres Vorgehen benötigt Anlass und eigene Verantwortung.');
  perform care_private.basic_care_time(followup->'dueAt');perform care_private.basic_care_person(t,(followup->>'responsibleProfileId')::uuid);
 else perform care_private.basic_care_require(followup->>'state'='not_required' and followup->>'reason'='' and followup->'responsibleProfileId'='null'::jsonb and followup->'dueAt'='null'::jsonb and followup->'closureEvidence'='""'::jsonb,'Ohne weiteres Vorgehen dürfen keine Folgebelege erfunden werden.');end if;
 if kind='oral_care' then perform care_private.basic_care_require(care_private.basic_care_text(observation->'oral',1,4000) and(observation->'oralAbnormality'='false'::jsonb or followup->'required'='true'::jsonb and care_private.basic_care_text(followup->'reason',3,8000)),'Mundpflege benötigt Befund und Reaktion auf Auffälligkeiten.');end if;
 if e->>'lifecycle'='completed' then perform care_private.basic_care_require(outcome not in('planned','offered') and followup->'required'='false'::jsonb,'Abschluss benötigt tatsächliches Ergebnis und nachgewiesenen Abschluss aller Folgeaufträge.');end if;
end$$;

create or replace function care_private.basic_care_original(root_ref uuid)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',h.id,'tenantId',r.tenant_id,'clientId',r.client_id,'rootId',r.id,'headId',h.id,'revision',h.revision,'kind',r.kind,'recordedAt',to_char(h.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',h.actor_id,'recordedByName',h.actor_name,'payload',h.payload,'contentFingerprint',h.content_fingerprint,'voided',false,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'previousId',e.previous_id,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',e.actor_id,'recordedByName',e.actor_name,'reason',e.reason,'payload',e.payload,'contentFingerprint',e.content_fingerprint) order by e.revision) from public.basic_care_events e where e.root_id=r.id))
 from public.basic_care_roots r join lateral(select e.* from public.basic_care_events e where e.root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;
create or replace function care_private.read_basic_care_prerequisites(requested_tenant uuid,requested_client uuid,requested_actor uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);
 select jsonb_build_object('plans',coalesce(jsonb_agg(jsonb_build_object('planVersionId',b.plan_version_id,'measureId',b.measure_id,'visitId',b.visit_id,'planSnapshotSha256',b.plan_snapshot_sha256,'kind',b.kind,'title',b.title,'plannedAt',to_char(b.planned_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'secondPersonRequired',b.second_person_required,'pressureOriginals',b.pressure_originals,'fallOriginals',b.fall_originals) order by b.planned_at,b.id),'[]'::jsonb),'pressure',null,'fall',null,'blockedReason','Dekubitus-, Sturz- und native Kontrollauftragsbezüge benötigen eine gesondert nachgewiesene Anbindung.') into result from public.basic_care_plan_bindings b where b.tenant_id=requested_tenant and b.client_id=requested_client and care_private.basic_care_binding_current(b);
 perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);return result;
end$$;
create or replace function care_private.basic_care_state(t uuid,c uuid,a uuid)returns text language plpgsql security definer set search_path='' as $$declare sources jsonb;begin
 perform care_private.basic_care_actor(t,c,a,false);
 select jsonb_build_object('client',(select to_jsonb(x) from public.clients x where x.id=c and x.tenant_id=t),'assignment',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.client_module_assignments x where x.client_id=c and x.tenant_id=t),'[]'::jsonb),'actor',(select to_jsonb(x) from public.profiles x where x.id=a and x.tenant_id=t),'ownRole',(select to_jsonb(r) from public.roles r join public.profiles x on x.role_id=r.id where x.id=a and x.tenant_id=t),'rolePermissions',coalesce((select jsonb_agg(to_jsonb(z) order by z.permission_key) from public.role_permissions z join public.profiles x on x.role_id=z.role_id where x.id=a and x.tenant_id=t),'[]'::jsonb),'tenantPermissionSets',coalesce((select jsonb_agg(to_jsonb(z) order by z.permission_key) from public.role_permission_sets z join public.roles r on r.key=z.role_key join public.profiles x on x.role_id=r.id where x.id=a and x.tenant_id=t and z.tenant_id=t),'[]'::jsonb),'bindings',coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from public.basic_care_plan_bindings b where b.tenant_id=t and b.client_id=c),'[]'::jsonb),'care',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.basic_care_events e where e.tenant_id=t and e.client_id=c),'[]'::jsonb),'reviews',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.basic_care_review_events e where e.tenant_id=t and e.client_id=c),'[]'::jsonb),
 'plans',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.care_plans p where p.tenant_id=t and p.client_id=c),'[]'::jsonb),'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from public.care_plan_versions v join public.care_plans p on p.id=v.care_plan_id and p.tenant_id=v.tenant_id where p.tenant_id=t and p.client_id=c),'[]'::jsonb),'measures',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.care_plan_items i join public.care_plans p on p.id=i.care_plan_id and p.tenant_id=i.tenant_id where p.tenant_id=t and p.client_id=c),'[]'::jsonb),'visits',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('tour',to_jsonb(tr)) order by s.id) from public.care_tour_stops s join public.care_tours tr on tr.id=s.tour_id and tr.tenant_id=s.tenant_id where s.tenant_id=t and s.client_id=c),'[]'::jsonb)) into sources;
 perform care_private.basic_care_actor(t,c,a,false);return care_private.basic_care_fingerprint(sources);
end$$;
create or replace function care_private.read_basic_care_page(requested_tenant uuid,requested_client uuid,requested_actor uuid,cursor_recorded_at timestamptz,cursor_id uuid,page_size integer)returns jsonb language plpgsql security definer set search_path='' as $$declare before_state text;after_state text;result jsonb;begin
 perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);
 perform care_private.basic_care_require(page_size between 1 and 100 and(cursor_recorded_at is null)=(cursor_id is null) and(cursor_recorded_at is null or isfinite(cursor_recorded_at)),'Ungültige Grundpflegeseite oder Cursorbindung.');
 if cursor_id is not null and not exists(select 1 from public.basic_care_events e where e.id=cursor_id and e.recorded_at=cursor_recorded_at and e.tenant_id=requested_tenant and e.client_id=requested_client and not exists(select 1 from public.basic_care_events n where n.root_id=e.root_id and n.revision>e.revision)) then raise exception 'Cursor ist kein aktueller Kopf dieser Pflegeakte.' using errcode='40001';end if;
 before_state:=care_private.basic_care_state(requested_tenant,requested_client,requested_actor);
 with heads as(select distinct on(e.root_id)e.* from public.basic_care_events e where e.tenant_id=requested_tenant and e.client_id=requested_client order by e.root_id,e.revision desc),page as materialized(select * from heads h where cursor_id is null or(h.recorded_at,h.id)<(cursor_recorded_at,cursor_id) order by h.recorded_at desc,h.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.basic_care_original(p.root_id) order by p.recorded_at desc,p.id desc) from page p),'[]'::jsonb),'nextCursorRecordedAt',(select to_char(p.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.recorded_at,p.id limit 1),'nextCursorId',(select p.id from page p order by p.recorded_at,p.id limit 1)) into result;
 after_state:=care_private.basic_care_state(requested_tenant,requested_client,requested_actor);perform care_private.basic_care_require(before_state=after_state,'Grundpflegebestand wurde während des Lesens verändert.');return result||jsonb_build_object('stateFingerprint',after_state);
end$$;
create or replace function care_private.basic_care_involved(t uuid,e jsonb,a uuid,b public.basic_care_plan_bindings)returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb:='[]'::jsonb;person_id uuid;accounts jsonb;begin
 for person_id in select distinct x.id from(
  select a id union select(b.plan_original->>'issuedBy')::uuid
  union select nullif(b.plan_original#>>'{sources,planVersion,actor_id}','')::uuid
  union select nullif(b.plan_original#>>'{sources,measure,created_by}','')::uuid
  union select nullif(b.plan_original#>>'{sources,measure,updated_by}','')::uuid
  union select nullif(b.plan_original#>>'{sources,tour,created_by}','')::uuid
  union select nullif(b.plan_original#>>'{sources,tour,updated_by}','')::uuid
  union select value::uuid from jsonb_array_elements_text(e#>'{assistance,helpers}')
  union select value::uuid from jsonb_array_elements_text(e#>'{execution,performedBy}')
  union select nullif(e#>>'{followUp,responsibleProfileId}','')::uuid)x where x.id is not null loop
  select coalesce(jsonb_agg(distinct u.id),'[]'::jsonb) into accounts from public.profiles p join auth.users u on u.id=p.id or u.id=p.auth_user_id where p.id=person_id and p.tenant_id=t;
  if person_id=a then accounts:=accounts||jsonb_build_array(auth.uid());end if;
  if person_id=(b.plan_original->>'issuedBy')::uuid then accounts:=accounts||jsonb_build_array((b.plan_original->>'issuedByAuthUser')::uuid);end if;
  result:=result||jsonb_build_array(jsonb_build_object('profileId',person_id,'authUserIds',accounts));
 end loop;return result;
end$$;

create or replace function care_private.commit_basic_care_packet(p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid;c uuid;a uuid;req uuid;r uuid;event_ref uuid:=gen_random_uuid();b public.basic_care_plan_bindings;prior public.basic_care_events;receipt public.basic_care_receipts;original jsonb;name text;now_at timestamptz;expected integer;field text;begin
 perform care_private.basic_care_require(care_private.basic_care_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','actorId','expectedHeadId','expectedRevision','entry','reason','original','pressureOriginals','fallOriginals']) and p->'schemaVersion'='"1"'::jsonb and p->>'action' in('create','revise') and jsonb_typeof(p->'expectedRevision')='number' and p->>'expectedRevision'~'^(0|[1-9][0-9]{0,3})$' and(p->>'expectedRevision')::integer<2000 and care_private.basic_care_text(p->'reason',0,2000),'Vollständiges eigenes Grundpflegepaket fehlt.');
 foreach field in array array['requestId','tenantId','clientId','actorId'] loop perform care_private.basic_care_require(care_private.basic_care_uuid(p->field),'Grundpflegekennung ist ungültig.');end loop;
 t:=(p->>'tenantId')::uuid;c:=(p->>'clientId')::uuid;a:=(p->>'actorId')::uuid;req:=(p->>'requestId')::uuid;expected:=(p->>'expectedRevision')::integer;
 perform care_private.basic_care_actor(t,c,a,true);perform pg_advisory_xact_lock(hashtextextended('basic-care-request:'||req,0));perform pg_advisory_xact_lock(hashtextextended('basic-care:'||t||':'||c,0));
 perform care_private.basic_care_actor(t,c,a,true);
 select * into receipt from public.basic_care_receipts x where x.request_id=req for share;
 if found then if receipt.tenant_id<>t or receipt.client_id<>c or receipt.actor_id<>a or receipt.packet is distinct from p or not exists(select 1 from public.basic_care_events e where e.id=receipt.event_id and e.auth_user_id=auth.uid()) then raise exception 'Grundpflegeanfrage ist anders belegt.' using errcode='40001';end if;return jsonb_build_object('requestId',req,'packet',p,'original',receipt.original);end if;
 perform care_private.basic_care_require(care_private.basic_care_uuid(p#>'{entry,planVersionId}') and care_private.basic_care_uuid(p#>'{entry,measureId}') and care_private.basic_care_uuid(p#>'{entry,visitId}'),'Eindeutige native Plan-, Maßnahmen- und Einsatzkennung fehlt.');
 select * into b from public.basic_care_plan_bindings x where x.tenant_id=t and x.client_id=c and x.plan_version_id=(p#>>'{entry,planVersionId}')::uuid and x.measure_id=(p#>>'{entry,measureId}')::uuid and x.visit_id=(p#>>'{entry,visitId}')::uuid for share;
 if b.id is null or care_private.basic_care_binding_current(b) is not true then raise exception 'Aktuelle unveränderte native Planbindung fehlt.' using errcode='40001';end if;
 perform care_private.basic_care_require(p->'pressureOriginals'='null'::jsonb and p->'fallOriginals'='null'::jsonb,'Prophylaxeoriginale sind noch nicht an native Quellen angebunden.');
 perform care_private.validate_basic_care_entry(p->'entry',t,b);
 if p->>'action'='create' then
  perform care_private.basic_care_require(expected=0 and p->'expectedHeadId'='null'::jsonb and p->'original'='null'::jsonb and p->>'reason'='','Neuanlage enthält einen erfundenen historischen Kopf.');r:=event_ref;
 else
  perform care_private.basic_care_require(care_private.basic_care_uuid(p->'expectedHeadId') and care_private.basic_care_text(p->'reason',10,2000),'Fortschreibung benötigt Kopf und konkreten Grund.');
  select * into prior from public.basic_care_events e where e.id=(p->>'expectedHeadId')::uuid and e.tenant_id=t and e.client_id=c for update;
  if prior.id is null or prior.revision<>expected or exists(select 1 from public.basic_care_events n where n.root_id=prior.root_id and n.revision>prior.revision) or care_private.basic_care_original(prior.root_id) is distinct from p->'original' or prior.payload=p->'entry' or not exists(select 1 from public.basic_care_roots x where x.id=prior.root_id and x.plan_binding_id=b.id) then raise exception 'Aktuelles vollständiges Grundpflegeoriginal wurde geändert.' using errcode='40001';end if;r:=prior.root_id;
 end if;
 perform care_private.basic_care_actor(t,c,a,true);perform care_private.validate_basic_care_entry(p->'entry',t,b);now_at:=clock_timestamp();
 select p0.display_name into name from public.profiles p0 where p0.id=a and p0.tenant_id=t;
 perform care_private.basic_care_require(length(btrim(coalesce(name,'')))>0,'Aktueller Dokumentationsname fehlt.');
 if expected=0 then insert into public.basic_care_roots(id,tenant_id,client_id,kind,plan_binding_id,created_at)values(r,t,c,b.kind,b.id,now_at);end if;
 insert into public.basic_care_events(id,tenant_id,client_id,root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,reason,payload,content_fingerprint,packet,auth_user_id,involved_auth)
 values(event_ref,t,c,r,expected+1,prior.id,req,a,name,now_at,p->>'reason',p->'entry',care_private.basic_care_fingerprint(p->'entry'),p,auth.uid(),care_private.basic_care_involved(t,p->'entry',a,b));
 original:=care_private.basic_care_original(r);insert into public.basic_care_receipts(request_id,tenant_id,client_id,actor_id,root_id,event_id,packet,original,recorded_at)values(req,t,c,a,r,event_ref,p,original,now_at);
 return jsonb_build_object('requestId',req,'packet',p,'original',original);
end$$;
create or replace function care_private.confirm_basic_care_packet(requested_tenant uuid,requested_client uuid,requested_actor uuid,requested_request uuid,p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare r public.basic_care_receipts;begin
 perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);
 select * into r from public.basic_care_receipts x where x.request_id=requested_request and x.tenant_id=requested_tenant and x.client_id=requested_client and x.actor_id=requested_actor;
 if r.request_id is null or r.packet is distinct from p or not exists(select 1 from public.basic_care_events e where e.id=r.event_id and e.auth_user_id=auth.uid()) then raise exception 'Passende eigene unveränderliche Grundpflegequittung fehlt.' using errcode='P0F02';end if;
 perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);return jsonb_build_object('requestId',r.request_id,'packet',r.packet,'original',r.original);
end$$;

create or replace function care_private.basic_care_review_original(root_ref uuid)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',h.id,'tenantId',r.tenant_id,'clientId',r.client_id,'rootId',r.id,'headId',h.id,'revision',h.revision,'careRootId',r.basic_care_root_id,'careHeadId',r.care_head_id,'careContentFingerprint',r.care_content_fingerprint,'status',case h.kind when 'review_request' then 'requested' when 'review_return' then 'returned' else 'accepted' end,
 'history',(select jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'previousId',e.previous_id,'requestId',e.request_id,'kind',e.kind,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id,'actorName',e.actor_name,'reason',e.reason,'requiredChange',e.required_change,'rationale',e.rationale,'careHeadId',e.care_head_id,'careContentFingerprint',e.care_content_fingerprint,'qualificationOriginal',e.qualification_original,'contentFingerprint',e.content_fingerprint) order by e.revision) from public.basic_care_review_events e where e.review_root_id=r.id))
 from public.basic_care_review_roots r join lateral(select e.* from public.basic_care_review_events e where e.review_root_id=r.id order by e.revision desc limit 1)h on true where r.id=root_ref
$$;
create or replace function care_private.read_basic_care_review_page(requested_tenant uuid,requested_client uuid,requested_actor uuid,cursor_recorded_at timestamptz,cursor_id uuid,page_size integer)returns jsonb language plpgsql security definer set search_path='' as $$declare before_state text;after_state text;result jsonb;begin
 perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);
 perform care_private.basic_care_require(page_size between 1 and 100 and(cursor_recorded_at is null)=(cursor_id is null) and(cursor_recorded_at is null or isfinite(cursor_recorded_at)),'Ungültige Prüfseite oder Cursorbindung.');
 if cursor_id is not null and not exists(select 1 from public.basic_care_review_roots r where r.id=cursor_id and r.created_at=cursor_recorded_at and r.tenant_id=requested_tenant and r.client_id=requested_client) then raise exception 'Prüfcursor gehört nicht zu diesem Pflegefall.' using errcode='40001';end if;
 before_state:=care_private.basic_care_state(requested_tenant,requested_client,requested_actor);
 with page as materialized(select r.* from public.basic_care_review_roots r where r.tenant_id=requested_tenant and r.client_id=requested_client and(cursor_id is null or(r.created_at,r.id)<(cursor_recorded_at,cursor_id)) order by r.created_at desc,r.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.basic_care_review_original(p.id) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),'nextCursorRecordedAt',(select to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.created_at,p.id limit 1),'nextCursorId',(select p.id from page p order by p.created_at,p.id limit 1)) into result;
 after_state:=care_private.basic_care_state(requested_tenant,requested_client,requested_actor);perform care_private.basic_care_require(before_state=after_state,'Prüfbestand wurde während des Lesens verändert.');return result||jsonb_build_object('stateFingerprint',after_state);
end$$;

create or replace function care_private.basic_care_review_qualification(t uuid,a uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare qvalue jsonb;now_at timestamptz;today date;begin
 -- Locks precede the fresh clock. Generic roles or an arbitrary credential title never imply this scope.
 lock table public.employees,public.employee_employment_details,public.employee_qualifications,public.employee_documents,care_private.basic_care_review_scopes in share mode;
 perform care_private.require_workspace_session(t,a);now_at:=clock_timestamp();today:=(now_at at time zone 'Europe/Berlin')::date;
 select jsonb_build_object('id',q.id,'employeeId',e.id,'profileId',a,'qualificationType',q.qualification_type,'title',q.title,'status',q.status,'validUntil',to_char(q.valid_until,'YYYY-MM-DD'),'verifiedAt',to_char(q.verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updatedAt',to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sourceFingerprint',sc.qualification_fingerprint,
 'documentId',d.id,'documentFingerprint',sc.document_fingerprint,'scopeId',sc.id,'scopeKind',sc.kind,'scopeFingerprint',care_private.basic_care_fingerprint(to_jsonb(sc)),'employeeFingerprint',care_private.basic_care_fingerprint(jsonb_build_object('employee',to_jsonb(e),'employment',to_jsonb(ed)))) into qvalue
 from public.employees e join public.employee_employment_details ed on ed.employee_id=e.id and ed.tenant_id=e.tenant_id join public.employee_qualifications q on q.employee_id=e.id and q.tenant_id=e.tenant_id join public.employee_documents d on d.id=q.document_id and d.employee_id=e.id and d.tenant_id=e.tenant_id
 join care_private.basic_care_review_scopes sc on sc.employee_id=e.id and sc.qualification_id=q.id and sc.tenant_id=e.tenant_id and sc.kind='basic_care_review'
 where e.tenant_id=t and e.profile_id=a and e.status='aktiv' and ed.employment_status='active' and coalesce(e.entry_date,e.start_date)<=today and(e.entry_date is null or e.entry_date<=today) and(e.start_date is null or e.start_date<=today) and(e.exit_date is null or e.exit_date>=today)
 and q.status in('valid','expires_soon') and q.verified_at is not null and q.verified_at<=now_at and q.updated_at<=now_at and(q.issued_at is null or q.issued_at<=today) and(q.valid_until is null or q.valid_until>=today)
 and btrim(coalesce(q.title,''))<>'' and btrim(coalesce(q.qualification_type,''))<>'' and(d.valid_until is null or d.valid_until>=today) and btrim(coalesce(d.storage_path,''))<>''
 and sc.approved_at<=now_at and sc.valid_until>now_at and sc.revoked_at is null and sc.qualification_fingerprint=care_private.basic_care_fingerprint(to_jsonb(q)) and sc.document_fingerprint=care_private.basic_care_fingerprint(to_jsonb(d))
 order by sc.approved_at desc,sc.id desc limit 1;
 if qvalue is null then raise exception 'Aktuelle Beschäftigung, verifiziertes Dokument und ausdrücklicher Grundpflegeprüfbereich fehlen.' using errcode='42501';end if;return qvalue;
end$$;
create or replace function care_private.commit_basic_care_review(p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid;c uuid;a uuid;req uuid;care_root uuid;care_head uuid;review_root uuid;event_ref uuid:=gen_random_uuid();receipt public.basic_care_review_receipts;prior public.basic_care_review_events;b public.basic_care_plan_bindings;expected integer;field text;action_value text;kind_value text;qualification jsonb;original jsonb;name text;now_at timestamptz;begin
 perform care_private.basic_care_require(care_private.basic_care_keys(p,array['schemaVersion','action','requestId','tenantId','clientId','actorId','occurredAt','expectedReviewHeadId','expectedReviewRevision','careOriginal','reviewOriginal','reason','requiredChange','rationale']) and p->'schemaVersion'='"1"'::jsonb and p->>'action' in('request','return','accept') and jsonb_typeof(p->'expectedReviewRevision')='number' and p->>'expectedReviewRevision'~'^[01]$' and care_private.basic_care_text(p->'reason',0,2000) and care_private.basic_care_text(p->'requiredChange',0,4000) and care_private.basic_care_text(p->'rationale',0,4000),'Vollständiges eigenes Grundpflegeprüfpaket fehlt.');
 foreach field in array array['requestId','tenantId','clientId','actorId'] loop perform care_private.basic_care_require(care_private.basic_care_uuid(p->field),'Prüfkennung ist ungültig.');end loop;
 perform care_private.basic_care_require(care_private.basic_care_uuid(p#>'{careOriginal,rootId}') and care_private.basic_care_uuid(p#>'{careOriginal,headId}'),'Vollständige aktuelle Grundpflegekennung fehlt.');
 t:=(p->>'tenantId')::uuid;c:=(p->>'clientId')::uuid;a:=(p->>'actorId')::uuid;req:=(p->>'requestId')::uuid;expected:=(p->>'expectedReviewRevision')::integer;action_value:=p->>'action';care_root:=(p#>>'{careOriginal,rootId}')::uuid;care_head:=(p#>>'{careOriginal,headId}')::uuid;
 perform care_private.basic_care_actor(t,c,a,false);perform pg_advisory_xact_lock(hashtextextended('basic-care-request:'||req,0));perform pg_advisory_xact_lock(hashtextextended('basic-care:'||t||':'||c,0));
 perform care_private.basic_care_actor(t,c,a,false);
 select * into receipt from public.basic_care_review_receipts r where r.request_id=req for share;
 if found then if receipt.tenant_id<>t or receipt.client_id<>c or receipt.actor_id<>a or receipt.packet is distinct from p or not exists(select 1 from public.basic_care_review_events e where e.id=receipt.event_id and e.auth_user_id=auth.uid()) then raise exception 'Prüfanfrage ist anders belegt.' using errcode='40001';end if;return jsonb_build_object('requestId',req,'packet',p,'original',receipt.original);end if;
 perform 1 from public.basic_care_roots r where r.id=care_root and r.tenant_id=t and r.client_id=c for share;
 if not found or care_private.basic_care_original(care_root) is distinct from p->'careOriginal' or p#>>'{careOriginal,headId}' is distinct from care_head::text then raise exception 'Aktuelles vollständiges Grundpflegeoriginal fehlt.' using errcode='40001';end if;
 select x.* into b from public.basic_care_roots r join public.basic_care_plan_bindings x on x.id=r.plan_binding_id where r.id=care_root;
 if care_private.basic_care_binding_current(b) is not true then raise exception 'Native Planbindung wurde seit der Dokumentation verändert.' using errcode='40001';end if;
 perform care_private.basic_care_require(p#>>'{careOriginal,payload,lifecycle}'='completed' and p#>>'{careOriginal,payload,execution,outcome}' not in('planned','offered'),'Planung oder offenes weiteres Vorgehen ist keine abgeschlossene tatsächliche Versorgung.');
 if action_value='request' then
  perform care_private.basic_care_actor(t,c,a,true);
  perform care_private.basic_care_require(expected=0 and p->'expectedReviewHeadId'='null'::jsonb and p->'reviewOriginal'='null'::jsonb and care_private.basic_care_text(p->'reason',10,2000) and p->>'requiredChange'='' and p->>'rationale'='','Prüfanfrage darf keine Fachentscheidung vorwegnehmen.');
  review_root:=event_ref;kind_value:='review_request';
 else
  if care_private.basic_care_has('pflege.documentation.sign') is not true then raise exception 'Eigenes Fachprüfrecht fehlt.' using errcode='42501';end if;
  perform care_private.basic_care_require(care_private.basic_care_uuid(p->'expectedReviewHeadId'),'Aktueller Prüfkopf fehlt.');review_root:=(p#>>'{reviewOriginal,rootId}')::uuid;
  select * into prior from public.basic_care_review_events e where e.review_root_id=review_root and e.tenant_id=t and e.client_id=c order by e.revision desc limit 1 for update;
  if prior.id is null or prior.id<>(p->>'expectedReviewHeadId')::uuid or prior.revision<>expected or expected<>1 or prior.kind<>'review_request' or care_private.basic_care_review_original(review_root) is distinct from p->'reviewOriginal' or prior.care_head_id<>care_head or prior.care_content_fingerprint is distinct from p#>>'{careOriginal,contentFingerprint}' then raise exception 'Aktuelle unveränderte Prüfanfrage fehlt.' using errcode='40001';end if;
  if prior.actor_id=a or prior.auth_user_id is null or prior.auth_user_id=auth.uid() or exists(select 1 from public.basic_care_events e where e.root_id=care_root and(e.actor_id=a or e.auth_user_id is null or e.auth_user_id=auth.uid() or e.involved_auth is null or exists(select 1 from jsonb_array_elements(e.involved_auth)person where person->>'profileId'=a::text or jsonb_array_length(person->'authUserIds')=0 or person->'authUserIds'@>jsonb_build_array(auth.uid())))) then raise exception 'Anfragende, planende, dokumentierende oder ausführende Person und dasselbe angemeldete Konto dürfen nicht selbst entscheiden.' using errcode='42501';end if;
  qualification:=care_private.basic_care_review_qualification(t,a);
  if action_value='return' then perform care_private.basic_care_require(care_private.basic_care_text(p->'reason',10,2000) and care_private.basic_care_text(p->'requiredChange',10,4000) and p->>'rationale'='','Rückgabe benötigt eigenen Grund und konkrete Änderung.');kind_value:='review_return';
  else perform care_private.basic_care_require(p->>'reason'='' and p->>'requiredChange'='' and care_private.basic_care_text(p->'rationale',10,4000),'Fachliche Annahme benötigt eigene Begründung.');kind_value:='review_acceptance';end if;
 end if;
 perform care_private.basic_care_actor(t,c,a,action_value='request');
 if action_value<>'request' then
  if care_private.basic_care_has('pflege.documentation.sign') is not true then raise exception 'Fachprüfrecht wurde beendet.' using errcode='42501';end if;
  if qualification is distinct from care_private.basic_care_review_qualification(t,a) then raise exception 'Beschäftigungs- oder Fachprüfgrundlage wurde verändert.' using errcode='42501';end if;
 end if;
 now_at:=clock_timestamp();perform care_private.basic_care_require(care_private.basic_care_time(p->'occurredAt')<=now_at and care_private.basic_care_time(p->'occurredAt')>=(select e.recorded_at from public.basic_care_events e where e.id=care_head) and(prior.id is null or care_private.basic_care_time(p->'occurredAt')>=prior.recorded_at),'Prüfzeit muss nach der dokumentierten Fassung und vor der aktuellen Serverzeit liegen.');
 select x.display_name into name from public.profiles x where x.id=a and x.tenant_id=t;perform care_private.basic_care_require(length(btrim(coalesce(name,'')))>0,'Aktueller Prüfungsname fehlt.');
 if action_value='request' then insert into public.basic_care_review_roots(id,tenant_id,client_id,basic_care_root_id,care_head_id,care_content_fingerprint,created_at)values(review_root,t,c,care_root,care_head,p#>>'{careOriginal,contentFingerprint}',now_at);end if;
 insert into public.basic_care_review_events(id,tenant_id,client_id,review_root_id,revision,previous_id,request_id,actor_id,actor_name,recorded_at,kind,reason,required_change,rationale,qualification_original,care_head_id,care_content_fingerprint,content_fingerprint,packet,auth_user_id)
 values(event_ref,t,c,review_root,expected+1,prior.id,req,a,name,now_at,kind_value,p->>'reason',p->>'requiredChange',p->>'rationale',qualification,care_head,p#>>'{careOriginal,contentFingerprint}',care_private.basic_care_fingerprint(jsonb_build_object('packet',p,'qualification',qualification)),p,auth.uid());
 original:=care_private.basic_care_review_original(review_root);insert into public.basic_care_review_receipts(request_id,tenant_id,client_id,actor_id,review_root_id,event_id,packet,original,recorded_at)values(req,t,c,a,review_root,event_ref,p,original,now_at);return jsonb_build_object('requestId',req,'packet',p,'original',original);
end$$;
create or replace function care_private.confirm_basic_care_review(requested_tenant uuid,requested_client uuid,requested_actor uuid,requested_request uuid,p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare r public.basic_care_review_receipts;begin
 perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);select * into r from public.basic_care_review_receipts x where x.request_id=requested_request and x.tenant_id=requested_tenant and x.client_id=requested_client and x.actor_id=requested_actor;
 if r.request_id is null or r.packet is distinct from p or not exists(select 1 from public.basic_care_review_events e where e.id=r.event_id and e.auth_user_id=auth.uid()) then raise exception 'Passende eigene unveränderliche Prüfquittung fehlt.' using errcode='P0F02';end if;perform care_private.basic_care_actor(requested_tenant,requested_client,requested_actor,false);return jsonb_build_object('requestId',r.request_id,'packet',r.packet,'original',r.original);
end$$;

-- Prepared originals never change. A later native plan/visit change invalidates
-- the current binding; it does not rewrite a historical care receipt.
create or replace function care_private.basic_care_immutable()returns trigger language plpgsql security definer set search_path='' as $$begin
 raise exception 'Grundpflegeoriginale, Planbindungen und historische Quittungen sind unveränderlich.' using errcode='42501';
end$$;
create or replace function care_private.basic_care_guard_native_version()returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.basic_care_plan_bindings b where b.plan_version_id=old.id and b.tenant_id=old.tenant_id and b.plan_original->>'version'='basic-care-native-binding/1') then
  raise exception 'Die ursprüngliche gebundene native Planfassung bleibt unverändert; eine neue Fassung anlegen.' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
drop trigger if exists basic_care_bound_plan_version_immutable on public.care_plan_versions;
create trigger basic_care_bound_plan_version_immutable before update or delete on public.care_plan_versions for each row execute function care_private.basic_care_guard_native_version();
do $$declare tab text;begin
 foreach tab in array array['basic_care_plan_bindings','basic_care_roots','basic_care_events','basic_care_receipts','basic_care_review_roots','basic_care_review_events','basic_care_review_receipts'] loop
  execute format('drop trigger if exists basic_care_immutable on public.%I',tab);
  execute format('create trigger basic_care_immutable before update or delete on public.%I for each row execute function care_private.basic_care_immutable()',tab);
 end loop;
end$$;
drop trigger if exists basic_care_binding_request_immutable on care_private.basic_care_binding_requests;
create trigger basic_care_binding_request_immutable before update or delete on care_private.basic_care_binding_requests for each row execute function care_private.basic_care_immutable();

-- Named browser arguments retain the existing Web DTO. The issuer remains
-- quarantined too: explicit authored planning facts never enable clinical use.
create or replace function public.web_issue_basic_care_binding(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.issue_basic_care_binding(p_packet)$$;
create or replace function public.web_read_basic_care_prerequisites(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_basic_care_prerequisites(p_tenant_id,p_client_id,p_actor_profile_id)$$;
create or replace function public.web_read_basic_care_page(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_basic_care_page(p_tenant_id,p_client_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_basic_care_packet(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_basic_care_packet(p_packet)$$;
create or replace function public.web_confirm_basic_care_packet(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_basic_care_packet(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet)$$;
create or replace function public.web_read_basic_care_review_page(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_basic_care_review_page(p_tenant_id,p_client_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;
create or replace function public.web_commit_basic_care_review(p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_basic_care_review(p_packet)$$;
create or replace function public.web_confirm_basic_care_review(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_basic_care_review(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet)$$;

-- Exact family denial includes pre-existing overloads without altering shared
-- schema ACLs, unrelated clinical writers, Android/native APIs or production.
revoke all on public.basic_care_plan_bindings,public.basic_care_roots,public.basic_care_events,public.basic_care_receipts,public.basic_care_review_roots,public.basic_care_review_events,public.basic_care_review_receipts,care_private.basic_care_binding_requests,care_private.basic_care_review_scopes from public,anon,authenticated,service_role;
do $$declare entry record;begin
 for entry in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='care_private' and(p.proname like 'basic\_care\_%' escape '\' or p.proname in('issue_basic_care_binding','validate_basic_care_entry','read_basic_care_prerequisites','read_basic_care_page','commit_basic_care_packet','confirm_basic_care_packet','read_basic_care_review_page','commit_basic_care_review','confirm_basic_care_review')))
 or(n.nspname='public' and p.proname in('web_issue_basic_care_binding','web_read_basic_care_prerequisites','web_read_basic_care_page','web_commit_basic_care_packet','web_confirm_basic_care_packet','web_read_basic_care_review_page','web_commit_basic_care_review','web_confirm_basic_care_review'))
 loop execute format('revoke all on function %s from public,anon,authenticated,service_role',entry.oid::regprocedure);end loop;
end$$;
