-- LOCAL REVIEW ONLY. Apply only after the wound documentation, care, lifecycle and correction patches
-- in an approved test database. This proposal is intentionally not executed by the checkpoint build.
-- It joins the J-01..J-08 read, append-only escalation, rights-change, receipt and resume contract.
begin;

create table if not exists public.ambulatory_wound_photo_links(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 client_id uuid not null references public.clients(id), wound_case_id uuid not null references public.clinical_wound_cases(id),
 assessment_id uuid not null references public.clinical_wound_assessments(id), consent_id uuid not null references public.client_consents(id),
 storage_path text not null, file_name text not null, content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 captured_at timestamptz not null, recorded_by uuid not null, recorded_by_name text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,wound_case_id,storage_path), unique(tenant_id,wound_case_id,content_sha256)
);

create table if not exists public.ambulatory_wound_path_events(
 id uuid primary key, tenant_id uuid not null references public.tenants(id), client_id uuid not null references public.clients(id),
 wound_case_id uuid not null references public.clinical_wound_cases(id), root_id uuid not null,
 revision integer not null check(revision>0), previous_id uuid references public.ambulatory_wound_path_events(id),
 kind text not null check(kind in ('infection_suspicion','clinical_contact','clinical_response','escalation_resolution','reopen_escalation','correction')),
 observed_at timestamptz not null, payload jsonb not null, reason text not null default '', content_fingerprint text not null,
 recorded_by uuid not null, recorded_by_name text not null, created_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,wound_case_id,root_id,revision), unique(tenant_id,wound_case_id,previous_id),
 check(content_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
 check((revision=1 and previous_id is null and root_id=id) or (revision>1 and previous_id is not null))
);

create index if not exists wound_photo_links_scope on public.ambulatory_wound_photo_links(tenant_id,wound_case_id,captured_at,id);
create index if not exists wound_path_event_scope on public.ambulatory_wound_path_events(tenant_id,wound_case_id,root_id,revision);
create index if not exists wound_path_event_page on public.ambulatory_wound_path_events(tenant_id,wound_case_id,created_at desc,id desc);

do $$declare tbl text;begin
 foreach tbl in array array['ambulatory_wound_photo_links','ambulatory_wound_path_events'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('drop policy if exists wound_path_read on public.%I',tbl);
  execute format('create policy wound_path_read on public.%I for select to authenticated using(true)',tbl);
  execute format('drop policy if exists wound_path_scope on public.%I',tbl);
  execute format('create policy wound_path_scope on public.%1$I as restrictive for select to authenticated using(
   auth.uid() is not null and tenant_id=public.current_tenant_id() and public.has_permission(''pflege.wounds.view'')
   and public.is_active_pfleger_client(client_id)
   and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=%1$I.tenant_id and p.is_active)
   and exists(select 1 from public.clinical_wound_cases w where w.id=%1$I.wound_case_id and w.tenant_id=%1$I.tenant_id and w.client_id=%1$I.client_id))',tbl);
 end loop;
end $$;
revoke all on public.ambulatory_wound_photo_links from public,anon,authenticated;
revoke all on public.ambulatory_wound_path_events from public,anon,authenticated;
grant select on public.ambulatory_wound_photo_links,public.ambulatory_wound_path_events to authenticated;

create table if not exists care_private.wound_path_requests(
 tenant_id uuid not null, request_id uuid not null, client_id uuid not null, wound_case_id uuid not null,
 actor_id uuid not null, packet jsonb not null, result_root_id uuid not null, result_head_id uuid not null,
 result_revision integer not null, created_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,request_id)
);
alter table care_private.wound_path_requests enable row level security;
revoke all on care_private.wound_path_requests from public,anon,authenticated;

create or replace function care_private.wound_path_fingerprint(value jsonb)
returns text language sql immutable security invoker set search_path='' as $$
 select 'sha256:'||encode(extensions.digest(pg_catalog.convert_to(value::text,'UTF8'),'sha256'),'hex')
$$;

create or replace function care_private.guard_wound_path_original()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Gebundene Wundpfad- und Fotooriginale sind append-only.' using errcode='42501';
end $$;
revoke all on function care_private.guard_wound_path_original() from public,anon,authenticated;
drop trigger if exists guard_wound_path_event_original on public.ambulatory_wound_path_events;
create trigger guard_wound_path_event_original before update or delete on public.ambulatory_wound_path_events for each row execute function care_private.guard_wound_path_original();
drop trigger if exists guard_wound_photo_original on public.ambulatory_wound_photo_links;
create trigger guard_wound_photo_original before update or delete on public.ambulatory_wound_photo_links for each row execute function care_private.guard_wound_path_original();

create or replace function care_private.assert_wound_path_authority(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid,write_required boolean,contact_required boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or requested_tenant is null or requested_tenant<>public.current_tenant_id()
 or requested_actor is null or requested_actor<>public.resolve_current_profile_id()
 or not exists(select 1 from public.profiles p where p.id=requested_actor and p.tenant_id=requested_tenant and p.is_active)
 or public.has_permission('pflege.wounds.view') is not true
 or (write_required and public.has_permission('pflege.wounds.manage') is not true)
 or (contact_required and public.has_permission('pflege.treatment.manage') is not true)
 or public.is_active_pfleger_client(requested_client) is not true
 or not exists(select 1 from public.clinical_wound_cases w where w.id=requested_wound and w.tenant_id=requested_tenant and w.client_id=requested_client)
 then raise exception 'Wundfall, Sitzung, Profil oder aktuelle Rechte nicht bestätigt.' using errcode='42501';end if;
end $$;
revoke all on function care_private.assert_wound_path_authority(uuid,uuid,uuid,uuid,boolean,boolean) from public,anon,authenticated;

create or replace function care_private.wound_path_ref(row_id uuid,client_id uuid,wound_id uuid,revision integer,recorded_at timestamptz,payload jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',row_id,'clientId',client_id,'woundId',wound_id,'revision',revision,'recordedAt',recorded_at,
  'fingerprint',care_private.wound_path_fingerprint(payload),'payload',payload)
$$;

create or replace function care_private.read_wound_path_context_impl(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform care_private.assert_wound_path_authority(requested_tenant,requested_client,requested_wound,requested_actor,false,false);
 select jsonb_build_object(
  'wounds',coalesce((select jsonb_agg(care_private.wound_path_ref(w.id,w.client_id,w.id,1,w.updated_at,to_jsonb(w)) order by w.updated_at,w.id) from public.clinical_wound_cases w where w.id=requested_wound and w.tenant_id=requested_tenant and w.client_id=requested_client),'[]'::jsonb),
  'assessments',coalesce((select jsonb_agg(care_private.wound_path_ref(a.id,a.client_id,a.wound_case_id,1,coalesce(a.observed_at,a.assessed_at,a.created_at),to_jsonb(a)) order by coalesce(a.observed_at,a.assessed_at,a.created_at),a.id) from public.clinical_wound_assessments a where a.tenant_id=requested_tenant and a.client_id=requested_client and a.wound_case_id=requested_wound),'[]'::jsonb),
  'photos',coalesce((select jsonb_agg(care_private.wound_path_ref(x.id,x.client_id,x.wound_case_id,1,x.captured_at,to_jsonb(x)||jsonb_build_object('assessment_id',x.assessment_id,'consent_id',x.consent_id)) order by x.captured_at,x.id) from public.ambulatory_wound_photo_links x where x.tenant_id=requested_tenant and x.client_id=requested_client and x.wound_case_id=requested_wound),'[]'::jsonb),
  'photoConsents',coalesce((select jsonb_agg(care_private.wound_path_ref(c.id,c.client_id,requested_wound,1,c.created_at,to_jsonb(c)||jsonb_build_object('status',case when c.granted and (c.expires_at is null or c.expires_at>clock_timestamp()) then 'active' else 'inactive' end)) order by c.created_at,c.id) from public.client_consents c where c.tenant_id=requested_tenant and c.client_id=requested_client and exists(select 1 from public.ambulatory_wound_photo_links x where x.consent_id=c.id and x.wound_case_id=requested_wound)),'[]'::jsonb),
  'plans',coalesce((select jsonb_agg(care_private.wound_path_ref(p.id,p.client_id,p.wound_case_id,p.version,p.created_at,to_jsonb(p)) order by p.version,p.id) from public.ambulatory_wound_plan_versions p where p.tenant_id=requested_tenant and p.client_id=requested_client and p.wound_case_id=requested_wound),'[]'::jsonb),
  'dressings',coalesce((select jsonb_agg(care_private.wound_path_ref(d.id,d.client_id,d.wound_case_id,1,d.created_at,to_jsonb(d)||jsonb_build_object('plan_id',d.plan_id,'occurred_at',d.occurred_at,'outcome',d.outcome,'action',coalesce(d.details->>'action',''),'reason',coalesce(d.details->>'reason',d.details->>'deviation','')))) from public.ambulatory_wound_dressings d where d.tenant_id=requested_tenant and d.client_id=requested_client and d.wound_case_id=requested_wound),'[]'::jsonb),
  'contacts',coalesce((select jsonb_agg(care_private.wound_path_ref(e.id,e.client_id,e.wound_case_id,e.revision,e.observed_at,e.payload->'contact') order by e.observed_at,e.id) from public.ambulatory_wound_path_events e where e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound and e.kind in ('clinical_contact','clinical_response','escalation_resolution')),'[]'::jsonb),
  'lifecycle',coalesce((select jsonb_agg(care_private.wound_path_ref(l.id,l.client_id,l.wound_case_id,1,l.occurred_at,to_jsonb(l)) order by l.occurred_at,l.id) from public.ambulatory_wound_lifecycle_events l where l.tenant_id=requested_tenant and l.client_id=requested_client and l.wound_case_id=requested_wound),'[]'::jsonb),
  'people',coalesce((select jsonb_agg(care_private.wound_path_ref(p.id,requested_client,requested_wound,1,coalesce(p.updated_at,p.created_at),jsonb_build_object('display_name',coalesce(nullif(p.display_name,''),p.email),'active',p.is_active)) order by p.id) from public.profiles p where p.tenant_id=requested_tenant),'[]'::jsonb),
  'corrections',coalesce((select jsonb_agg(care_private.wound_path_ref(c.id,c.client_id,c.wound_case_id,c.version,c.created_at,to_jsonb(c)) order by c.version,c.id) from public.ambulatory_wound_assessment_corrections c where c.tenant_id=requested_tenant and c.client_id=requested_client and c.wound_case_id=requested_wound),'[]'::jsonb),
  'escalations',coalesce((select jsonb_agg(care_private.wound_path_ref(e.id,e.client_id,e.wound_case_id,e.revision,e.observed_at,e.payload||jsonb_build_object('resolution_state',e.payload#>>'{resolution,state}')) order by e.created_at,e.id) from public.ambulatory_wound_path_events e where e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create or replace function public.web_read_wound_path_context(p_tenant_id uuid,p_client_id uuid,p_wound_id uuid,p_actor_profile_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_wound_path_context_impl(p_tenant_id,p_client_id,p_wound_id,p_actor_profile_id)$$;

create or replace function care_private.wound_path_original(root uuid,requested_tenant uuid,requested_client uuid,requested_wound uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with rows as (select e.* from public.ambulatory_wound_path_events e where e.root_id=root and e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound order by e.revision),
 head as (select * from rows order by revision desc limit 1)
 select jsonb_build_object('id',h.id,'tenantId',h.tenant_id,'clientId',h.client_id,'woundId',h.wound_case_id,'rootId',h.root_id,'headId',h.id,'revision',h.revision,'kind',h.kind,'recordedAt',h.observed_at,'recordedBy',h.recorded_by,'recordedByName',h.recorded_by_name,'payload',h.payload,'contentFingerprint',h.content_fingerprint,
  'history',(select jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'previousId',r.previous_id,'recordedAt',r.observed_at,'recordedBy',r.recorded_by,'recordedByName',r.recorded_by_name,'reason',r.reason,'payload',r.payload,'contentFingerprint',r.content_fingerprint) order by r.revision) from rows r)) from head h
$$;
revoke all on function care_private.wound_path_original(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function care_private.read_wound_path_page_impl(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid,cursor_recorded timestamptz,cursor_id uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;last_time timestamptz;last_id uuid;begin
 perform care_private.assert_wound_path_authority(requested_tenant,requested_client,requested_wound,requested_actor,false,false);
 if page_size is null or page_size<1 or page_size>100 then raise exception 'Ungültige Seitengröße.' using errcode='22023';end if;
 with heads as (select distinct on(e.root_id) e.* from public.ambulatory_wound_path_events e where e.tenant_id=requested_tenant and e.client_id=requested_client and e.wound_case_id=requested_wound order by e.root_id,e.revision desc),
 page as (select h.* from heads h where cursor_recorded is null or (h.created_at,h.id)<(cursor_recorded,cursor_id) order by h.created_at desc,h.id desc limit page_size)
 select coalesce(jsonb_agg(care_private.wound_path_original(p.root_id,requested_tenant,requested_client,requested_wound) order by p.created_at desc,p.id desc),'[]'::jsonb) into rows from page p;
 select p.created_at,p.id into last_time,last_id from page p order by p.created_at,p.id limit 1;
 return jsonb_build_object('rows',rows,'nextCursorRecordedAt',case when jsonb_array_length(rows)>0 then last_time end,'nextCursorId',case when jsonb_array_length(rows)>0 then last_id end);
end $$;

create or replace function public.web_read_wound_path_page(p_tenant_id uuid,p_client_id uuid,p_wound_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_wound_path_page_impl(p_tenant_id,p_client_id,p_wound_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;

create or replace function care_private.commit_wound_path_packet_impl(packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid;subject uuid;wound uuid;actor uuid;request uuid;entry jsonb;kind text;action text;receipt care_private.wound_path_requests%rowtype;head public.ambulatory_wound_path_events%rowtype;result_id uuid;root_id uuid;revision integer;fingerprint text;actor_name text;current_sources jsonb;contact_required boolean;begin
 if jsonb_typeof(packet) is distinct from 'object' or packet->>'schemaVersion'<>'1' then raise exception 'Ungültiges Wundpfadpaket.' using errcode='23514';end if;
 tenant:=(packet->>'tenantId')::uuid;subject:=(packet->>'clientId')::uuid;wound:=(packet->>'woundId')::uuid;actor:=(packet->>'actorId')::uuid;request:=(packet->>'requestId')::uuid;entry:=packet->'entry';kind:=entry->>'kind';action:=packet->>'action';
 contact_required:=kind in ('clinical_contact','clinical_response','escalation_resolution');
 perform care_private.assert_wound_path_authority(tenant,subject,wound,actor,true,contact_required);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-path-request:'||request::text,0));
 select * into receipt from care_private.wound_path_requests r where r.tenant_id=tenant and r.request_id=request;
 if receipt.request_id is not null then
  if receipt.actor_id<>actor or receipt.client_id<>subject or receipt.wound_case_id<>wound or receipt.packet<>packet then raise exception 'Anfragekennung wurde mit anderen Originalen verwendet.' using errcode='23514';end if;
  return jsonb_build_object('requestId',request,'packet',packet,'original',care_private.wound_path_original(receipt.result_root_id,tenant,subject,wound));
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':wound-path:'||wound::text,0));
 perform 1 from public.clinical_wound_cases w where w.id=wound and w.tenant_id=tenant and w.client_id=subject for update;
 if not found then raise exception 'Wundfall wurde geändert oder ist nicht zugänglich.' using errcode='40001';end if;
 current_sources:=care_private.read_wound_path_context_impl(tenant,subject,wound,actor);
 if current_sources is distinct from packet->'sources' then raise exception 'Wund-, Befund-, Bild-, Plan-, Versorgungs-, Personen- oder Statusbestand hat sich geändert.' using errcode='40001';end if;
 if kind not in ('infection_suspicion','clinical_contact','clinical_response','escalation_resolution','reopen_escalation','correction') or entry->>'tenantId'<>tenant::text or entry->>'clientId'<>subject::text or entry->>'woundId'<>wound::text then raise exception 'Vorgangsart oder Wundbindung ungültig.' using errcode='23514';end if;
 if nullif(btrim(entry->>'title'),'') is null or nullif(btrim(entry#>>'{observation,narrative}'),'') is null or nullif(btrim(entry#>>'{contact,nextStep}'),'') is null or nullif(btrim(entry#>>'{person,decision}'),'') is null then raise exception 'Beobachtung, nächster Schritt und Personenentscheidung fehlen.' using errcode='23514';end if;
 if kind='infection_suspicion' and (entry#>>'{observation,state}'<>'suspected' or jsonb_array_length(entry#>'{observation,signs}')=0) then raise exception 'Verdacht benötigt tatsächlich beobachtete Zeichen; keine Diagnose wird abgeleitet.' using errcode='23514';end if;
 if entry#>>'{observation,photoId}' is not null and (entry#>>'{person,photoDecision}'<>'consented' or not exists(select 1 from public.ambulatory_wound_photo_links x join public.client_consents c on c.id=x.consent_id and c.tenant_id=x.tenant_id and c.client_id=x.client_id where x.id=(entry#>>'{observation,photoId}')::uuid and x.tenant_id=tenant and x.client_id=subject and x.wound_case_id=wound and c.id=(entry#>>'{observation,photoConsentId}')::uuid and c.granted and (c.expires_at is null or c.expires_at>clock_timestamp()))) then raise exception 'Foto und aktive Einwilligung sind nicht unverändert gebunden.' using errcode='23514';end if;
 if kind='clinical_response' and (entry#>>'{contact,state}'<>'responded' or nullif(btrim(entry#>>'{contact,response}'),'') is null) then raise exception 'Tatsächliche Rückmeldung fehlt.' using errcode='23514';end if;
 if kind='escalation_resolution' and (entry#>>'{resolution,state}'<>'resolved' or entry#>>'{contact,state}'<>'responded' or nullif(btrim(entry#>>'{resolution,result}'),'') is null) then raise exception 'Abschluss benötigt tatsächliche Rückmeldung und Ergebnis.' using errcode='23514';end if;
 if kind='reopen_escalation' and (entry#>>'{resolution,state}'<>'reopened' or not exists(select 1 from public.ambulatory_wound_path_events e where e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=wound and e.payload#>>'{resolution,state}'='resolved')) then raise exception 'Wiederöffnung benötigt einen abgeschlossenen Originalverlauf.' using errcode='23514';end if;
 if action='create' then
  if packet->'original'<>'null'::jsonb or packet->'expectedHeadId'<>'null'::jsonb or (packet->>'expectedRevision')::integer<>0 or packet->>'reason'<>'' then raise exception 'Neuanlage enthält fremden historischen Kopf.' using errcode='23514';end if;
  result_id:=request;root_id:=request;revision:=1;
 elsif action='revise' then
  select * into head from public.ambulatory_wound_path_events e where e.id=(packet->>'expectedHeadId')::uuid and e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=wound for update;
  if head.id is null or head.revision<>(packet->>'expectedRevision')::integer or care_private.wound_path_original(head.root_id,tenant,subject,wound) is distinct from packet->'original' or exists(select 1 from public.ambulatory_wound_path_events x where x.root_id=head.root_id and x.revision>head.revision) then raise exception 'Eskalationsverlauf hat einen neueren Kopf.' using errcode='40001';end if;
  if length(btrim(packet->>'reason'))<10 then raise exception 'Konkreter Fortschreibungsgrund fehlt.' using errcode='23514';end if;
  result_id:=request;root_id:=head.root_id;revision:=head.revision+1;
 else raise exception 'Paketaktion ungültig.' using errcode='23514';end if;
 if kind='correction' and (entry#>>'{correction,targetId}')::uuid not in(select e.id from public.ambulatory_wound_path_events e where e.tenant_id=tenant and e.client_id=subject and e.wound_case_id=wound) then raise exception 'Korrekturoriginal fehlt.' using errcode='23514';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 fingerprint:=care_private.wound_path_fingerprint(entry);
 insert into public.ambulatory_wound_path_events(id,tenant_id,client_id,wound_case_id,root_id,revision,previous_id,kind,observed_at,payload,reason,content_fingerprint,recorded_by,recorded_by_name)
 values(result_id,tenant,subject,wound,root_id,revision,head.id,kind,(entry->>'observedAt')::timestamptz,entry,case when revision=1 then '' else btrim(packet->>'reason') end,fingerprint,actor,actor_name);
 insert into care_private.wound_path_requests(tenant_id,request_id,client_id,wound_case_id,actor_id,packet,result_root_id,result_head_id,result_revision)
 values(tenant,request,subject,wound,actor,packet,root_id,result_id,revision);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,subject,'wound_path',result_id,kind,'Wund-/Eskalationsverlauf append-only dokumentiert',jsonb_build_object('rootId',root_id,'revision',revision,'kind',kind,'observedAt',entry->>'observedAt'),actor,actor_name);
 return jsonb_build_object('requestId',request,'packet',packet,'original',care_private.wound_path_original(root_id,tenant,subject,wound));
end $$;

create or replace function public.web_commit_wound_path_packet(p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_wound_path_packet_impl(p_packet)$$;

create or replace function care_private.confirm_wound_path_packet_impl(requested_tenant uuid,requested_client uuid,requested_wound uuid,requested_actor uuid,requested_id uuid,packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt care_private.wound_path_requests%rowtype;begin
 perform care_private.assert_wound_path_authority(requested_tenant,requested_client,requested_wound,requested_actor,false,false);
 select * into receipt from care_private.wound_path_requests r where r.tenant_id=requested_tenant and r.request_id=requested_id and r.client_id=requested_client and r.wound_case_id=requested_wound;
 if receipt.request_id is null or receipt.actor_id<>requested_actor or receipt.packet<>packet then return null;end if;
 return jsonb_build_object('requestId',requested_id,'packet',packet,'original',care_private.wound_path_original(receipt.result_root_id,requested_tenant,requested_client,requested_wound));
end $$;

create or replace function public.web_confirm_wound_path_packet(p_tenant_id uuid,p_client_id uuid,p_wound_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_wound_path_packet_impl(p_tenant_id,p_client_id,p_wound_id,p_actor_profile_id,p_request_id,p_packet)$$;

revoke all on function public.web_read_wound_path_context(uuid,uuid,uuid,uuid),public.web_read_wound_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_wound_path_packet(jsonb),public.web_confirm_wound_path_packet(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function care_private.read_wound_path_context_impl(uuid,uuid,uuid,uuid),care_private.read_wound_path_page_impl(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.commit_wound_path_packet_impl(jsonb),care_private.confirm_wound_path_packet_impl(uuid,uuid,uuid,uuid,uuid,jsonb),care_private.wound_path_ref(uuid,uuid,uuid,integer,timestamptz,jsonb),care_private.wound_path_fingerprint(jsonb) from public,anon,authenticated;
grant execute on function public.web_read_wound_path_context(uuid,uuid,uuid,uuid),public.web_read_wound_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_commit_wound_path_packet(jsonb),public.web_confirm_wound_path_packet(uuid,uuid,uuid,uuid,uuid,jsonb) to authenticated;
commit;
