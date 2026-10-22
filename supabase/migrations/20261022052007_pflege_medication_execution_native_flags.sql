-- Quarantined follow-up: missing native safety flags remain unknown; no schema/default backfill.
create or replace function care_private.assess_medication_execution(p_packet jsonb)
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
revoke all on function care_private.assess_medication_execution(jsonb) from public,anon,authenticated,service_role;

