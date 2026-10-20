-- Prepared, NOT applied. Web/Desktop only. No legacy writer or Android contract is replaced.
-- Dependencies: existing client/contact/risk/document schema and clinical_control_tasks.sql
-- plus its already prepared protocol/evaluation source extensions. Native PostgreSQL/RLS
-- and two-session race verification remain release gates; no production data tests.
begin;
create schema if not exists care_handover_private;
revoke all on schema care_handover_private from public,anon,authenticated;

create table if not exists care_handover_private.roots (
 id uuid primary key, tenant_id uuid not null references public.tenants(id), client_id uuid not null references public.clients(id),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null,
 head_id uuid, revision_count integer not null default 0, closed boolean not null default false,
 unique(id,tenant_id,client_id)
);
create table if not exists care_handover_private.events (
 id uuid primary key, tenant_id uuid not null, client_id uuid not null, handover_id uuid not null,
 sequence integer not null check(sequence>0), request_id uuid not null, kind text not null check(kind in('publish','acknowledge','close')),
 head_id uuid not null, actor_id uuid not null references public.profiles(id), actor_name text not null,
 recorded_at timestamptz not null, command jsonb not null check(jsonb_typeof(command)='object' and octet_length(command::text)<=750000),
 foreign key(handover_id,tenant_id,client_id) references care_handover_private.roots(id,tenant_id,client_id),
 foreign key(head_id) references care_handover_private.events(id) deferrable initially deferred,
 unique(tenant_id,request_id),unique(handover_id,sequence)
);
create unique index if not exists case_handover_own_ack on care_handover_private.events(head_id,actor_id) where kind='acknowledge';
create index if not exists case_handover_case on care_handover_private.roots(tenant_id,client_id,created_at,id);
alter table care_handover_private.roots enable row level security;
alter table care_handover_private.events enable row level security;
revoke all on all tables in schema care_handover_private from public,anon,authenticated;

create or replace function care_handover_private.immutable() returns trigger
language plpgsql set search_path='' as $$begin raise exception using errcode='23514',message='Übergabebelege bleiben unveränderlich.';end$$;
drop trigger if exists case_handover_immutable on care_handover_private.events;
create trigger case_handover_immutable before update or delete on care_handover_private.events for each row execute function care_handover_private.immutable();

-- Mirrors the existing Web role_permission_sets override contract, using native role_id.
-- This helper cannot be called by application roles. Actor checks additionally use has_permission.
create or replace function care_handover_private.profile_has(p_tenant uuid,p_profile uuid,p_keys text[]) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from public.profiles p join public.roles r on r.id=p.role_id
  where p.id=p_profile and p.tenant_id=p_tenant and p.is_active and p.status='active'
   and r.key in('business_admin','business_manager','nurse','caregiver','counselor','billing','dispatch','akademie_admin')
   and not exists(select 1 from unnest(p_keys) k where not case
    when exists(select 1 from public.role_permission_sets z where z.tenant_id=p_tenant and z.role_key=r.key)
    then exists(select 1 from public.role_permission_sets z where z.tenant_id=p_tenant and z.role_key=r.key and z.permission_key=k)
    else exists(select 1 from public.role_permissions z where z.role_id=r.id and z.permission_key=k) end))
$$;
create or replace function care_handover_private.base_keys() returns text[] language sql immutable set search_path='' as $$
 select array['office.clients.view','office.documents.view','pflege.handovers.view','pflege.documentation.view','pflege.treatment.view','pflege.orders.view','pflege.risks.view']::text[]
$$;
create or replace function care_handover_private.authorize(p_tenant uuid,p_actor uuid,p_client uuid,p_write boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid; key text;
begin
 if auth.uid() is null or p_actor is distinct from auth.uid() or p_actor is distinct from public.resolve_current_profile_id()
  or p_tenant is distinct from public.current_tenant_id() or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())
  then raise exception using errcode='42501',message='Aktuelles eigenes Konto fehlt.';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 perform 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>clock_timestamp()) for share;
 if not found then raise exception using errcode='42501',message='Aktuelle native Sitzung fehlt.';end if;
 if p_write then
  -- Permissions are rare administrative writes; hold their existing rows and gaps stable
  -- for this short transaction, including insertion/deletion of a tenant override.
  lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;
 end if;
 perform 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=p_actor and p.tenant_id=p_tenant
  and p.is_active and p.status='active' and (p.auth_user_id is null or p.auth_user_id=p_actor)
  and r.key in('business_admin','business_manager','nurse','caregiver','counselor','billing','dispatch','akademie_admin') for share of p,r;
 if not found or not care_handover_private.profile_has(p_tenant,p_actor,care_handover_private.base_keys()||case when p_write then array['pflege.handovers.manage'] else array[]::text[] end)
  then raise exception using errcode='42501',message='Aktuelle Akten- und Übergaberechte fehlen.';end if;
 foreach key in array care_handover_private.base_keys()||case when p_write then array['pflege.handovers.manage'] else array[]::text[] end loop
  if public.has_permission(key) is not true then raise exception using errcode='42501',message='Nativer Rechtezugang fehlt.';end if;
 end loop;
 if p_client is not null then
  perform care_private.assert_control_access(p_tenant,p_client);
  perform 1 from public.clients c where c.id=p_client and c.tenant_id=p_tenant and c.status='active' and c.deleted_at is null
   and (c.sensitivity<>'restricted' or public.has_permission('office.clients.view_sensitive') and care_handover_private.profile_has(p_tenant,p_actor,array['office.clients.view_sensitive'])) for no key update;
  if not found then raise exception using errcode='42501',message='Aktive eigene Pflegeakte fehlt.';end if;
 end if;
end$$;

create or replace function care_handover_private.client_row(p_tenant uuid,p_client uuid) returns jsonb
language sql stable set search_path='' as $$
 select (select jsonb_object_agg(j.key,j.value) from jsonb_each(to_jsonb(c)) j
  where j.key=any(array['id','tenant_id','first_name','last_name','date_of_birth','birth_date','street','house_number','zip','postal_code','city','phone','primary_contact_phone','sensitivity','status','updated_at']))
 from public.clients c where c.id=p_client and c.tenant_id=p_tenant and c.status='active' and c.deleted_at is null
$$;
create or replace function care_handover_private.person(p_tenant uuid,p_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id::text,'tenantId',p.tenant_id::text,'name',coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt'),
  'roleKey',r.key,'updatedAt',to_char(p.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
 from public.profiles p join public.roles r on r.id=p.role_id where p.id=p_id and p.tenant_id=p_tenant and p.is_active and p.status='active'
  and r.key in('business_admin','business_manager','nurse','caregiver','counselor')
  and care_handover_private.profile_has(p_tenant,p.id,care_handover_private.base_keys()||array['pflege.handovers.manage'])
$$;
create or replace function care_handover_private.source_keys(s jsonb) returns text[]
language plpgsql immutable set search_path='' as $$begin
 return case s->>'kind'
 when 'treatment_execution' then array['pflege.treatment.view','pflege.medications.view','pflege.vitals.view']||case when s->'snapshot'->>'treatment_type'='wound_dressing' then array['pflege.wounds.view'] else array[]::text[] end
 when 'infusion_event' then array['pflege.treatment.view','pflege.orders.view']
 when 'wound_assessment' then array['pflege.wounds.view'] when 'medication_administration' then array['pflege.medications.view']
 when 'vital_measurement' then array['pflege.vitals.view'] when 'care_plan' then array['pflege.plans.view']
 when 'plan_evaluation' then array['pflege.plans.view'] when 'protocol_event' then array['pflege.documentation.view']
 when 'pflege_report' then array['pflege.documentation.view'] else array['__unknown_handover_source__'] end;
end$$;
create or replace function care_handover_private.task_record(p_tenant uuid,p_client uuid,p_task uuid) returns jsonb
language plpgsql set search_path='' as $$declare t public.care_control_tasks%rowtype; answer jsonb;
begin
 select * into t from public.care_control_tasks x where x.id=p_task and x.tenant_id=p_tenant and x.client_id=p_client;
 if not found or care_private.control_task_readable(t.id,p_tenant,p_client) is not true then raise exception using errcode='42501',message='Vollständiger Originalauftrag nicht zugänglich.';end if;
 select jsonb_build_object('task',jsonb_build_object('id',t.id::text,'tenantId',t.tenant_id::text,'clientId',t.client_id::text,'version',t.version),
  'headId',(array_agg(e.id::text order by e.sequence desc))[1],'eventCount',count(*),
  'actorNames',jsonb_object_agg(e.id::text,e.actor_name),
  'events',jsonb_agg(jsonb_build_object('id',e.id::text,'taskId',e.task_id::text,'tenantId',e.tenant_id::text,'clientId',e.client_id::text,
    'sequence',e.sequence,'previousId',coalesce(e.previous_id::text,''),'actorId',e.actor_id::text,'requestId',e.request_id::text,
    'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'draft',e.draft) order by e.sequence)) into answer
 from public.care_control_events e where e.task_id=t.id and e.tenant_id=p_tenant and e.client_id=p_client;
 if answer->>'headId' is null then raise exception using errcode='23514',message='Ursprünglicher Auftrag fehlt.';end if;
 return answer;
end$$;
create or replace function care_handover_private.task_state(r jsonb) returns jsonb
language plpgsql set search_path='' as $$declare e jsonb;s jsonb;h jsonb:='[]';seq integer:=0;head text:='';
begin
 for e in select x from jsonb_array_elements(r->'events') x loop
  if (e->>'sequence')::integer<>seq+1 or e->>'previousId'<>head then raise exception using errcode='23514',message='Auftragskette ist abgeschnitten.';end if;
  perform care_private.control_draft(r->'task',e->'draft',clock_timestamp());
  s:=care_private.control_fold(r->'task',e->'draft',(e->>'actorId')::uuid,(e->>'id')::uuid,s,h);
  h:=h||jsonb_build_array(jsonb_build_object('id',e->>'id','draft',e->'draft'));seq:=seq+1;head:=e->>'id';
 end loop;
 if r->>'headId'<>head or (r->>'eventCount')::integer<>seq then raise exception using errcode='23514',message='Auftragskopf stimmt nicht mit vollständigem Verlauf überein.';end if;
 return s;
end$$;

create or replace function care_handover_private.content_rights(p_tenant uuid,p_actor uuid,c jsonb,p_check_recipients boolean) returns void
language plpgsql set search_path='' as $$declare s jsonb;t jsonb;e jsonb;p jsonb;required text[]:=care_handover_private.base_keys();key text;
begin
 -- Historical metadata never downgrades a document's current stronger restriction.
 -- Original equality is checked at publication; history keeps its original version
 -- while current authorization also considers the native document's present scope.
 if c->'client'->>'sensitivity'='restricted'
  or exists(select 1 from jsonb_array_elements(c->'documents') x where x->'document'->>'sensitivity'='restricted')
  or exists(select 1 from public.client_documents d join jsonb_array_elements(c->'documents') x on d.id=(x->'document'->>'id')::uuid
    where d.tenant_id=p_tenant and d.client_id=(c->'client'->>'id')::uuid and d.sensitivity='restricted')
  then required:=required||array['office.clients.view_sensitive'];end if;
 for s in select x from jsonb_array_elements(c->'sources') x union all select x from jsonb_array_elements(c->'emergency'->'plans') x loop required:=required||care_handover_private.source_keys(s);end loop;
 for t in select x from jsonb_array_elements(c->'tasks') x loop
  for e in select x from jsonb_array_elements(t->'events') x loop
   foreach s in array array[e->'draft'->'source',e->'draft'->'evidence'] loop
    if s is not null and s<>'null'::jsonb then required:=required||care_handover_private.source_keys(s);end if;
   end loop;
  end loop;
 end loop;
 if not care_handover_private.profile_has(p_tenant,p_actor,required) then raise exception using errcode='42501',message='Rechte für einen vollständigen Originalbeleg fehlen.';end if;
 foreach key in array required loop if public.has_permission(key) is not true then raise exception using errcode='42501',message='Nativer Quellenzugang fehlt.';end if;end loop;
 if p_check_recipients then
  for p in select x from jsonb_array_elements(c->'recipients') x loop
   perform 1 from public.profiles z where z.id=(p->>'id')::uuid and z.tenant_id=p_tenant for share;
   if care_handover_private.person(p_tenant,(p->>'id')::uuid) is distinct from p
    or not care_handover_private.profile_has(p_tenant,(p->>'id')::uuid,required||array['pflege.handovers.manage'])
    then raise exception using errcode='42501',message='Empfangsperson oder deren vollständiger Aktenzugang ist nicht bestätigt.';end if;
  end loop;
 end if;
end$$;

create or replace function care_handover_private.context(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare cs jsonb;ts jsonb; answer jsonb;
begin
 perform care_handover_private.authorize(p_tenant_id,p_actor_id,p_client_id,false);
 cs:=care_private.read_clinical_control_sources(p_tenant_id,p_client_id);
 select coalesce(jsonb_agg(care_handover_private.task_record(p_tenant_id,p_client_id,t.id) order by t.id),'[]') into ts
 from public.care_control_tasks t where t.tenant_id=p_tenant_id and t.client_id=p_client_id and care_private.control_task_readable(t.id,p_tenant_id,p_client_id);
 answer:=jsonb_build_object('version','2026-10-16.1','tenantId',p_tenant_id::text,'actorId',p_actor_id::text,'clientId',p_client_id::text,
  'loadedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'client',care_handover_private.client_row(p_tenant_id,p_client_id),
  'contacts',(select jsonb_build_object('count',count(*),'rows',coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')) from public.client_contacts x where x.tenant_id=p_tenant_id and x.client_id=p_client_id),
  'risks',(select jsonb_build_object('count',count(*),'rows',coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')) from public.client_risks x where x.tenant_id=p_tenant_id and x.client_id=p_client_id),
  'documents',(select jsonb_build_object('count',count(*),'rows',coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')) from public.client_documents x where x.tenant_id=p_tenant_id and x.client_id=p_client_id
    and (x.sensitivity<>'restricted' or public.has_permission('office.clients.view_sensitive') and care_handover_private.profile_has(p_tenant_id,p_actor_id,array['office.clients.view_sensitive']))),
  'sources',cs->'sources','controls',ts,
  'recipients',(select jsonb_build_object('count',count(*),'rows',coalesce(jsonb_agg(v order by v->>'name',v->>'id'),'[]')) from (select care_handover_private.person(p_tenant_id,p.id) v from public.profiles p where p.tenant_id=p_tenant_id) q where v is not null));
 if octet_length(answer::text)>12000000 then raise exception using errcode='23514',message='Der vollständige Fallbestand überschreitet den lesbaren Umfang.';end if;
 return answer;
end$$;
create or replace function care_handover_private.clients(p_tenant_id uuid,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare answer jsonb;begin
 perform care_handover_private.authorize(p_tenant_id,p_actor_id,null,false);
 select jsonb_build_object('version','2026-10-16.1','tenantId',p_tenant_id::text,'actorId',p_actor_id::text,'count',count(*),
  'clients',coalesce(jsonb_agg(jsonb_build_object('id',c.id::text,'tenant_id',c.tenant_id::text,'first_name',c.first_name,'last_name',c.last_name) order by c.last_name,c.first_name,c.id),'[]')) into answer
 from public.clients c where c.tenant_id=p_tenant_id and c.status='active' and c.deleted_at is null and public.is_active_pfleger_client(c.id)
  and (c.sensitivity<>'restricted' or public.has_permission('office.clients.view_sensitive') and care_handover_private.profile_has(p_tenant_id,p_actor_id,array['office.clients.view_sensitive']));
 if (answer->>'count')::integer>10000 then raise exception using errcode='23514',message='Der vollständige Pflegefallbestand ist zu groß.';end if;return answer;
end$$;

create or replace function care_handover_private.event_json(e care_handover_private.events) returns jsonb
language sql stable set search_path='' as $$select jsonb_build_object('id',e.id::text,'requestId',e.request_id::text,'tenantId',e.tenant_id::text,'clientId',e.client_id::text,
 'handoverId',e.handover_id::text,'headId',e.head_id::text,'kind',e.kind,'actorId',e.actor_id::text,'actorName',e.actor_name,
 'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)$$;
create or replace function care_handover_private.receipt(e care_handover_private.events) returns jsonb
language sql stable set search_path='' as $$select jsonb_build_object('version','2026-10-16.1','requestId',e.request_id::text,'command',e.command,'event',care_handover_private.event_json(e))$$;
create or replace function care_handover_private.event_access(e care_handover_private.events,p_actor uuid) returns void
language plpgsql set search_path='' as $$declare c jsonb;begin
 if e.kind='publish' then c:=e.command->'content';
 else select x.command->'content' into c from care_handover_private.events x where x.id=e.head_id and x.handover_id=e.handover_id and x.tenant_id=e.tenant_id and x.client_id=e.client_id and x.kind='publish';end if;
 if c is null then raise exception using errcode='23514',message='Ursprüngliche Übergabefassung fehlt.';end if;
 if e.kind='close' then c:=jsonb_set(c,array['tasks'],e.command->'taskSnapshots');end if;
 perform care_handover_private.content_rights(e.tenant_id,p_actor,c,false);
end$$;
create or replace function care_handover_private.history(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid,p_handover_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare answer jsonb;e care_handover_private.events%rowtype;begin
 perform care_handover_private.authorize(p_tenant_id,p_actor_id,p_client_id,false);
 if not exists(select 1 from care_handover_private.roots r where r.id=p_handover_id and r.tenant_id=p_tenant_id and r.client_id=p_client_id) then raise exception using errcode='42501',message='Übergabe nicht zugänglich.';end if;
 for e in select * from care_handover_private.events x where x.handover_id=p_handover_id and x.tenant_id=p_tenant_id and x.client_id=p_client_id loop
  perform care_handover_private.event_access(e,p_actor_id);
 end loop;
 select jsonb_build_object('version','2026-10-16.1','tenantId',p_tenant_id::text,'clientId',p_client_id::text,'handoverId',p_handover_id::text,
  'count',count(*),'events',coalesce(jsonb_agg(care_handover_private.event_json(x) order by x.sequence),'[]')) into answer
 from care_handover_private.events x where x.handover_id=p_handover_id and x.tenant_id=p_tenant_id and x.client_id=p_client_id;
 return answer;
end$$;
create or replace function care_handover_private.list(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare answer jsonb;begin
 perform care_handover_private.authorize(p_tenant_id,p_actor_id,p_client_id,false);
 if (select count(*) from care_handover_private.roots r where r.tenant_id=p_tenant_id and r.client_id=p_client_id)>1000 then raise exception using errcode='23514',message='Der vollständige Übergabeverlauf überschreitet den lesbaren Umfang.';end if;
 select jsonb_build_object('version','2026-10-16.1','tenantId',p_tenant_id::text,'clientId',p_client_id::text,'count',count(*),
  'rows',coalesce(jsonb_agg(care_handover_private.history(p_tenant_id,p_actor_id,p_client_id,r.id) order by r.created_at desc,r.id desc),'[]')) into answer
 from care_handover_private.roots r where r.tenant_id=p_tenant_id and r.client_id=p_client_id;
 if octet_length(answer::text)>16000000 then raise exception using errcode='23514',message='Vollständiger Übergabeverlauf ist zu groß.';end if;return answer;
end$$;

create or replace function care_handover_private.validate_content(c jsonb,p_tenant uuid,p_client uuid) returns void
language plpgsql set search_path='' as $$declare x jsonb;d jsonb;original jsonb;task jsonb;field text;e jsonb;seen text[];n integer;begin
 if jsonb_typeof(c) is distinct from 'object' or c-array['title','priority','summary','client','sources','documents','tasks','recipients','emergency']<>'{}'::jsonb or (select count(*) from jsonb_each(c))<>9
  or jsonb_typeof(c->'title') is distinct from 'string' or jsonb_typeof(c->'summary') is distinct from 'string'
  or length(btrim(coalesce(c->>'title',''))) not between 1 and 200 or length(btrim(coalesce(c->>'summary',''))) not between 1 and 8000
  or coalesce(c->>'priority','') not in('normal','important','urgent','critical') or c->'client' is distinct from care_handover_private.client_row(p_tenant,p_client)
  then raise exception using errcode='23514',message='Grundangaben oder aktuelle Stammdaten widersprüchlich.';end if;
 foreach field in array array['sources','documents','tasks','recipients'] loop if jsonb_typeof(c->field) is distinct from 'array' then raise exception using errcode='23514',message='Vollständige Auswahl fehlt.';end if;end loop;
 if jsonb_array_length(c->'recipients') not between 1 and 30 or jsonb_array_length(c->'documents')>50 then raise exception using errcode='23514',message='Empfangs- oder Dokumentenauswahl ungültig.';end if;
 e:=c->'emergency';
 if jsonb_typeof(e) is distinct from 'object' or e-array['contacts','risks','plans','accessNote','limitations','reviewed']<>'{}'::jsonb or (select count(*) from jsonb_each(e))<>6
  or e->'reviewed' is distinct from 'true'::jsonb or jsonb_typeof(e->'accessNote') is distinct from 'string' or jsonb_typeof(e->'limitations') is distinct from 'string'
  or length(btrim(coalesce(e->>'accessNote',''))) not between 1 and 2000 or length(btrim(coalesce(e->>'limitations',''))) not between 1 and 4000
  or jsonb_typeof(e->'contacts') is distinct from 'array' or jsonb_typeof(e->'risks') is distinct from 'array' or jsonb_typeof(e->'plans') is distinct from 'array'
  then raise exception using errcode='23514',message='Notfallinformationen und fehlende Angaben ausdrücklich prüfen.';end if;
 n:=jsonb_array_length(c->'sources')+jsonb_array_length(c->'documents')+jsonb_array_length(c->'tasks')+jsonb_array_length(e->'contacts')+jsonb_array_length(e->'risks')+jsonb_array_length(e->'plans');
 if n<1 then raise exception using errcode='23514',message='Tatsächlicher Aktenbeleg fehlt.';end if;
 foreach field in array array['sources','documents','tasks','recipients'] loop
  seen:=array[]::text[];
  for x in select z from jsonb_array_elements(c->field) z order by coalesce(z->>'id',z->'document'->>'id',z->'task'->>'id') loop
   if field='sources' then
    if x-array['kind','id','snapshot']<>'{}'::jsonb or (select count(*) from jsonb_each(x))<>3 then raise exception using errcode='23514',message='Quellbeleg ungültig.';end if;
    d:=to_jsonb((x->>'kind')||':'||(x->>'id'));
    if care_private.control_source_current(x->>'kind',(x->>'id')::uuid,p_tenant,p_client) is distinct from x->'snapshot' then raise exception using errcode='40001',message='Originalquelle inzwischen geändert.';end if;
   elsif field='documents' then
    if x-array['document','source','documentDate','readable','correctCase','note']<>'{}'::jsonb or (select count(*) from jsonb_each(x))<>6 or x->'readable' is distinct from 'true'::jsonb or x->'correctCase' is distinct from 'true'::jsonb
     or jsonb_typeof(x->'source') is distinct from 'string' or jsonb_typeof(x->'documentDate') is distinct from 'string' or jsonb_typeof(x->'note') is distinct from 'string'
     or length(btrim(coalesce(x->>'source',''))) not between 1 and 1000 or length(coalesce(x->>'note',''))>4000 or coalesce(x->>'documentDate','')!~'^\d{4}-\d{2}-\d{2}$'
     or to_char((x->>'documentDate')::date,'YYYY-MM-DD')<>x->>'documentDate' then raise exception using errcode='23514',message='Dokumentherkunft, Datum, Lesbarkeit oder Fallzuordnung fehlt.';end if;
    select to_jsonb(z) into original from public.client_documents z where z.id=(x->'document'->>'id')::uuid and z.tenant_id=p_tenant and z.client_id=p_client and z.status='aktiv' for share;
    if original is null or original is distinct from x->'document' or original->>'mime_type' not in('application/pdf','image/png','image/jpeg','text/plain') then raise exception using errcode='40001',message='Dokumentfassung unlesbar, geändert oder fremd.';end if;d:=x->'document'->'id';
   elsif field='tasks' then
    perform 1 from public.care_control_tasks z where z.id=(x->'task'->>'id')::uuid and z.tenant_id=p_tenant and z.client_id=p_client for update;
    task:=care_handover_private.task_record(p_tenant,p_client,(x->'task'->>'id')::uuid);
    if task is distinct from x or care_handover_private.task_state(task)->>'status' is distinct from 'open' then raise exception using errcode='40001',message='Auftrag inzwischen geändert oder nicht offen.';end if;d:=x->'task'->'id';
   else d:=x->'id';end if;
   if d is null or d::text=any(seen) then raise exception using errcode='23514',message='Beleg fehlt oder ist doppelt.';end if;seen:=array_append(seen,d::text);
  end loop;
 end loop;
 foreach field in array array['contacts','risks','plans'] loop
  seen:=array[]::text[];
  for x in select z from jsonb_array_elements(e->field) z order by z->>'id' loop
   original:=null;
   if field='contacts' then select to_jsonb(z) into original from public.client_contacts z where z.id=(x->>'id')::uuid and z.tenant_id=p_tenant and z.client_id=p_client for share;
   elsif field='risks' then select to_jsonb(z) into original from public.client_risks z where z.id=(x->>'id')::uuid and z.tenant_id=p_tenant and z.client_id=p_client for share;
   else
    if x->>'kind' is distinct from 'care_plan' or x-array['kind','id','snapshot']<>'{}'::jsonb or (select count(*) from jsonb_each(x))<>3 then raise exception using errcode='23514',message='Planbezug ungültig.';end if;
    original:=jsonb_build_object('kind','care_plan','id',x->>'id','snapshot',care_private.control_source_current('care_plan',(x->>'id')::uuid,p_tenant,p_client));
   end if;
   if original is null or original is distinct from x or x->>'id'=any(seen) then raise exception using errcode='40001',message='Notfallbeleg geändert, fremd oder doppelt.';end if;seen:=array_append(seen,x->>'id');
  end loop;
 end loop;
end$$;

create or replace function care_handover_private.commit(p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tenant uuid;actor uuid;subject uuid;root_id uuid;event_id uuid;request uuid;expected uuid;k text;keys text[];
 root care_handover_private.roots%rowtype;prior care_handover_private.events%rowtype;head care_handover_private.events%rowtype;saved care_handover_private.events%rowtype;
 c jsonb;t jsonb;actual jsonb;seen uuid[]:=array[]::uuid[];task_id uuid;name text;seq integer;at_time timestamptz;identity_key text;
begin
 if jsonb_typeof(p_command) is distinct from 'object' or octet_length(p_command::text)>750000 or p_command->>'version' is distinct from '2026-10-16.1' then raise exception using errcode='23514',message='Übergabeanfrage ungültig.';end if;
 tenant:=(p_command->>'tenantId')::uuid;actor:=(p_command->>'actorId')::uuid;subject:=(p_command->>'clientId')::uuid;
 root_id:=(p_command->>'handoverId')::uuid;event_id:=(p_command->>'eventId')::uuid;request:=(p_command->>'requestId')::uuid;expected:=(p_command->>'expectedHeadId')::uuid;k:=p_command->>'kind';
 if tenant is null or actor is null or subject is null or root_id is null or event_id is null or request is null or event_id=request or event_id=root_id then raise exception using errcode='23514',message='Native Anfragekennungen fehlen.';end if;
 foreach identity_key in array array['tenantId','actorId','clientId','handoverId','eventId','requestId'] loop
  if jsonb_typeof(p_command->identity_key) is distinct from 'string' or (p_command->>identity_key)::uuid::text<>p_command->>identity_key then raise exception using errcode='23514',message='Native Kennung ist nicht kanonisch.';end if;
 end loop;
 if not (p_command?'expectedHeadId') or p_command->'expectedHeadId'<>'null'::jsonb and (jsonb_typeof(p_command->'expectedHeadId') is distinct from 'string' or expected::text is distinct from p_command->>'expectedHeadId') then raise exception using errcode='23514',message='Erwartete Originalfassung fehlt.';end if;
 perform care_handover_private.authorize(tenant,actor,subject,true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':case-handover-request:'||request::text,0));
 select * into prior from care_handover_private.events e where e.tenant_id=tenant and e.request_id=request;
 if prior.id is not null then
  if prior.actor_id<>actor or prior.command is distinct from p_command then raise exception using errcode='23514',message='Anfragekennung ist bereits anders belegt.';end if;
  perform care_handover_private.event_access(prior,actor);return care_handover_private.receipt(prior);
 end if;
 keys:=array['version','requestId','eventId','tenantId','clientId','actorId','handoverId','expectedHeadId','kind']||case k when 'publish' then array['reason','content'] when 'acknowledge' then array['statement'] when 'close' then array['statement','taskSnapshots'] else array[]::text[] end;
 if coalesce(k,'') not in('publish','acknowledge','close') or p_command-keys<>'{}'::jsonb or (select count(*) from jsonb_each(p_command))<>cardinality(keys)
  or k<>'publish' and (expected is null or jsonb_typeof(p_command->'statement') is distinct from 'string' or length(btrim(coalesce(p_command->>'statement',''))) not between 1 and 4000)
  or k='publish' and (jsonb_typeof(p_command->'reason') is distinct from 'string' or length(p_command->>'reason')>4000 or expected is not null and nullif(btrim(p_command->>'reason'),'') is null)
  then raise exception using errcode='23514',message='Fassung, Änderungsgrund oder tatsächliche Rückmeldung fehlen.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':case-handover-root:'||root_id::text,0));
 select * into root from care_handover_private.roots r where r.id=root_id for update;
 if root.id is null then
  if k<>'publish' or expected is not null then raise exception using errcode='40001',message='Ursprüngliche Übergabe fehlt.';end if;
 else
  if root.tenant_id<>tenant or root.client_id<>subject then raise exception using errcode='42501',message='Übergabe gehört zu einer anderen Akte.';end if;
  if root.closed or root.head_id is distinct from expected then raise exception using errcode='40001',message='Übergabefassung wurde geändert oder geschlossen.';end if;
  select * into head from care_handover_private.events e where e.id=root.head_id and e.kind='publish';
  perform care_handover_private.content_rights(tenant,actor,head.command->'content',false);
 end if;
 if k='publish' then
  c:=p_command->'content';perform care_handover_private.validate_content(c,tenant,subject);perform care_handover_private.content_rights(tenant,actor,c,true);
 elsif k='acknowledge' then
  if not exists(select 1 from jsonb_array_elements(head.command->'content'->'recipients') p where p->>'id'=actor::text)
   or exists(select 1 from care_handover_private.events e where e.head_id=expected and e.kind='acknowledge' and e.actor_id=actor)
   then raise exception using errcode='23514',message='Kein eigener offener Empfang dieser Fassung.';end if;
 else
  if jsonb_typeof(p_command->'taskSnapshots') is distinct from 'array' or exists(select 1 from jsonb_array_elements(head.command->'content'->'recipients') p
   where not exists(select 1 from care_handover_private.events e where e.head_id=expected and e.kind='acknowledge' and e.actor_id=(p->>'id')::uuid))
   then raise exception using errcode='23514',message='Empfangsbestätigungen oder Aufgabenbelege fehlen.';end if;
  if jsonb_array_length(p_command->'taskSnapshots')<>jsonb_array_length(head.command->'content'->'tasks') then raise exception using errcode='23514',message='Vollständiger aktueller Aufgabenstand fehlt.';end if;
  for t in select x from jsonb_array_elements(p_command->'taskSnapshots') x order by x->'task'->>'id' loop
   task_id:=(t->'task'->>'id')::uuid;
   if task_id is null or task_id=any(seen) or not exists(select 1 from jsonb_array_elements(head.command->'content'->'tasks') x where x->'task'->>'id'=task_id::text) then raise exception using errcode='23514',message='Fremder oder doppelter Abschlussauftrag.';end if;
   perform 1 from public.care_control_tasks z where z.id=task_id and z.tenant_id=tenant and z.client_id=subject for update;
   actual:=care_handover_private.task_record(tenant,subject,task_id);
   if actual is distinct from t or care_handover_private.task_state(actual)->>'status'='open' then raise exception using errcode='40001',message='Auftragsstand geändert oder Versorgung noch offen.';end if;
   seen:=array_append(seen,task_id);
  end loop;
  perform care_handover_private.content_rights(tenant,actor,jsonb_set(head.command->'content',array['tasks'],p_command->'taskSnapshots'),false);
 end if;
 select coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt') into name from public.profiles p where p.id=actor and p.tenant_id=tenant;
 at_time:=clock_timestamp();
 if root.id is null then insert into care_handover_private.roots(id,tenant_id,client_id,created_by,created_at) values(root_id,tenant,subject,actor,at_time);end if;
 select count(*)+1 into seq from care_handover_private.events e where e.handover_id=root_id;
 insert into care_handover_private.events(id,tenant_id,client_id,handover_id,sequence,request_id,kind,head_id,actor_id,actor_name,recorded_at,command)
 values(event_id,tenant,subject,root_id,seq,request,k,case when k='publish' then event_id else expected end,actor,name,at_time,p_command) returning * into saved;
 if k='publish' then update care_handover_private.roots set head_id=event_id,revision_count=revision_count+1 where id=root_id;
 elsif k='close' then update care_handover_private.roots set closed=true where id=root_id;end if;
 -- Only communication events are written. No clinical task/event is completed here.
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
 values(tenant,subject,'case_handover_event',event_id,'created','Fallübergabe: Fassung, eigener Empfang oder Kommunikationsabschluss',jsonb_build_object('handoverId',root_id,'kind',k,'headId',saved.head_id),actor,name);
 return care_handover_private.receipt(saved);
end$$;
create or replace function care_handover_private.confirm(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid,p_request_id uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$declare e care_handover_private.events%rowtype;begin
 perform care_handover_private.authorize(p_tenant_id,p_actor_id,p_client_id,false);
 select * into e from care_handover_private.events x where x.tenant_id=p_tenant_id and x.client_id=p_client_id and x.actor_id=p_actor_id and x.request_id=p_request_id;
 if not found or e.command is distinct from p_command then return null;end if;
 perform care_handover_private.event_access(e,p_actor_id);return care_handover_private.receipt(e);
end$$;

create or replace function public.web_case_handover_clients(p_tenant_id uuid,p_actor_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_handover_private.clients(p_tenant_id,p_actor_id)$$;
create or replace function public.web_case_handover_context(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_handover_private.context(p_tenant_id,p_actor_id,p_client_id)$$;
create or replace function public.web_case_handover_list(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_handover_private.list(p_tenant_id,p_actor_id,p_client_id)$$;
create or replace function public.web_case_handover_history(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid,p_handover_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_handover_private.history(p_tenant_id,p_actor_id,p_client_id,p_handover_id)$$;
create or replace function public.web_commit_case_handover(p_command jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_handover_private.commit(p_command)$$;
create or replace function public.web_confirm_case_handover(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid,p_request_id uuid,p_command jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_handover_private.confirm(p_tenant_id,p_actor_id,p_client_id,p_request_id,p_command)$$;
revoke all on all functions in schema care_handover_private from public,anon,authenticated;
grant usage on schema care_handover_private to authenticated;
revoke all on function public.web_case_handover_clients(uuid,uuid),public.web_case_handover_context(uuid,uuid,uuid),public.web_case_handover_list(uuid,uuid,uuid),public.web_case_handover_history(uuid,uuid,uuid,uuid),public.web_commit_case_handover(jsonb),public.web_confirm_case_handover(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function care_handover_private.clients(uuid,uuid),care_handover_private.context(uuid,uuid,uuid),care_handover_private.list(uuid,uuid,uuid),care_handover_private.history(uuid,uuid,uuid,uuid),care_handover_private.commit(jsonb),care_handover_private.confirm(uuid,uuid,uuid,uuid,jsonb),
 public.web_case_handover_clients(uuid,uuid),public.web_case_handover_context(uuid,uuid,uuid),public.web_case_handover_list(uuid,uuid,uuid),public.web_case_handover_history(uuid,uuid,uuid,uuid),public.web_commit_case_handover(jsonb),public.web_confirm_case_handover(uuid,uuid,uuid,uuid,jsonb) to authenticated;
commit;
