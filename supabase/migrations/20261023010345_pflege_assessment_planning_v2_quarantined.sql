-- NEW ADDITIVE V2 ONLY. Supersedes the REJECTED unapplied c13fc4 candidate.
-- Automatic approval rejected its changes to EXISTING path objects; no rejected SQL ran.
-- This independent namespace/ledger never alters/revokes/writes existing native/path objects.
-- Native tables/catalogs are READ ONLY. No old history adoption or historical Auth backfill.
-- Native legacy writers, real catalog provisioning and clinical qualification remain release gaps.
-- All ALTER/REVOKE below target ONLY NEW objects created by this file; no grants/activation.
begin;
create schema assessment_planning_v2_private;
revoke all on schema assessment_planning_v2_private from public,anon,authenticated,service_role;
create table assessment_planning_v2_private.assessment_roots(tenant_id uuid not null,assessment_id uuid not null,head_id uuid,updated_at timestamptz not null default clock_timestamp(),primary key(tenant_id,assessment_id));
create table assessment_planning_v2_private.plan_roots(like assessment_planning_v2_private.assessment_roots including all);
create table assessment_planning_v2_private.assessment_events(
 id uuid primary key,tenant_id uuid not null,assessment_id uuid not null,sequence bigint not null,previous_id uuid,request_id uuid not null,actor_id uuid not null,auth_user_id uuid not null,actor_name text not null,occurred_at timestamptz not null,recorded_at timestamptz not null,kind text not null,command jsonb not null,unique(tenant_id,assessment_id,sequence),unique(tenant_id,request_id));
create table assessment_planning_v2_private.plan_events(like assessment_planning_v2_private.assessment_events including all);
alter table assessment_planning_v2_private.assessment_roots enable row level security;
alter table assessment_planning_v2_private.plan_roots enable row level security;
alter table assessment_planning_v2_private.assessment_events enable row level security;
alter table assessment_planning_v2_private.plan_events enable row level security;
revoke all on all tables in schema assessment_planning_v2_private from public,anon,authenticated,service_role;
create function assessment_planning_v2_private.immutable()returns trigger language plpgsql set search_path=''as $$begin raise exception 'Technische V2-Originale bleiben unveränderlich.'using errcode='P0P01';end$$;
create trigger assessment_v2_events_immutable before update or delete on assessment_planning_v2_private.assessment_events for each row execute function assessment_planning_v2_private.immutable();
create trigger plan_v2_events_immutable before update or delete on assessment_planning_v2_private.plan_events for each row execute function assessment_planning_v2_private.immutable();
create trigger assessment_v2_roots_no_delete before delete on assessment_planning_v2_private.assessment_roots for each row execute function assessment_planning_v2_private.immutable();
create trigger plan_v2_roots_no_delete before delete on assessment_planning_v2_private.plan_roots for each row execute function assessment_planning_v2_private.immutable();
create function assessment_planning_v2_private.require(ok boolean,message text,code text default '23514')
returns void language plpgsql set search_path='' as $$begin if ok is not true then raise exception '%',message using errcode=code;end if;end$$;
create function assessment_planning_v2_private.fields(v jsonb,keys text[])
returns boolean language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(v)is distinct from'object'then return false;end if;
 return v?&keys and not exists(select 1 from jsonb_object_keys(v)k where not(k=any(keys)));
end$$;
create function assessment_planning_v2_private.text_value(v jsonb,minimum integer default 0,maximum integer default 8000)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare raw text;trimmed text;units integer:=0;i integer;
begin
 if jsonb_typeof(v) is distinct from 'string' or minimum is null or maximum is null or minimum<0 or maximum<minimum then return false;end if;
 raw:=v#>>'{}';
 -- One UTF-16 unit cannot require more than four UTF-8 bytes. Reject before iteration.
 if octet_length(raw)::bigint>maximum::bigint*4 then return false;end if;
 for i in 1..length(raw) loop units:=units+case when ascii(substr(raw,i,1))>65535 then 2 else 1 end;if units>maximum then return false;end if;end loop;
 trimmed:=btrim(raw,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
 units:=0;
 for i in 1..length(trimmed) loop units:=units+case when ascii(substr(trimmed,i,1))>65535 then 2 else 1 end;end loop;
 return units>=minimum;
end$$;

create function assessment_planning_v2_private.uuid_value(v jsonb)
returns boolean language sql immutable set search_path='' as $$select jsonb_typeof(v)='string'and length(v#>>'{}')=36 and(v#>>'{}')~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'$$;
create function assessment_planning_v2_private.instant(v jsonb)
returns timestamptz language plpgsql immutable set search_path='' as $$declare s text:=v#>>'{}';at timestamptz;begin
 perform assessment_planning_v2_private.require(jsonb_typeof(v)='string'and s~'^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$','Endlicher Originalzeitpunkt mit Zeitzone fehlt.');
 at:=s::timestamptz;perform assessment_planning_v2_private.require(isfinite(at),'Endlicher Originalzeitpunkt fehlt.');return at;
end$$;
create function assessment_planning_v2_private.fingerprint(v jsonb)
returns text language sql immutable strict set search_path='' as $$select 'sha256:'||encode(extensions.digest(convert_to(v::text,'UTF8'),'sha256'),'hex')$$;
create function assessment_planning_v2_private.supported(family text)
returns text[] language sql immutable set search_path='' as $$select case family when'assessment'then array['measure_plan_revision','correction']when'plan'then array['goal_plan','measure_plan','daily_routine','support_boundary','schedule_commitment','plan_review_request','correction']else null end$$;

create function assessment_planning_v2_private.scope(t uuid,a uuid,c uuid,write_access boolean default false)
returns public.care_assessments language plpgsql security definer set search_path='' as $$
declare assessment public.care_assessments%rowtype;profile public.profiles%rowtype;role_key_value text;k text;begin
 perform care_private.require_workspace_session(t,a);
 perform assessment_planning_v2_private.require(t=public.current_tenant_id()and a=public.resolve_current_profile_id(),'Eigener aktueller Assessmentbereich fehlt.','42501');
 -- Consistent lock order covers permission override insertions and native source insert phantoms.
 lock table public.roles,public.role_permissions,public.role_permission_sets,public.profiles,public.clients,public.client_module_assignments in share mode;
 lock table public.care_assessments,public.care_assessment_topics,public.care_assessment_risks,public.care_assessment_measures,public.care_assessment_evaluations,public.care_assessment_events in share mode;
 lock table care_private.assessment_models,care_private.assessment_instruments,care_private.assessment_instrument_selections,care_private.plan_lifecycle_headers,care_private.plan_day_routines,care_private.plan_support_boundaries,care_private.plan_quality_visits,care_private.plan_lifecycle_revisions in share mode;
 -- Serializes both technical journals without SHARE-to-INSERT upgrades across clients.
 lock table assessment_planning_v2_private.assessment_roots,assessment_planning_v2_private.assessment_events,assessment_planning_v2_private.plan_roots,assessment_planning_v2_private.plan_events in share row exclusive mode;
 select p.*into profile from public.profiles p where p.id=a and p.tenant_id=t and p.is_active and p.status='active'and(p.auth_user_id=auth.uid()or(p.auth_user_id is null and p.id=auth.uid()))and to_jsonb(p)->>'deleted_at'is null and to_jsonb(p)->>'archived_at'is null for share;
 perform assessment_planning_v2_private.require(profile.id is not null and assessment_planning_v2_private.text_value(to_jsonb(profile.display_name),1,500),'Eigenes aktives Profil oder bestätigter Name fehlt.','42501');
 select r.key into role_key_value from public.roles r where r.id=profile.role_id for share;
 foreach k in array case when write_access then array['pflege.plans.view','pflege.assessments.manage']else array['pflege.plans.view']end loop
  if exists(select 1 from public.role_permission_sets s where s.tenant_id=t and s.role_key=role_key_value)then
   perform assessment_planning_v2_private.require(exists(select 1 from public.role_permission_sets s where s.tenant_id=t and s.role_key=role_key_value and s.permission_key=k),'Aktuelles eigenes Rollenrecht fehlt.','42501');
  else
   perform assessment_planning_v2_private.require(exists(select 1 from public.role_permissions s where s.role_id=profile.role_id and s.permission_key=k),'Aktuelles eigenes Rollenrecht fehlt.','42501');
  end if;
 end loop;
 select x.*into assessment from public.care_assessments x where x.id=c and x.tenant_id=t and x.subject_type='client'and x.variant='ambulant'for share;
 perform assessment_planning_v2_private.require(assessment.id is not null,'Eigene ambulante Assessmentakte fehlt.','42501');
 perform 1 from public.clients x where x.id=assessment.subject_id and x.tenant_id=t and x.status::text in('active','aktiv')and x.lifecycle_status::text in('active','aktiv')and to_jsonb(x)->>'deleted_at'is null and to_jsonb(x)->>'archived_at'is null for share;
 perform assessment_planning_v2_private.require(found,'Aktiver eigener Pflegefall fehlt.','42501');
 perform 1 from public.client_module_assignments x where x.tenant_id=t and x.client_id=assessment.subject_id and x.module_key='pflege'and x.is_active and x.status in('active','aktiv')for share;
 perform assessment_planning_v2_private.require(found,'Aktuelle Pflegezuordnung fehlt.','42501');
 perform care_private.require_workspace_session(t,a);return assessment;
end$$;

create function assessment_planning_v2_private.event_json(v jsonb)
returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',v->'id','sequence',v->'sequence','previousId',v->'previous_id','tenantId',v->'tenant_id','assessmentId',v->'assessment_id','actorId',v->'actor_id','actorName',v->'actor_name','recordedAt',to_char((v->>'recorded_at')::timestamptz at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',v->'command')$$;
create function assessment_planning_v2_private.sources(t uuid,c uuid)
returns jsonb language sql security definer set search_path='' as $$
 with s as(
 select 'care_assessment'::text kind,x.id,to_jsonb(x)snapshot from public.care_assessments x where x.tenant_id=t and x.id=c and x.subject_type='client'
 union all select 'assessment_topic',x.id,to_jsonb(x)from public.care_assessment_topics x where x.tenant_id=t and x.assessment_id=c
 union all select 'assessment_risk',x.id,to_jsonb(x)from public.care_assessment_risks x where x.tenant_id=t and x.assessment_id=c
 union all select 'assessment_measure',x.id,to_jsonb(x)from public.care_assessment_measures x where x.tenant_id=t and x.assessment_id=c
 union all select 'assessment_evaluation',x.id,to_jsonb(x)from public.care_assessment_evaluations x where x.tenant_id=t and x.assessment_id=c
 union all select 'care_event',x.id,to_jsonb(x)from public.care_assessment_events x where x.tenant_id=t and x.assessment_id=c
 union all select 'assessment_instrument',x.id,to_jsonb(x)from care_private.assessment_instruments x
 union all select 'assessment_path_event',x.id,assessment_planning_v2_private.event_json(to_jsonb(x))from assessment_planning_v2_private.assessment_events x where x.tenant_id=t and x.assessment_id=c
 union all select 'care_plan_path_event',x.id,assessment_planning_v2_private.event_json(to_jsonb(x))from assessment_planning_v2_private.plan_events x where x.tenant_id=t and x.assessment_id=c)
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'snapshot',snapshot)order by kind,id),'[]'::jsonb)from s$$;
create function assessment_planning_v2_private.state(t uuid,a uuid,c uuid)
returns text language sql security definer set search_path='' as $$select assessment_planning_v2_private.fingerprint(jsonb_build_object(
 'policy','assessment-planning-additive-v2-20261022.1','assessmentKinds',to_jsonb(assessment_planning_v2_private.supported('assessment')),'planKinds',to_jsonb(assessment_planning_v2_private.supported('plan')),
 'sources',assessment_planning_v2_private.sources(t,c),'profile',(select to_jsonb(p)from public.profiles p where p.id=a and p.tenant_id=t),
 'role',(select to_jsonb(r)from public.roles r join public.profiles p on p.role_id=r.id where p.id=a and p.tenant_id=t),
 'permissions',coalesce((select jsonb_agg(to_jsonb(r)order by r.permission_key)from public.role_permissions r join public.profiles p on p.role_id=r.role_id where p.id=a and p.tenant_id=t),'[]'::jsonb),
 'overrides',coalesce((select jsonb_agg(to_jsonb(r)order by r.permission_key)from public.role_permission_sets r join public.roles z on z.key=r.role_key join public.profiles p on p.role_id=z.id where p.id=a and p.tenant_id=t and r.tenant_id=t),'[]'::jsonb),
 'client',(select to_jsonb(x)from public.clients x join public.care_assessments z on z.subject_id=x.id and z.tenant_id=x.tenant_id where z.id=c and z.tenant_id=t),
 'assignments',coalesce((select jsonb_agg(to_jsonb(x)order by x.id)from public.client_module_assignments x join public.care_assessments z on z.subject_id=x.client_id and z.tenant_id=x.tenant_id where z.id=c and z.tenant_id=t),'[]'::jsonb),
 'models',coalesce((select jsonb_agg(to_jsonb(x)order by x.model_key)from care_private.assessment_models x),'[]'::jsonb),
 'selection',(select to_jsonb(x)from care_private.assessment_instrument_selections x where x.tenant_id=t and x.assessment_id=c),
 'planHeader',(select to_jsonb(x)from care_private.plan_lifecycle_headers x where x.tenant_id=t and x.assessment_id=c),
 'routines',coalesce((select jsonb_agg(to_jsonb(x)order by x.id)from care_private.plan_day_routines x where x.tenant_id=t and x.assessment_id=c),'[]'::jsonb),
 'boundaries',coalesce((select jsonb_agg(to_jsonb(x)order by x.id)from care_private.plan_support_boundaries x where x.tenant_id=t and x.assessment_id=c),'[]'::jsonb),
 'visits',coalesce((select jsonb_agg(to_jsonb(x)order by x.id)from care_private.plan_quality_visits x where x.tenant_id=t and x.assessment_id=c),'[]'::jsonb),
 'planRevisions',coalesce((select jsonb_agg(to_jsonb(x)order by x.packet_revision)from care_private.plan_lifecycle_revisions x where x.tenant_id=t and x.assessment_id=c),'[]'::jsonb),
 'assessmentRoot',(select to_jsonb(x)from assessment_planning_v2_private.assessment_roots x where x.tenant_id=t and x.assessment_id=c),'planRoot',(select to_jsonb(x)from assessment_planning_v2_private.plan_roots x where x.tenant_id=t and x.assessment_id=c),
 'assessmentEvents',coalesce((select jsonb_agg(to_jsonb(x)order by x.sequence)from assessment_planning_v2_private.assessment_events x where x.tenant_id=t and x.assessment_id=c),'[]'::jsonb),
 'planEvents',coalesce((select jsonb_agg(to_jsonb(x)order by x.sequence)from assessment_planning_v2_private.plan_events x where x.tenant_id=t and x.assessment_id=c),'[]'::jsonb)))$$;


create function assessment_planning_v2_private.payload_keys(family text,k text)returns text[]language sql immutable set search_path=''as $$select case
 when family='assessment'and k='measure_plan_revision'then array['assessment','risk','measure','goal','action','frequency','responsibility','dueAt']
 when family='plan'and k='goal_plan'then array['assessment','finding','goal','outcome','baseline','priority','reviewAt']
 when family='plan'and k='measure_plan'then array['goal','measure','action','frequency','aids','responsibleRole']
 when family='plan'and k='daily_routine'then array['assessment','plan','timeWindow','ritual','preference','dependency']
 when family='plan'and k='support_boundary'then array['plan','finding','supportLevel','ownContribution','professionalBoundary']
 when family='plan'and k='schedule_commitment'then array['measure','routine','startsAt','dueAt','frequency','exceptionRule']
 when family='plan'and k='plan_review_request'then array['assessment','goal','measure','schedule','reason','packetSha256']
 when k='correction'and family in('assessment','plan')then array['targetId','reason','evidenceSha256']end$$;
create function assessment_planning_v2_private.header(cmd jsonb,family text)
returns void language plpgsql set search_path='' as $$declare k text;begin
 perform assessment_planning_v2_private.require(assessment_planning_v2_private.fields(cmd,array['version','requestId','eventId','tenantId','assessmentId','actorId','expectedHeadId','kind','occurredAt','note','payload']),'Vollständige unveränderte Anfrage fehlt.');
 perform assessment_planning_v2_private.require(cmd->>'version'=case family when'assessment'then'assessment-path-workspace-v2'when'plan'then'care-plan-path-workspace-v2'end,'Pfadversion fehlt.');
 foreach k in array array['requestId','eventId','tenantId','assessmentId','actorId']loop perform assessment_planning_v2_private.require(assessment_planning_v2_private.uuid_value(cmd->k),'Kanonische eigene Kennung fehlt.');end loop;
 perform assessment_planning_v2_private.require(cmd->'expectedHeadId'='null'::jsonb or assessment_planning_v2_private.uuid_value(cmd->'expectedHeadId'),'Erwarteter Verlaufskopf fehlt.');
 perform assessment_planning_v2_private.instant(cmd->'occurredAt');
 perform assessment_planning_v2_private.require(assessment_planning_v2_private.text_value(cmd->'note',1,4000)and jsonb_typeof(cmd->'payload')='object'and octet_length(cmd::text)<=1048576,'Anlass oder vollständiger begrenzter Inhalt fehlt.');
end$$;
create function assessment_planning_v2_private.current_source(v jsonb,src jsonb,depth integer default 0)
returns void language plpgsql set search_path='' as $$declare child jsonb;begin
 perform assessment_planning_v2_private.require(depth<=32,'Verknüpfte Originalkette ist zu tief.');
 perform assessment_planning_v2_private.require(assessment_planning_v2_private.fields(v,array['kind','id','snapshot'])and assessment_planning_v2_private.uuid_value(v->'id')and jsonb_typeof(v->'snapshot')='object'and v#>'{snapshot,id}'=v->'id','Vollständiger nativer Originalverweis fehlt.');
 perform assessment_planning_v2_private.require(exists(select 1 from jsonb_array_elements(src)x where x=v),'Ausgewählte vollständige Originalgrundlage wurde geändert.','40001');
 if v->>'kind'in('assessment_path_event','care_plan_path_event')then
  perform assessment_planning_v2_private.require(not exists(select 1 from jsonb_array_elements(src)x where x->>'kind'=v->>'kind'and x#>>'{snapshot,command,kind}'='correction'and x#>'{snapshot,command,payload,targetId}'=v->'id'),'Berichtigtes Original ist keine aktuelle Planungsgrundlage.','40001');
  for child in select value from jsonb_each(v#>'{snapshot,command,payload}')where jsonb_typeof(value)='object'and value?'kind'and value?'snapshot'loop
   perform assessment_planning_v2_private.current_source(child,src,depth+1);
  end loop;
 end if;
end$$;
create function assessment_planning_v2_private.source_field(cmd jsonb,key text,kinds text[],event_kinds text[],src jsonb)
returns void language plpgsql set search_path='' as $$declare v jsonb:=cmd->'payload'->key;begin
 perform assessment_planning_v2_private.current_source(v,src);
 perform assessment_planning_v2_private.require(v->>'kind'=any(kinds),'Fachliche Originalart stimmt nicht mit dem Feld überein.');
 if v->>'kind'in('assessment_path_event','care_plan_path_event')and event_kinds is not null then
  perform assessment_planning_v2_private.require(v#>>'{snapshot,command,kind}'=any(event_kinds),'Fachlicher Originalvorgang passt nicht zur Planung.');
 end if;
end$$;
create function assessment_planning_v2_private.validate(cmd jsonb,family text,src jsonb)
returns void language plpgsql set search_path='' as $$
declare k text:=cmd->>'kind';keys text[];texts text[];times text[];item text;p jsonb:=cmd->'payload';begin
 perform assessment_planning_v2_private.header(cmd,family);
 perform assessment_planning_v2_private.require(k=any(assessment_planning_v2_private.supported(family)),'Neue klinische Durchführung, Freigabe oder ungeklärte Fachaktion bleibt gesperrt.','42501');
 if family='assessment'then
  keys:=assessment_planning_v2_private.payload_keys('assessment',k);texts:=array['goal','action','frequency','responsibility'];times:=array['dueAt'];
  if k='measure_plan_revision'then
   perform assessment_planning_v2_private.source_field(cmd,'assessment',array['care_assessment'],null,src);
   perform assessment_planning_v2_private.source_field(cmd,'risk',array['assessment_risk'],null,src);
   perform assessment_planning_v2_private.source_field(cmd,'measure',array['assessment_measure'],null,src);
   perform assessment_planning_v2_private.require(p#>>'{assessment,id}'=cmd->>'assessmentId'and p#>>'{measure,snapshot,related_risk_key}'=p#>>'{risk,snapshot,risk_key}','Maßnahme und ausdrücklich ausgewähltes natives Risiko sind nicht verbunden.');
  end if;
 else
  keys:=assessment_planning_v2_private.payload_keys('plan',k);
  if k='goal_plan'then
   perform assessment_planning_v2_private.source_field(cmd,'assessment',array['care_assessment'],null,src);
   perform assessment_planning_v2_private.source_field(cmd,'finding',array['assessment_topic','assessment_risk','assessment_path_event'],array['cognition_assessment','mobility_assessment','disease_demands_assessment','self_care_assessment','household_assessment','social_relationships_assessment','risk_screening','risk_deep_assessment'],src);
   perform assessment_planning_v2_private.source_field(cmd,'goal',array['assessment_measure'],null,src);
   perform assessment_planning_v2_private.require(p#>>'{assessment,id}'=cmd->>'assessmentId','Aktuelles Assessmentoriginal fehlt.');
   if p#>>'{finding,kind}'='assessment_topic'then perform assessment_planning_v2_private.require(p#>>'{goal,snapshot,related_topic_key}'=p#>>'{finding,snapshot,topic_key}','Natives Themenfeld und Zielmaßnahme sind nicht verbunden.');
   elsif p#>>'{finding,kind}'='assessment_risk'then perform assessment_planning_v2_private.require(p#>>'{goal,snapshot,related_risk_key}'=p#>>'{finding,snapshot,risk_key}','Natives Risiko und Zielmaßnahme sind nicht verbunden.');end if;
   texts:=array['outcome','baseline','priority'];times:=array['reviewAt'];
  elsif k='measure_plan'then
   perform assessment_planning_v2_private.source_field(cmd,'goal',array['care_plan_path_event'],array['goal_plan'],src);
   perform assessment_planning_v2_private.source_field(cmd,'measure',array['assessment_measure'],null,src);
   perform assessment_planning_v2_private.require(p#>'{goal,snapshot,command,payload,goal}'=p->'measure','Ziel- und Maßnahmenoriginal sind nicht identisch.');
   texts:=array['action','frequency','aids','responsibleRole'];
  elsif k='daily_routine'then
   perform assessment_planning_v2_private.source_field(cmd,'assessment',array['care_assessment'],null,src);
   perform assessment_planning_v2_private.source_field(cmd,'plan',array['care_plan_path_event'],array['goal_plan','measure_plan'],src);
   perform assessment_planning_v2_private.require(p#>>'{assessment,id}'=cmd->>'assessmentId','Aktuelles Assessmentoriginal fehlt.');
   texts:=array['timeWindow','ritual','preference','dependency'];
  elsif k='support_boundary'then
   perform assessment_planning_v2_private.source_field(cmd,'plan',array['care_plan_path_event'],array['goal_plan','measure_plan'],src);
   perform assessment_planning_v2_private.source_field(cmd,'finding',array['assessment_topic','assessment_path_event'],array['cognition_assessment','mobility_assessment','self_care_assessment','household_assessment'],src);
   perform assessment_planning_v2_private.require(p->'finding'=case when p#>>'{plan,snapshot,command,kind}'='goal_plan'then p#>'{plan,snapshot,command,payload,finding}'else p#>'{plan,snapshot,command,payload,goal,snapshot,command,payload,finding}'end,'Unterstützungsgrenze und Zielplanung verwenden verschiedene Grundlagen.');
   perform assessment_planning_v2_private.require(p->>'supportLevel'in('self','guidance','partial_assistance','full_assistance'),'Ausdrücklicher Unterstützungsgrad fehlt.');texts:=array['ownContribution','professionalBoundary'];
  elsif k='schedule_commitment'then
   perform assessment_planning_v2_private.source_field(cmd,'measure',array['care_plan_path_event'],array['measure_plan'],src);
   perform assessment_planning_v2_private.source_field(cmd,'routine',array['care_plan_path_event'],array['daily_routine'],src);
   perform assessment_planning_v2_private.require(p#>'{routine,snapshot,command,payload,plan}'=p->'measure'or p#>'{routine,snapshot,command,payload,plan}'=p#>'{measure,snapshot,command,payload,goal}','Termin und Tagesstruktur gehören nicht zur gleichen Planfassung.');
   texts:=array['frequency','exceptionRule'];times:=array['startsAt','dueAt'];
   perform assessment_planning_v2_private.require(assessment_planning_v2_private.instant(p->'startsAt')<=assessment_planning_v2_private.instant(p->'dueAt'),'Planfrist liegt vor dem Planbeginn.');
  elsif k='plan_review_request'then
   perform assessment_planning_v2_private.source_field(cmd,'assessment',array['care_assessment'],null,src);
   perform assessment_planning_v2_private.source_field(cmd,'goal',array['care_plan_path_event'],array['goal_plan'],src);
   perform assessment_planning_v2_private.source_field(cmd,'measure',array['care_plan_path_event'],array['measure_plan'],src);
   perform assessment_planning_v2_private.source_field(cmd,'schedule',array['care_plan_path_event'],array['schedule_commitment'],src);
   perform assessment_planning_v2_private.require(p#>>'{assessment,id}'=cmd->>'assessmentId'and p#>'{measure,snapshot,command,payload,goal}'=p->'goal'and p#>'{schedule,snapshot,command,payload,measure}'=p->'measure','Prüfanfrage enthält verschiedene Planfassungen.');
   texts:=array['reason'];perform assessment_planning_v2_private.require(jsonb_typeof(p->'packetSha256')='string'and length(p->>'packetSha256')=64 and p->>'packetSha256'~'^[0-9a-f]{64}$','Ausdrücklicher technischer Prüfbeleg fehlt.');
  end if;
 end if;
 if k='correction'then
  texts:=array['reason'];times:=null;
  perform assessment_planning_v2_private.require(assessment_planning_v2_private.uuid_value(p->'targetId')and jsonb_typeof(p->'evidenceSha256')='string'and length(p->>'evidenceSha256')=64 and p->>'evidenceSha256'~'^[0-9a-f]{64}$','Berichtigungsziel oder Beleg fehlt.');
 end if;
 perform assessment_planning_v2_private.require(assessment_planning_v2_private.fields(p,keys),'Vollständige Vorgangsfelder fehlen oder enthalten Fremdfelder.');
 foreach item in array coalesce(texts,array[]::text[])loop perform assessment_planning_v2_private.require(assessment_planning_v2_private.text_value(p->item,1,4000),'Ausdrücklicher begrenzter Planungsinhalt fehlt.');end loop;
 foreach item in array coalesce(times,array[]::text[])loop perform assessment_planning_v2_private.instant(p->item);end loop;
end$$;

create function assessment_planning_v2_private.history(t uuid,c uuid,family text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefix text:=case family when'assessment'then'assessment'when'plan'then'plan'end;v jsonb;head uuid;prev uuid;n integer:=0;rows jsonb:='[]';last_recorded timestamptz;at timestamptz;cmd jsonb;begin
 perform assessment_planning_v2_private.require(prefix is not null,'Unbekannter Pfad.');
 execute format('select head_id from %I.%I where tenant_id=$1 and assessment_id=$2','assessment_planning_v2_private',prefix||'_roots')into head using t,c;
 for v in execute format('select to_jsonb(e)from %I.%I e where tenant_id=$1 and assessment_id=$2 order by sequence','assessment_planning_v2_private',prefix||'_events')using t,c loop
  n:=n+1;perform assessment_planning_v2_private.require(n<=1000,'Vollständiger Verlauf überschreitet die sichere Lesemenge.');
  cmd:=v->'command';perform assessment_planning_v2_private.header(cmd,family);at:=(v->>'recorded_at')::timestamptz;
  perform assessment_planning_v2_private.require((v->>'sequence')::bigint=n and(v->>'previous_id')::uuid is not distinct from prev and cmd->'eventId'=v->'id'and cmd->>'tenantId'=t::text and cmd->>'assessmentId'=c::text and cmd->'actorId'=v->'actor_id'and cmd->'requestId'=v->'request_id'and cmd->'kind'=v->'kind'and(cmd->>'expectedHeadId')::uuid is not distinct from prev and assessment_planning_v2_private.instant(cmd->'occurredAt')=(v->>'occurred_at')::timestamptz and at>=assessment_planning_v2_private.instant(cmd->'occurredAt')and(last_recorded is null or at>=last_recorded)and assessment_planning_v2_private.text_value(v->'actor_name',1,500),'Unvollständiger oder widersprüchlicher unveränderlicher Verlauf.');
  rows:=rows||jsonb_build_array(assessment_planning_v2_private.event_json(v));prev:=(v->>'id')::uuid;last_recorded:=at;
 end loop;
 perform assessment_planning_v2_private.require(head is not distinct from prev,'Verlaufskopf stimmt nicht mit dem vollständigen Verlauf überein.');
 return jsonb_build_object('version',case family when'assessment'then'assessment-path-workspace-v2'else'care-plan-path-workspace-v2'end,'tenantId',t,'assessmentId',c,'count',n,'headId',head,'events',rows);
end$$;
create function assessment_planning_v2_private.context(t uuid,a uuid,c uuid,family text)
returns jsonb language plpgsql security definer set search_path='' as $$declare assessment public.care_assessments%rowtype;src jsonb;hist jsonb;proof text;begin
 assessment:=assessment_planning_v2_private.scope(t,a,c,false);
 select coalesce(jsonb_agg(x order by x->>'kind',x->>'id'),'[]'::jsonb)into src from jsonb_array_elements(assessment_planning_v2_private.sources(t,c))x where family='plan'or x->>'kind'<>'care_plan_path_event';
 perform assessment_planning_v2_private.require(jsonb_array_length(src)<=3000 and octet_length(src::text)<=8388608,'Vollständiger Quellenbestand überschreitet die sichere Lesemenge.');
 hist:=assessment_planning_v2_private.history(t,c,family);proof:=assessment_planning_v2_private.state(t,a,c);
 perform care_private.require_workspace_session(t,a);
 return jsonb_build_object('version',case family when'assessment'then'assessment-path-workspace-v2'else'care-plan-path-workspace-v2'end,'tenantId',t,'assessmentId',c,'actorId',a,'loadedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src),'history',hist,'stateFingerprint',proof,'supportedWriteKinds',to_jsonb(assessment_planning_v2_private.supported(family)));
end$$;
create function assessment_planning_v2_private.commit_event(cmd jsonb,family text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid;c uuid;a uuid;rid uuid;eid uuid;prefix text:=case family when'assessment'then'assessment'when'plan'then'plan'end;assessment public.care_assessments%rowtype;prior jsonb;v jsonb;src jsonb;head uuid;hist jsonb;recorded timestamptz;name_value text;begin
 perform assessment_planning_v2_private.header(cmd,family);t:=(cmd->>'tenantId')::uuid;c:=(cmd->>'assessmentId')::uuid;a:=(cmd->>'actorId')::uuid;rid:=(cmd->>'requestId')::uuid;eid:=(cmd->>'eventId')::uuid;
 assessment:=assessment_planning_v2_private.scope(t,a,c,true);
 execute format('select to_jsonb(e)from %I.%I e where tenant_id=$1 and request_id=$2','assessment_planning_v2_private',prefix||'_events')into prior using t,rid;
 if prior is not null then
  perform assessment_planning_v2_private.require(prior->>'auth_user_id'=auth.uid()::text and prior->>'actor_id'=a::text and prior->>'assessment_id'=c::text,'Ursprüngliches eigenes Konto ist nicht bestätigt.','42501');
  perform assessment_planning_v2_private.require(prior->'command'=cmd,'Anfragekennung gehört zu einem anderen unveränderten Inhalt.','23505');
  perform care_private.require_workspace_session(t,a);return jsonb_build_object('version',cmd->'version','requestId',rid,'command',prior->'command','event',assessment_planning_v2_private.event_json(prior));
 end if;
 perform assessment_planning_v2_private.require(cmd->>'kind'=any(assessment_planning_v2_private.supported(family)),'Klinische Freigabe, tatsächliche Durchführung und ungeklärte Fachaktionen bleiben gesperrt.','42501');
 perform assessment_planning_v2_private.require(assessment.status in('draft','in_progress'),'Neue technische Planung benötigt eine offene native Assessmentfassung.','42501');
 src:=assessment_planning_v2_private.sources(t,c);perform assessment_planning_v2_private.require(jsonb_array_length(src)<=3000 and octet_length(src::text)<=8388608,'Quellenbestand ist zu umfangreich.');perform assessment_planning_v2_private.validate(cmd,family,src);
 hist:=assessment_planning_v2_private.history(t,c,family);head:=(hist->>'headId')::uuid;
 perform assessment_planning_v2_private.require((cmd->>'expectedHeadId')::uuid is not distinct from head,'Verlauf wurde zwischenzeitlich geändert.','40001');
 perform assessment_planning_v2_private.require((hist->>'count')::integer<1000,'Vollständiger Verlauf ist zu umfangreich.');
 if cmd->>'kind'='correction'then
  perform assessment_planning_v2_private.require(exists(select 1 from jsonb_array_elements(hist->'events')x where x->>'id'=cmd#>>'{payload,targetId}'and x#>>'{command,kind}'<>'correction')and not exists(select 1 from jsonb_array_elements(hist->'events')x where x#>>'{command,kind}'='correction'and x#>>'{command,payload,targetId}'=cmd#>>'{payload,targetId}'),'Nur ein vorhandenes unberichtigtes Original kann berichtigt werden.');
 end if;
 select p.display_name into name_value from public.profiles p where p.id=a and p.tenant_id=t;
 perform care_private.require_workspace_session(t,a);recorded:=clock_timestamp();
 perform assessment_planning_v2_private.require(assessment_planning_v2_private.instant(cmd->'occurredAt')<=recorded,'Der tatsächliche Erfassungszeitpunkt liegt in der Zukunft.');
 execute format('insert into %I.%I(tenant_id,assessment_id)values($1,$2)on conflict do nothing','assessment_planning_v2_private',prefix||'_roots')using t,c;
 execute format('insert into %I.%I as inserted(id,tenant_id,assessment_id,sequence,previous_id,request_id,actor_id,actor_name,occurred_at,recorded_at,kind,command,auth_user_id)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)returning to_jsonb(inserted)','assessment_planning_v2_private',prefix||'_events')into v using eid,t,c,(hist->>'count')::integer+1,head,rid,a,name_value,assessment_planning_v2_private.instant(cmd->'occurredAt'),recorded,cmd->>'kind',cmd,auth.uid();
 execute format('update %I.%I set head_id=$1,updated_at=$2 where tenant_id=$3 and assessment_id=$4','assessment_planning_v2_private',prefix||'_roots')using eid,recorded,t,c;
 perform care_private.require_workspace_session(t,a);return jsonb_build_object('version',cmd->'version','requestId',rid,'command',cmd,'event',assessment_planning_v2_private.event_json(v));
end$$;
create function assessment_planning_v2_private.confirm_event(t uuid,a uuid,c uuid,rid uuid,cmd jsonb,family text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefix text:=case family when'assessment'then'assessment'when'plan'then'plan'end;v jsonb;begin
 perform assessment_planning_v2_private.scope(t,a,c,false);
 execute format('select to_jsonb(e)from %I.%I e where tenant_id=$1 and assessment_id=$2 and request_id=$3 and actor_id=$4 and auth_user_id=$5','assessment_planning_v2_private',prefix||'_events')into v using t,c,rid,a,auth.uid();
 perform assessment_planning_v2_private.require(v is not null and v->'command'=cmd,'Passende ursprüngliche eigene Quittung fehlt.','P0P01');
 perform care_private.require_workspace_session(t,a);return jsonb_build_object('version',v#>'{command,version}','requestId',rid,'command',v->'command','event',assessment_planning_v2_private.event_json(v));
end$$;

create function assessment_planning_v2_private.utc(v timestamptz)
returns text language sql immutable strict set search_path='' as $$select to_char(v at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')$$;
create function assessment_planning_v2_private.instrument_projection(i care_private.assessment_instruments)
returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',i.id,'key',i.key,'title',i.title,'version',i.instrument_version,'ownership',i.ownership,'availability',i.availability,'licenseState',i.license_state,'riskKeys',to_jsonb(i.risk_keys),'sourceRevision',i.source_revision)$$;
create function assessment_planning_v2_private.read_instrument_packet(p_tenant uuid,p_assessment uuid,p_subject uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.care_assessments%rowtype;m care_private.assessment_models%rowtype;s care_private.assessment_instrument_selections%rowtype;items jsonb;item jsonb;key text;ids jsonb;originals jsonb;proof text;begin
 a:=assessment_planning_v2_private.scope(p_tenant,p_actor,p_assessment,false);perform assessment_planning_v2_private.require(a.subject_id=p_subject,'Eigener Patientenbezug fehlt.','42501');
 select x.*into s from care_private.assessment_instrument_selections x where x.tenant_id=p_tenant and x.assessment_id=p_assessment;
 perform assessment_planning_v2_private.require(not exists(select 1 from care_private.assessment_instrument_selections x where x.assessment_id=p_assessment and(x.tenant_id<>p_tenant or x.subject_id<>p_subject)),'Gespeicherte Instrumentenauswahl gehört zu einem fremden Fall.');
 select x.*into m from care_private.assessment_models x where x.model_key=case when s.assessment_id is null then'caresuite_pflegeassessment'else s.model_key end;
 perform assessment_planning_v2_private.require(m.model_key is not null and m.status='active'and m.claim='product_model'and(s.assessment_id is null or s.model_version=m.model_version),'Aktuelles eigenes Produktmodell ist nicht als native Grundlage belegt.');
 perform assessment_planning_v2_private.require(assessment_planning_v2_private.text_value(to_jsonb(m.model_key),1,120)and assessment_planning_v2_private.text_value(to_jsonb(m.title),1,240)and assessment_planning_v2_private.text_value(to_jsonb(m.model_version),1,80),'Modelloriginal überschreitet den vollständigen Webvertrag.');
 select coalesce(jsonb_agg(assessment_planning_v2_private.instrument_projection(i)order by i.key),'[]'::jsonb)into items from care_private.assessment_instruments i;
 perform assessment_planning_v2_private.require(jsonb_array_length(items)<=200,'Vollständiger Instrumentenkatalog ist zu umfangreich.');
 for item in select value from jsonb_array_elements(items)loop
  perform assessment_planning_v2_private.require(assessment_planning_v2_private.uuid_value(item->'id')and assessment_planning_v2_private.text_value(item->'key',1,120)and assessment_planning_v2_private.text_value(item->'title',1,240)and assessment_planning_v2_private.text_value(item->'version',1,80)and assessment_planning_v2_private.text_value(item->'sourceRevision',1,120)and item->>'ownership'in('caresuite','licensed_external','external_reference')and item->>'availability'in('active','unavailable','retired')and item->>'licenseState'in('owned','licensed','unverified','expired')and jsonb_typeof(item->'riskKeys')='array'and jsonb_array_length(item->'riskKeys')<=80,'Vollständiges Instrumentenoriginal ist ungültig.');
  for key in select value#>>'{}'from jsonb_array_elements(item->'riskKeys')loop perform assessment_planning_v2_private.require(assessment_planning_v2_private.text_value(to_jsonb(key),1,120),'Instrumentenrisikobezug ist ungültig.');end loop;
 end loop;
 if s.assessment_id is null then ids:='[]';originals:='[]';else
  ids:=to_jsonb(s.selected_instrument_ids);
  perform assessment_planning_v2_private.require(s.selection_revision>=0 and jsonb_array_length(ids)<=200 and(select count(distinct value)from jsonb_array_elements(ids))=jsonb_array_length(ids)and assessment_planning_v2_private.text_value(to_jsonb(s.rationale),0,4000),'Gespeicherte Auswahl ist unvollständig.');
  select coalesce(jsonb_agg(assessment_planning_v2_private.instrument_projection(i)order by z.ordinality),'[]'::jsonb)into originals from unnest(s.selected_instrument_ids)with ordinality z(id,ordinality)join care_private.assessment_instruments i on i.id=z.id;
  perform assessment_planning_v2_private.require(jsonb_array_length(originals)=jsonb_array_length(ids)and originals=s.selected_originals,'Gespeicherte Auswahloriginale sind nicht mehr vollständig aktuell.','40001');
 end if;
 proof:=assessment_planning_v2_private.state(p_tenant,p_actor,p_assessment);perform care_private.require_workspace_session(p_tenant,p_actor);
 return jsonb_build_object('tenantId',p_tenant,'assessmentId',p_assessment,'subjectId',p_subject,'actorId',p_actor,'catalogRevision',assessment_planning_v2_private.fingerprint(jsonb_build_object('model',to_jsonb(m),'instruments',(select coalesce(jsonb_agg(to_jsonb(i)order by i.id),'[]'::jsonb)from care_private.assessment_instruments i))),'readAt',assessment_planning_v2_private.utc(clock_timestamp()),'model',jsonb_build_object('key',m.model_key,'title',m.title,'version',m.model_version,'claim',m.claim,'status',m.status),'instruments',items,'selection',jsonb_build_object('revision',case when s.assessment_id is null then 0 else s.selection_revision end,'modelKey',m.model_key,'modelVersion',m.model_version,'selectedInstrumentIds',ids,'rationale',case when s.assessment_id is null then''else s.rationale end,'updatedAt',assessment_planning_v2_private.utc(s.updated_at)),'stateFingerprint',proof);
end$$;
create function assessment_planning_v2_private.measure_projection(m public.care_assessment_measures)
returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',m.id,'title',m.title,'relatedTopicKey',m.related_topic_key,'relatedRiskKey',m.related_risk_key,'personalGoal',m.personal_goal,'intervention',m.intervention,'timing',m.timing,'frequency',m.frequency,'responsibleRole',m.responsible_role,'personContribution',m.person_contribution,'relativesContribution',m.relatives_contribution,'warningSigns',m.warning_signs,'escalationPath',m.escalation_path,'evaluationCriteria',m.evaluation_criteria,'nextEvaluationAt',assessment_planning_v2_private.utc(m.next_evaluation_at),'status',m.status)$$;
create function assessment_planning_v2_private.read_lifecycle_packet(p_tenant uuid,p_assessment uuid,p_subject uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.care_assessments%rowtype;h care_private.plan_lifecycle_headers%rowtype;measures jsonb;routines jsonb;boundaries jsonb;visit jsonb;item jsonb;key text;proof text;begin
 a:=assessment_planning_v2_private.scope(p_tenant,p_actor,p_assessment,false);perform assessment_planning_v2_private.require(a.subject_id=p_subject,'Eigener Patientenbezug fehlt.','42501');
 select x.*into h from care_private.plan_lifecycle_headers x where x.tenant_id=p_tenant and x.assessment_id=p_assessment;
 perform assessment_planning_v2_private.require(not exists(select 1 from care_private.plan_lifecycle_headers x where x.assessment_id=p_assessment and(x.tenant_id<>p_tenant or x.subject_id<>p_subject))and a.version>=1 and(h.assessment_id is null or(h.packet_revision>=0 and h.plan_version>=1)),'Nativer Planlebenszyklus ist widersprüchlich.');
 select coalesce(jsonb_agg(assessment_planning_v2_private.measure_projection(m)order by m.id),'[]'::jsonb)into measures from public.care_assessment_measures m where m.tenant_id=p_tenant and m.assessment_id=p_assessment;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'sequence',r.sequence,'label',r.label,'timeWindow',r.time_window,'ritual',r.ritual,'preference',r.preference,'dependency',r.dependency,'responsibleRole',r.responsible_role,'status',r.status)order by r.sequence,r.id),'[]'::jsonb)into routines from care_private.plan_day_routines r where r.tenant_id=p_tenant and r.assessment_id=p_assessment;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'topicKey',s.topic_key,'ownContribution',s.own_contribution,'guidance',s.guidance,'partialSupport',s.partial_support,'fullSupport',s.full_support,'stopBoundary',s.stop_boundary,'responsibleRole',s.responsible_role)order by s.topic_key,s.id),'[]'::jsonb)into boundaries from care_private.plan_support_boundaries s where s.tenant_id=p_tenant and s.assessment_id=p_assessment;
 select jsonb_build_object('id',v.id,'plannedAt',assessment_planning_v2_private.utc(v.planned_at),'participants',v.participants,'checkpoints',v.checkpoints,'deviations',v.deviations,'decision',v.decision,'implementationDueAt',coalesce(assessment_planning_v2_private.utc(v.implementation_due_at),''),'followUpAt',coalesce(assessment_planning_v2_private.utc(v.follow_up_at),''),'state',v.state)into visit from care_private.plan_quality_visits v where v.tenant_id=p_tenant and v.assessment_id=p_assessment order by v.planned_at desc,v.id desc limit 1;
 perform assessment_planning_v2_private.require(jsonb_array_length(measures)<=200 and jsonb_array_length(routines)<=200 and jsonb_array_length(boundaries)<=200,'Vollständiger Planlebenszyklus ist zu umfangreich.');
 for item in select value from jsonb_array_elements(measures)loop
  foreach key in array array['title','personalGoal','intervention','timing','frequency','responsibleRole','personContribution','relativesContribution','warningSigns','escalationPath','evaluationCriteria']loop perform assessment_planning_v2_private.require(assessment_planning_v2_private.text_value(item->key,0,4000),'Natives Maßnahmenfeld ist unbekannt oder zu umfangreich.');end loop;
  perform assessment_planning_v2_private.require(item->>'status'in('planned','active','paused','completed','cancelled')and(item->'relatedTopicKey'='null'::jsonb or item->>'relatedTopicKey'in('cognition_communication','mobility','disease_demands','self_care','social_relationships','living_environment')),'Nativer Maßnahmenstatus oder Themenbezug ist unbekannt.');
 end loop;
 for item in select value from jsonb_array_elements(routines)loop
  perform assessment_planning_v2_private.require((item->>'sequence')::integer>=0 and item->>'status'in('planned','active','paused'),'Native Tagesstruktur ist widersprüchlich.');
  foreach key in array array['label','timeWindow','ritual','preference','dependency','responsibleRole']loop perform assessment_planning_v2_private.require(assessment_planning_v2_private.text_value(item->key,0,4000),'Natives Tagesstrukturfeld ist unbekannt oder zu umfangreich.');end loop;
 end loop;
 for item in select value from jsonb_array_elements(boundaries)loop
  perform assessment_planning_v2_private.require(item->>'topicKey'in('cognition_communication','mobility','disease_demands','self_care','social_relationships','living_environment'),'Native Unterstützungsgrenze hat einen unbekannten Themenbezug.');
  foreach key in array array['ownContribution','guidance','partialSupport','fullSupport','stopBoundary','responsibleRole']loop perform assessment_planning_v2_private.require(assessment_planning_v2_private.text_value(item->key,0,4000),'Native Unterstützungsangabe ist unbekannt oder zu umfangreich.');end loop;
 end loop;
 if visit is not null then
  perform assessment_planning_v2_private.require(visit->>'state'in('planned','documented'),'Nativer Visitenstatus ist unbekannt.');
  foreach key in array array['participants','checkpoints','deviations','decision']loop perform assessment_planning_v2_private.require(assessment_planning_v2_private.text_value(visit->key,0,4000),'Natives Visitenfeld ist unbekannt oder zu umfangreich.');end loop;
 end if;
 proof:=assessment_planning_v2_private.state(p_tenant,p_actor,p_assessment);perform care_private.require_workspace_session(p_tenant,p_actor);
 return jsonb_build_object('tenantId',p_tenant,'assessmentId',p_assessment,'subjectId',p_subject,'actorId',p_actor,'packetRevision',case when h.assessment_id is null then 0 else h.packet_revision end,'packetUpdatedAt',assessment_planning_v2_private.utc(h.updated_at),'planVersion',case when h.assessment_id is null then a.version else h.plan_version end,'measureOriginals',measures,'dayRoutines',routines,'supportBoundaries',boundaries,'qualityVisit',visit,'stateFingerprint',proof);
end$$;
create function public.web_read_assessment_instrument_v2_packet(p_tenant_id uuid,p_assessment_id uuid,p_subject_id uuid,p_actor_profile_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select assessment_planning_v2_private.read_instrument_packet(p_tenant_id,p_assessment_id,p_subject_id,p_actor_profile_id)$$;
create function public.web_read_plan_lifecycle_v2_packet(p_tenant_id uuid,p_assessment_id uuid,p_subject_id uuid,p_actor_profile_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select assessment_planning_v2_private.read_lifecycle_packet(p_tenant_id,p_assessment_id,p_subject_id,p_actor_profile_id)$$;


create function public.web_assessment_path_v2_context(p_tenant_id uuid,p_assessment_id uuid,p_actor_id uuid)returns jsonb language sql security invoker set search_path=''as $$select assessment_planning_v2_private.context(p_tenant_id,p_actor_id,p_assessment_id,'assessment')$$;
create function public.web_commit_assessment_path_v2_event(p_command jsonb)returns jsonb language sql security invoker set search_path=''as $$select assessment_planning_v2_private.commit_event(p_command,'assessment')$$;
create function public.web_confirm_assessment_path_v2_event(p_tenant_id uuid,p_assessment_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)returns jsonb language sql security invoker set search_path=''as $$select assessment_planning_v2_private.confirm_event(p_tenant_id,p_actor_id,p_assessment_id,p_request_id,p_command,'assessment')$$;
create function public.web_care_plan_path_v2_context(p_tenant_id uuid,p_assessment_id uuid,p_actor_id uuid)returns jsonb language sql security invoker set search_path=''as $$select assessment_planning_v2_private.context(p_tenant_id,p_actor_id,p_assessment_id,'plan')$$;
create function public.web_commit_care_plan_path_v2_event(p_command jsonb)returns jsonb language sql security invoker set search_path=''as $$select assessment_planning_v2_private.commit_event(p_command,'plan')$$;
create function public.web_confirm_care_plan_path_v2_event(p_tenant_id uuid,p_assessment_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)returns jsonb language sql security invoker set search_path=''as $$select assessment_planning_v2_private.confirm_event(p_tenant_id,p_actor_id,p_assessment_id,p_request_id,p_command,'plan')$$;
-- Name collisions fail CREATE instead of replacing an existing function.
do $quarantine$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='assessment_planning_v2_private'loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end$quarantine$;
revoke all on function public.web_assessment_path_v2_context(uuid,uuid,uuid),public.web_commit_assessment_path_v2_event(jsonb),public.web_confirm_assessment_path_v2_event(uuid,uuid,uuid,uuid,jsonb),public.web_care_plan_path_v2_context(uuid,uuid,uuid),public.web_commit_care_plan_path_v2_event(jsonb),public.web_confirm_care_plan_path_v2_event(uuid,uuid,uuid,uuid,jsonb),public.web_read_assessment_instrument_v2_packet(uuid,uuid,uuid,uuid),public.web_read_plan_lifecycle_v2_packet(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
commit;
