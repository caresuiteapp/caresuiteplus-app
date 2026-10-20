-- LOCAL REVIEW ONLY; NOT APPLIED. Requires clinical core, infusion_courses.sql
-- (infusion_time) and clinical_control_tasks.sql (control_uuid). No migration/job registration.
begin;
create table if not exists public.care_protocol_roots(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 version text not null check(version='2026-10-09.1'),kind text not null check(kind in ('drink','meal','stool','urine','fluid_output')),
 created_at timestamptz not null,recorded_by uuid not null references public.profiles(id),unique(id,tenant_id,client_id)
);
alter table public.care_protocol_roots drop constraint if exists care_protocol_roots_kind_check;
alter table public.care_protocol_roots add constraint care_protocol_roots_kind_check check(kind in ('drink','meal','stool','urine','fluid_output'));
create table if not exists public.care_protocol_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),root_id uuid not null,
 sequence integer not null check(sequence>0),previous_id uuid,actor_id uuid not null references public.profiles(id),actor_name text not null check(btrim(actor_name)<>''),
 request_id uuid not null,recorded_at timestamptz not null,draft jsonb not null,request_payload jsonb not null,
 unique(root_id,sequence),unique(tenant_id,request_id),unique(id,root_id),foreign key(root_id,tenant_id,client_id) references public.care_protocol_roots(id,tenant_id,client_id),
 foreign key(previous_id,root_id) references public.care_protocol_events(id,root_id),check((sequence=1)=(previous_id is null))
);
create index if not exists care_protocol_client on public.care_protocol_roots(tenant_id,client_id,created_at,id);
create index if not exists care_protocol_history on public.care_protocol_events(tenant_id,root_id,sequence);
alter table public.care_protocol_roots enable row level security;
alter table public.care_protocol_events enable row level security;
revoke all on public.care_protocol_roots,public.care_protocol_events from public,anon,authenticated;
grant select on public.care_protocol_roots,public.care_protocol_events to authenticated;

create or replace function care_private.protocol_access(tenant uuid,subject uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.uid() is not null and tenant=public.current_tenant_id() and public.has_permission('pflege.documentation.view')
 and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=tenant and p.is_active and p.role_key not in ('client_portal','family_portal'))
 and (subject is null or (public.is_active_pfleger_client(subject) and exists(select 1 from public.clients c where c.id=subject and c.tenant_id=tenant and c.status='active' and c.deleted_at is null))),false)
$$;
drop policy if exists protocol_root_read on public.care_protocol_roots;
create policy protocol_root_read on public.care_protocol_roots for select to authenticated using(care_private.protocol_access(tenant_id,client_id));
drop policy if exists protocol_event_read on public.care_protocol_events;
create policy protocol_event_read on public.care_protocol_events for select to authenticated using(care_private.protocol_access(tenant_id,client_id));
create or replace function care_private.protocol_fields(v jsonb,fields text[]) returns void language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(v) is distinct from 'object' or v-fields<>'{}'::jsonb or (select count(*) from jsonb_each(v))<>cardinality(fields) then raise exception 'Protokollfelder fehlen oder sind fremd.' using errcode='23514';end if;
end $$;
create or replace function care_private.protocol_text(v jsonb,field text,required boolean default true) returns void language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(v->field) is distinct from 'string' or length(v->>field)>4000 or (required and btrim(v->>field)='') then raise exception 'Protokollangabe % fehlt oder ist ungültig.',field using errcode='23514';end if;
end $$;
create or replace function care_private.protocol_quantity(q jsonb,kind text) returns void language plpgsql immutable set search_path='' as $$begin
 perform care_private.protocol_fields(q,array['state','value','unit','basis']);perform care_private.protocol_text(q,'state');perform care_private.protocol_text(q,'basis');perform care_private.protocol_text(q,'value',false);perform care_private.protocol_text(q,'unit',false);
 if q->>'state' not in ('measured','estimated','not_measured') then raise exception 'Mengenqualität auswählen.' using errcode='23514';end if;
 if q->>'state'='not_measured' then
  if q->>'value'<>'' or (kind='drink' and q->>'unit'<>'ml') or (kind='meal' and q->>'unit' not in ('','g','percent')) then raise exception 'Fehlende Menge darf keinen Nullwert enthalten.' using errcode='23514';end if;
 else
  if (kind='drink' and q->>'unit'<>'ml') or (kind='meal' and q->>'unit' not in ('g','percent')) or (q->>'value') !~ '^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$' then raise exception 'Menge oder Originaleinheit ungültig.' using errcode='23514';end if;
  if q->>'unit'='percent' and (q->>'value')::numeric>100 then raise exception 'Anteil über 100 Prozent.' using errcode='23514';end if;
 end if;
end $$;
-- CP29 output-specific checks, using the existing quantity/provenance/time contract.
create or replace function care_private.protocol_output_entry(e jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare k text:=e->>'kind';positive boolean;f text;start_at timestamptz;end_at timestamptz;actual jsonb:=e->'actual';begin
 perform care_private.protocol_quantity(actual,'drink');positive:=case when k='urine' then e->>'occurrence'='passed' else e->>'occurrence'='collected' end;
 if (k='urine' and e->>'occurrence' not in ('passed','zero_collected','no_urine_observed','not_observed')) or (k='fluid_output' and e->>'occurrence' not in ('collected','zero_collected','not_observed')) then raise exception 'Tatsächlichen Ausscheidungsvorgang wählen.' using errcode='23514';end if;
 perform care_private.protocol_text(e,'symptoms');if not positive then perform care_private.protocol_text(e,'reason');end if;
 if positive and actual->>'state'<>'not_measured' then if (actual->>'value')::numeric=0 then raise exception 'Positive Ausscheidung widerspricht Nullmenge.' using errcode='23514';end if;end if;
 if e->>'occurrence'='zero_collected' then if actual->>'state'<>'measured' then raise exception 'Nullsammlung benötigt gemessene Null.' using errcode='23514';end if;if (actual->>'value')::numeric<>0 then raise exception 'Nullsammlung benötigt Nullmenge.' using errcode='23514';end if;
 elsif not positive and actual->>'state'<>'not_measured' then raise exception 'Fehlende Beobachtung ist keine positive oder Nullmenge.' using errcode='23514';end if;
 if e->>'collectionMode' not in ('single_event','interval_collection') then raise exception 'Einzelereignis oder tatsächliche Sammlung wählen.' using errcode='23514';end if;
 if e->>'collectionMode'='interval_collection' then
  perform care_private.protocol_text(e,'collectionRef');start_at:=care_private.infusion_time(e->>'collectionStartAt');end_at:=care_private.infusion_time(e->>'collectionEndAt');
  if start_at>=end_at or end_at<>care_private.infusion_time(e->>'occurredAt') or end_at>server_now then raise exception 'Sammelgrenzen widersprüchlich.' using errcode='23514';end if;
  if not positive and e->>'occurrence'<>'zero_collected' then raise exception 'Unbeobachteter Vorgang ist keine bestätigte Intervallsammlung.' using errcode='23514';end if;
 elsif e->>'collectionStartAt'<>'' or e->>'collectionEndAt'<>'' then raise exception 'Einzelereignis besitzt keinen Sammelzeitraum.' using errcode='23514';end if;
 if k='urine' then
  if e->>'method' not in ('spontaneous','collection','catheter_collection','unknown') or e->>'support' not in ('independent','assisted','provided','unknown') or e->>'aidsState' not in ('used','not_used','not_confirmed') then raise exception 'Ausscheidungsweg, Hilfeumfang und Hilfsmittel wählen.' using errcode='23514';end if;
  perform care_private.protocol_text(e,'personDecision');if e->>'aidsState'='used' then perform care_private.protocol_text(e,'aidsDetail');elsif e->>'aidsDetail'<>'' then raise exception 'Unbestätigte Hilfsmittel nicht als eingesetzt beschreiben.' using errcode='23514';end if;
  foreach f in array array['color','clarity','odor'] loop if not positive and e->>f<>'' then raise exception 'Ohne positive Ausscheidung keinen Urinbefund erfinden.' using errcode='23514';end if;end loop;
  if e->>'collectionMode'='interval_collection' and e->>'method' not in ('collection','catheter_collection') then raise exception 'Intervallsammlung benötigt bestätigten Sammelweg.' using errcode='23514';end if;
  if positive or e->>'occurrence'='zero_collected' then
   if e->>'method' in ('collection','catheter_collection') then perform care_private.protocol_text(e,'collectionRef');elsif e->>'method'='unknown' then raise exception 'Tatsächliche Ausscheidung benötigt bestätigten Herkunftsweg.' using errcode='23514';end if;
  end if;
  if e->>'occurrence'='not_observed' and e->>'source'='observed' and (e->>'support'<>'unknown' or e->>'aidsState'<>'not_confirmed') then raise exception 'Unbeobachtete Hilfe/Hilfsmittel nicht als durchgeführt bestätigen.' using errcode='23514';end if;
 else
  if e->>'route' not in ('emesis','drain','stoma','other_loss') then raise exception 'Tatsächlichen Ausfuhrweg wählen.' using errcode='23514';end if;perform care_private.protocol_text(e,'site');
  if not positive and e->>'appearance'<>'' then raise exception 'Ohne positive Ausfuhr keinen Befund erfinden.' using errcode='23514';end if;
 end if;
end $$;
create or replace function care_private.protocol_entry(e jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare k text:=e->>'kind';fields text[];f text;actual jsonb:=e->'actual';offered jsonb:=e->'offered';occurred timestamptz;begin
 if k is null or k not in ('drink','meal','stool','urine','fluid_output') then raise exception 'Protokollart auswählen.' using errcode='23514';end if;
 fields:=array['kind','occurredAt','source','reportedBy','observation','reaction','reviewState','reviewAt','reviewReason']||case when k='urine' then array['occurrence','actual','collectionMode','collectionRef','collectionStartAt','collectionEndAt','reason','method','support','aidsState','aidsDetail','color','clarity','odor','symptoms','personDecision'] when k='fluid_output' then array['occurrence','actual','collectionMode','collectionRef','collectionStartAt','collectionEndAt','reason','route','site','appearance','symptoms'] when k='stool' then array['occurrence','amount','consistency','color','reason'] else array['description','outcome','support','offered','actual','reason'] end;
 perform care_private.protocol_fields(e,fields);
 foreach f in array fields loop if f not in ('offered','actual') then perform care_private.protocol_text(e,f,false);end if;end loop;
 occurred:=care_private.infusion_time(e->>'occurredAt');if occurred>server_now then raise exception 'Ereignis liegt in der Zukunft.' using errcode='23514';end if;
 if e->>'source' not in ('observed','reported') or (e->>'source'='observed' and e->>'reportedBy'<>'') then raise exception 'Eigenbeobachtung und Fremdangabe trennen.' using errcode='23514';end if;
 if e->>'source'='reported' then perform care_private.protocol_text(e,'reportedBy');end if;
 foreach f in array array['observation','reaction','reviewReason'] loop perform care_private.protocol_text(e,f);end loop;
 if e->>'reviewState' not in ('scheduled','pending','not_required') then raise exception 'Weitere Kontrolle entscheiden.' using errcode='23514';end if;
 if e->>'reviewState'='scheduled' then if care_private.infusion_time(e->>'reviewAt')<occurred then raise exception 'Kontrollzeitpunkt liegt vor Ereignis.' using errcode='23514';end if;
 elsif e->>'reviewAt'<>'' then raise exception 'Unvereinbarte Kontrollfrist entfernen.' using errcode='23514';end if;
 if k in ('urine','fluid_output') then perform care_private.protocol_output_entry(e,server_now);
 elsif k='stool' then
  if e->>'occurrence' not in ('passed','no_stool_observed','not_observed') or e->>'amount' not in ('small','medium','large','not_assessed') or e->>'consistency' not in ('hard','formed','soft','liquid','not_assessed') then raise exception 'Stuhlereignis oder Befund ungültig.' using errcode='23514';end if;
  if e->>'occurrence'<>'passed' then perform care_private.protocol_text(e,'reason');if e->>'amount'<>'not_assessed' or e->>'consistency'<>'not_assessed' or e->>'color'<>'' then raise exception 'Ohne Stuhlereignis keinen tatsächlichen Befund erfinden.' using errcode='23514';end if;end if;
 else
  perform care_private.protocol_text(e,'description');perform care_private.protocol_quantity(actual,k);perform care_private.protocol_quantity(offered,k);
  if e->>'outcome' not in ('taken','partial','none_taken','refused','omitted','not_observed') or e->>'support' not in ('independent','assisted','provided','unknown') then raise exception 'Aufnahme und Hilfeumfang auswählen.' using errcode='23514';end if;
  if e->>'outcome'<>'taken' then perform care_private.protocol_text(e,'reason');end if;
  if e->>'outcome' not in ('taken','partial','none_taken') and actual->>'state'<>'not_measured' then raise exception 'Nichtaufnahme nicht als Aufnahmemenge bestätigen.' using errcode='23514';end if;
  if e->>'outcome'='none_taken' then if actual->>'state'<>'measured' then raise exception 'Bestätigte Nichtaufnahme benötigt gemessene Nullmenge.' using errcode='23514';end if;if (actual->>'value')::numeric<>0 then raise exception 'Bestätigte Nichtaufnahme benötigt Nullmenge.' using errcode='23514';end if;end if;
  if e->>'outcome'='not_observed' and e->>'source'='observed' and e->>'support'<>'unknown' then raise exception 'Unbeobachtete Hilfe nicht als durchgeführt bestätigen.' using errcode='23514';end if;
  if e->>'outcome' in ('taken','partial') and actual->>'state'<>'not_measured' then if (actual->>'value')::numeric=0 then raise exception 'Aufnahme und Nullmenge widersprüchlich.' using errcode='23514';end if;end if;
  if actual->>'state'<>'not_measured' and offered->>'state'<>'not_measured' then
   if actual->>'unit'<>offered->>'unit' or (actual->>'value')::numeric>(offered->>'value')::numeric then raise exception 'Aufnahme, Angebot oder Einheiten widersprüchlich.' using errcode='23514';end if;
  end if;
 end if;
end $$;
create or replace function care_private.protocol_draft(d jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$begin
 perform care_private.protocol_fields(d,array['action','entry','reason']);perform care_private.protocol_text(d,'action');perform care_private.protocol_text(d,'reason',d->>'action'<>'record');
 if d->>'action' not in ('record','replace','void') or (d->>'action'='record' and d->>'reason'<>'') then raise exception 'Protokollhandlung ungültig.' using errcode='23514';end if;
 if d->>'action'='void' then if d->'entry'<>'null'::jsonb then raise exception 'Rücknahme darf keine neue Aufnahme enthalten.' using errcode='23514';end if;else perform care_private.protocol_entry(d->'entry',server_now);end if;
end $$;

create or replace function care_private.write_daily_protocol_event(request_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();subject uuid;protocol_id uuid;expected uuid;d jsonb;root public.care_protocol_roots%rowtype;receipt public.care_protocol_events%rowtype;old record;head uuid;seq integer:=0;current_entry jsonb;last_at timestamptz;server_now timestamptz;name text;result uuid:=gen_random_uuid();begin
 if care_private.protocol_access(tenant,null) is not true then raise exception 'Eigener aktiver Dokumentationszugang fehlt.' using errcode='42501';end if;
 perform care_private.protocol_fields(payload,array['version','clientId','rootId','expectedHeadId','draft']);
 if request_id is null or payload->>'version' is distinct from '2026-10-09.1' or not care_private.control_uuid(payload->>'clientId') or not care_private.control_uuid(payload->>'rootId') or jsonb_typeof(payload->'expectedHeadId') is distinct from 'string' or (payload->>'expectedHeadId'<>'' and not care_private.control_uuid(payload->>'expectedHeadId')) then raise exception 'Anfrage oder Originalkennung ungültig.' using errcode='23514';end if;
 subject:=(payload->>'clientId')::uuid;protocol_id:=(payload->>'rootId')::uuid;expected:=nullif(payload->>'expectedHeadId','')::uuid;d:=payload->'draft';
 if care_private.protocol_access(tenant,subject) is not true then raise exception 'Aktive eigene Pflegeakte nicht zugänglich.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':protocol-request:'||request_id::text,0));
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant and c.status='active' and c.deleted_at is null for share;
 if not found then raise exception 'Aktiver Pflegefall geändert.' using errcode='42501';end if;
 perform 1 from public.client_module_assignments a where a.tenant_id=tenant and a.client_id=subject and a.module_key='pflege' and a.is_active and a.status not in ('inactive','deactivated','archiviert') for share;
 if not found then raise exception 'Aktive Pflegezuordnung geändert.' using errcode='42501';end if;
 if care_private.protocol_access(tenant,subject) is not true then raise exception 'Pflegeaktenzugang geändert.' using errcode='42501';end if;
 select nullif(btrim(p.display_name),'') into name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active and p.role_key not in ('client_portal','family_portal') for share;
 if not found or name is null then raise exception 'Aktives tatsächliches Profil fehlt.' using errcode='42501';end if;
 select * into receipt from public.care_protocol_events e where e.tenant_id=tenant and e.request_id=write_daily_protocol_event.request_id;
 if found then if receipt.actor_id<>actor or receipt.request_payload<>payload then raise exception 'Anfragekennung bereits mit anderem Original belegt.' using errcode='23514';end if;
  return jsonb_build_object('id',receipt.id::text,'tenantId',tenant::text,'rootId',receipt.root_id::text,'requestId',request_id::text,'previousId',coalesce(receipt.previous_id::text,''),'sequence',receipt.sequence);end if;
 if public.has_permission('pflege.documentation.create') is not true then raise exception 'Dokumentations-Schreibrecht fehlt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':protocol-root:'||protocol_id::text,0));
 select * into root from public.care_protocol_roots r where r.id=protocol_id for update;
 if found and (root.tenant_id<>tenant or root.client_id<>subject) then raise exception 'Fremder Originalbezug.' using errcode='42501';end if;
 server_now:=clock_timestamp();perform care_private.protocol_draft(d,server_now);
 for old in select e.* from public.care_protocol_events e where e.root_id=protocol_id order by e.sequence loop
  if old.tenant_id<>tenant or old.client_id<>subject or old.sequence<>seq+1 or old.previous_id is distinct from head or (last_at is not null and old.recorded_at<last_at) or old.recorded_at>server_now then raise exception 'Originalverlauf unvollständig.' using errcode='23514';end if;
  perform care_private.protocol_draft(old.draft,old.recorded_at);
  if (seq=0 and old.draft->>'action'<>'record') or (seq>0 and (old.draft->>'action'='record' or current_entry='null'::jsonb)) or (old.draft->'entry'<>'null'::jsonb and old.draft->'entry'->>'kind'<>root.kind) or (old.draft->>'action'='replace' and old.draft->'entry'=current_entry) then raise exception 'Originalfolge widersprüchlich.' using errcode='23514';end if;
  current_entry:=old.draft->'entry';head:=old.id;seq:=old.sequence;last_at:=old.recorded_at;
 end loop;
 if (root.id is not null and seq=0) or head is distinct from expected or (seq=0 and d->>'action'<>'record') or (seq>0 and (d->>'action'='record' or current_entry='null'::jsonb)) then raise exception 'Aktueller Originalkopf geändert oder zurückgenommen.' using errcode='23514';end if;
 if d->>'action'='replace' and (d->'entry'->>'kind'<>root.kind or d->'entry'=current_entry) then raise exception 'Keine passende tatsächliche Berichtigung.' using errcode='23514';end if;
 if root.id is null then insert into public.care_protocol_roots(id,tenant_id,client_id,version,kind,created_at,recorded_by) values(protocol_id,tenant,subject,'2026-10-09.1',d->'entry'->>'kind',server_now,actor);end if;
 insert into public.care_protocol_events(id,tenant_id,client_id,root_id,sequence,previous_id,actor_id,actor_name,request_id,recorded_at,draft,request_payload) values(result,tenant,subject,protocol_id,seq+1,head,actor,name,request_id,server_now,d,payload);
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) values(tenant,subject,'protocol_event',result,'created','Strukturiertes Pflegeprotokoll dokumentiert',jsonb_build_object('rootId',protocol_id::text,'sequence',seq+1,'action',d->>'action'),actor,name);
 return jsonb_build_object('id',result::text,'tenantId',tenant::text,'rootId',protocol_id::text,'requestId',request_id::text,'previousId',coalesce(head::text,''),'sequence',seq+1);
end $$;
create or replace function public.write_daily_protocol_event(request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.write_daily_protocol_event(request_id,payload)$$;

create or replace function public.read_daily_protocols(requested_tenant uuid,requested_client uuid) returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' as $$declare result jsonb;begin
 if requested_client is null or care_private.protocol_access(requested_tenant,requested_client) is not true then raise exception 'Aktive eigene Pflegeakte und Dokumentationsleserecht erforderlich.' using errcode='42501';end if;
 with data as (
 select jsonb_build_object('root',jsonb_build_object('id',r.id::text,'tenantId',r.tenant_id::text,'clientId',r.client_id::text,'version',r.version,'kind',r.kind),
 'headId',coalesce((array_agg(e.id::text order by e.sequence desc) filter(where e.id is not null))[1],''),'eventCount',count(e.id),
 'events',coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'rootId',e.root_id::text,'tenantId',e.tenant_id::text,'clientId',e.client_id::text,'sequence',e.sequence,'previousId',coalesce(e.previous_id::text,''),'actorId',e.actor_id::text,'requestId',e.request_id::text,'recordedAt',to_char(e.recorded_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'draft',e.draft) order by e.sequence) filter(where e.id is not null),'[]'::jsonb),
 'actorNames',coalesce(jsonb_object_agg(e.id::text,e.actor_name) filter(where e.id is not null),'{}'::jsonb)) as item
 from public.care_protocol_roots r left join public.care_protocol_events e on e.root_id=r.id and e.tenant_id=r.tenant_id and e.client_id=r.client_id
 where r.tenant_id=requested_tenant and r.client_id=requested_client group by r.id)
 select jsonb_build_object('version','2026-10-09.1','tenantId',requested_tenant::text,'clientId',requested_client::text,'count',count(*),'records',coalesce(jsonb_agg(item),'[]'::jsonb)) into result from data;return result;
end $$;
create or replace function care_private.read_daily_protocol_clients(requested_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 if care_private.protocol_access(requested_tenant,null) is not true then raise exception 'Eigener Dokumentationszugang fehlt.' using errcode='42501';end if;
 with data as(select c.id,coalesce(nullif(btrim(concat_ws(' ',c.first_name,c.last_name)),''),'Name fehlt') as name from public.clients c where c.tenant_id=requested_tenant and c.status='active' and c.deleted_at is null and public.is_active_pfleger_client(c.id))
 select jsonb_build_object('version','2026-10-09.1','tenantId',requested_tenant::text,'count',count(*),'clients',coalesce(jsonb_agg(jsonb_build_object('id',id::text,'name',name) order by name,id),'[]'::jsonb)) into result from data;return result;
end $$;
create or replace function public.read_daily_protocol_clients(requested_tenant uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_daily_protocol_clients(requested_tenant)$$;
revoke all on function care_private.protocol_access(uuid,uuid),care_private.protocol_fields(jsonb,text[]),care_private.protocol_text(jsonb,text,boolean),care_private.protocol_quantity(jsonb,text),care_private.protocol_entry(jsonb,timestamptz),care_private.protocol_draft(jsonb,timestamptz) from public,anon,authenticated;
grant execute on function care_private.protocol_access(uuid,uuid) to authenticated;
revoke all on function care_private.write_daily_protocol_event(uuid,jsonb),care_private.read_daily_protocol_clients(uuid),public.write_daily_protocol_event(uuid,jsonb),public.read_daily_protocols(uuid,uuid),public.read_daily_protocol_clients(uuid) from public,anon;
grant execute on function care_private.write_daily_protocol_event(uuid,jsonb),care_private.read_daily_protocol_clients(uuid),public.write_daily_protocol_event(uuid,jsonb),public.read_daily_protocols(uuid,uuid),public.read_daily_protocol_clients(uuid) to authenticated;
revoke all on function care_private.protocol_output_entry(jsonb,timestamptz) from public,anon,authenticated;
commit;
