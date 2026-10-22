-- Reconstructed candidate after environment loss; NEW source, no prior hash/result claimed.
-- Requires applied quarantined BasicCare base and DTO-limits patch. No grants.
-- Exact UTF-8 packet bytes are durable before native binding; cancellation wins even before prepare.
create table if not exists care_private.basic_care_binding_intents(
 request_id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),actor_id uuid not null references public.profiles(id),auth_user_id uuid not null,
 packet_hash text not null check(length(packet_hash)=71 and packet_hash~'^sha256:[0-9a-f]{64}$'),packet_text text,packet jsonb,created_at timestamptz not null default clock_timestamp(),
 check((packet_text is null)=(packet is null)),check(packet is null or jsonb_typeof(packet)='object'),check(packet_text is null or octet_length(packet_text) between 1 and 2097152)
);
create table if not exists care_private.basic_care_binding_cancellations(request_id uuid primary key references care_private.basic_care_binding_intents(request_id),cancelled_at timestamptz not null default clock_timestamp());
create index if not exists basic_care_binding_intent_scope on care_private.basic_care_binding_intents(tenant_id,client_id,actor_id,request_id);
alter table care_private.basic_care_binding_intents enable row level security;
alter table care_private.basic_care_binding_cancellations enable row level security;
drop trigger if exists basic_care_binding_intent_immutable on care_private.basic_care_binding_intents;
create trigger basic_care_binding_intent_immutable before update or delete on care_private.basic_care_binding_intents for each row execute function care_private.basic_care_immutable();
drop trigger if exists basic_care_binding_cancellation_immutable on care_private.basic_care_binding_cancellations;
create trigger basic_care_binding_cancellation_immutable before update or delete on care_private.basic_care_binding_cancellations for each row execute function care_private.basic_care_immutable();
create or replace function care_private.basic_care_packet_text_hash(value text)returns text language sql immutable strict set search_path='' as $$select 'sha256:'||encode(extensions.digest(convert_to(value,'UTF8'),'sha256'),'hex')$$;
create or replace function care_private.basic_care_js_length(value text)returns integer language sql immutable strict set search_path='' as $$select length(value)+coalesce(sum(case when ascii(substr(value,i,1))>65535 then 1 else 0 end),0)::integer from generate_series(1,length(value))i$$;
create or replace function care_private.basic_care_js_text(value jsonb,minimum integer default 0,maximum integer default 8000)returns boolean language plpgsql immutable set search_path='' as $$declare raw_value text;trimmed text;whitespace text:=chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(32)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);begin
 if jsonb_typeof(value)is distinct from 'string' or minimum is null or maximum is null or minimum<0 or maximum<minimum or maximum>8000 then return false;end if;
 raw_value:=value#>>'{}';if octet_length(raw_value)>maximum*3 then return false;end if;trimmed:=btrim(raw_value,whitespace);
 return care_private.basic_care_js_length(trimmed)>=minimum and care_private.basic_care_js_length(raw_value)<=maximum;
end$$;
create or replace function care_private.basic_care_text(value jsonb,minimum integer default 0,maximum integer default 8000)returns boolean language sql immutable set search_path='' as $$select care_private.basic_care_js_text(value,minimum,maximum)$$;
create or replace function care_private.basic_care_binding_intent_authority(t uuid,c uuid,a uuid,w boolean)returns void language plpgsql security definer set search_path='' as $$begin
 perform care_private.basic_care_actor(t,c,a,w);if w and care_private.basic_care_has('pflege.plans.manage')is not true then raise exception 'Eigenes aktuelles Planungsrecht fehlt.' using errcode='42501';end if;perform care_private.require_workspace_session(t,a);
end$$;
create or replace function care_private.basic_care_binding_intent_lock(t uuid,c uuid,a uuid,req uuid,packet_hash text,w boolean)returns void language plpgsql security definer set search_path='' as $$begin
 perform care_private.basic_care_require(t is not null and c is not null and a is not null and req is not null and length(packet_hash)=71 and packet_hash~'^sha256:[0-9a-f]{64}$','Vollständige eigene Anfrage- und Hashbindung fehlt.');
 perform care_private.require_workspace_session(t,a);perform pg_advisory_xact_lock(hashtextextended('basic-care-request:'||req,0));perform pg_advisory_xact_lock(hashtextextended('basic-care:'||t||':'||c,0));perform care_private.basic_care_binding_intent_authority(t,c,a,w);
end$$;
create or replace function care_private.basic_care_planned_instants(local_value timestamp)returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(to_char(value at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')order by value),'[]'::jsonb)
 from(select distinct(local_value at time zone 'Europe/Berlin')+delta value from unnest(array[interval '-1 hour',interval '0 hour',interval '1 hour'])delta where isfinite(local_value)and((local_value at time zone 'Europe/Berlin')+delta)at time zone 'Europe/Berlin'=local_value)matches
$$;
create or replace function care_private.read_basic_care_binding_context(t uuid,c uuid,a uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare candidate record;native jsonb;choices jsonb:='[]';state_before text;state_after text;begin
 perform care_private.basic_care_binding_intent_authority(t,c,a,true);
 lock table public.care_plans,public.care_plan_items,public.care_plan_versions,public.care_tour_stops,public.care_tours in share mode;
 state_before:=care_private.basic_care_state(t,c,a);
 for candidate in select v.id version_id,i.id measure_id,s.id visit_id,tr.tour_date,s.planned_start from public.care_plans p
 join lateral(select x.id from public.care_plan_versions x where x.tenant_id=t and x.care_plan_id=p.id order by x.version desc,x.id desc limit 1)v on true
 join public.care_plan_items i on i.care_plan_id=p.id and i.tenant_id=t
 join public.care_tour_stops s on s.client_id=c and s.tenant_id=t join public.care_tours tr on tr.id=s.tour_id and tr.tenant_id=t
 where p.tenant_id=t and p.client_id=c and p.status in('active','aktiv')and i.status::text='active'and i.category in('body_care','oral_care','dressing','transfer_positioning','contracture_prevention','individual_prevention')
 and tr.status in('published','in_progress','completed')and s.status in('planned','arrived','in_progress','completed')and tr.tour_date>=p.valid_from and(p.valid_until is null or tr.tour_date<=p.valid_until)
 and not exists(select 1 from public.basic_care_plan_bindings b where b.tenant_id=t and b.client_id=c and b.plan_version_id=v.id and b.measure_id=i.id and b.visit_id=s.id)
 order by tr.tour_date,s.planned_start,v.id,i.id,s.id loop
  perform care_private.basic_care_require(jsonb_array_length(choices)<500,'Der vollständige native Planbestand überschreitet 500 Auswahlmöglichkeiten.');
  native:=care_private.basic_care_native_sources(t,c,candidate.version_id,candidate.measure_id,candidate.visit_id);
  perform care_private.basic_care_require(care_private.basic_care_js_text(native#>'{measure,title}',3,300)and isfinite(candidate.tour_date)and candidate.planned_start is not null and candidate.planned_start<time '24:00:00','Ursprünglicher Titel oder lokaler Zeitpunkt ist unvollständig.');
  choices:=choices||jsonb_build_array(jsonb_build_object('planVersionId',candidate.version_id,'measureId',candidate.measure_id,'visitId',candidate.visit_id,'kind',native#>'{measure,category}','title',native#>'{measure,title}','localDate',to_char(candidate.tour_date,'YYYY-MM-DD'),'localStart',to_char(candidate.tour_date+candidate.planned_start,'HH24:MI:SS.US'),'timeZone','Europe/Berlin','plannedInstants',care_private.basic_care_planned_instants(candidate.tour_date+candidate.planned_start),'sources',native));
 end loop;
 perform care_private.basic_care_binding_intent_authority(t,c,a,true);state_after:=care_private.basic_care_state(t,c,a);
 if state_before is distinct from state_after then raise exception 'Nativer Planbestand wurde während der Auswahl verändert.' using errcode='40001';end if;
 return jsonb_build_object('schemaVersion','1','tenantId',t,'clientId',c,'actorId',a,'stateFingerprint',state_after,'candidates',choices);
end$$;
create or replace function care_private.validate_basic_care_binding_intent(p jsonb)returns void language plpgsql security definer set search_path='' as $$declare t uuid;c uuid;a uuid;field text;native jsonb;instant_value timestamptz;local_value timestamp;begin
 perform care_private.basic_care_require(care_private.basic_care_keys(p,array['schemaVersion','requestId','tenantId','clientId','actorId','planVersionId','measureId','visitId','plannedAt','timeZone','secondPersonRequired','reason','sources'])and p->'schemaVersion'='"1"'::jsonb and jsonb_typeof(p->'secondPersonRequired')='boolean'and care_private.basic_care_js_text(p->'reason',10,2000)and p->>'timeZone'='Europe/Berlin','Explizite vollständige ursprüngliche Planungsentscheidung fehlt.');
 foreach field in array array['requestId','tenantId','clientId','actorId','planVersionId','measureId','visitId']loop perform care_private.basic_care_require(care_private.basic_care_uuid(p->field),'Ungültige Bindungskennung.');end loop;
 t:=(p->>'tenantId')::uuid;c:=(p->>'clientId')::uuid;a:=(p->>'actorId')::uuid;perform care_private.basic_care_binding_intent_authority(t,c,a,true);
 native:=care_private.basic_care_native_sources(t,c,(p->>'planVersionId')::uuid,(p->>'measureId')::uuid,(p->>'visitId')::uuid);
 if native is distinct from p->'sources' then raise exception 'Die vollständigen nativen Originale wurden geändert.' using errcode='40001';end if;
 if exists(select 1 from public.basic_care_plan_bindings b where b.tenant_id=t and b.client_id=c and b.plan_version_id=(p->>'planVersionId')::uuid and b.measure_id=(p->>'measureId')::uuid and b.visit_id=(p->>'visitId')::uuid)then raise exception 'Diese Originale sind bereits gebunden.' using errcode='40001';end if;
 perform care_private.basic_care_require(native#>>'{measure,category}'in('body_care','oral_care','dressing','transfer_positioning','contracture_prevention','individual_prevention')and care_private.basic_care_js_text(native#>'{measure,title}',3,300),'Eindeutige native Art oder ursprünglicher Titel fehlt.');
 instant_value:=care_private.basic_care_time(p->'plannedAt');local_value:=instant_value at time zone 'Europe/Berlin';
 perform care_private.basic_care_require(local_value::date=(native#>>'{tour,tour_date}')::date and local_value::time=(native#>>'{visit,planned_start}')::time and local_value::date>=(native#>>'{plan,valid_from}')::date and(native#>>'{plan,valid_until}'is null or local_value::date<=(native#>>'{plan,valid_until}')::date),'Expliziter Zeitpunkt widerspricht Tour oder nativer Planlaufzeit.');
 perform care_private.basic_care_binding_intent_authority(t,c,a,true);
end$$;
create or replace function care_private.basic_care_binding_intent_status(t uuid,c uuid,a uuid,req uuid,hash_value text)returns jsonb language plpgsql security definer set search_path='' as $$declare i care_private.basic_care_binding_intents;r care_private.basic_care_binding_requests;state_value text:='absent';binding_value uuid;plan_value jsonb;begin
 select * into i from care_private.basic_care_binding_intents x where x.request_id=req for share;
 if i.request_id is not null then
  if i.tenant_id is distinct from t or i.client_id is distinct from c or i.actor_id is distinct from a or i.auth_user_id is distinct from auth.uid()or i.packet_hash is distinct from hash_value then raise exception 'Die ursprüngliche Anfrage gehört zu einem anderen Umfang oder Konto.' using errcode='40001';end if;
  select * into r from care_private.basic_care_binding_requests x where x.request_id=req for share;
  if r.request_id is not null then
   if r.tenant_id is distinct from t or r.client_id is distinct from c or r.actor_id is distinct from a or r.auth_user_id is distinct from auth.uid()or r.packet is distinct from i.packet then raise exception 'Eigener ursprünglicher Bindungsbeleg ist anders belegt.' using errcode='40001';end if;
   state_value:='committed';binding_value:=r.binding_id;plan_value:=r.original->'plan';
  elsif exists(select 1 from care_private.basic_care_binding_cancellations x where x.request_id=req)then state_value:='cancelled';
  elsif i.packet_text is not null then state_value:='prepared';
  else raise exception 'Ursprünglicher Anfragestatus ist unvollständig.' using errcode='40001';end if;
 else
  if exists(select 1 from care_private.basic_care_binding_requests x where x.request_id=req)then raise exception 'Historischer Bindungsbeleg besitzt keinen bestätigten ursprünglichen Anfragetext.'using errcode='40001';end if;
 end if;
 perform care_private.basic_care_binding_intent_authority(t,c,a,false);
 return jsonb_build_object('schemaVersion','1','tenantId',t,'clientId',c,'actorId',a,'requestId',req,'packetHash',hash_value,'state',state_value,'bindingId',binding_value,'plan',plan_value);
end$$;
create or replace function care_private.prepare_basic_care_binding_intent(packet_text text,packet_hash text)returns jsonb language plpgsql security definer set search_path='' as $$declare p jsonb;t uuid;c uuid;a uuid;req uuid;field text;prior care_private.basic_care_binding_intents;status_value jsonb;begin
 perform care_private.basic_care_require(packet_text is not null and octet_length(packet_text)between 1 and 2097152 and length(packet_hash)=71 and packet_hash~'^sha256:[0-9a-f]{64}$'and care_private.basic_care_packet_text_hash(packet_text)=packet_hash,'Exakter ursprünglicher UTF-8-Anfragetext und Hash fehlen.');p:=packet_text::jsonb;
 foreach field in array array['tenantId','clientId','actorId','requestId']loop perform care_private.basic_care_require(care_private.basic_care_uuid(p->field),'Eigene Anfragekennung fehlt.');end loop;
 t:=(p->>'tenantId')::uuid;c:=(p->>'clientId')::uuid;a:=(p->>'actorId')::uuid;req:=(p->>'requestId')::uuid;perform care_private.basic_care_binding_intent_lock(t,c,a,req,packet_hash,true);
 status_value:=care_private.basic_care_binding_intent_status(t,c,a,req,packet_hash);
 if status_value->>'state'='cancelled'then perform care_private.basic_care_binding_intent_authority(t,c,a,true);return status_value;end if;
 select * into prior from care_private.basic_care_binding_intents x where x.request_id=req;
 if prior.request_id is not null then if prior.packet_text is distinct from packet_text or prior.packet is distinct from p then raise exception 'Ursprüngliche Anfrage darf nicht umgeschrieben werden.' using errcode='40001';end if;perform care_private.basic_care_binding_intent_authority(t,c,a,true);return status_value;end if;
 perform care_private.validate_basic_care_binding_intent(p);perform care_private.basic_care_binding_intent_authority(t,c,a,true);
 insert into care_private.basic_care_binding_intents(request_id,tenant_id,client_id,actor_id,auth_user_id,packet_hash,packet_text,packet)values(req,t,c,a,auth.uid(),packet_hash,packet_text,p);
 return care_private.basic_care_binding_intent_status(t,c,a,req,packet_hash);
end$$;
create or replace function care_private.commit_basic_care_binding_intent(t uuid,c uuid,a uuid,req uuid,packet_hash text)returns jsonb language plpgsql security definer set search_path='' as $$declare i care_private.basic_care_binding_intents;result jsonb;receipt_value jsonb;begin
 perform care_private.basic_care_binding_intent_lock(t,c,a,req,packet_hash,true);result:=care_private.basic_care_binding_intent_status(t,c,a,req,packet_hash);
 if result->>'state'in('committed','cancelled')then perform care_private.basic_care_binding_intent_authority(t,c,a,true);return result;end if;if result->>'state'<>'prepared'then raise exception 'Anfrage wurde nicht vorbereitet.' using errcode='40001';end if;
 select * into i from care_private.basic_care_binding_intents x where x.request_id=req for share;
 perform care_private.basic_care_require(i.packet_text is not null and care_private.basic_care_packet_text_hash(i.packet_text)=packet_hash and i.packet_text::jsonb is not distinct from i.packet,'Ursprünglicher Anfragetext wurde geändert.');receipt_value:=care_private.issue_basic_care_binding(i.packet);
 perform care_private.basic_care_binding_intent_authority(t,c,a,true);result:=care_private.basic_care_binding_intent_status(t,c,a,req,packet_hash);
 perform care_private.basic_care_require(result->>'state'='committed'and receipt_value->'packet'=i.packet and receipt_value->>'requestId'=req::text,'Eigener Bindungsbeleg wurde nicht bestätigt.');return result;
end$$;
create or replace function care_private.confirm_basic_care_binding_intent(t uuid,c uuid,a uuid,req uuid,packet_hash text)returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin perform care_private.basic_care_binding_intent_lock(t,c,a,req,packet_hash,false);result:=care_private.basic_care_binding_intent_status(t,c,a,req,packet_hash);perform care_private.basic_care_binding_intent_authority(t,c,a,false);return result;end$$;
create or replace function care_private.cancel_basic_care_binding_intent(t uuid,c uuid,a uuid,req uuid,packet_hash text)returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 perform care_private.basic_care_binding_intent_lock(t,c,a,req,packet_hash,false);result:=care_private.basic_care_binding_intent_status(t,c,a,req,packet_hash);if result->>'state'='committed'then return result;end if;
 if result->>'state'='absent'then insert into care_private.basic_care_binding_intents(request_id,tenant_id,client_id,actor_id,auth_user_id,packet_hash)values(req,t,c,a,auth.uid(),packet_hash);end if;
 insert into care_private.basic_care_binding_cancellations(request_id)values(req)on conflict(request_id)do nothing;perform care_private.basic_care_binding_intent_authority(t,c,a,false);return care_private.basic_care_binding_intent_status(t,c,a,req,packet_hash);
end$$;
create or replace function care_private.basic_care_guard_binding_intent_issuance()returns trigger language plpgsql security definer set search_path='' as $$declare i care_private.basic_care_binding_intents;begin
 perform pg_advisory_xact_lock(hashtextextended('basic-care-request:'||new.request_id,0));select * into i from care_private.basic_care_binding_intents x where x.request_id=new.request_id for share;
 if i.request_id is null or exists(select 1 from care_private.basic_care_binding_cancellations x where x.request_id=new.request_id)or i.packet is null or i.tenant_id is distinct from new.tenant_id or i.client_id is distinct from new.client_id or i.actor_id is distinct from new.actor_id or i.auth_user_id is distinct from new.auth_user_id or i.packet is distinct from new.packet or care_private.basic_care_packet_text_hash(i.packet_text)is distinct from i.packet_hash then raise exception 'Vollständige unveränderte Anfrage muss vor jeder Bindung vorbereitet sein.' using errcode='40001';end if;return new;
end$$;
drop trigger if exists basic_care_binding_intent_issuance_guard on care_private.basic_care_binding_requests;
create trigger basic_care_binding_intent_issuance_guard before insert on care_private.basic_care_binding_requests for each row execute function care_private.basic_care_guard_binding_intent_issuance();
create or replace function public.web_read_basic_care_binding_context(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid)returns jsonb language sql security invoker set search_path='' as $$select care_private.read_basic_care_binding_context(p_tenant_id,p_client_id,p_actor_profile_id)$$;
create or replace function public.web_prepare_basic_care_binding_intent(p_packet_text text,p_packet_hash text)returns jsonb language sql security invoker set search_path='' as $$select care_private.prepare_basic_care_binding_intent(p_packet_text,p_packet_hash)$$;
create or replace function public.web_commit_basic_care_binding_intent(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet_hash text)returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_basic_care_binding_intent(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet_hash)$$;
create or replace function public.web_confirm_basic_care_binding_intent(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet_hash text)returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_basic_care_binding_intent(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet_hash)$$;
create or replace function public.web_cancel_basic_care_binding_intent(p_tenant_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_request_id uuid,p_packet_hash text)returns jsonb language sql security invoker set search_path='' as $$select care_private.cancel_basic_care_binding_intent(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_packet_hash)$$;
revoke all on care_private.basic_care_binding_intents,care_private.basic_care_binding_cancellations from public,anon,authenticated,service_role;
do $$declare f record;begin for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='care_private'and p.proname in('basic_care_packet_text_hash','basic_care_js_length','basic_care_js_text','basic_care_text','basic_care_binding_intent_authority','basic_care_binding_intent_lock','basic_care_planned_instants','read_basic_care_binding_context','validate_basic_care_binding_intent','basic_care_binding_intent_status','prepare_basic_care_binding_intent','commit_basic_care_binding_intent','confirm_basic_care_binding_intent','cancel_basic_care_binding_intent','basic_care_guard_binding_intent_issuance'))or(n.nspname='public'and p.proname in('web_read_basic_care_binding_context','web_prepare_basic_care_binding_intent','web_commit_basic_care_binding_intent','web_confirm_basic_care_binding_intent','web_cancel_basic_care_binding_intent'))loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.oid::regprocedure);end loop;end$$;
