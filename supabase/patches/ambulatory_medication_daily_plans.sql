-- Quarantined explicit daily plans and exact, non-executing medication constraints.
-- Technical transcription / plan review does not establish clinical qualifications.
-- Scope indexes for the exact application binding and uncapped actual-time history.
create index medication_order_application_current_scope on care_private.medication_order_applications(tenant_id,medication_id,client_id,recorded_at desc,id desc);
create index medication_administration_actual_scope on public.medication_administrations(tenant_id,medication_id,client_id,occurred_at,id);
create function care_private.current_medication_order_application(p_tenant uuid,p_client uuid,p_medication uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.medications%rowtype;a care_private.medication_order_applications%rowtype;r care_private.medication_order_revisions%rowtype;originals jsonb;
begin
 select * into m from public.medications where id=p_medication and tenant_id=p_tenant and client_id=p_client for share;
 select * into a from care_private.medication_order_applications where tenant_id=p_tenant and client_id=p_client and medication_id=p_medication and after_snapshot=to_jsonb(m) order by recorded_at desc,id desc limit 1 for share;
 if a.id is null then return null;end if;
 select * into r from care_private.medication_order_revisions where id=a.revision_id and tenant_id=p_tenant for share;
 originals:=care_private.medication_order_archived_source(p_tenant,p_client,p_medication,a.source_id);
 perform care_private.med_packet_require(r.id is not null and r.source_id=a.source_id and r.before_snapshot is not distinct from a.before_snapshot and r.source_snapshot is not distinct from originals->'source' and r.archive_snapshot is not distinct from originals->'archive' and care_private.medication_native_order(to_jsonb(m)) is not distinct from r.proposed_order,'Übertragene Verordnung oder gesicherter Quellenbezug wurde geändert.');
 return to_jsonb(a)-'packet';
end$$;
revoke all on function care_private.current_medication_order_application(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create table care_private.medication_daily_plans(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),medication_id uuid not null references public.medications(id),
 order_application_id uuid not null references care_private.medication_order_applications(id),source_id uuid not null references public.medication_order_sources(id),request_id uuid not null,
 recorded_by uuid not null references public.profiles(id),creator_session_id uuid not null,recorded_by_name text not null,recorded_at timestamptz not null default clock_timestamp(),expected_updated_at timestamptz not null,
 native_snapshot jsonb not null,order_application_snapshot jsonb not null,source_snapshot jsonb not null,archive_snapshot jsonb not null,
 effective_from date not null,effective_until date,timezone text not null check(timezone='Europe/Berlin'),entries jsonb not null,reason text not null,packet jsonb not null,
 unique(tenant_id,request_id),check(effective_until is null or effective_until>=effective_from)
);
create index medication_daily_plan_page on care_private.medication_daily_plans(tenant_id,medication_id,recorded_at desc,id desc);
create table care_private.medication_daily_plan_review_requests(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),plan_id uuid not null references care_private.medication_daily_plans(id),request_id uuid not null,
 actor_id uuid not null references public.profiles(id),creator_session_id uuid not null,action text not null default 'authorize' check(action in('authorize','withdraw')),effective_from date,reason text,plan_fingerprint text not null,recorded_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,unique(tenant_id,request_id)
);
create table care_private.medication_daily_plan_authorizations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),plan_id uuid not null unique references care_private.medication_daily_plans(id),review_request_id uuid not null references care_private.medication_daily_plan_review_requests(id),request_id uuid not null,
 reviewed_by uuid not null references public.profiles(id),reviewer_session_id uuid not null,review_reference text not null,recorded_at timestamptz not null default clock_timestamp(),plan_fingerprint text not null,packet jsonb not null,unique(tenant_id,request_id)
);
create table care_private.medication_daily_plan_withdrawals(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),plan_id uuid not null unique references care_private.medication_daily_plans(id),review_request_id uuid not null references care_private.medication_daily_plan_review_requests(id),request_id uuid not null,
 reviewed_by uuid not null references public.profiles(id),reviewer_session_id uuid not null,effective_from date not null,reason text not null,review_reference text not null,recorded_at timestamptz not null default clock_timestamp(),plan_fingerprint text not null,packet jsonb not null,unique(tenant_id,request_id)
);
alter table care_private.medication_daily_plan_withdrawals enable row level security;
create policy medication_daily_plan_withdrawals_deny on care_private.medication_daily_plan_withdrawals for all to public using(false) with check(false);
revoke all on care_private.medication_daily_plan_withdrawals from public,anon,authenticated,service_role;
create trigger medication_daily_plan_withdrawal_immutable before update or delete on care_private.medication_daily_plan_withdrawals for each row execute function care_private.keep_medication_archive_proof_receipt();
alter table care_private.medication_daily_plans enable row level security;
alter table care_private.medication_daily_plan_review_requests enable row level security;
alter table care_private.medication_daily_plan_authorizations enable row level security;
create policy medication_daily_plans_deny on care_private.medication_daily_plans for all to public using(false) with check(false);
create policy medication_daily_plan_review_requests_deny on care_private.medication_daily_plan_review_requests for all to public using(false) with check(false);
create policy medication_daily_plan_authorizations_deny on care_private.medication_daily_plan_authorizations for all to public using(false) with check(false);
revoke all on care_private.medication_daily_plans,care_private.medication_daily_plan_review_requests,care_private.medication_daily_plan_authorizations from public,anon,authenticated,service_role;
create trigger medication_daily_plan_immutable before update or delete on care_private.medication_daily_plans for each row execute function care_private.keep_medication_archive_proof_receipt();
create trigger medication_daily_plan_review_request_immutable before update or delete on care_private.medication_daily_plan_review_requests for each row execute function care_private.keep_medication_archive_proof_receipt();
create trigger medication_daily_plan_authorization_immutable before update or delete on care_private.medication_daily_plan_authorizations for each row execute function care_private.keep_medication_archive_proof_receipt();

create function care_private.medication_daily_plan_json(p_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select (to_jsonb(p)-'packet'-'creator_session_id')||jsonb_build_object('state',case when a.id is null then 'proposed' else 'authorized' end,'authorization',case when a.id is null then null else jsonb_build_object('id',a.id,'plan_id',a.plan_id,'review_request_id',a.review_request_id,'request_id',a.request_id,'reviewed_by',a.reviewed_by,'review_reference',a.review_reference,'recorded_at',a.recorded_at,'plan_fingerprint',a.plan_fingerprint) end,'withdrawal',case when w.id is null then null else jsonb_build_object('id',w.id,'plan_id',w.plan_id,'review_request_id',w.review_request_id,'request_id',w.request_id,'reviewed_by',w.reviewed_by,'effective_from',w.effective_from,'reason',w.reason,'review_reference',w.review_reference,'recorded_at',w.recorded_at,'plan_fingerprint',w.plan_fingerprint) end)
 from care_private.medication_daily_plans p left join care_private.medication_daily_plan_authorizations a on a.plan_id=p.id left join care_private.medication_daily_plan_withdrawals w on w.plan_id=p.id where p.id=p_id
$$;
revoke all on function care_private.medication_daily_plan_json(uuid) from public,anon,authenticated,service_role;

create function care_private.validate_medication_daily_plan(p_packet jsonb,p_native jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare o jsonb;entry jsonb;prior_time text:='';ids uuid[]:=array[]::uuid[];entry_id uuid;from_day date;until_day date;
begin
 perform care_private.med_packet_require(care_private.med_packet_keys(p_packet,array['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','expectedUpdatedAt','orderApplicationId','sourceId','reason','effectiveFrom','effectiveUntil','timezone','entries']) and p_packet->'schemaVersion'='1'::jsonb and p_packet->>'timezone'='Europe/Berlin' and care_private.med_packet_text(p_packet->'reason',10,2000),'Tagesplan benötigt eine vollständige eigene Anfrage und ausdrückliche Zeitfenster.');
 perform care_private.med_packet_require(care_private.med_packet_uuid(p_packet->'requestId') and care_private.med_packet_uuid(p_packet->'tenantId') and care_private.med_packet_uuid(p_packet->'clientId') and care_private.med_packet_uuid(p_packet->'medicationId') and care_private.med_packet_uuid(p_packet->'actorId') and care_private.med_packet_uuid(p_packet->'orderApplicationId') and care_private.med_packet_uuid(p_packet->'sourceId'),'Tagesplan enthält ungültige eigene Kennungen.');
 o:=care_private.medication_native_order(p_native);
 perform care_private.med_packet_require(o->'isPrn'='false'::jsonb and p_native->>'status'='active' and care_private.med_packet_time(to_jsonb(replace(p_packet->>'expectedUpdatedAt',' ','T')))=(p_native->>'updated_at')::timestamptz,'Tagesplan benötigt eine aktive aktuelle Regelverordnung.');
 perform care_private.med_packet_require(care_private.med_packet_date(p_packet->'effectiveFrom') is not null and (p_packet->'effectiveUntil'='null'::jsonb or care_private.med_packet_date(p_packet->'effectiveUntil') is not null),'Tagesplan benötigt tatsächliche lokale Gültigkeitstage.');
 from_day:=(p_packet->>'effectiveFrom')::date;until_day:=(p_packet->>'effectiveUntil')::date;
 perform care_private.med_packet_require(from_day>=(o->>'validFrom')::date and (until_day is null or until_day>=from_day) and (o->>'validUntil' is null or (until_day is not null and until_day<=(o->>'validUntil')::date)),'Tagesplan darf die ausdrückliche Verordnungsgültigkeit nicht erweitern.');
 perform care_private.med_packet_require(jsonb_typeof(p_packet->'entries')='array' and jsonb_array_length(p_packet->'entries') between 1 and 24,'Ein bis 24 ausdrücklich erfasste Gabezeitfenster erforderlich.');
 for entry in select value from jsonb_array_elements(p_packet->'entries') loop
  perform care_private.med_packet_require(care_private.med_packet_keys(entry,array['id','time','dose','unit','route']) and care_private.med_packet_uuid(entry->'id') and jsonb_typeof(entry->'time')='string' and entry->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and entry->>'time'>prior_time,'Zeitfenster benötigen eindeutige streng aufsteigende lokale Uhrzeiten.');
  entry_id:=(entry->>'id')::uuid;
  perform care_private.med_packet_require(not entry_id=any(ids) and entry->'dose'=o->'dose' and entry->'unit'=o->'unit' and entry->'route'=o->'route','Dosis, Einheit und Weg jedes Zeitfensters müssen ausdrücklich zur nativen Verordnung gehören.');
  ids:=array_append(ids,entry_id);prior_time:=entry->>'time';
 end loop;
end$$;
revoke all on function care_private.validate_medication_daily_plan(jsonb,jsonb) from public,anon,authenticated,service_role;

create function care_private.propose_medication_daily_plan(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;plan care_private.medication_daily_plans%rowtype;app jsonb;originals jsonb;req uuid;actor_name text;
begin
 perform care_private.require_workspace_session(tenant,actor);
 perform care_private.med_packet_require(care_private.med_packet_uuid(p_packet->'requestId') and care_private.med_packet_uuid(p_packet->'clientId') and care_private.med_packet_uuid(p_packet->'medicationId') and p_packet->>'tenantId'=tenant::text and p_packet->>'actorId'=actor::text,'Eigener Tagesplanbezug fehlt.');req:=(p_packet->>'requestId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('medication-daily-plan-request:'||tenant||':'||req,0));
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||(p_packet->>'medicationId'),0));
 perform care_private.lock_medication_source_scope(tenant,(p_packet->>'clientId')::uuid,(p_packet->>'medicationId')::uuid,actor);
 select * into plan from care_private.medication_daily_plans where tenant_id=tenant and request_id=req for share;
 if plan.id is not null then perform care_private.med_packet_require(plan.recorded_by=actor and plan.packet is not distinct from p_packet,'Tagesplananfrage wurde für andere Angaben verwendet.');return care_private.medication_daily_plan_json(plan.id);end if;
 select * into m from public.medications where id=(p_packet->>'medicationId')::uuid and tenant_id=tenant for share;
 perform care_private.validate_medication_daily_plan(p_packet,to_jsonb(m));
 app:=care_private.current_medication_order_application(tenant,m.client_id,m.id);
 perform care_private.med_packet_require(app is not null and app->>'id'=p_packet->>'orderApplicationId' and app->>'source_id'=p_packet->>'sourceId','Tagesplan benötigt die exakt zurückgelesene gesondert übertragene Verordnung.');
 originals:=care_private.medication_order_archived_source(tenant,m.client_id,m.id,(p_packet->>'sourceId')::uuid);
 select coalesce(nullif(p.display_name,''),p.email,'Name nicht verfügbar') into actor_name from public.profiles p where p.id=actor;
 insert into care_private.medication_daily_plans(tenant_id,client_id,medication_id,order_application_id,source_id,request_id,recorded_by,creator_session_id,recorded_by_name,expected_updated_at,native_snapshot,order_application_snapshot,source_snapshot,archive_snapshot,effective_from,effective_until,timezone,entries,reason,packet)
 values(tenant,m.client_id,m.id,(app->>'id')::uuid,(p_packet->>'sourceId')::uuid,req,actor,(auth.jwt()->>'session_id')::uuid,actor_name,m.updated_at,to_jsonb(m),app,originals->'source',originals->'archive',(p_packet->>'effectiveFrom')::date,(p_packet->>'effectiveUntil')::date,'Europe/Berlin',p_packet->'entries',btrim(p_packet->>'reason'),p_packet) returning * into plan;
 return care_private.medication_daily_plan_json(plan.id);
end$$;
create function public.propose_ambulatory_medication_daily_plan(packet jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.propose_medication_daily_plan(packet)$$;

create function care_private.confirm_medication_daily_plan(p_plan uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();plan care_private.medication_daily_plans%rowtype;begin
 perform care_private.require_workspace_session(tenant,actor);
 select * into plan from care_private.medication_daily_plans where id=p_plan and tenant_id=tenant and request_id=p_request and recorded_by=actor for share;
 if plan.id is null then raise exception 'Eigener Tagesplan nicht zugänglich.' using errcode='42501';end if;
 perform care_private.lock_medication_source_scope(tenant,plan.client_id,plan.medication_id,actor);return care_private.medication_daily_plan_json(plan.id);
end$$;
create function public.confirm_ambulatory_medication_daily_plan(plan_id uuid,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_medication_daily_plan(plan_id,request_id)$$;

create function care_private.read_medication_daily_plan_context(p_medication uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare ledger_before text;ledger_after text;tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;app jsonb;originals jsonb;begin
 perform care_private.require_workspace_session(tenant,actor);select * into m from public.medications where id=p_medication and tenant_id=tenant;
 if m.id is null then raise exception 'Verordnung nicht zugänglich.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||m.id,0));
 perform care_private.lock_medication_source_scope(tenant,m.client_id,m.id,actor);ledger_before:=care_private.medication_daily_plan_ledger_fingerprint(tenant,m.id);select * into m from public.medications where id=m.id for share;
 app:=care_private.current_medication_order_application(tenant,m.client_id,m.id);
 if app is not null then originals:=care_private.medication_order_archived_source(tenant,m.client_id,m.id,(app->>'source_id')::uuid);end if;
 ledger_after:=care_private.medication_daily_plan_ledger_fingerprint(tenant,m.id);perform care_private.med_packet_require(ledger_before=ledger_after,'Vollständiger Tagesplan- oder Prüfledger wurde während des Lesens geändert.');
 return jsonb_build_object('order',to_jsonb(m),'orderApplication',app,'source',originals,'ledgerFingerprint',ledger_after);
end$$;
create function public.read_ambulatory_medication_daily_plan_context(medication_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_daily_plan_context(medication_id)$$;

create function care_private.read_medication_daily_plans(p_medication uuid,p_cursor_at timestamptz,p_cursor_id uuid,p_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare ledger_before text;ledger_after text;tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;plan care_private.medication_daily_plans%rowtype;items jsonb:='[]'::jsonb;last_at timestamptz;last_id uuid;pos integer:=0;more boolean:=false;begin
 perform care_private.require_workspace_session(tenant,actor);perform care_private.med_packet_require(p_size between 1 and 100 and (p_cursor_at is null)=(p_cursor_id is null) and (p_cursor_at is null or isfinite(p_cursor_at)),'Ungültige Tagesplan-Verlaufsseite.');
 select * into m from public.medications where id=p_medication and tenant_id=tenant;if m.id is null then raise exception 'Verordnung nicht zugänglich.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||m.id,0));
 perform care_private.lock_medication_source_scope(tenant,m.client_id,m.id,actor);ledger_before:=care_private.medication_daily_plan_ledger_fingerprint(tenant,m.id);
 if p_cursor_id is not null and not exists(select 1 from care_private.medication_daily_plans p where p.id=p_cursor_id and p.tenant_id=tenant and p.medication_id=m.id and p.recorded_at=p_cursor_at) then raise exception 'Tagesplancursor gehört nicht zu dieser Akte.' using errcode='23514';end if;
 for plan in select * from care_private.medication_daily_plans p where p.tenant_id=tenant and p.medication_id=m.id and (p_cursor_at is null or (p.recorded_at,p.id)<(p_cursor_at,p_cursor_id)) order by p.recorded_at desc,p.id desc limit p_size+1 loop
  pos:=pos+1;if pos>p_size then more:=true;exit;end if;items:=items||jsonb_build_array(care_private.medication_daily_plan_json(plan.id));last_at:=plan.recorded_at;last_id:=plan.id;
 end loop;ledger_after:=care_private.medication_daily_plan_ledger_fingerprint(tenant,m.id);perform care_private.med_packet_require(ledger_before=ledger_after,'Vollständiger Tagesplan- oder Prüfledger wurde während des Lesens geändert.');
 return jsonb_build_object('items',items,'nextCursor',case when more then jsonb_build_object('at',last_at,'id',last_id) else null end,'ledgerFingerprint',ledger_after);
end$$;
create function public.read_ambulatory_medication_daily_plans(medication_id uuid,cursor_at timestamptz default null,cursor_id uuid default null,page_size integer default 50) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_daily_plans(medication_id,cursor_at,cursor_id,page_size)$$;

-- The original request actor must retain their own current scope rights and session.
-- Never resolve this actor through the current reviewer's JWT or linked other roles.
create function care_private.medication_daily_plan_request_actor_active(p_tenant uuid,p_actor uuid,p_session uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare creator public.profiles%rowtype;required text;
begin
 select * into creator from public.profiles p where p.id=p_actor and p.tenant_id=p_tenant and p.is_active and p.status='active' for share;
 if creator.id is null then return false;end if;
 perform 1 from auth.sessions s where s.id=p_session and s.user_id=coalesce(creator.auth_user_id,creator.id) and (s.not_after is null or s.not_after>clock_timestamp()) for share;
 if not found then return false;end if;
 perform 1 from public.role_permissions rp where rp.role_id=creator.role_id for share;
 foreach required in array array['pflege.medications.manage','pflege.medications.view','office.documents.view','office.clients.view_sensitive'] loop
  if not exists(select 1 from public.role_permissions rp where rp.role_id=creator.role_id and (rp.permission_key=required or (rp.permission_key=split_part(required,'.',2) and ((required like '%.view' and coalesce(rp.can_view,false)) or (required like '%.manage' and coalesce(rp.can_update,false)))))) then return false;end if;
 end loop;
 return true;
end$$;
revoke all on function care_private.medication_daily_plan_request_actor_active(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function care_private.medication_daily_plan_review_json(p_review uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();request_row care_private.medication_daily_plan_review_requests%rowtype;plan care_private.medication_daily_plans%rowtype;m public.medications%rowtype;creator public.profiles%rowtype;role_id_value uuid;app jsonb;plan_value jsonb;state_value text;can_review boolean:=false;result jsonb;
begin
 perform care_private.require_workspace_session(tenant,actor);
 select * into request_row from care_private.medication_daily_plan_review_requests where id=p_review and tenant_id=tenant for share;
 if request_row.id is null then raise exception 'Tagesplan-Prüfanfrage nicht zugänglich.' using errcode='42501';end if;
 select * into plan from care_private.medication_daily_plans where id=request_row.plan_id and tenant_id=tenant for share;
 perform care_private.lock_medication_source_scope(tenant,plan.client_id,plan.medication_id,actor);
 select * into m from public.medications where id=plan.medication_id and tenant_id=tenant for share;
 app:=care_private.current_medication_order_application(tenant,plan.client_id,plan.medication_id);plan_value:=care_private.medication_daily_plan_json(plan.id);
 if (request_row.action='authorize' and plan_value->>'state'='authorized') or (request_row.action='withdraw' and plan_value->'withdrawal'<>'null'::jsonb) then state_value:='authorized';
 elsif request_row.expires_at<=clock_timestamp() then state_value:='expired';
 elsif request_row.plan_fingerprint<>care_private.medication_json_fingerprint(to_jsonb(plan)) or (request_row.action='authorize' and app is distinct from plan.order_application_snapshot) or (request_row.action='withdraw' and (plan_value->>'state'<>'authorized' or request_row.effective_from<=(clock_timestamp() at time zone 'Europe/Berlin')::date)) then state_value:='stale';
 else state_value:='pending';end if;
 select * into creator from public.profiles where id=request_row.actor_id and tenant_id=tenant and is_active and status='active' for share;
 select role_id into role_id_value from public.profiles where id=actor and tenant_id=tenant for share;
 can_review:=state_value='pending' and care_private.medication_daily_plan_request_actor_active(tenant,request_row.actor_id,request_row.creator_session_id) and creator.id is not null and creator.id<>actor and coalesce(creator.auth_user_id,creator.id)<>auth.uid() and exists(select 1 from public.role_permissions where role_id=role_id_value and permission_key='pflege.documentation.sign') and exists(select 1 from auth.sessions where id=request_row.creator_session_id and user_id=coalesce(creator.auth_user_id,creator.id) and (not_after is null or not_after>clock_timestamp()));
 result:=jsonb_build_object('request',to_jsonb(request_row)-'creator_session_id','plan',plan_value,'currentOrder',to_jsonb(m),'currentOrderApplication',app,'state',state_value,'canReview',can_review);
 return result||jsonb_build_object('reviewFingerprint',care_private.medication_json_fingerprint(result));
end$$;
revoke all on function care_private.medication_daily_plan_review_json(uuid) from public,anon,authenticated,service_role;

-- Full medication ledger, rather than page-one freshness alone. Projected reviews
-- include expiry and current actor/session/role rights; no session identifier is returned.
create function care_private.medication_daily_plan_ledger_fingerprint(p_tenant uuid,p_medication uuid)
returns text language plpgsql security definer set search_path='' as $$
declare m public.medications%rowtype;plans jsonb;reviews jsonb;app jsonb;originals jsonb;actor uuid:=public.resolve_current_profile_id();
begin
 perform care_private.require_workspace_session(p_tenant,actor);
 select * into m from public.medications where id=p_medication and tenant_id=p_tenant for share;
 if m.id is null then raise exception 'Tagesplanledger nicht zugänglich.' using errcode='42501';end if;
 perform care_private.lock_medication_source_scope(p_tenant,m.client_id,m.id,actor);
 select coalesce(jsonb_agg(care_private.medication_daily_plan_json(p.id) order by p.recorded_at,p.id),'[]'::jsonb) into plans from care_private.medication_daily_plans p where p.tenant_id=p_tenant and p.medication_id=p_medication and p.client_id=m.client_id;
 select coalesce(jsonb_agg(care_private.medication_daily_plan_review_json(q.id) order by q.recorded_at,q.id),'[]'::jsonb) into reviews from care_private.medication_daily_plan_review_requests q join care_private.medication_daily_plans p on p.id=q.plan_id where q.tenant_id=p_tenant and p.tenant_id=p_tenant and p.medication_id=p_medication and p.client_id=m.client_id;
 app:=care_private.current_medication_order_application(p_tenant,m.client_id,m.id);
 if app is not null then originals:=care_private.medication_order_archived_source(p_tenant,m.client_id,m.id,(app->>'source_id')::uuid);end if;
 return care_private.medication_json_fingerprint(jsonb_build_object('order',to_jsonb(m),'orderApplication',app,'source',originals,'plans',plans,'reviews',reviews));
end$$;
revoke all on function care_private.medication_daily_plan_ledger_fingerprint(uuid,uuid) from public,anon,authenticated,service_role;

create function care_private.request_medication_daily_plan_review(p_plan uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();plan care_private.medication_daily_plans%rowtype;request_row care_private.medication_daily_plan_review_requests%rowtype;app jsonb;begin
 perform care_private.require_workspace_session(tenant,actor);if p_request is null then raise exception 'Eigene Prüfanfrage fehlt.' using errcode='23514';end if;
 select * into plan from care_private.medication_daily_plans where id=p_plan and tenant_id=tenant and recorded_by=actor for share;
 if plan.id is null then raise exception 'Eigener Tagesplan fehlt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||plan.medication_id,0));
 perform care_private.lock_medication_source_scope(tenant,plan.client_id,plan.medication_id,actor);
 perform pg_advisory_xact_lock(hashtextextended('medication-plan-review-request:'||tenant||':'||p_request,0));
 select * into request_row from care_private.medication_daily_plan_review_requests where tenant_id=tenant and request_id=p_request for share;
 if request_row.id is not null then perform care_private.med_packet_require(request_row.plan_id=plan.id and request_row.actor_id=actor and request_row.action='authorize','Prüfanfrage gehört zu einem anderen ursprünglichen Tagesplan.');return care_private.medication_daily_plan_review_json(request_row.id);end if;
 app:=care_private.current_medication_order_application(tenant,plan.client_id,plan.medication_id);
 perform care_private.med_packet_require(app is not distinct from plan.order_application_snapshot,'Tagesplan gehört nicht mehr zur aktuellen übertragenen Verordnung.');
 insert into care_private.medication_daily_plan_review_requests(tenant_id,plan_id,request_id,actor_id,creator_session_id,plan_fingerprint,expires_at)
 values(tenant,plan.id,p_request,actor,(auth.jwt()->>'session_id')::uuid,care_private.medication_json_fingerprint(to_jsonb(plan)),clock_timestamp()+interval '30 minutes') returning * into request_row;
 return care_private.medication_daily_plan_review_json(request_row.id);
end$$;
create function public.request_ambulatory_medication_daily_plan_review(plan_id uuid,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.request_medication_daily_plan_review(plan_id,request_id)$$;

create function care_private.authorize_medication_daily_plan(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();reviewer uuid:=public.resolve_current_profile_id();plan care_private.medication_daily_plans%rowtype;request_row care_private.medication_daily_plan_review_requests%rowtype;prior care_private.medication_daily_plan_authorizations%rowtype;prior_withdrawal care_private.medication_daily_plan_withdrawals%rowtype;creator public.profiles%rowtype;reviewer_role uuid;app jsonb;req uuid;review_context jsonb;
begin
 perform care_private.require_workspace_session(tenant,reviewer);
 perform care_private.med_packet_require(care_private.med_packet_keys(p_packet,array['planId','reviewRequestId','requestId','reviewReference','expectedReviewFingerprint']) and care_private.med_packet_uuid(p_packet->'planId') and care_private.med_packet_uuid(p_packet->'reviewRequestId') and care_private.med_packet_uuid(p_packet->'requestId') and care_private.med_packet_text(p_packet->'reviewReference',10,2000) and jsonb_typeof(p_packet->'expectedReviewFingerprint')='string' and p_packet->>'expectedReviewFingerprint' ~ '^sha256:[0-9a-f]{64}$','Tagesplanprüfung benötigt eine vollständige eigene Prüfanfrage und unveränderte Prüffassung.');req:=(p_packet->>'requestId')::uuid;
 select * into plan from care_private.medication_daily_plans where id=(p_packet->>'planId')::uuid and tenant_id=tenant for share;
 if plan.id is null then raise exception 'Tagesplan nicht zugänglich.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||plan.medication_id,0));
 perform care_private.lock_medication_source_scope(tenant,plan.client_id,plan.medication_id,reviewer);
 select role_id into reviewer_role from public.profiles where id=reviewer and tenant_id=tenant for share;
 if not exists(select 1 from public.role_permissions where role_id=reviewer_role and permission_key='pflege.documentation.sign') then raise exception 'Eigenes Recht zur unabhängigen dokumentierten Prüfung fehlt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('medication-plan-authorization-request:'||tenant||':'||req,0));
 select * into prior from care_private.medication_daily_plan_authorizations where tenant_id=tenant and request_id=req for share;
 if prior.id is not null then perform care_private.med_packet_require(prior.reviewed_by=reviewer and prior.packet is not distinct from p_packet,'Prüfbestätigung gehört zu einem anderen ursprünglichen Auftrag.');return care_private.medication_daily_plan_json(prior.plan_id);end if;
 select * into prior_withdrawal from care_private.medication_daily_plan_withdrawals where tenant_id=tenant and request_id=req for share;
 if prior_withdrawal.id is not null then perform care_private.med_packet_require(prior_withdrawal.reviewed_by=reviewer and prior_withdrawal.packet is not distinct from p_packet,'Beendigungsbestätigung gehört zu einem anderen ursprünglichen Auftrag.');return care_private.medication_daily_plan_json(prior_withdrawal.plan_id);end if;
 select * into request_row from care_private.medication_daily_plan_review_requests where id=(p_packet->>'reviewRequestId')::uuid and tenant_id=tenant and plan_id=plan.id for share;
 if request_row.id is null or request_row.expires_at<=clock_timestamp() or request_row.recorded_at>clock_timestamp() then raise exception 'Aktuelle eigene Tagesplan-Prüfanfrage fehlt.' using errcode='42501';end if;
 select * into creator from public.profiles where id=request_row.actor_id and tenant_id=tenant and is_active and status='active' for share;
 if creator.id is null or creator.id=reviewer or coalesce(creator.auth_user_id,creator.id)=auth.uid() then raise exception 'Anfrage und unabhängige Prüfung müssen von verschiedenen angemeldeten Personen stammen.' using errcode='42501';end if;
 perform 1 from auth.sessions where id=request_row.creator_session_id and user_id=coalesce(creator.auth_user_id,creator.id) and (not_after is null or not_after>clock_timestamp()) for share;
 if not found then raise exception 'Ursprüngliche eigene Anfragesitzung wurde beendet.' using errcode='42501';end if;
 if not care_private.medication_daily_plan_request_actor_active(tenant,request_row.actor_id,request_row.creator_session_id) then raise exception 'Ursprüngliche eigene Quellenrechte der anfragenden Person fehlen.' using errcode='42501';end if;
 review_context:=care_private.medication_daily_plan_review_json(request_row.id);
 perform care_private.med_packet_require(review_context->'canReview'='true'::jsonb and review_context->>'reviewFingerprint'=p_packet->>'expectedReviewFingerprint','Tagesplan, vollständiger Verordnungsstand oder Prüffassung wurde geändert.');
 if request_row.action='withdraw' then
  perform care_private.med_packet_require(request_row.effective_from>(clock_timestamp() at time zone 'Europe/Berlin')::date,'Tagesplanbeendigung darf vergangene oder heutige Zeitfenster nicht nachträglich entfernen.');
  insert into care_private.medication_daily_plan_withdrawals(tenant_id,plan_id,review_request_id,request_id,reviewed_by,reviewer_session_id,effective_from,reason,review_reference,plan_fingerprint,packet)
  values(tenant,plan.id,request_row.id,req,reviewer,(auth.jwt()->>'session_id')::uuid,request_row.effective_from,request_row.reason,btrim(p_packet->>'reviewReference'),request_row.plan_fingerprint,p_packet);
 else
  app:=care_private.current_medication_order_application(tenant,plan.client_id,plan.medication_id);
  perform care_private.med_packet_require(app is not distinct from plan.order_application_snapshot and request_row.plan_fingerprint=care_private.medication_json_fingerprint(to_jsonb(plan)),'Tagesplan oder vollständiger Verordnungs- und Quellenstand wurde geändert.');
  if exists(select 1 from care_private.medication_daily_plan_authorizations a join care_private.medication_daily_plans p on p.id=a.plan_id left join care_private.medication_daily_plan_withdrawals w on w.plan_id=p.id where p.tenant_id=tenant and p.medication_id=plan.medication_id and p.order_application_id=plan.order_application_id and (case when w.id is not null and w.effective_from<=p.effective_from then 'empty'::daterange else daterange(p.effective_from,case when w.id is null then p.effective_until else least(coalesce(p.effective_until,w.effective_from-1),w.effective_from-1) end,'[]') end) && daterange(plan.effective_from,plan.effective_until,'[]')) then raise exception 'Für diesen Zeitraum besteht bereits ein geprüfter Tagesplan; ausdrückliche zukünftige Beendigung erforderlich.' using errcode='23514';end if;
  insert into care_private.medication_daily_plan_authorizations(tenant_id,plan_id,review_request_id,request_id,reviewed_by,reviewer_session_id,review_reference,plan_fingerprint,packet)
  values(tenant,plan.id,request_row.id,req,reviewer,(auth.jwt()->>'session_id')::uuid,btrim(p_packet->>'reviewReference'),request_row.plan_fingerprint,p_packet);
 end if;
 return care_private.medication_daily_plan_json(plan.id);
end$$;
create function public.authorize_ambulatory_medication_daily_plan(packet jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.authorize_medication_daily_plan(packet)$$;

create function care_private.assess_medication_execution(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;app jsonb;o jsonb;plan care_private.medication_daily_plans%rowtype;plan_json jsonb;entry jsonb;actual public.medication_administrations%rowtype;actuals jsonb:='[]'::jsonb;relevant jsonb:='[]'::jsonb;item jsonb;anchor jsonb;checks jsonb;result jsonb;violations jsonb:='["legacy_execution_writers_unclosed","clinical_execution_acceptance_unproven"]'::jsonb;
 reference_at timestamptz;assessed_at timestamptz;window_from timestamptz;window_through timestamptz;period_us bigint:=0;interval_us bigint:=0;lookback_us bigint;day date;slot_matched boolean;complete boolean:=true;interval_ok boolean;cumulative_ok boolean;before_id uuid;after_id uuid;before_time timestamptz;after_time timestamptz;before_minutes numeric;after_minutes numeric;rolling numeric;observed numeric;anchor_at timestamptz;anchor_total numeric;amount numeric;own_role uuid;
begin
 perform care_private.require_workspace_session(tenant,actor);
 perform care_private.med_packet_require(care_private.med_packet_keys(p_packet,array['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','expectedUpdatedAt','orderApplicationId','kind','planId','entryId','occurredAt','actualDose','unit','route','prnIndication']) and p_packet->'schemaVersion'='1'::jsonb and p_packet->>'tenantId'=tenant::text and p_packet->>'actorId'=actor::text and care_private.med_packet_uuid(p_packet->'requestId') and care_private.med_packet_uuid(p_packet->'clientId') and care_private.med_packet_uuid(p_packet->'medicationId') and care_private.med_packet_uuid(p_packet->'orderApplicationId') and p_packet->>'kind' in('regular','prn'),'Eigener Gabenprüfauftrag unvollständig.');
 -- Same key as structured order applications, before the scope helper acquires SHARE.
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||(p_packet->>'medicationId'),0));
 perform care_private.lock_medication_source_scope(tenant,(p_packet->>'clientId')::uuid,(p_packet->>'medicationId')::uuid,actor);
 select role_id into own_role from public.profiles where id=actor and tenant_id=tenant for share;
 if not exists(select 1 from public.role_permissions where role_id=own_role and permission_key='pflege.medications.administer') then raise exception 'Eigenes aktuelles Recht zur Gabenprüfung fehlt.' using errcode='42501';end if;
 select * into m from public.medications where id=(p_packet->>'medicationId')::uuid and tenant_id=tenant for update;
 o:=care_private.medication_native_order(to_jsonb(m));app:=care_private.current_medication_order_application(tenant,m.client_id,m.id);
 perform care_private.med_packet_require(app is not null and app->>'id'=p_packet->>'orderApplicationId' and m.status='active' and care_private.med_packet_time(to_jsonb(replace(p_packet->>'expectedUpdatedAt',' ','T')))=m.updated_at and p_packet->'actualDose'=o->'dose' and p_packet->'unit'=o->'unit' and p_packet->'route'=o->'route' and (o->>'isPrn')::boolean=(p_packet->>'kind'='prn'),'Prüfauftrag widerspricht der aktuellen ausdrücklich übertragenen Verordnung.');
 reference_at:=care_private.med_packet_time(p_packet->'occurredAt');day:=(reference_at at time zone 'Europe/Berlin')::date;
 perform care_private.med_packet_require(day>=(o->>'validFrom')::date and (o->>'validUntil' is null or day<=(o->>'validUntil')::date),'Prüfzeit außerhalb der ursprünglichen Verordnungsgültigkeit.');
 if p_packet->>'kind'='regular' then
  perform care_private.med_packet_require(care_private.med_packet_uuid(p_packet->'planId') and care_private.med_packet_uuid(p_packet->'entryId') and p_packet->'prnIndication'='""'::jsonb,'Regelprüfung benötigt eine konkrete Tagesplanposition.');
  select * into plan from care_private.medication_daily_plans where id=(p_packet->>'planId')::uuid and tenant_id=tenant and client_id=m.client_id and medication_id=m.id for share;
  if plan.id is not null then
   plan_json:=care_private.medication_daily_plan_json(plan.id);
   select value into entry from jsonb_array_elements(plan.entries) where value->>'id'=p_packet->>'entryId';
  end if;
  slot_matched:=coalesce(plan.id is not null and plan_json->>'state'='authorized' and (plan_json->'withdrawal'='null'::jsonb or day<(plan_json#>>'{withdrawal,effective_from}')::date) and plan.native_snapshot=to_jsonb(m) and plan.order_application_id=(app->>'id')::uuid and day>=plan.effective_from and (plan.effective_until is null or day<=plan.effective_until) and entry->>'time'=to_char(reference_at at time zone 'Europe/Berlin','HH24:MI') and entry->'dose'=p_packet->'actualDose' and entry->'unit'=p_packet->'unit' and entry->'route'=p_packet->'route',false);
  if not slot_matched then violations:=violations||'"regular_plan_slot_not_confirmed"'::jsonb;end if;
  lookback_us:=93600000000; -- 26 hours spans a Berlin local day even across DST.
 else
  perform care_private.med_packet_require(p_packet->'planId'='null'::jsonb and p_packet->'entryId'='null'::jsonb and care_private.med_packet_text(p_packet->'prnIndication',3,2000),'Bedarfsprüfung benötigt die aktuelle ausdrückliche Indikation.');
  interval_us:=((o->>'minimumIntervalMinutes')::numeric*60000000)::bigint;period_us:=((o->>'maximumPeriodHours')::numeric*3600000000)::bigint;lookback_us:=greatest(interval_us,period_us);
 end if;
 -- Existing direct/legacy writers do not prove this lock is universal. No success here
 -- permits an administration write. Every retained native row is returned, without cap.
 perform 1 from public.medication_administrations a where a.tenant_id=tenant and a.client_id=m.client_id and a.medication_id=m.id for share;
 assessed_at:=clock_timestamp();perform care_private.med_packet_require(reference_at<=assessed_at,'Prüfzeit liegt in der Zukunft.');
 window_from:=reference_at-(lookback_us::text||' microseconds')::interval;window_through:=least(assessed_at,reference_at+(lookback_us::text||' microseconds')::interval);
 for actual in select * from public.medication_administrations a where a.tenant_id=tenant and a.client_id=m.client_id and a.medication_id=m.id order by a.occurred_at nulls first,a.id loop
  actuals:=actuals||jsonb_build_array(to_jsonb(actual));
  if actual.status in('scheduled','omitted','refused','held') then
   if actual.administered_dose is not null then complete:=false;violations:=violations||'"non_actual_row_contains_dose"'::jsonb;end if;continue;
  end if;
  if actual.status not in('administered','late') or actual.occurred_at is null or not isfinite(actual.occurred_at) or actual.occurred_at>assessed_at then complete:=false;violations:=violations||'"actual_time_or_outcome_unknown"'::jsonb;continue;end if;
  if actual.occurred_at<window_from or actual.occurred_at>window_through then continue;end if;
  if actual.administered_dose is null or actual.administered_dose !~ '^(0|[1-9][0-9]{0,7})(\.[0-9]{1,3})?$' then complete:=false;violations:=violations||'"actual_dose_not_structured"'::jsonb;continue;end if;
  amount:=actual.administered_dose::numeric;
  if amount<=0 or jsonb_typeof(actual.creation_payload) is distinct from 'object' or jsonb_typeof(actual.creation_payload->'unit') is distinct from 'string' or actual.creation_payload->>'unit' is distinct from o->>'unit' or actual.route is distinct from o->>'route' then complete:=false;violations:=violations||'"actual_unit_or_route_unconfirmed"'::jsonb;continue;end if;
  relevant:=relevant||jsonb_build_array(jsonb_build_object('id',actual.id,'at',actual.occurred_at,'dose',amount));
  if p_packet->>'kind'='regular' and slot_matched and (actual.occurred_at at time zone 'Europe/Berlin')::date=day and to_char(actual.occurred_at at time zone 'Europe/Berlin','HH24:MI')=entry->>'time' then violations:=violations||'"regular_slot_already_documented"'::jsonb;end if;
 end loop;
 if p_packet->>'kind'='prn' and complete then
  select value into item from jsonb_array_elements(relevant) where (value->>'at')::timestamptz<=reference_at order by (value->>'at')::timestamptz desc,value->>'id' desc limit 1;
  if item is not null then before_id:=(item->>'id')::uuid;before_time:=(item->>'at')::timestamptz;before_minutes:=extract(epoch from(reference_at-before_time))/60;end if;
  item:=null;select value into item from jsonb_array_elements(relevant) where (value->>'at')::timestamptz>reference_at order by (value->>'at')::timestamptz,value->>'id' limit 1;
  if item is not null then after_id:=(item->>'id')::uuid;after_time:=(item->>'at')::timestamptz;after_minutes:=extract(epoch from(after_time-reference_at))/60;end if;
  interval_ok:=(before_time is null or extract(epoch from(reference_at-before_time))*1000000>=interval_us) and (after_time is null or extract(epoch from(after_time-reference_at))*1000000>=interval_us);
  select coalesce(sum((value->>'dose')::numeric),0)+(p_packet->>'actualDose')::numeric into rolling from jsonb_array_elements(relevant) where (value->>'at')::timestamptz between reference_at-(period_us::text||' microseconds')::interval and reference_at;
  observed:=rolling;
  for anchor in select value from jsonb_array_elements(relevant) where (value->>'at')::timestamptz>reference_at and (value->>'at')::timestamptz<=reference_at+(period_us::text||' microseconds')::interval loop
   anchor_at:=(anchor->>'at')::timestamptz;
   select coalesce(sum((value->>'dose')::numeric),0)+(p_packet->>'actualDose')::numeric into anchor_total from jsonb_array_elements(relevant) where (value->>'at')::timestamptz between anchor_at-(period_us::text||' microseconds')::interval and anchor_at;
   observed:=greatest(observed,anchor_total);
  end loop;
  cumulative_ok:=observed<=(o->>'maximumDose')::numeric;
  if not interval_ok then violations:=violations||'"minimum_interval_not_satisfied"'::jsonb;end if;
  if not cumulative_ok then violations:=violations||'"rolling_maximum_not_satisfied"'::jsonb;end if;
 end if;
 if to_jsonb(m)->'is_controlled_substance' is distinct from 'false'::jsonb then violations:=violations||'"controlled_or_unknown_witness_requirement"'::jsonb;end if;
 if to_jsonb(m)->'is_high_alert' is distinct from 'false'::jsonb then violations:=violations||'"high_alert_or_unknown_review_requirement"'::jsonb;end if;
 checks:=jsonb_build_object('nativeBound',true,'slotMatched',slot_matched,'historyComplete',complete,'intervalSatisfied',interval_ok,'cumulativeSatisfied',cumulative_ok,'precedingActualId',before_id,'followingActualId',after_id,'intervalBeforeMinutes',case when before_minutes is null then null else before_minutes::text end,'intervalAfterMinutes',case when after_minutes is null then null else after_minutes::text end,'intervalBeforeMicroseconds',case when before_time is null then null else (extract(epoch from(reference_at-before_time))*1000000)::bigint::text end,'intervalAfterMicroseconds',case when after_time is null then null else (extract(epoch from(after_time-reference_at))*1000000)::bigint::text end,'rollingDose',case when rolling is null then null else rolling::text end,'maximumObservedWindowDose',case when observed is null then null else observed::text end,'maximumDose',case when p_packet->>'kind'='prn' then o->>'maximumDose' else null end,'maximumPeriodHours',case when p_packet->>'kind'='prn' then o->>'maximumPeriodHours' else null end,'minimumIntervalMinutes',case when p_packet->>'kind'='prn' then o->>'minimumIntervalMinutes' else null end);
 result:=jsonb_build_object('state','blocked','executionAllowed',false,'requestId',p_packet->'requestId','kind',p_packet->'kind','assessedAt',assessed_at,'historyWindow',jsonb_build_object('from',window_from,'through',window_through),'order',to_jsonb(m),'orderApplication',app,'plan',plan_json,'actuals',actuals,'violations',violations,'checks',checks);
 return result||jsonb_build_object('fingerprint',care_private.medication_json_fingerprint(result));
end$$;
create function public.assess_ambulatory_medication_execution(packet jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.assess_medication_execution(packet)$$;

create function care_private.commit_medication_execution(p_packet jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$begin
 raise exception 'Gabendokumentation gesperrt: vollständige Abschlussprüfung der bisherigen Schreibwege und klinischen Ausführungsvoraussetzungen fehlt.' using errcode='42501';
end$$;
create function public.commit_ambulatory_medication_execution(packet jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_medication_execution(packet)$$;
revoke all on function care_private.propose_medication_daily_plan(jsonb),public.propose_ambulatory_medication_daily_plan(jsonb),care_private.confirm_medication_daily_plan(uuid,uuid),public.confirm_ambulatory_medication_daily_plan(uuid,uuid),care_private.read_medication_daily_plan_context(uuid),public.read_ambulatory_medication_daily_plan_context(uuid),care_private.read_medication_daily_plans(uuid,timestamptz,uuid,integer),public.read_ambulatory_medication_daily_plans(uuid,timestamptz,uuid,integer),care_private.request_medication_daily_plan_review(uuid,uuid),public.request_ambulatory_medication_daily_plan_review(uuid,uuid),care_private.authorize_medication_daily_plan(jsonb),public.authorize_ambulatory_medication_daily_plan(jsonb),care_private.assess_medication_execution(jsonb),public.assess_ambulatory_medication_execution(jsonb),care_private.commit_medication_execution(jsonb),public.commit_ambulatory_medication_execution(jsonb) from public,anon,authenticated,service_role;

create function care_private.request_medication_daily_plan_withdrawal(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();plan care_private.medication_daily_plans%rowtype;request_row care_private.medication_daily_plan_review_requests%rowtype;req uuid;plan_value jsonb;
begin
 perform care_private.require_workspace_session(tenant,actor);
 perform care_private.med_packet_require(care_private.med_packet_keys(p_packet,array['planId','requestId','effectiveFrom','reason']) and care_private.med_packet_uuid(p_packet->'planId') and care_private.med_packet_uuid(p_packet->'requestId') and care_private.med_packet_date(p_packet->'effectiveFrom') is not null and care_private.med_packet_text(p_packet->'reason',10,2000),'Beendigungsanfrage benötigt den ausdrücklichen ursprünglichen Plan, zukünftigen Tag und vollständigen Grund.');req:=(p_packet->>'requestId')::uuid;
 select * into plan from care_private.medication_daily_plans where id=(p_packet->>'planId')::uuid and tenant_id=tenant for share;
 if plan.id is null then raise exception 'Tagesplan nicht zugänglich.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||plan.medication_id,0));
 perform care_private.lock_medication_source_scope(tenant,plan.client_id,plan.medication_id,actor);
 perform pg_advisory_xact_lock(hashtextextended('medication-plan-review-request:'||tenant||':'||req,0));
 select * into request_row from care_private.medication_daily_plan_review_requests where tenant_id=tenant and request_id=req for share;
 if request_row.id is not null then perform care_private.med_packet_require(request_row.plan_id=plan.id and request_row.actor_id=actor and request_row.action='withdraw' and request_row.effective_from=(p_packet->>'effectiveFrom')::date and request_row.reason=btrim(p_packet->>'reason'),'Beendigungsanfrage wurde für andere ursprüngliche Angaben verwendet.');return care_private.medication_daily_plan_review_json(request_row.id);end if;
 plan_value:=care_private.medication_daily_plan_json(plan.id);
 perform care_private.med_packet_require(plan_value->>'state'='authorized' and plan_value->'withdrawal'='null'::jsonb and (p_packet->>'effectiveFrom')::date>(clock_timestamp() at time zone 'Europe/Berlin')::date,'Nur ein noch nicht beendeter autorisierter Tagesplan darf ausdrücklich für einen zukünftigen Tag beendet werden.');
 insert into care_private.medication_daily_plan_review_requests(tenant_id,plan_id,request_id,actor_id,creator_session_id,action,effective_from,reason,plan_fingerprint,expires_at)
 values(tenant,plan.id,req,actor,(auth.jwt()->>'session_id')::uuid,'withdraw',(p_packet->>'effectiveFrom')::date,btrim(p_packet->>'reason'),care_private.medication_json_fingerprint(to_jsonb(plan)),clock_timestamp()+interval '30 minutes') returning * into request_row;
 return care_private.medication_daily_plan_review_json(request_row.id);
end$$;
create function public.request_ambulatory_medication_daily_plan_withdrawal(packet jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.request_medication_daily_plan_withdrawal(packet)$$;

create function care_private.confirm_medication_daily_plan_review_request(p_review uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();begin
 perform care_private.require_workspace_session(tenant,actor);
 if not exists(select 1 from care_private.medication_daily_plan_review_requests where id=p_review and tenant_id=tenant and request_id=p_request and actor_id=actor) then raise exception 'Eigene ursprüngliche Prüfanfrage fehlt.' using errcode='42501';end if;
 return care_private.medication_daily_plan_review_json(p_review);
end$$;
create function public.confirm_ambulatory_medication_daily_plan_review_request(review_request_id uuid,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_medication_daily_plan_review_request(review_request_id,request_id)$$;
create function public.read_ambulatory_medication_daily_plan_review_context(review_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.medication_daily_plan_review_json(review_request_id)$$;

create function care_private.read_medication_daily_plan_reviews(p_medication uuid,p_cursor_at timestamptz,p_cursor_id uuid,p_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare ledger_before text;ledger_after text;tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;request_row care_private.medication_daily_plan_review_requests%rowtype;items jsonb:='[]'::jsonb;last_at timestamptz;last_id uuid;pos integer:=0;more boolean:=false;begin
 perform care_private.require_workspace_session(tenant,actor);perform care_private.med_packet_require(p_size between 1 and 100 and (p_cursor_at is null)=(p_cursor_id is null) and (p_cursor_at is null or isfinite(p_cursor_at)),'Ungültige Tagesplan-Prüfseite.');
 select * into m from public.medications where id=p_medication and tenant_id=tenant;if m.id is null then raise exception 'Verordnung nicht zugänglich.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||m.id,0));
 perform care_private.lock_medication_source_scope(tenant,m.client_id,m.id,actor);ledger_before:=care_private.medication_daily_plan_ledger_fingerprint(tenant,m.id);
 if p_cursor_id is not null and not exists(select 1 from care_private.medication_daily_plan_review_requests q join care_private.medication_daily_plans p on p.id=q.plan_id where q.id=p_cursor_id and q.tenant_id=tenant and p.medication_id=m.id and q.recorded_at=p_cursor_at) then raise exception 'Prüfcursor gehört nicht zur eigenen Medikationsakte.' using errcode='23514';end if;
 for request_row in select q.* from care_private.medication_daily_plan_review_requests q join care_private.medication_daily_plans p on p.id=q.plan_id where q.tenant_id=tenant and p.medication_id=m.id and (p_cursor_at is null or (q.recorded_at,q.id)<(p_cursor_at,p_cursor_id)) order by q.recorded_at desc,q.id desc limit p_size+1 loop
  pos:=pos+1;if pos>p_size then more:=true;exit;end if;items:=items||jsonb_build_array(care_private.medication_daily_plan_review_json(request_row.id));last_at:=request_row.recorded_at;last_id:=request_row.id;
 end loop;
 ledger_after:=care_private.medication_daily_plan_ledger_fingerprint(tenant,m.id);perform care_private.med_packet_require(ledger_before=ledger_after,'Vollständiger Tagesplan- oder Prüfledger wurde während des Lesens geändert.');
 return jsonb_build_object('items',items,'nextCursor',case when more then jsonb_build_object('at',last_at,'id',last_id) else null end,'ledgerFingerprint',ledger_after);
end$$;
create function public.read_ambulatory_medication_daily_plan_reviews(medication_id uuid,cursor_at timestamptz default null,cursor_id uuid default null,page_size integer default 50) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_daily_plan_reviews(medication_id,cursor_at,cursor_id,page_size)$$;

create function care_private.confirm_medication_daily_plan_authorization(p_authorization uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();plan_id_value uuid;plan care_private.medication_daily_plans%rowtype;begin
 perform care_private.require_workspace_session(tenant,actor);
 select plan_id into plan_id_value from care_private.medication_daily_plan_authorizations where id=p_authorization and tenant_id=tenant and request_id=p_request and reviewed_by=actor;
 if plan_id_value is null then select plan_id into plan_id_value from care_private.medication_daily_plan_withdrawals where id=p_authorization and tenant_id=tenant and request_id=p_request and reviewed_by=actor;end if;
 if plan_id_value is null then raise exception 'Eigene ursprüngliche Tagesplanentscheidung fehlt.' using errcode='42501';end if;
 select * into plan from care_private.medication_daily_plans where id=plan_id_value and tenant_id=tenant for share;
 perform care_private.lock_medication_source_scope(tenant,plan.client_id,plan.medication_id,actor);return care_private.medication_daily_plan_json(plan.id);
end$$;
create function public.confirm_ambulatory_medication_daily_plan_authorization(authorization_id uuid,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_medication_daily_plan_authorization(authorization_id,request_id)$$;
revoke all on function care_private.request_medication_daily_plan_withdrawal(jsonb),public.request_ambulatory_medication_daily_plan_withdrawal(jsonb),care_private.confirm_medication_daily_plan_review_request(uuid,uuid),public.confirm_ambulatory_medication_daily_plan_review_request(uuid,uuid),public.read_ambulatory_medication_daily_plan_review_context(uuid),care_private.read_medication_daily_plan_reviews(uuid,timestamptz,uuid,integer),public.read_ambulatory_medication_daily_plan_reviews(uuid,timestamptz,uuid,integer),care_private.confirm_medication_daily_plan_authorization(uuid,uuid),public.confirm_ambulatory_medication_daily_plan_authorization(uuid,uuid) from public,anon,authenticated,service_role;
