-- Run only on staging in the same transaction as prepare-wound-record-release.mjs,
-- before the final ROLLBACK. Exercise the production-style RLS as authenticated.
create temporary table wound_release_fixture (
  tenant uuid, actor uuid, client uuid, wound uuid, assessment uuid, photo uuid, article uuid, claims jsonb
) on commit drop;
grant select on wound_release_fixture to authenticated;

do $fixture$
declare
  t uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  r uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  other_client uuid := gen_random_uuid();
  view_uid uuid := gen_random_uuid();
  view_role uuid := gen_random_uuid();
  view_session uuid := gen_random_uuid();
  w uuid;
  case_request uuid := gen_random_uuid();
  case_payload jsonb;
  statistics jsonb;
  day date := (clock_timestamp() at time zone 'Europe/Berlin')::date;
  initial_mark jsonb := '{"name":"Linke Ferse","kind":"Wunde","text":"","figure":"older-woman","focusRegion":"foot","side":"left","target":[0,0,0],"point":[0,0.2,0.1],"yaw":0,"pitch":0,"height":1,"detailAngle":0,"anatomyIndex":0,"clinical":false}';
  assessment_id uuid;
  photo_id uuid := gen_random_uuid();
  article_id uuid := gen_random_uuid();
  observed timestamptz := date_trunc('second', clock_timestamp() - interval '1 day');
  consent_id uuid := gen_random_uuid();
  auth_claims jsonb;
  photo jsonb;
  upload_path text;
  doc jsonb;
  assessment_doc jsonb;
begin
  insert into public.tenants(id,name) values(t,'Wundakte V10 release fixture');
  insert into public.roles(id,key,name) values(r,'wound_release_'||r,'Wundakte synthetic editor'),
    (view_role,'wound_release_view_'||view_role,'Wundakte synthetic reader');
  insert into public.role_permissions(role_id,permission_key)
    select r,unnest(array['pflege.access','pflege.wounds.view','pflege.wounds.manage','pflege.orders.view']);
  insert into public.role_permissions(role_id,permission_key)
    values(view_role,'pflege.access'),(view_role,'pflege.wounds.view');
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(a,a||'@example.invalid','{}','{}'),(view_uid,view_uid||'@example.invalid','{}','{}');
  update public.profiles set tenant_id=t,role_id=r,role_key='pfleger',is_active=true,status='active',
    display_name='Synthetische Pflegekraft' where id=a;
  update public.profiles set tenant_id=t,role_id=view_role,role_key='pfleger',is_active=true,status='active',
    display_name='Synthetische Lesekraft' where id=view_uid;
  insert into auth.sessions(id,user_id,not_after,aal)
    values(s,a,clock_timestamp()+interval '2 hours','aal2'),
    (view_session,view_uid,clock_timestamp()+interval '2 hours','aal2');
  insert into public.clients(id,tenant_id,first_name,last_name,status,date_of_birth)
    values(c,t,'Synthetisch','Prüffall','aktiv','1960-01-01'),
      (other_client,t,'Synthetisch','Zweite Pflegeakte','aktiv','1980-01-01');
  insert into public.client_module_assignments(tenant_id,client_id,module_key,status,is_active)
    values(t,c,'pflege','active',true),(t,other_client,'pflege','active',true);
  insert into public.client_consents(id,tenant_id,client_id,title,scope,consent_type,granted,granted_at)
    values(consent_id,t,c,'Synthetische Fotofreigabe','own','foto_video',true,observed-interval '1 day');
  auth_claims := jsonb_build_object('sub',a,'role','authenticated','session_id',s,'aal','aal2',
    'exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint);
  perform set_config('request.jwt.claims',auth_claims::text,true);

  doc := jsonb_build_object(
    'bodyLocation','Linke Ferse','side','left','woundType','Synthetischer Befund',
    'etiology','Unbekannt im synthetischen Test','onsetDate','','onsetUnknownReason','Synthetischer Fall',
    'acquiredWhere','Unbekannt im synthetischen Test','description','Synthetische Aufnahme',
    'basisStatus','pending','basisReference','Synthetische ärztliche Grundlage offen','physician','',
    'carePlan','Synthetischer Vermerk','nextReviewAt','','reviewStatus','pending','reviewPendingReason','Synthetischer Termin offen'
  );
  assessment_doc := jsonb_build_object(
    'observedAt',to_char(observed at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'measurementMethod','Synthetisch','lengthState','measured','lengthCm','1.25','lengthReason','',
    'widthState','not_measurable','widthCm','','widthReason','Synthetisch nicht messbar',
    'depthState','not_measurable','depthCm','','depthReason','Synthetisch nicht messbar',
    'woundBed','Synthetisch','exudate','Synthetisch','odor','Synthetisch','woundEdge','Synthetisch',
    'surroundingSkin','Synthetisch','painState','not_assessable','painScore','','painReason','Synthetisch',
    'infectionObservation','Synthetisch','personalImpact','Synthetisch','preferences','Synthetisch',
    'selfManagement','Synthetisch','actualAction','Synthetisch','response','Synthetisch',
    'nextReviewAt','','reviewStatus','pending','reviewPendingReason','Synthetisch'
  );

  set local role authenticated;
  case_payload := jsonb_build_object('action','create','subjectId',c,'dataJson',doc::text);
  begin
    perform public.create_ambulatory_wound_with_location(case_request,case_payload,initial_mark || '{"name":"Andere Stelle"}');
    raise exception 'Widersprüchliche Lokalisation übernommen';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from public.clinical_wound_cases where client_id=c) then
    raise exception 'Teilweise Anlage eines Wundfalls';
  end if;
  w := public.create_ambulatory_wound_with_location(case_request,case_payload,initial_mark);
  if public.create_ambulatory_wound_with_location(case_request,case_payload,initial_mark) is distinct from w
    or (select count(*) from public.ambulatory_wound_clinical_entries
      where wound_case_id=w and kind='body_mark' and payload=initial_mark) <> 1 then
    raise exception 'Markierung fehlt oder wurde beim Wiederholen verdoppelt';
  end if;
  begin
    perform public.create_ambulatory_wound_with_location(case_request,case_payload,initial_mark || '{"point":[0,0.3,0.1]}');
    raise exception 'Markierung derselben Anfrage überschrieben';
  exception when invalid_parameter_value then null;
  end;
  statistics := public.read_wound_statistics_for_client(t,a,day,day,other_client);
  if statistics->>'total' is distinct from '0' then
    raise exception 'Pflegeakte ohne Wundfall enthält fremde Fälle';
  end if;
  perform public.write_ambulatory_wound_documentation(gen_random_uuid(),
    jsonb_build_object('action','create','subjectId',other_client,
      'dataJson',(doc || '{"woundType":"Weiterer synthetischer Befund"}')::text));
  statistics := public.read_wound_statistics_for_client(t,a,day,day,c);
  if statistics->>'total' is distinct from '1' or statistics->>'people' is distinct from '1'
     or statistics->'types' is distinct from '{"Synthetischer Befund":1}'::jsonb then
    raise exception 'Klientenfilter stellt keine eindeutige Teilmenge dar';
  end if;
  statistics := public.read_wound_statistics(t,a,day,day);
  if statistics->>'total' is distinct from '2' or statistics->>'people' is distinct from '2' then
    raise exception 'Gesamtstatistik hat einen Klienten ausgeblendet';
  end if;
  begin
    perform public.read_wound_statistics_for_client(t,a,day,day,gen_random_uuid());
    raise exception 'Klientenfilter hat einen unzugänglichen Bezug akzeptiert';
  exception when insufficient_privilege then null;
  end;
  assessment_id := public.write_ambulatory_wound_documentation(gen_random_uuid(),
    jsonb_build_object('action','assessment','subjectId',w,'dataJson',assessment_doc::text));
  perform public.write_wound_record_entry(t,a,c,w,gen_random_uuid(),'note',observed,
    '{"description":"Synthetischer Eintrag"}');
  perform public.save_wound_catalog_item(t,a,jsonb_build_object('id',article_id,'kind','article',
    'name','Synthetischer Artikel','unit','Stück','unit_cents',100));
  perform public.read_wound_record_context(t,a,c,w);
  photo := public.prepare_wound_media(t,a,c,w,jsonb_build_object('id',photo_id,'kind','wound_photo',
    'name','synthetischer-befund.png','mime','image/png','size',64,'digest',repeat('a',64),
    'observedAt',observed,'assessmentId',assessment_id,'consentId',consent_id));
  upload_path := photo->>'path';
  if photo->>'state' is distinct from 'pending' or upload_path is null then
    raise exception 'Fotoaufnahme nicht vorbereitet';
  end if;
  begin
    perform public.complete_wound_media(t,a,c,w,photo_id);
    raise exception 'Fehlende Fotodatei akzeptiert';
  exception when invalid_parameter_value then null;
  end;
  insert into storage.objects(bucket_id,name,owner_id,metadata)
    values('pflege-wound-media',upload_path,a::text,'{"size":64,"mimetype":"image/png"}');
  if public.complete_wound_media(t,a,c,w,photo_id) is distinct from photo_id then
    raise exception 'Dateizuordnung nicht bestätigt';
  end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',view_uid,'role','authenticated',
    'session_id',view_session,'aal','aal2','exp',extract(epoch from clock_timestamp()+interval '1 hour')::bigint)::text,true);
  begin
    perform public.write_wound_record_entry(t,view_uid,c,w,gen_random_uuid(),'note',observed,
      '{"description":"Synthetischer unerlaubter Eintrag"}');
    raise exception 'Leser durfte schreiben';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_ambulatory_wound_with_location(gen_random_uuid(),case_payload,initial_mark);
    raise exception 'Leser durfte Wundfall mit Markierung anlegen';
  exception when insufficient_privilege then null;
  end;
  reset role;
  insert into wound_release_fixture values(t,a,c,w,assessment_id,photo_id,article_id,auth_claims);
end
$fixture$;

set local transaction_read_only = on;
do $read_claims$
begin
  perform set_config('request.jwt.claims', claims::text, true) from wound_release_fixture;
end
$read_claims$;
set local role authenticated;
do $read$
declare f wound_release_fixture%rowtype;
begin
  select * into strict f from wound_release_fixture;
  if current_setting('transaction_read_only') is distinct from 'on' then
    raise exception 'Lesetest lief in einer schreibfähigen Transaktion';
  end if;
  if not exists(select 1 from public.ambulatory_wound_clinical_entries where wound_case_id=f.wound)
    or not exists(select 1 from public.ambulatory_wound_clinical_entries
      where wound_case_id=f.wound and kind='body_mark' and payload->>'name'='Linke Ferse')
    or not exists(select id from public.ambulatory_wound_media where id=f.photo and state='ready')
    or not exists(select 1 from public.ambulatory_wound_catalog where id=f.article)
    or not exists(select 1 from public.ambulatory_wound_photo_links where id=f.photo)
    or not exists(select 1 from storage.objects where bucket_id='pflege-wound-media'
      and name=f.tenant||'/'||f.client||'/'||f.photo) then
    raise exception 'Authentifizierter Lesepfad unvollständig';
  end if;
  perform 1 from public.ambulatory_wound_lifecycle_events where wound_case_id=f.wound;
  perform 1 from public.ambulatory_wound_assessment_corrections where wound_case_id=f.wound;
end
$read$;
reset role;
select 'wound_v10_read_write_and_media_verified' as check_name;
