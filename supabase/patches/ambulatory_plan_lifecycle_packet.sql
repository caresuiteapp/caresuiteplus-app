-- LOCAL ONLY / NOT APPLIED. Requires ambulatory_assessment_instrument_packet.sql first.
-- Binds goals/measures, daily structure, support boundaries, review dates and care visit to one draft transaction.
begin;
create schema if not exists care_private;
revoke all on schema care_private from public,anon;

create table if not exists care_private.plan_lifecycle_headers(
 tenant_id uuid not null references public.tenants(id),assessment_id uuid primary key references public.care_assessments(id),subject_id uuid not null,
 packet_revision integer not null default 0 check(packet_revision>=0),plan_version integer not null default 1 check(plan_version>=1),
 change_reason text not null default '',updated_at timestamptz not null default clock_timestamp(),updated_by uuid not null references public.profiles(id)
);
create table if not exists care_private.plan_day_routines(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),assessment_id uuid not null references public.care_assessments(id),sequence integer not null,
 label text not null,time_window text not null,ritual text not null,preference text not null,dependency text not null,responsible_role text not null,status text not null check(status in ('planned','active','paused'))
);
create table if not exists care_private.plan_support_boundaries(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),assessment_id uuid not null references public.care_assessments(id),topic_key text not null,
 own_contribution text not null,guidance text not null,partial_support text not null,full_support text not null,stop_boundary text not null,responsible_role text not null
);
create table if not exists care_private.plan_quality_visits(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),assessment_id uuid not null references public.care_assessments(id),planned_at timestamptz not null,
 participants text not null,checkpoints text not null,deviations text not null,decision text not null,implementation_due_at timestamptz,follow_up_at timestamptz,state text not null check(state in ('planned','documented'))
);
create table if not exists care_private.plan_lifecycle_revisions(
 tenant_id uuid not null references public.tenants(id),assessment_id uuid not null references public.care_assessments(id),packet_revision integer not null,plan_version integer not null,
 original_packet jsonb not null,recorded_at timestamptz not null default clock_timestamp(),recorded_by uuid not null references public.profiles(id),primary key(tenant_id,assessment_id,packet_revision)
);
alter table care_private.plan_lifecycle_headers enable row level security;
alter table care_private.plan_day_routines enable row level security;
alter table care_private.plan_support_boundaries enable row level security;
alter table care_private.plan_quality_visits enable row level security;
alter table care_private.plan_lifecycle_revisions enable row level security;
revoke all on care_private.plan_lifecycle_headers,care_private.plan_day_routines,care_private.plan_support_boundaries,care_private.plan_quality_visits,care_private.plan_lifecycle_revisions from public,anon,authenticated;

create or replace function care_private.plan_measure_original(m public.care_assessment_measures) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object(
 'id',m.id,'title',coalesce(m.title,''),'relatedTopicKey',m.related_topic_key,'relatedRiskKey',m.related_risk_key,'personalGoal',coalesce(m.personal_goal,''),
 'intervention',coalesce(m.intervention,''),'timing',coalesce(m.timing,''),'frequency',coalesce(m.frequency,''),'responsibleRole',coalesce(m.responsible_role,''),
 'personContribution',coalesce(m.person_contribution,''),'relativesContribution',coalesce(m.relatives_contribution,''),'warningSigns',coalesce(m.warning_signs,''),
 'escalationPath',coalesce(m.escalation_path,''),'evaluationCriteria',coalesce(m.evaluation_criteria,''),'nextEvaluationAt',m.next_evaluation_at,'status',m.status)$$;
revoke all on function care_private.plan_measure_original(public.care_assessment_measures) from public,anon,authenticated;

create or replace function care_private.read_ambulatory_plan_lifecycle_packet(p_tenant uuid,p_assessment uuid,p_subject uuid,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.care_assessments%rowtype;h care_private.plan_lifecycle_headers%rowtype;begin
 a:=care_private.assert_ambulatory_assessment_instrument_access(p_tenant,p_assessment,p_subject,p_actor,false);
 select * into h from care_private.plan_lifecycle_headers x where x.assessment_id=a.id;
 return jsonb_build_object('tenantId',a.tenant_id,'assessmentId',a.id,'subjectId',a.subject_id,'actorId',p_actor,'packetRevision',coalesce(h.packet_revision,0),'packetUpdatedAt',h.updated_at,'planVersion',coalesce(h.plan_version,greatest(a.version,1)),
  'measureOriginals',coalesce((select jsonb_agg(care_private.plan_measure_original(m) order by m.id) from public.care_assessment_measures m where m.tenant_id=a.tenant_id and m.assessment_id=a.id),'[]'::jsonb),
  'dayRoutines',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'sequence',r.sequence,'label',r.label,'timeWindow',r.time_window,'ritual',r.ritual,'preference',r.preference,'dependency',r.dependency,'responsibleRole',r.responsible_role,'status',r.status) order by r.sequence,r.id) from care_private.plan_day_routines r where r.tenant_id=a.tenant_id and r.assessment_id=a.id),'[]'::jsonb),
  'supportBoundaries',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'topicKey',s.topic_key,'ownContribution',s.own_contribution,'guidance',s.guidance,'partialSupport',s.partial_support,'fullSupport',s.full_support,'stopBoundary',s.stop_boundary,'responsibleRole',s.responsible_role) order by s.topic_key,s.id) from care_private.plan_support_boundaries s where s.tenant_id=a.tenant_id and s.assessment_id=a.id),'[]'::jsonb),
  'qualityVisit',(select jsonb_build_object('id',v.id,'plannedAt',v.planned_at,'participants',v.participants,'checkpoints',v.checkpoints,'deviations',v.deviations,'decision',v.decision,'implementationDueAt',coalesce(v.implementation_due_at::text,''),'followUpAt',coalesce(v.follow_up_at::text,''),'state',v.state) from care_private.plan_quality_visits v where v.tenant_id=a.tenant_id and v.assessment_id=a.id order by v.planned_at desc,v.id desc limit 1));
end $$;
create or replace function public.web_read_ambulatory_plan_lifecycle_packet(p_tenant_id uuid,p_assessment_id uuid,p_subject_id uuid,p_actor_profile_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_ambulatory_plan_lifecycle_packet(p_tenant_id,p_assessment_id,p_subject_id,p_actor_profile_id)$$;
revoke all on function care_private.read_ambulatory_plan_lifecycle_packet(uuid,uuid,uuid,uuid),public.web_read_ambulatory_plan_lifecycle_packet(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.web_read_ambulatory_plan_lifecycle_packet(uuid,uuid,uuid,uuid) to authenticated;

create or replace function care_private.persist_ambulatory_plan_lifecycle(p_payload jsonb,p_actor uuid,p_tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare body jsonb:=(p_payload->>'payloadJson')::jsonb;packet jsonb:=body->'planLifecyclePacket';a public.care_assessments%rowtype;h care_private.plan_lifecycle_headers%rowtype;native_measures jsonb;item jsonb;next_revision integer;next_version integer;visit jsonb;begin
 if jsonb_typeof(packet) is distinct from 'object' or packet->>'schemaVersion'<>'1' then raise exception 'Vollständiges Planlebenszykluspaket fehlt.' using errcode='23514';end if;
 a:=care_private.assert_ambulatory_assessment_instrument_access(p_tenant,(packet->>'assessmentId')::uuid,(packet->>'subjectId')::uuid,p_actor,true);
 if packet->>'tenantId'<>p_tenant::text or packet->>'actorId'<>p_actor::text then raise exception 'Planlebenszyklus gehört nicht zum aktuellen Kontext.' using errcode='42501';end if;
 select * into h from care_private.plan_lifecycle_headers x where x.assessment_id=a.id for update;
 if coalesce(h.packet_revision,0)<>(packet->>'packetRevision')::integer or h.updated_at is distinct from nullif(packet->>'packetUpdatedAt','')::timestamptz or coalesce(h.plan_version,greatest(a.version,1))<>(packet->>'planVersion')::integer then raise exception 'Planlebenszyklus wurde geändert. Vollständig neu laden.' using errcode='40001';end if;
 perform 1 from public.care_assessment_measures m where m.tenant_id=a.tenant_id and m.assessment_id=a.id for share;
 select coalesce(jsonb_agg(care_private.plan_measure_original(m) order by m.id),'[]'::jsonb) into native_measures from public.care_assessment_measures m where m.tenant_id=a.tenant_id and m.assessment_id=a.id;
 if packet->'measureOriginals' is distinct from native_measures then raise exception 'Maßnahmenoriginale wurden geändert. Vollständig neu laden.' using errcode='40001';end if;
 if packet->'plannedMeasures' is distinct from body->'measures' then raise exception 'Planlebenszyklus und Assessment enthalten verschiedene Maßnahmen.' using errcode='23514';end if;
 if jsonb_array_length(packet->'dayRoutines')>200 or jsonb_array_length(packet->'supportBoundaries')>200 or length(coalesce(packet->>'changeReason',''))>4000 then raise exception 'Planlebenszyklus ist zu umfangreich.' using errcode='23514';end if;
 delete from care_private.plan_day_routines where tenant_id=p_tenant and assessment_id=a.id;
 for item in select value from jsonb_array_elements(packet->'dayRoutines') loop
  insert into care_private.plan_day_routines(id,tenant_id,assessment_id,sequence,label,time_window,ritual,preference,dependency,responsible_role,status) values((item->>'id')::uuid,p_tenant,a.id,(item->>'sequence')::integer,coalesce(item->>'label',''),coalesce(item->>'timeWindow',''),coalesce(item->>'ritual',''),coalesce(item->>'preference',''),coalesce(item->>'dependency',''),coalesce(item->>'responsibleRole',''),item->>'status');
 end loop;
 delete from care_private.plan_support_boundaries where tenant_id=p_tenant and assessment_id=a.id;
 for item in select value from jsonb_array_elements(packet->'supportBoundaries') loop
  insert into care_private.plan_support_boundaries(id,tenant_id,assessment_id,topic_key,own_contribution,guidance,partial_support,full_support,stop_boundary,responsible_role) values((item->>'id')::uuid,p_tenant,a.id,item->>'topicKey',coalesce(item->>'ownContribution',''),coalesce(item->>'guidance',''),coalesce(item->>'partialSupport',''),coalesce(item->>'fullSupport',''),coalesce(item->>'stopBoundary',''),coalesce(item->>'responsibleRole',''));
 end loop;
 visit:=packet->'qualityVisit';
 if visit is null or jsonb_typeof(visit)<>'object' then delete from care_private.plan_quality_visits where tenant_id=p_tenant and assessment_id=a.id and state='planned';end if;
 if visit is not null and jsonb_typeof(visit)='object' then
  insert into care_private.plan_quality_visits(id,tenant_id,assessment_id,planned_at,participants,checkpoints,deviations,decision,implementation_due_at,follow_up_at,state) values((visit->>'id')::uuid,p_tenant,a.id,(visit->>'plannedAt')::timestamptz,coalesce(visit->>'participants',''),coalesce(visit->>'checkpoints',''),coalesce(visit->>'deviations',''),coalesce(visit->>'decision',''),nullif(visit->>'implementationDueAt','')::timestamptz,nullif(visit->>'followUpAt','')::timestamptz,visit->>'state') on conflict(id) do update set planned_at=excluded.planned_at,participants=excluded.participants,checkpoints=excluded.checkpoints,deviations=excluded.deviations,decision=excluded.decision,implementation_due_at=excluded.implementation_due_at,follow_up_at=excluded.follow_up_at,state=excluded.state;
 end if;
 next_revision:=coalesce(h.packet_revision,0)+1;next_version:=coalesce(h.plan_version,greatest(a.version,1))+case when p_payload->>'intent'='review' then 1 else 0 end;
 insert into care_private.plan_lifecycle_headers(tenant_id,assessment_id,subject_id,packet_revision,plan_version,change_reason,updated_at,updated_by) values(p_tenant,a.id,a.subject_id,next_revision,next_version,btrim(coalesce(packet->>'changeReason','')),clock_timestamp(),p_actor) on conflict(assessment_id) do update set packet_revision=excluded.packet_revision,plan_version=excluded.plan_version,change_reason=excluded.change_reason,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 insert into care_private.plan_lifecycle_revisions(tenant_id,assessment_id,packet_revision,plan_version,original_packet,recorded_by) values(p_tenant,a.id,next_revision,next_version,packet,p_actor);
 return jsonb_build_object('planPacketRevision',next_revision,'planVersion',next_version);
end $$;
revoke all on function care_private.persist_ambulatory_plan_lifecycle(jsonb,uuid,uuid) from public,anon,authenticated;

create or replace function care_private.write_ambulatory_assessment_with_plan(request_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.resolve_current_profile_id();tenant uuid:=public.current_tenant_id();prior care_private.assessment_draft_requests%rowtype;receipt jsonb;plan_receipt jsonb;begin
 select * into prior from care_private.assessment_draft_requests r where r.tenant_id=tenant and r.request_id=write_ambulatory_assessment_with_plan.request_id for share;
 if prior.request_id is not null then
  if prior.actor_id<>actor or prior.payload<>payload then raise exception 'Anfrage-ID bereits mit anderen Daten verwendet.' using errcode='23514';end if;
  if prior.result ? 'instrumentSelectionRevision' and prior.result ? 'planPacketRevision' and prior.result ? 'planVersion' then return prior.result;end if;
  raise exception 'Alte unvollständige Plananfrage bleibt gesperrt.' using errcode='23514';
 end if;
 plan_receipt:=care_private.persist_ambulatory_plan_lifecycle(payload,actor,tenant);
 receipt:=care_private.write_ambulatory_assessment_with_instruments(request_id,payload)||plan_receipt;
 update care_private.assessment_draft_requests set result=receipt where tenant_id=tenant and request_id=write_ambulatory_assessment_with_plan.request_id and actor_id=actor and assessment_draft_requests.payload=write_ambulatory_assessment_with_plan.payload;
 if not found then raise exception 'Planquittung konnte nicht vollständig gebunden werden.' using errcode='23514';end if;
 return receipt;
end $$;
create or replace function public.write_ambulatory_assessment_draft(request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.write_ambulatory_assessment_with_plan(request_id,payload)$$;
revoke all on function care_private.write_ambulatory_assessment_with_plan(uuid,jsonb),public.write_ambulatory_assessment_draft(uuid,jsonb) from public,anon;
grant execute on function public.write_ambulatory_assessment_draft(uuid,jsonb) to authenticated;
commit;
