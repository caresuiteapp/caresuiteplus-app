-- Execute only with the reviewed migrations and representative ambulatory access on a test database.
begin;
do $test$
declare
  t uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); fixture_role uuid:=gen_random_uuid();
  actor uuid:=gen_random_uuid(); sess uuid:=gen_random_uuid(); req uuid:=gen_random_uuid();
  read_result jsonb; first_item uuid; plan jsonb; revised jsonb; v_last jsonb; breathe uuid:=gen_random_uuid();
begin
  insert into public.tenants(id,name) values(t,'Synthetischer Pflegeplan-Test');
  insert into public.roles(id,key,name) values(fixture_role,'synthetic_planner_'||fixture_role,'Synthetische Pflegerolle');
  insert into public.role_permissions(role_id,permission_key)
    select fixture_role,unnest(array['pflege.plans.view','pflege.plans.manage','pflege.vitals.view','pflege.vitals.manage']);
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values(actor,actor||'@example.invalid','{}','{}');
  update public.profiles p set tenant_id=t,role_id=fixture_role,role_key='pfleger',is_active=true,status='active',display_name='Synthetische Fachkraft'
    where p.id=actor;
  insert into auth.sessions(id,user_id,not_after) values(sess,actor,clock_timestamp()+interval '1 hour');
  insert into public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status) values(c,t,'Anika','Testfall','active','aktiv');
  insert into public.client_module_assignments(tenant_id,client_id,module_key,status,is_active) values(t,c,'pflege','active',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','session_id',sess)::text,true);
  assert public.current_tenant_id()=t and public.resolve_current_profile_id()=actor;
  assert public.has_permission('pflege.plans.manage') and public.has_permission('pflege.vitals.manage');
  set local role authenticated;
  plan:=jsonb_build_object('requestId',req,'clientId',c,'title','Synthetischer Pflegeplan','planningModel','roper','validFrom','2026-11-17',
    'description','Individuelle Unterstützung im Tagesverlauf','goals','Selbstständigkeit beim Trinken erhalten',
    'items',jsonb_build_array(jsonb_build_object('title','Individuelles Trinkangebot','goal','Angebot erreichbar halten',
      'activity','{"kind":"drinking","days":[1,4],"times":["08:30","13:00"],"subject":"Individuell vereinbartes Angebot","equipment":"Becher","offeredMl":125}'::jsonb)));
  read_result:=public.write_ambulatory_care_plan(plan);
  assert read_result=jsonb_build_object('id',req,'version',1);
  assert public.write_ambulatory_care_plan(plan)=read_result;
  reset role;
  select id into first_item from public.care_plan_items where care_plan_id=req and tenant_id=t;
  assert first_item is not null;
  assert (select count(*) from public.care_plan_versions where care_plan_id=req)=1;
  assert exists(select 1 from public.care_plans where id=req and planning_model='roper' and status='draft');
  revised:=plan||jsonb_build_object('id',req,'requestId',gen_random_uuid(),'expectedVersion',1,
    'items',jsonb_build_array((plan->'items'->0)||jsonb_build_object('id',first_item,'notes','Fortgeschriebene Bemerkung'),
      '{"title":"Individuelle Positionierung","activity":{"kind":"positioning","days":[2],"times":["16:00"],"subject":"Abgesprochene Position","equipment":"Individuelle Unterlage","offeredMl":null}}'::jsonb));
  set local role authenticated;
  assert public.write_ambulatory_care_plan(revised)=jsonb_build_object('id',req,'version',2);
  begin
    perform public.write_ambulatory_care_plan(jsonb_set(revised,'{requestId}',to_jsonb(gen_random_uuid())));
    raise exception 'Veraltete Version unerwartet gespeichert';
  exception when serialization_failure then null;
  end;
  reset role;
  assert exists(select 1 from public.care_plan_items where id=first_item and notes='Fortgeschriebene Bemerkung'
    and (planning_activity->>'offeredMl')::integer=125);
  assert exists(select 1 from public.care_audit_events where care_plan_id=req and action='updated'
    and jsonb_array_length(before_data->'items')=1 and jsonb_array_length(after_data->'items')=2);

  v_last:=revised||jsonb_build_object('requestId',gen_random_uuid(),'expectedVersion',2,'items','[]'::jsonb);
  set local role authenticated;
  assert public.write_ambulatory_care_plan(v_last)=jsonb_build_object('id',req,'version',3);
  insert into public.care_plan_respiratory_assessments
    (id,tenant_id,care_plan_id,observed_on,instrument,instrument_version,score,maximum,findings)
    values(breathe,t,req,current_date,'Synthetische Atemskala','Testfassung',2.5,10,'Pflegefachliche Beobachtung für den Test.');
  assert exists(select 1 from public.care_plan_respiratory_assessments where id=breathe and score=2.5 and created_by=actor);
  begin
    update public.care_plan_respiratory_assessments set score=0 where id=breathe;
    raise exception 'Erhebung unerwartet überschrieben';
  exception when insufficient_privilege then null;
  end;
  reset role;
  assert exists(select 1 from public.care_plan_items where id=first_item and status='cancelled');
end;
$test$;
select 'Pflegeplan wiederholbar gespeichert, Maßnahmen-ID behalten, Revisionen gesichert und Atemwert geschrieben' as result;
rollback;
