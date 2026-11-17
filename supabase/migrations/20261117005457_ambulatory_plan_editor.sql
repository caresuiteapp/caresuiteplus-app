begin;

alter table public.care_plans add column planning_model text
  check (planning_model in ('atl', 'aedl', 'fedl', 'roper', 'orem', 'henderson'));

create function care_private.valid_ambulatory_plan_activity(value jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare
  weekday_count integer;
  time_count integer;
  kind text:=value->>'kind';
begin
  if value is null then return true; end if;
  if pg_catalog.jsonb_typeof(value)!='object' or kind is null or kind not in ('drinking','positioning')
      or pg_catalog.jsonb_typeof(value->'days') is distinct from 'array'
      or pg_catalog.jsonb_typeof(value->'times') is distinct from 'array'
      or pg_catalog.jsonb_typeof(value->'subject') is distinct from 'string'
      or pg_catalog.jsonb_typeof(value->'equipment') is distinct from 'string'
      or pg_catalog.char_length(pg_catalog.btrim(value->>'subject')) not between 1 and 160
      or pg_catalog.char_length(value->>'equipment')>240
      or not (value ? 'offeredMl') then return false; end if;
  if value->'offeredMl'!='null'::jsonb and (kind!='drinking'
      or pg_catalog.jsonb_typeof(value->'offeredMl')!='number'
      or (value->>'offeredMl') !~ '^[1-9][0-9]{0,3}$') then return false; end if;

  weekday_count:=pg_catalog.jsonb_array_length(value->'days');
  time_count:=pg_catalog.jsonb_array_length(value->'times');
  return weekday_count between 1 and 7 and time_count between 1 and 24
    and (select count(distinct day) from pg_catalog.jsonb_array_elements(value->'days') as d(day))=weekday_count
    and (select count(distinct at_time) from pg_catalog.jsonb_array_elements(value->'times') as t(at_time))=time_count
    and not exists (select 1 from pg_catalog.jsonb_array_elements(value->'days') as d(day) where day::text !~ '^[1-7]$')
    and not exists (select 1 from pg_catalog.jsonb_array_elements(value->'times') as t(at_time)
      where pg_catalog.jsonb_typeof(at_time)!='string' or (at_time#>>'{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
end;
$$;

revoke all on function care_private.valid_ambulatory_plan_activity(jsonb) from public,anon;
grant execute on function care_private.valid_ambulatory_plan_activity(jsonb) to authenticated;

alter table public.care_plan_items add column planning_activity jsonb
  check (care_private.valid_ambulatory_plan_activity(planning_activity));

create function care_private.write_ambulatory_care_plan(p_document jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  tenant uuid:=public.current_tenant_id();
  account uuid:=auth.uid();
  actor uuid:=public.resolve_current_profile_id();
  request_id uuid:=(p_document->>'requestId')::uuid;
  existing_id uuid:=(p_document->>'id')::uuid;
  plan_id uuid:=coalesce(existing_id,request_id);
  subject_case uuid:=(p_document->>'clientId')::uuid;
  source_id uuid:=(p_document->>'sourceAssessmentId')::uuid;
  nurse_id uuid:=(p_document->>'primaryNurseId')::uuid;
  from_on date:=(p_document->>'validFrom')::date;
  until_on date:=(p_document->>'validUntil')::date;
  expected integer:=(p_document->>'expectedVersion')::integer;
  fingerprint text:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(account::text||':'||p_document::text,'UTF8')),'hex');
  previous public.care_plans;
  saved public.care_plans;
  receipt public.care_plan_versions;
  item jsonb;
  item_id uuid;
  seen uuid[]:='{}';
  before_state jsonb;
  after_state jsonb;
  actor_label text;
  item_status public.care_plan_item_status;
begin
  if tenant is null or account is null or actor is null or coalesce(public.current_portal_type(),'business')!='business'
    or not public.has_permission('pflege.plans.view') or not public.has_permission('pflege.plans.manage') then
    raise exception 'Keine Berechtigung für diese Pflegeplanung.' using errcode='42501';
  end if;
  if subject_case is null or not public.is_active_pfleger_client(subject_case) then
    raise exception 'Wählen Sie einen aktiven ambulanten Pflegefall.' using errcode='42501';
  end if;
  perform 1 from public.clients c where c.id=subject_case and c.tenant_id=tenant and c.deleted_at is null for share;
  if not found then
    raise exception 'Wählen Sie einen aktiven ambulanten Pflegefall.' using errcode='42501';
  end if;
  perform 1 from public.client_module_assignments a where a.tenant_id=tenant and a.client_id=subject_case
    and a.module_key='pflege' and a.is_active and a.status not in ('inactive','deactivated','archiviert') for share;
  if not found or not public.is_active_pfleger_client(subject_case) then
    raise exception 'Die ambulante Pflegezuordnung wurde geändert.' using errcode='42501';
  end if;
  if request_id is null or pg_catalog.jsonb_typeof(p_document->'items') is distinct from 'array'
    or pg_catalog.octet_length(p_document::text)>400000
    or coalesce(pg_catalog.btrim(p_document->>'title'),'')='' or from_on is null or until_on<from_on
    or (existing_id is not null and coalesce(expected,0)<1) then
    raise exception 'Die Angaben zur Pflegeplanung sind unvollständig.' using errcode='23514';
  end if;
  if pg_catalog.jsonb_array_length(p_document->'items')>200 then
    raise exception 'In einer Planung sind bis zu 200 Maßnahmen möglich.' using errcode='23514';
  end if;

  -- The same draft request and concurrent revisions use the same lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':'||plan_id::text,0));
  select * into previous from public.care_plans q where q.tenant_id=tenant and q.id=plan_id for update;
  if previous.id is not null and previous.client_id!=subject_case then
    raise exception 'Die Pflegeplanung gehört zu einer anderen Akte.' using errcode='42501';
  end if;
  select * into receipt from public.care_plan_versions h where h.tenant_id=tenant and h.care_plan_id=plan_id
    and h.snapshot->>'editorRequestId'=request_id::text order by h.version desc limit 1;
  if receipt.id is not null then
    if receipt.actor_id is distinct from actor or receipt.snapshot->>'editorFingerprint' is distinct from fingerprint then
      raise exception 'Dieser Speichervorgang enthält abweichende Daten.' using errcode='23514';
    end if;
    return pg_catalog.jsonb_build_object('id',plan_id,'version',receipt.version);
  end if;
  if (existing_id is null and previous.id is not null)
    or (existing_id is not null and (previous.id is null or previous.status='archived' or coalesce(previous.version,1)!=expected)) then
    raise exception 'Diese Planung wurde geändert. Bitte laden Sie die aktuelle Version.' using errcode='40001';
  end if;
  if source_id is not null and (previous.id is null or previous.source_assessment_id is distinct from source_id)
    and not exists(select 1 from public.care_assessments a where a.id=source_id and a.tenant_id=tenant
      and a.subject_id=subject_case and a.subject_type='client' and a.variant='ambulant' and a.status='approved') then
    raise exception 'Die freigegebene Informationssammlung gehört nicht zu diesem Pflegefall.' using errcode='42501';
  end if;
  if nurse_id is not null and (previous.id is null or previous.primary_nurse_id is distinct from nurse_id)
    and not exists(select 1 from public.employees e where e.id=nurse_id and e.tenant_id=tenant) then
    raise exception 'Die zuständige Person gehört nicht zu diesem Mandanten.' using errcode='42501';
  end if;
  select coalesce(nullif(pg_catalog.btrim(p.display_name),''),'Pflegefachperson') into actor_label
    from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active and p.status='active';
  if not found then
    raise exception 'Das zuständige Pflegeprofil ist nicht aktiv.' using errcode='42501';
  end if;

  if previous.id is null then
    insert into public.care_plans(id,tenant_id,client_id,title,description,goals,resources,risks,valid_from,valid_until,
      source_assessment_id,primary_nurse_id,status,version,created_by,updated_by,planning_model)
    values(plan_id,tenant,subject_case,pg_catalog.btrim(p_document->>'title'),coalesce(p_document->>'description',''),
      coalesce(p_document->>'goals',''),coalesce(p_document->>'resources',''),coalesce(p_document->>'risks',''),from_on,until_on,
      source_id,nurse_id,'draft',1,actor,actor,p_document->>'planningModel') returning * into saved;
  else
    select pg_catalog.jsonb_build_object('plan',pg_catalog.to_jsonb(previous),'items',coalesce(pg_catalog.jsonb_agg(i order by i.sort_order,i.id),'[]'))
      into before_state from public.care_plan_items i where i.tenant_id=tenant and i.care_plan_id=plan_id;
    update public.care_plans q set title=pg_catalog.btrim(p_document->>'title'), description=coalesce(p_document->>'description',''),
      goals=coalesce(p_document->>'goals',''), resources=coalesce(p_document->>'resources',''), risks=coalesce(p_document->>'risks',''),
      valid_from=from_on, valid_until=until_on, source_assessment_id=source_id, primary_nurse_id=nurse_id,
      planning_model=p_document->>'planningModel', version=coalesce(previous.version,1)+1, updated_by=actor, updated_at=pg_catalog.clock_timestamp()
    where q.tenant_id=tenant and q.id=plan_id returning * into saved;
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(p_document->'items') loop
    item_id:=(item->>'id')::uuid;
    item_status:=coalesce(item->>'status','active')::public.care_plan_item_status;
    if pg_catalog.jsonb_typeof(item)!='object' or coalesce(pg_catalog.btrim(item->>'title'),'')=''
      or not care_private.valid_ambulatory_plan_activity(nullif(item->'activity','null'::jsonb)) then
      raise exception 'Eine Maßnahme oder deren Terminangaben sind unvollständig.' using errcode='23514';
    end if;
    if item_id is not null and (item_id=any(seen) or previous.id is null or not exists (
      select 1 from public.care_plan_items t where t.id=item_id and t.tenant_id=tenant and t.care_plan_id=plan_id and t.status!='cancelled'
    )) then
      raise exception 'Eine Maßnahme gehört nicht mehr zur aktuellen Planung.' using errcode='40001';
    end if;
    item_id:=coalesce(item_id,pg_catalog.gen_random_uuid());
    seen:=pg_catalog.array_append(seen,item_id);
    insert into public.care_plan_items(id,tenant_id,care_plan_id,title,category,description,goal,intervention,frequency,
      timing,responsible_role,person_contribution,relatives_contribution,warning_signs,escalation_path,evaluation_criteria,
      evaluation_interval_days,next_evaluation_date,status,sort_order,notes,created_by,updated_by,planning_activity)
    values(item_id,tenant,plan_id,pg_catalog.btrim(item->>'title'),nullif(item->>'category',''),nullif(item->>'description',''),
      nullif(item->>'goal',''),nullif(item->>'intervention',''),nullif(item->>'frequency',''),nullif(item->>'timing',''),
      nullif(item->>'responsibleRole',''),nullif(item->>'personContribution',''),nullif(item->>'relativesContribution',''),
      nullif(item->>'warningSigns',''),nullif(item->>'escalationPath',''),nullif(item->>'evaluationCriteria',''),
      (item->>'evaluationIntervalDays')::integer,(item->>'nextEvaluationAt')::date,item_status,cardinality(seen)-1,
      nullif(item->>'notes',''),actor,actor,nullif(item->'activity','null'::jsonb))
    on conflict(id) do update set title=excluded.title, category=excluded.category, description=excluded.description,
      goal=excluded.goal, intervention=excluded.intervention, frequency=excluded.frequency, timing=excluded.timing,
      responsible_role=excluded.responsible_role, person_contribution=excluded.person_contribution,
      relatives_contribution=excluded.relatives_contribution, warning_signs=excluded.warning_signs,
      escalation_path=excluded.escalation_path, evaluation_criteria=excluded.evaluation_criteria,
      evaluation_interval_days=excluded.evaluation_interval_days,next_evaluation_date=excluded.next_evaluation_date,
      status=excluded.status,sort_order=excluded.sort_order,notes=excluded.notes,updated_by=actor,updated_at=pg_catalog.clock_timestamp(),
      planning_activity=excluded.planning_activity
    where care_plan_items.tenant_id=tenant and care_plan_items.care_plan_id=plan_id;
    if not found then raise exception 'Die Maßnahme konnte nicht eindeutig zugeordnet werden.' using errcode='40001'; end if;
  end loop;

  update public.care_plan_items t set status='cancelled', updated_by=actor, updated_at=pg_catalog.clock_timestamp()
    where t.tenant_id=tenant and t.care_plan_id=plan_id and not (t.id=any(seen)) and t.status in ('active','paused');
  select pg_catalog.jsonb_build_object('plan',pg_catalog.to_jsonb(saved),'items',coalesce(pg_catalog.jsonb_agg(i order by i.sort_order,i.id),'[]'))
    into after_state from public.care_plan_items i where i.tenant_id=tenant and i.care_plan_id=plan_id;
  insert into public.care_plan_versions(tenant_id,care_plan_id,version,snapshot,reason,actor_id,actor_name)
    values(tenant,plan_id,saved.version,after_state||pg_catalog.jsonb_build_object('editorRequestId',request_id,'editorFingerprint',fingerprint),
      case when previous.id is null then 'created' else 'updated' end,actor,actor_label);
  insert into public.care_audit_events(tenant_id,client_id,care_plan_id,entity_type,entity_id,action,summary,before_data,after_data,actor_id,actor_name)
    values(tenant,subject_case,plan_id,'care_plan',plan_id,case when previous.id is null then 'created' else 'updated' end,
      case when previous.id is null then 'Pflegeplan angelegt' else 'Pflegeplan fortgeschrieben' end,before_state,after_state,actor,actor_label);
  return pg_catalog.jsonb_build_object('id',saved.id,'version',saved.version);
end;
$$;

create function public.write_ambulatory_care_plan(p_document jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select care_private.write_ambulatory_care_plan(p_document)
$$;

revoke all on function care_private.write_ambulatory_care_plan(jsonb),public.write_ambulatory_care_plan(jsonb) from public,anon;
grant execute on function care_private.write_ambulatory_care_plan(jsonb),public.write_ambulatory_care_plan(jsonb) to authenticated;

commit;
