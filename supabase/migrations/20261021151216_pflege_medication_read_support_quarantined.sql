create or replace function care_private.medication_json_fingerprint(value jsonb)
returns text language sql immutable strict set search_path='' as $$select 'sha256:'||encode(extensions.digest(convert_to(value::text,'UTF8'),'sha256'),'hex')$$;

create or replace function care_private.medication_packet_actor(permission_name text,p_tenant uuid,p_client uuid,p_medication uuid,p_actor uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare claims jsonb;session_id uuid;actor uuid;
begin
 perform care_private.require_workspace_session(p_tenant,p_actor);
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 if claims->>'session_id' is null or claims->>'session_id' !~* '^[0-9a-f-]{36}$' then raise exception 'Sitzungsbindung fehlt.' using errcode='42501';end if;
 session_id:=(claims->>'session_id')::uuid;actor:=public.resolve_current_profile_id();
 if auth.uid() is null or p_tenant is distinct from public.current_tenant_id() or actor is distinct from p_actor
 or not exists(select 1 from auth.sessions s where s.id=session_id and s.user_id=auth.uid() and coalesce(s.not_after,clock_timestamp()+interval '1 second')>clock_timestamp())
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=p_tenant and p.is_active)
 or public.has_permission('pflege.medications.view') is not true or public.has_permission(permission_name) is not true
 or public.is_active_pfleger_client(p_client) is not true
 or not exists(select 1 from public.medications m where m.id=p_medication and m.tenant_id=p_tenant and m.client_id=p_client)
 then raise exception 'Aktueller Medikationsbezug oder Berechtigung fehlt.' using errcode='42501';end if;
 return actor;
end $$;

create or replace function care_private.medication_source_snapshot(p_tenant uuid,p_client uuid,p_medication uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.medications%rowtype;c public.clients%rowtype;result jsonb;allergy_state text;allergy_text text;order_json jsonb;
begin
 select * into m from public.medications where id=p_medication and tenant_id=p_tenant and client_id=p_client;
 select * into c from public.clients where id=p_client and tenant_id=p_tenant;
 if m.id is null or c.id is null then raise exception 'Verordnungsoriginal fehlt.' using errcode='P0H01';end if;
 order_json:=to_jsonb(m)-'created_by'-'updated_by';allergy_text:=coalesce(nullif(btrim(to_jsonb(c)->>'allergies'),''),'');allergy_state:=case when allergy_text<>'' then 'documented' else 'unknown' end;
 select jsonb_build_object(
  'order',jsonb_build_object('id',m.id,'revision',1,'recordedAt',to_char(m.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(order_json),'medicationId',m.id,'clientId',m.client_id,'status',m.status::text,'updatedAt',to_char(m.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'payload',order_json),
  'allergies',jsonb_build_object('id',c.id,'revision',1,'recordedAt',to_char(coalesce(c.updated_at,m.updated_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(jsonb_build_object('state',allergy_state,'text',allergy_text)),'state',allergy_state,'text',allergy_text),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'revision',1,'recordedAt',to_char(s.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(jsonb_build_object('snapshot',s.document_snapshot,'order',s.order_snapshot)),'title',coalesce(s.document_snapshot->>'title','Quelle'),'version',coalesce(s.document_snapshot->>'updated_at',s.document_snapshot->>'version',to_char(s.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))) order by s.created_at,s.id) from public.medication_order_sources s where s.tenant_id=p_tenant and s.medication_id=p_medication),'[]'::jsonb),
  'administrations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'revision',1,'recordedAt',to_char(a.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(to_jsonb(a)),'status',a.status::text,'occurredAt',case when a.occurred_at is null then null else to_char(a.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'dose',a.administered_dose,'unit',nullif(a.creation_payload->>'unit',''),'route',a.route) order by a.created_at,a.id) from public.medication_administrations a where a.tenant_id=p_tenant and a.medication_id=p_medication),'[]'::jsonb),
  'statusEvents',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'revision',1,'recordedAt',to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(to_jsonb(e)),'previousStatus',e.previous_status,'nextStatus',e.next_status) order by e.created_at,e.id) from public.medication_order_status_events e where e.tenant_id=p_tenant and e.medication_id=p_medication),'[]'::jsonb),
  'witnesses',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'revision',1,'recordedAt',to_char(coalesce(p.updated_at,p.created_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',care_private.medication_json_fingerprint(to_jsonb(p)-'email'-'phone'),'profileId',p.id,'active',p.is_active,'qualificationState',coalesce(nullif(to_jsonb(p)->>'qualification_state',''),'not_verified')) order by p.id) from public.profiles p where p.tenant_id=p_tenant),'[]'::jsonb),
  'stockMovements',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'fingerprint',e.content_fingerprint,'packageId',e.payload->'stock'->>'packageId','operation',e.payload->'stock'->>'operation','quantity',e.payload->'stock'->>'quantity','unit',e.payload->'stock'->>'unit','balanceAfter',e.payload->'stock'->>'balanceAfter') order by e.recorded_at,e.id) from public.medication_safety_events e where e.tenant_id=p_tenant and e.medication_id=p_medication and e.kind in('preparation_stock','controlled_ledger') and not e.voided),'[]'::jsonb)
 ) into result;return result;
end $$;

create or replace function care_private.medication_original(p_event uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare head public.medication_safety_events%rowtype;history jsonb;
begin
 select * into head from public.medication_safety_events where id=p_event;
 if head.id is null then return null;end if;
 select jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'previousId',e.previous_id,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',e.recorded_by,'recordedByName',e.recorded_by_name,'reason',e.reason,'payload',e.payload,'contentFingerprint',e.content_fingerprint) order by e.revision) into history from public.medication_safety_events e where e.tenant_id=head.tenant_id and e.root_id=head.root_id;
 return jsonb_build_object('id',head.id,'tenantId',head.tenant_id,'clientId',head.client_id,'medicationId',head.medication_id,'rootId',head.root_id,'headId',head.id,'revision',head.revision,'kind',head.kind,'recordedAt',to_char(head.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'recordedBy',head.recorded_by,'recordedByName',head.recorded_by_name,'payload',head.payload,'contentFingerprint',head.content_fingerprint,'history',coalesce(history,'[]'::jsonb),'voided',head.voided);
end $$;

create or replace function care_private.read_medication_safety_context(p_tenant uuid,p_client uuid,p_medication uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;sources jsonb;m public.medications%rowtype;dose text;unit text;prior_order jsonb;
begin actor:=care_private.medication_packet_actor('pflege.medications.view',p_tenant,p_client,p_medication,p_actor);sources:=care_private.medication_source_snapshot(p_tenant,p_client,p_medication);select * into m from public.medications where id=p_medication and tenant_id=p_tenant for share;select e.payload->'order' into prior_order from public.medication_safety_events e where e.tenant_id=p_tenant and e.client_id=p_client and e.medication_id=p_medication and e.kind in('reconciliation','order_capture') and e.payload->'sourceReview'->>'decision'='confirmed' and e.source_snapshot->'order'->>'fingerprint'=sources->'order'->>'fingerprint' and not e.voided order by e.recorded_at desc,e.id desc limit 1;dose:=coalesce(nullif(m.dosage,''),'');unit:=coalesce(nullif(to_jsonb(m)->>'dose_unit',''),'');return jsonb_build_object('sources',sources,'orderDefaults',coalesce(prior_order,jsonb_build_object('medicationName',coalesce(m.name,''),'activeIngredient',coalesce(m.active_ingredient,''),'strength',coalesce(m.strength,''),'form',coalesce(m.form,''),'dose',dose,'unit',unit,'route',coalesce(m.route,''),'prescriber',coalesce(m.prescribed_by,''),'validFrom',coalesce(m.start_date::text,''),'validUntil',case when m.end_date is null then null else m.end_date::text end,'indication',coalesce(m.indication,''),'isPrn',m.is_prn,'minimumIntervalMinutes',null,'maximumDose',null,'maximumDoseUnit','','maximumPeriodHours',null)));end $$;

create or replace function care_private.read_medication_safety_page(p_tenant uuid,p_client uuid,p_medication uuid,p_actor uuid,p_cursor timestamptz,p_cursor_id uuid,p_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;rows jsonb;last_row jsonb;
begin actor:=care_private.medication_packet_actor('pflege.medications.view',p_tenant,p_client,p_medication,p_actor);if p_size is null or p_size<1 or p_size>100 or (p_cursor is null)<>(p_cursor_id is null) then raise exception 'Ungültige Seitengröße.' using errcode='23514';end if;
 with heads as(select distinct on(e.root_id)e.* from public.medication_safety_events e where e.tenant_id=p_tenant and e.client_id=p_client and e.medication_id=p_medication order by e.root_id,e.revision desc),page as(select * from heads h where p_cursor is null or (h.recorded_at,h.id)<(p_cursor,p_cursor_id) order by h.recorded_at desc,h.id desc limit p_size)
 select coalesce(jsonb_agg(care_private.medication_original(x.id) order by x.recorded_at desc,x.id desc),'[]'::jsonb) into rows from page x;
 last_row:=rows->(jsonb_array_length(rows)-1);
 return jsonb_build_object('rows',rows,'nextCursorRecordedAt',last_row->>'recordedAt','nextCursorId',last_row->>'headId');
end $$;

create or replace function public.web_read_medication_safety_context(p_tenant_id uuid,p_client_id uuid,p_medication_id uuid,p_actor_profile_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_safety_context(p_tenant_id,p_client_id,p_medication_id,p_actor_profile_id)$$;

create or replace function public.web_read_medication_safety_page(p_tenant_id uuid,p_client_id uuid,p_medication_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_safety_page(p_tenant_id,p_client_id,p_medication_id,p_actor_profile_id,p_cursor_recorded_at,p_cursor_id,p_page_size)$$;

REVOKE ALL ON FUNCTION care_private.medication_json_fingerprint(jsonb),care_private.medication_packet_actor(text,uuid,uuid,uuid,uuid),care_private.medication_source_snapshot(uuid,uuid,uuid),care_private.medication_original(uuid),care_private.read_medication_safety_context(uuid,uuid,uuid,uuid),care_private.read_medication_safety_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_read_medication_safety_context(uuid,uuid,uuid,uuid),public.web_read_medication_safety_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer) FROM PUBLIC,anon,authenticated;
