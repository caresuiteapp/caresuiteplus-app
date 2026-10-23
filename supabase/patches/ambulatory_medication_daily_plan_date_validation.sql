-- Quarantined follow-up: the strict original date parser returns DATE, never BOOLEAN.
create or replace function care_private.validate_medication_daily_plan(p_packet jsonb,p_native jsonb)
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

create or replace function care_private.request_medication_daily_plan_withdrawal(p_packet jsonb)
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
revoke all on function care_private.validate_medication_daily_plan(jsonb,jsonb),care_private.request_medication_daily_plan_withdrawal(jsonb) from public,anon,authenticated,service_role;
