-- Synthetic data only. All records are rolled back.
begin;
do $test$
declare
  tenant uuid:=gen_random_uuid(); client uuid:=gen_random_uuid(); foreign_client uuid:=gen_random_uuid();
  staff uuid:=gen_random_uuid(); session uuid:=gen_random_uuid(); staff_role uuid:=gen_random_uuid();
  root uuid:=gen_random_uuid(); request_id uuid:=gen_random_uuid();
  entry jsonb; doc jsonb; receipt jsonb; history jsonb;
begin
  insert into public.tenants(id,name) values(tenant,'Synthetischer Protokoll-Test');
  insert into public.roles(id,key,name) values(staff_role,'fixture_documentation_'||staff_role,'Synthetische Rolle');
  insert into public.role_permissions(role_id,permission_key)
    select staff_role,unnest(array['pflege.documentation.view','pflege.documentation.create']);
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values(staff,staff||'@example.invalid','{}','{}');
  update public.profiles p set tenant_id=tenant,role_id=staff_role,is_active=true,status='active',display_name='Synthetische Fachkraft'
    where p.id=staff;
  insert into auth.sessions(id,user_id,not_after) values(session,staff,clock_timestamp()+interval '1 hour');
  insert into public.clients(id,tenant_id,first_name,last_name,status,lifecycle_status)
    values(client,tenant,'Nora','Testfall','active','aktiv'),(foreign_client,tenant,'Anderer','Testfall','active','aktiv');
  insert into public.client_module_assignments(tenant_id,client_id,module_key,status,is_active)
    values(tenant,client,'pflege','active',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',staff,'role','authenticated','session_id',session)::text,true);
  entry:='{"kind":"drink","description":"Vereinbartes Getränk","outcome":"taken","support":"independent",
    "reason":"","source":"observed","reportedBy":"","observation":"Eigenständig aufgenommen","reaction":"Besprochen",
    "reviewState":"pending","reviewAt":"","reviewReason":"Beim nächsten Einsatz absprechen",
    "offered":{"state":"measured","value":"150","unit":"ml","basis":"Messbecher"},
    "actual":{"state":"measured","value":"120","unit":"ml","basis":"Rest abgelesen"}}'::jsonb ||
    jsonb_build_object('occurredAt',to_char((clock_timestamp()-interval '1 minute') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  doc:=jsonb_build_object('version','2026-10-09.1','clientId',client,'rootId',root,'expectedHeadId','',
    'draft',jsonb_build_object('action','record','entry',entry,'reason',''));
  set local role authenticated;
  assert (public.read_daily_protocol_clients(tenant)->>'count')::int=1;
  assert (public.read_daily_protocols(tenant,client)->>'count')::int=0;
  begin
    perform public.read_daily_protocols(tenant,foreign_client);
    raise exception 'Nicht zugeordnete Akte lieferte Protokolle.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.write_daily_protocol_event(request_id,jsonb_set(doc,'{clientId}',to_jsonb(foreign_client)));
    raise exception 'Nicht zugeordnete Akte akzeptierte einen Eintrag.';
  exception when insufficient_privilege then null;
  end;
  receipt:=public.write_daily_protocol_event(request_id,doc);
  assert receipt->>'sequence'='1';
  assert public.write_daily_protocol_event(request_id,doc)=receipt;
  history:=public.read_daily_protocols(tenant,client);
  assert history#>>'{records,0,events,0,draft,entry,actual,value}'='120';
  doc:=doc||jsonb_build_object('expectedHeadId',receipt->>'id','draft',
    jsonb_build_object('action','replace','entry',jsonb_set(entry,'{actual,value}','"125"'),'reason','Messwert bestätigt'));
  assert public.write_daily_protocol_event(gen_random_uuid(),doc)->>'sequence'='2';
  history:=public.read_daily_protocols(tenant,client);
  assert history#>>'{records,0,events,0,draft,entry,actual,value}'='120'
    and history#>>'{records,0,events,1,draft,entry,actual,value}'='125';
  assert not has_table_privilege('authenticated','public.care_protocol_events','select');
  assert not has_function_privilege('anon','public.read_daily_protocols(uuid,uuid)','execute');
end;
$test$;
select 'Protokollrecht, Aufnahme und Berichtigung bestätigt' as result;
rollback;
