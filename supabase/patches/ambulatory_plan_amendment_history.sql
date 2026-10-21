-- LOCAL REVIEW ONLY. NOT EXECUTED. Apply after CP40 ambulatory_plan_amendments.sql.
-- Read immutable accepted requests; do not join against the current evaluation head or measure.
begin;
create or replace function care_private.read_ambulatory_plan_amendments(requested_tenant uuid,requested_assessment uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare result jsonb;
begin
 if auth.uid() is null or care_private.plan_eval_access(requested_tenant,requested_assessment) is not true then
  raise exception 'Eigene aktive Pflegeakte nicht zugänglich.' using errcode='42501';
 end if;
 if exists(select 1 from care_private.plan_amendment_requests r join public.care_assessments a on a.id=r.assessment_id and a.tenant_id=r.tenant_id where r.tenant_id=requested_tenant and r.assessment_id=requested_assessment and r.client_id<>a.subject_id) then
  raise exception 'Historischer Pflegefallbezug widersprüchlich.' using errcode='23514';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id::text,'requestId',r.request_id::text,'actorId',r.actor_id::text,'actorName',r.actor_name,
  'recordedAt',to_char(r.recorded_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'payload',r.payload,'result',r.result
 ) order by r.recorded_at desc,r.id), '[]'::jsonb) into result
 from care_private.plan_amendment_requests r
 where r.tenant_id=requested_tenant and r.assessment_id=requested_assessment;
 -- Fail as a whole; never return an apparently complete truncated history.
 if jsonb_array_length(result)>2000 or octet_length(result::text)>33554432 then
  raise exception 'Änderungshistorie überschreitet den vollständigen Lesebereich.' using errcode='54000';
 end if;
 return jsonb_build_object('version','2026-10-11.1','tenantId',requested_tenant::text,'assessmentId',requested_assessment::text,'count',jsonb_array_length(result),'records',result);
end $$;
create or replace function public.read_ambulatory_plan_amendments(requested_tenant uuid,requested_assessment uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_ambulatory_plan_amendments(requested_tenant,requested_assessment)$$;
revoke all on function care_private.read_ambulatory_plan_amendments(uuid,uuid),public.read_ambulatory_plan_amendments(uuid,uuid) from public,anon,authenticated;
grant execute on function care_private.read_ambulatory_plan_amendments(uuid,uuid),public.read_ambulatory_plan_amendments(uuid,uuid) to authenticated;
commit;
