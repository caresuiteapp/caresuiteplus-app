-- LOCAL PREPARATION ONLY. Requires draft_requests and review_guard patches.
begin;
alter table care_private.assessment_review_authorizations add column if not exists action text not null default 'review' check(action in ('review','return'));
create table if not exists care_private.assessment_lifecycle_requests(
 tenant_id uuid not null references public.tenants(id),request_id uuid not null,
 actor_id uuid not null references public.profiles(id),assessment_id uuid not null references public.care_assessments(id),
 payload jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.assessment_lifecycle_requests enable row level security;
revoke all on care_private.assessment_lifecycle_requests from public,anon,authenticated;
create or replace function care_private.apply_ambulatory_assessment_lifecycle(request_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.resolve_current_profile_id();tenant uuid:=public.current_tenant_id();actor_name text;subject uuid;v public.care_assessments%rowtype;client public.clients%rowtype;previous care_private.assessment_lifecycle_requests%rowtype;action text:=payload->>'action';reason text:=payload->>'reason';detail text:=coalesce(payload->>'reasonDetail','');return_reason text:=coalesce(payload->>'returnReason','');snapshot jsonb;result jsonb;topic_key text;
begin
 if auth.uid() is null or tenant is null or public.has_permission('pflege.assessments.manage') is not true or public.has_permission('pflege.plans.view') is not true then raise exception 'Keine Berechtigung.' using errcode='42501';end if;
 select coalesce(nullif(p.display_name,''),p.email,'Pflegefachperson') into actor_name from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active;
 if actor_name is null then raise exception 'Kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>24000 or coalesce(action,'') not in ('create','return') or length(detail)>2000 or length(return_reason)>2000 then raise exception 'Ungültiger Auftrag.' using errcode='23514';end if;
 subject:=(payload->>'subjectId')::uuid;
 select * into client from public.clients c where c.id=subject and c.tenant_id=tenant for update;
 if client.id is null or public.is_active_pfleger_client(subject) is not true then raise exception 'Kein zugänglicher aktiver Pflegefall.' using errcode='42501';end if;
 select * into previous from care_private.assessment_lifecycle_requests r where r.tenant_id=tenant and r.request_id=apply_ambulatory_assessment_lifecycle.request_id;
 if previous.request_id is not null then
  if previous.actor_id<>actor or previous.payload<>payload then raise exception 'Anfrage-ID bereits mit anderen Daten verwendet.' using errcode='23514';end if;
  return previous.result;
 end if;
 if action='create' then
  if coalesce(payload->>'assessmentId','x')<>'' or coalesce(payload->>'expectedRevision','x')<>'' or coalesce(payload->>'expectedVersion','x')<>'' or return_reason<>'' or coalesce(reason,'') not in ('initial','scheduled_review','event_triggered','hospital_return','care_level_change','other') or (reason<>'initial' and nullif(btrim(detail),'') is null) then raise exception 'Erstellungsanlass oder leere Ausgangsfassung fehlt.' using errcode='23514';end if;
  insert into public.care_assessments(tenant_id,subject_type,subject_id,subject_name_snapshot,variant,reason,reason_detail,status,version,assessor_profile_id,assessor_name_snapshot,created_by,updated_by)
  values(tenant,'client',subject,btrim(concat_ws(' ',client.first_name,client.last_name)),'ambulant',reason,detail,'draft',1,actor,actor_name,auth.uid(),auth.uid()) returning * into v;
  foreach topic_key in array array['cognition_communication','mobility','disease_demands','self_care','social_relationships','living_environment'] loop
   insert into public.care_assessment_topics(tenant_id,assessment_id,topic_key) values(tenant,v.id,topic_key);
  end loop;
 else
  if nullif(btrim(return_reason),'') is null or coalesce(reason,'x')<>'' or detail<>'' then raise exception 'Rückgabe muss ausdrücklich begründet sein.' using errcode='23514';end if;
  select * into v from public.care_assessments a where a.id=(payload->>'assessmentId')::uuid and a.tenant_id=tenant and a.subject_type='client' and a.subject_id=subject for update;
  if v.id is null or v.status<>'professional_review' then raise exception 'Nur übergebene ambulante Assessments können zurückgegeben werden.' using errcode='23514';end if;
  if (payload->>'expectedRevision')::integer is distinct from v.draft_revision or (payload->>'expectedVersion')::integer is distinct from v.version then raise exception 'Assessmentstand geändert. Neu laden.' using errcode='40001';end if;
  snapshot:=jsonb_build_object('assessment',to_jsonb(v),'returnReason',return_reason,'topics',coalesce((select jsonb_agg(to_jsonb(t)) from public.care_assessment_topics t where t.assessment_id=v.id and t.tenant_id=tenant),'[]'::jsonb),'risks',coalesce((select jsonb_agg(to_jsonb(r)) from public.care_assessment_risks r where r.assessment_id=v.id and r.tenant_id=tenant),'[]'::jsonb),'measures',coalesce((select jsonb_agg(to_jsonb(m)) from public.care_assessment_measures m where m.assessment_id=v.id and m.tenant_id=tenant),'[]'::jsonb));
  insert into public.care_assessment_versions(tenant_id,assessment_id,version,transition_from,transition_to,snapshot,created_by,actor_name)
  values(tenant,v.id,v.version,'professional_review','in_progress',snapshot,auth.uid(),actor_name);
  insert into care_private.assessment_review_authorizations(assessment_id,transaction_key,actor_id,action) values(v.id,pg_catalog.pg_current_xact_id()::text,actor,'return');
  update public.care_assessments set status='in_progress',version=version+1,completed_at=null,change_summary=return_reason,updated_by=auth.uid(),updated_at=clock_timestamp() where id=v.id;
  delete from care_private.assessment_review_authorizations a where a.assessment_id=v.id and a.transaction_key=pg_catalog.pg_current_xact_id()::text;
 end if;
 select * into v from public.care_assessments a where a.id=v.id;
 result:=jsonb_build_object('assessmentId',v.id,'subjectId',subject,'action',action,'draftRevision',v.draft_revision,'version',v.version,'status',v.status);
 insert into care_private.assessment_lifecycle_requests(tenant_id,request_id,actor_id,assessment_id,payload,result) values(tenant,request_id,actor,v.id,payload,result);
 return result;
end $$;
create or replace function public.apply_ambulatory_assessment_lifecycle(request_id uuid,payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.apply_ambulatory_assessment_lifecycle(request_id,payload)$$;
revoke all on function care_private.apply_ambulatory_assessment_lifecycle(uuid,jsonb),public.apply_ambulatory_assessment_lifecycle(uuid,jsonb) from public,anon;
grant execute on function care_private.apply_ambulatory_assessment_lifecycle(uuid,jsonb),public.apply_ambulatory_assessment_lifecycle(uuid,jsonb) to authenticated;
commit;
