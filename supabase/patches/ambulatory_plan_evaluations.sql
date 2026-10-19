-- LOCAL REVIEW ONLY; NOT APPLIED. Requires ambulatory assessment draft/lifecycle guards.
begin;
create table if not exists public.care_plan_evaluation_roots(id uuid primary key,tenant_id uuid not null references public.tenants(id),assessment_id uuid not null references public.care_assessments(id),snapshot jsonb not null,created_at timestamptz not null,unique(id,tenant_id,assessment_id));
create table if not exists public.care_plan_evaluation_events(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,assessment_id uuid not null,root_id uuid not null,sequence integer not null check(sequence>0),previous_id uuid,request_id uuid not null,actor_id uuid not null references public.profiles(id),actor_name text not null check(btrim(actor_name)<>''),recorded_at timestamptz not null,draft jsonb not null,request_payload jsonb not null,unique(root_id,sequence),unique(tenant_id,request_id),unique(id,root_id),foreign key(root_id,tenant_id,assessment_id) references public.care_plan_evaluation_roots(id,tenant_id,assessment_id),foreign key(previous_id,root_id) references public.care_plan_evaluation_events(id,root_id),check((sequence=1)=(previous_id is null)));
create index if not exists care_plan_eval_scope on public.care_plan_evaluation_roots(tenant_id,assessment_id,created_at,id);
alter table public.care_plan_evaluation_roots enable row level security;
alter table public.care_plan_evaluation_events enable row level security;
revoke all on public.care_plan_evaluation_roots,public.care_plan_evaluation_events from public,anon,authenticated;
create or replace function care_private.plan_eval_access(tenant uuid,assessment uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(auth.uid() is not null and tenant=public.current_tenant_id() and public.has_permission('pflege.plans.view') and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=tenant and p.is_active and p.role_key not in ('client_portal','family_portal')) and exists(select 1 from public.care_assessments a join public.clients c on c.id=a.subject_id and c.tenant_id=a.tenant_id where a.id=assessment and a.tenant_id=tenant and a.subject_type='client' and c.status='active' and c.deleted_at is null and public.is_active_pfleger_client(c.id)),false)$$;
drop policy if exists plan_eval_roots_read on public.care_plan_evaluation_roots;
create policy plan_eval_roots_read on public.care_plan_evaluation_roots for select to authenticated using(care_private.plan_eval_access(tenant_id,assessment_id));
drop policy if exists plan_eval_events_read on public.care_plan_evaluation_events;
create policy plan_eval_events_read on public.care_plan_evaluation_events for select to authenticated using(care_private.plan_eval_access(tenant_id,assessment_id));
create or replace function care_private.plan_eval_fields(v jsonb,fields text[]) returns void language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(v) is distinct from 'object' or v-fields<>'{}'::jsonb or (select count(*) from jsonb_each(v))<>cardinality(fields) then raise exception 'Evaluationsfelder fehlen oder sind fremd.' using errcode='23514';end if;
end $$;
create or replace function care_private.plan_eval_text(v jsonb,k text,required boolean default true) returns void language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>4000 or (required and nullif(btrim(v->>k),'') is null) then raise exception 'Evaluationsangabe fehlt oder ist ungültig: %',k using errcode='23514';end if;
end $$;
create or replace function care_private.plan_eval_time(v text) returns timestamptz language plpgsql immutable set search_path='' as $$begin
 if v is null or v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' or left(v,4)='0000' then raise exception 'Evaluationszeit mit Zeitzone fehlt.' using errcode='23514';end if;return v::timestamptz;
end $$;
create or replace function care_private.plan_eval_uuid(v jsonb) returns boolean language sql immutable set search_path='' as $$select coalesce(jsonb_typeof(v)='string' and (v#>>'{}')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false)$$;
create or replace function care_private.plan_eval_snapshot(p jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare m jsonb;f text;ids uuid[]:='{}';ref uuid;begin
 perform care_private.plan_eval_text(p,'status');
 perform care_private.plan_eval_fields(p,array['assessmentId','tenantId','clientId','version','draftRevision','updatedAt','status','measures']);
 foreach f in array array['assessmentId','tenantId','clientId'] loop if not care_private.plan_eval_uuid(p->f) then raise exception 'Eigener Planbezug fehlt.' using errcode='23514';end if;end loop;
 if jsonb_typeof(p->'version') is distinct from 'number' or (p->>'version') !~ '^[1-9][0-9]{0,9}$' or (p->>'version')::numeric>2147483647 or jsonb_typeof(p->'draftRevision') is distinct from 'number' or (p->>'draftRevision') !~ '^(0|[1-9][0-9]{0,9})$' or (p->>'draftRevision')::numeric>2147483647 or p->>'status' not in ('draft','in_progress','approved') or care_private.plan_eval_time(p->>'updatedAt')>server_now or jsonb_typeof(p->'measures') is distinct from 'array' then raise exception 'Historischer Planstand ungültig.' using errcode='23514';end if;
 if jsonb_array_length(p->'measures') not between 1 and 200 then raise exception 'Tatsächliche Maßnahmen auswählen.' using errcode='23514';end if;
 for m in select value from jsonb_array_elements(p->'measures') loop
  perform care_private.plan_eval_fields(m,array['id','title','relatedTopicKey','relatedRiskKey','personalGoal','intervention','timing','frequency','responsibleRole','personContribution','relativesContribution','warningSigns','escalationPath','evaluationCriteria','nextEvaluationAt','status']);
  if not care_private.plan_eval_uuid(m->'id') then raise exception 'Native Maßnahme fehlt.' using errcode='23514';end if;ref:=(m->>'id')::uuid;if ref=any(ids) then raise exception 'Maßnahme doppelt.' using errcode='23514';end if;ids:=array_append(ids,ref);
  foreach f in array array['title','personalGoal','intervention','timing','frequency','responsibleRole','evaluationCriteria'] loop perform care_private.plan_eval_text(m,f);end loop;
  foreach f in array array['personContribution','relativesContribution','warningSigns','escalationPath'] loop perform care_private.plan_eval_text(m,f,false);end loop;
  foreach f in array array['relatedTopicKey','relatedRiskKey','nextEvaluationAt'] loop if m->f<>'null'::jsonb then perform care_private.plan_eval_text(m,f,false);end if;end loop;
  if m->'nextEvaluationAt'<>'null'::jsonb then perform care_private.plan_eval_time(m->>'nextEvaluationAt');end if;
  perform care_private.plan_eval_text(m,'status');
  if m->>'status' not in ('planned','active','paused','completed','cancelled') then raise exception 'Tatsächlicher Maßnahmenstatus fehlt.' using errcode='23514';end if;
 end loop;
end $$;
create or replace function care_private.plan_eval_draft(d jsonb,p jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare e jsonb:=d->'entry';f text;at_time timestamptz;start_at timestamptz;end_at timestamptz;begin
 perform care_private.plan_eval_fields(d,array['action','entry','reason']);perform care_private.plan_eval_text(d,'action');perform care_private.plan_eval_text(d,'reason',d->>'action'<>'record');
 if d->>'action' not in ('record','replace','void') or (d->>'action'='record' and d->>'reason'<>'') then raise exception 'Evaluationshandlung ungültig.' using errcode='23514';end if;
 if d->>'action'='void' then if e<>'null'::jsonb then raise exception 'Rücknahme darf keine neue Wirkung tragen.' using errcode='23514';end if;return;end if;
 perform care_private.plan_eval_fields(e,array['evaluatedAt','periodStartAt','periodEndAt','source','reportedBy','outcome','observedEffect','feedbackState','personFeedback','professionalConclusion','nextAction','nextActionReason','reviewState','reviewAt','reviewReason']);
 foreach f in array array['evaluatedAt','periodStartAt','periodEndAt','source','outcome','observedEffect','feedbackState','personFeedback','professionalConclusion','nextAction','nextActionReason','reviewState','reviewReason'] loop perform care_private.plan_eval_text(e,f);end loop;
 foreach f in array array['reportedBy','reviewAt'] loop perform care_private.plan_eval_text(e,f,false);end loop;
 at_time:=care_private.plan_eval_time(e->>'evaluatedAt');start_at:=care_private.plan_eval_time(e->>'periodStartAt');end_at:=care_private.plan_eval_time(e->>'periodEndAt');
 if start_at<care_private.plan_eval_time(p->>'updatedAt') or start_at>end_at or end_at>at_time or at_time>server_now then raise exception 'Beobachtungszeitraum passt nicht zum Planstand oder tatsächlichen Zeitpunkt.' using errcode='23514';end if;
 if e->>'source' not in ('observed','reported') or (e->>'source'='observed' and e->>'reportedBy'<>'') then raise exception 'Eigene Wirkung und Fremdangaben trennen.' using errcode='23514';end if;if e->>'source'='reported' then perform care_private.plan_eval_text(e,'reportedBy');end if;
 if e->>'outcome' not in ('effective','partly_effective','not_effective','deteriorated','not_assessable') or e->>'feedbackState' not in ('given','declined','not_possible') or e->>'nextAction' not in ('continue','adjust','reassess','clarify') or e->>'reviewState' not in ('scheduled','pending','not_required') then raise exception 'Wirkung, Personenentscheidung und nächste Prüfung wählen.' using errcode='23514';end if;
 if e->>'reviewState'='scheduled' then if care_private.plan_eval_time(e->>'reviewAt')<at_time then raise exception 'Prüfung liegt vor Evaluation.' using errcode='23514';end if;elsif e->>'reviewAt'<>'' then raise exception 'Unvereinbarte Prüffrist entfernen.' using errcode='23514';end if;
end $$;
create or replace function care_private.write_ambulatory_plan_evaluation(request_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();a public.care_assessments%rowtype;r public.care_plan_evaluation_roots%rowtype;prior public.care_plan_evaluation_events%rowtype;old record;ref uuid;root_ref uuid;expected uuid;seq integer:=0;head uuid;last_at timestamptz;entry jsonb;p jsonb:=payload->'snapshot';d jsonb:=payload->'draft';m jsonb;native jsonb;server_now timestamptz;name text;result uuid:=gen_random_uuid();begin
 perform care_private.plan_eval_fields(payload,array['version','assessmentId','rootId','expectedHeadId','expectedSequence','snapshot','draft']);
 if payload->>'version' is distinct from '2026-10-09.1' or request_id is null or not care_private.plan_eval_uuid(payload->'assessmentId') or not care_private.plan_eval_uuid(payload->'rootId') or jsonb_typeof(payload->'expectedHeadId') is distinct from 'string' or (payload->>'expectedHeadId'<>'' and not care_private.plan_eval_uuid(payload->'expectedHeadId')) or jsonb_typeof(payload->'expectedSequence') is distinct from 'number' or (payload->>'expectedSequence') !~ '^(0|[1-9][0-9]{0,9})$' or (payload->>'expectedSequence')::numeric>2147483646 or octet_length(payload::text)>262144 then raise exception 'Evaluationsauftrag ungültig.' using errcode='23514';end if;
 ref:=(payload->>'assessmentId')::uuid;root_ref:=(payload->>'rootId')::uuid;expected:=nullif(payload->>'expectedHeadId','')::uuid;
 if care_private.plan_eval_access(tenant,ref) is not true then raise exception 'Eigene aktive Pflegeakte nicht zugänglich.' using errcode='42501';end if;
 select * into a from public.care_assessments x where x.id=ref and x.tenant_id=tenant and x.subject_type='client' for update;
 if a.id is null then raise exception 'Eigener Assessmentstand fehlt.' using errcode='42501';end if;
 perform 1 from public.clients c where c.id=a.subject_id and c.tenant_id=tenant and c.status='active' and c.deleted_at is null for share;
 if not found or care_private.plan_eval_access(tenant,ref) is not true then raise exception 'Aktiver Pflegefall geändert.' using errcode='42501';end if;
 perform 1 from public.client_module_assignments x where x.client_id=a.subject_id and x.tenant_id=tenant and x.module_key='pflege' and x.is_active and x.status not in ('inactive','deactivated','archiviert') for share;
 if not found then raise exception 'Pflegezuordnung geändert.' using errcode='42501';end if;
 select nullif(btrim(x.display_name),'') into name from public.profiles x where x.id=actor and x.tenant_id=tenant and x.is_active and x.role_key not in ('client_portal','family_portal') for share;
 if name is null or length(name)>4000 then raise exception 'Aktuelles tatsächliches Profil fehlt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':plan-eval-request:'||request_id::text,0));
 select * into prior from public.care_plan_evaluation_events x where x.tenant_id=tenant and x.request_id=write_ambulatory_plan_evaluation.request_id;
 if found then if prior.actor_id<>actor or prior.request_payload<>payload then raise exception 'Originalrequest mit anderen Angaben belegt.' using errcode='23514';end if;return jsonb_build_object('id',prior.id::text,'tenantId',tenant::text,'assessmentId',ref::text,'rootId',prior.root_id::text,'requestId',request_id::text,'previousId',coalesce(prior.previous_id::text,''),'sequence',prior.sequence);end if;
 if public.has_permission('pflege.assessments.manage') is not true or a.status in ('superseded','archived','professional_review') then raise exception 'Keine aktuelle Evaluations-Schreibfreigabe.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':plan-eval-root:'||root_ref::text,0));
 select * into r from public.care_plan_evaluation_roots x where x.id=root_ref for update;server_now:=clock_timestamp();
 perform care_private.plan_eval_snapshot(p,server_now);perform care_private.plan_eval_draft(d,p,server_now);
 if p->>'assessmentId'<>ref::text or p->>'tenantId'<>tenant::text or p->>'clientId'<>a.subject_id::text then raise exception 'Fremder historischer Planbezug.' using errcode='42501';end if;
 if r.id is not null then
  if r.tenant_id<>tenant or r.assessment_id<>ref or r.snapshot<>p then raise exception 'Originalplan darf nicht ausgetauscht werden.' using errcode='23514';end if;
 else
  if (p->>'version')::integer<>a.version or (p->>'draftRevision')::integer<>a.draft_revision or care_private.plan_eval_time(p->>'updatedAt')<>a.updated_at or p->>'status'<>a.status then raise exception 'Bewerteter Planstand inzwischen geändert.' using errcode='40001';end if;
  for m in select value from jsonb_array_elements(p->'measures') loop
   select jsonb_build_object('id',x.id::text,'title',x.title,'relatedTopicKey',x.related_topic_key,'relatedRiskKey',x.related_risk_key,'personalGoal',x.personal_goal,'intervention',x.intervention,'timing',x.timing,'frequency',x.frequency,'responsibleRole',x.responsible_role,'personContribution',x.person_contribution,'relativesContribution',x.relatives_contribution,'warningSigns',x.warning_signs,'escalationPath',x.escalation_path,'evaluationCriteria',x.evaluation_criteria,'nextEvaluationAt',x.next_evaluation_at,'status',x.status) into native from public.care_assessment_measures x where x.id=(m->>'id')::uuid and x.assessment_id=ref and x.tenant_id=tenant for share;
   if native is null or native-'nextEvaluationAt'<>m-'nextEvaluationAt' or ((native->'nextEvaluationAt'='null'::jsonb)<>(m->'nextEvaluationAt'='null'::jsonb)) or (m->'nextEvaluationAt'<>'null'::jsonb and care_private.plan_eval_time(m->>'nextEvaluationAt')<>(native->>'nextEvaluationAt')::timestamptz) then raise exception 'Ausgewählte Originalmaßnahme inzwischen geändert.' using errcode='40001';end if;
  end loop;
 end if;
 for old in select x.* from public.care_plan_evaluation_events x where x.root_id=root_ref order by x.sequence loop
  if old.tenant_id<>tenant or old.assessment_id<>ref or old.sequence<>seq+1 or old.previous_id is distinct from head or old.recorded_at>server_now or (last_at is not null and old.recorded_at<last_at) or (seq=0 and old.recorded_at<>r.created_at) then raise exception 'Originalverlauf unvollständig.' using errcode='23514';end if;
  perform care_private.plan_eval_draft(old.draft,r.snapshot,old.recorded_at);
  if (seq=0 and old.draft->>'action'<>'record') or (seq>0 and (old.draft->>'action'='record' or entry='null'::jsonb)) or (old.draft->>'action'='replace' and old.draft->'entry'=entry) then raise exception 'Originalfolge widersprüchlich.' using errcode='23514';end if;entry:=old.draft->'entry';seq:=old.sequence;head:=old.id;last_at:=old.recorded_at;
 end loop;
 if seq<>(payload->>'expectedSequence')::integer or head is distinct from expected or (r.id is not null and seq=0) or (seq=0 and d->>'action'<>'record') or (seq>0 and (d->>'action'='record' or entry='null'::jsonb)) or (d->>'action'='replace' and d->'entry'=entry) then raise exception 'Evaluationskopf geändert, zurückgenommen oder keine tatsächliche Berichtigung.' using errcode='40001';end if;
 if r.id is null then insert into public.care_plan_evaluation_roots(id,tenant_id,assessment_id,snapshot,created_at) values(root_ref,tenant,ref,p,server_now);end if;
 insert into public.care_plan_evaluation_events(id,tenant_id,assessment_id,root_id,sequence,previous_id,request_id,actor_id,actor_name,recorded_at,draft,request_payload) values(result,tenant,ref,root_ref,seq+1,head,request_id,actor,name,server_now,d,payload);
 return jsonb_build_object('id',result::text,'tenantId',tenant::text,'assessmentId',ref::text,'rootId',root_ref::text,'requestId',request_id::text,'previousId',coalesce(head::text,''),'sequence',seq+1);
end $$;
create or replace function care_private.read_ambulatory_plan_evaluations(requested_tenant uuid,requested_assessment uuid) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$declare result jsonb;begin
 if care_private.plan_eval_access(requested_tenant,requested_assessment) is not true then raise exception 'Eigener Evaluationsbestand nicht zugänglich.' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('root',jsonb_build_object('id',r.id::text,'tenantId',r.tenant_id::text,'assessmentId',r.assessment_id::text,'snapshot',r.snapshot,'createdAt',to_char(r.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),'events',h.events,'headId',h.head_id,'eventCount',h.count) order by r.created_at desc,r.id desc),'[]'::jsonb) into result from public.care_plan_evaluation_roots r cross join lateral(select coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'rootId',e.root_id::text,'sequence',e.sequence,'previousId',coalesce(e.previous_id::text,''),'requestId',e.request_id::text,'recordedAt',to_char(e.recorded_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'actorId',e.actor_id::text,'actorName',e.actor_name,'draft',e.draft) order by e.sequence),'[]'::jsonb) events,(array_agg(e.id::text order by e.sequence desc))[1] head_id,count(*) count from public.care_plan_evaluation_events e where e.root_id=r.id and e.tenant_id=r.tenant_id and e.assessment_id=r.assessment_id) h where r.tenant_id=requested_tenant and r.assessment_id=requested_assessment;
 return jsonb_build_object('version','2026-10-09.1','tenantId',requested_tenant::text,'assessmentId',requested_assessment::text,'count',jsonb_array_length(result),'records',result);
end $$;
create or replace function care_private.plan_eval_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Historische Evaluationsoriginale bleiben unverändert.' using errcode='23514';end $$;
drop trigger if exists plan_eval_roots_immutable on public.care_plan_evaluation_roots;
create trigger plan_eval_roots_immutable before update or delete on public.care_plan_evaluation_roots for each row execute function care_private.plan_eval_immutable();
drop trigger if exists plan_eval_events_immutable on public.care_plan_evaluation_events;
create trigger plan_eval_events_immutable before update or delete on public.care_plan_evaluation_events for each row execute function care_private.plan_eval_immutable();
create or replace function care_private.block_legacy_ambulatory_evaluation() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.care_assessments a where a.id=case when tg_op='DELETE' then old.assessment_id else new.assessment_id end and a.subject_type='client') or (tg_op='UPDATE' and exists(select 1 from public.care_assessments a where a.id=old.assessment_id and a.subject_type='client')) then raise exception 'Ambulante Evaluation benötigt historischen Plan- und Originalrequestbezug.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists block_legacy_ambulatory_evaluation on public.care_assessment_evaluations;
create trigger block_legacy_ambulatory_evaluation before insert or update or delete on public.care_assessment_evaluations for each row execute function care_private.block_legacy_ambulatory_evaluation();
create or replace function public.write_ambulatory_plan_evaluation(request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_private.write_ambulatory_plan_evaluation(request_id,payload)$$;
create or replace function public.read_ambulatory_plan_evaluations(requested_tenant uuid,requested_assessment uuid) returns jsonb language sql security invoker set search_path='' as $$select care_private.read_ambulatory_plan_evaluations(requested_tenant,requested_assessment)$$;
revoke all on function care_private.plan_eval_access(uuid,uuid),care_private.plan_eval_fields(jsonb,text[]),care_private.plan_eval_text(jsonb,text,boolean),care_private.plan_eval_time(text),care_private.plan_eval_uuid(jsonb),care_private.plan_eval_snapshot(jsonb,timestamptz),care_private.plan_eval_draft(jsonb,jsonb,timestamptz),care_private.plan_eval_immutable(),care_private.block_legacy_ambulatory_evaluation() from public,anon,authenticated;
revoke all on function care_private.write_ambulatory_plan_evaluation(uuid,jsonb),care_private.read_ambulatory_plan_evaluations(uuid,uuid),public.write_ambulatory_plan_evaluation(uuid,jsonb),public.read_ambulatory_plan_evaluations(uuid,uuid) from public,anon;
grant execute on function care_private.plan_eval_access(uuid,uuid),care_private.write_ambulatory_plan_evaluation(uuid,jsonb),care_private.read_ambulatory_plan_evaluations(uuid,uuid),public.write_ambulatory_plan_evaluation(uuid,jsonb),public.read_ambulatory_plan_evaluations(uuid,uuid) to authenticated;
commit;
