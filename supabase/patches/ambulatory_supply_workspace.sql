-- CP324: prepared only, NOT executed. Existing public inventory/Assist/Android writers are unchanged.
-- Requires the existing clinical-control and CP323 permission/session helpers.
-- All quantities use whole smallest declared units. This is case stock, not a central warehouse.
begin;
create schema if not exists care_supply_private;
revoke all on schema care_supply_private from public,anon,authenticated;
create table if not exists care_supply_private.roots(
 tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 head_id uuid, event_count integer not null default 0 check(event_count between 0 and 10000),
 primary key(tenant_id,client_id)
);
create table if not exists care_supply_private.events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,sequence integer not null check(sequence>0),
 previous_id uuid references care_supply_private.events(id),request_id uuid not null,actor_id uuid not null references public.profiles(id),
 actor_name text not null,recorded_at timestamptz not null,command jsonb not null check(jsonb_typeof(command)='object' and octet_length(command::text)<=2000000),
 foreign key(tenant_id,client_id) references care_supply_private.roots(tenant_id,client_id),
 unique(tenant_id,request_id),unique(tenant_id,client_id,sequence)
);
alter table care_supply_private.roots enable row level security;
alter table care_supply_private.events enable row level security;
revoke all on all tables in schema care_supply_private from public,anon,authenticated;
create or replace function care_supply_private.immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception using errcode='23514',message='Materialoriginale bleiben unveränderlich.';end$$;
drop trigger if exists supply_events_immutable on care_supply_private.events;
create trigger supply_events_immutable before update or delete on care_supply_private.events for each row execute function care_supply_private.immutable();

create or replace function care_supply_private.keys(k text,p jsonb,w boolean) returns text[] language sql immutable set search_path='' as $$
 select case when w then case k
 when 'infection' then array['pflege.risks.manage'] when 'hygiene_plan' then array['qm.view','qm.view_versions','pflege.plans.manage']
 when 'housekeeping' then array['assist.records.create'] when 'consume' then array['inventory.issue']
 when 'device_use' then array['inventory.issue'] when 'device_training' then array['inventory.issue']
 when 'key' then case p->>'action' when 'return' then array['inventory.return_manage'] when 'lost' then array['inventory.report_damage'] when 'block' then array['inventory.manage_items'] when 'resolve' then array['inventory.manage_items'] else array['inventory.issue'] end
 else array['inventory.manage_items'] end else case k
 when 'infection' then array['pflege.risks.view'] when 'hygiene_plan' then array['qm.view','qm.view_versions','pflege.documentation.view'] when 'housekeeping' then array['assist.records.view'] else array[]::text[] end end
$$;
create or replace function care_supply_private.require_keys(t uuid,a uuid,keys text[]) returns void language plpgsql set search_path='' as $$declare k text;begin
 if not care_handover_private.profile_has(t,a,keys) then raise exception using errcode='42501',message='Aktuelle Materialrechte fehlen.';end if;
 foreach k in array keys loop if public.has_permission(k) is not true then raise exception using errcode='42501',message='Nativer Materialzugang fehlt.';end if;end loop;
end$$;
create or replace function care_supply_private.authorize(t uuid,a uuid,c uuid,w boolean) returns void language plpgsql security definer set search_path='' as $$declare sid uuid;begin
 if auth.uid() is null or a is distinct from auth.uid() or a is distinct from public.resolve_current_profile_id() or t is distinct from public.current_tenant_id()
 or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp()) then raise exception using errcode='42501',message='Aktuelles eigenes Konto fehlt.';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 perform 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>clock_timestamp()) for share;
 if not found then raise exception using errcode='42501',message='Aktuelle native Sitzung fehlt.';end if;
 if w then lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;end if;
 perform 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'
 and (p.auth_user_id is null or p.auth_user_id=a) and r.key in('business_admin','business_manager','nurse','caregiver','counselor','dispatch','billing','akademie_admin') for share of p,r;
 if not found then raise exception using errcode='42501',message='Aktuelles Betriebsprofil fehlt.';end if;
 perform care_supply_private.require_keys(t,a,array['office.clients.view','inventory.view','inventory.audit_view']);
 if c is not null then
  perform 1 from public.clients x where x.id=c and x.tenant_id=t and x.status='active' and x.deleted_at is null and public.is_active_pfleger_client(x.id)
   and (x.sensitivity<>'restricted' or public.has_permission('office.clients.view_sensitive') and care_handover_private.profile_has(t,a,array['office.clients.view_sensitive'])) for no key update;
  if not found then raise exception using errcode='42501',message='Aktiver eigener Pflegefall fehlt.';end if;
 end if;
end$$;
create or replace function care_supply_private.person(t uuid,a uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id::text,'tenantId',t::text,'name',coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt'),'roleKey',r.key,'updatedAt',to_char(p.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
 from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'
 and r.key in('business_admin','business_manager','nurse','caregiver','counselor','dispatch','billing','akademie_admin')
$$;
-- Exact native projections deliberately omit secret access-account fields and storage paths.
create or replace function care_supply_private.source(t uuid,a uuid,c uuid,k text,i uuid) returns jsonb language plpgsql set search_path='' as $$declare s jsonb;d public.qm_documents%rowtype;r public.qm_document_versions%rowtype;x public.inventory_items%rowtype;g public.inventory_categories%rowtype;q public.client_documents%rowtype;begin
 if k='qm_version' then
  perform care_supply_private.require_keys(t,a,array['qm.view','qm.view_versions']);
  select * into r from public.qm_document_versions z where z.id=i and z.tenant_id=t for share;
  select * into d from public.qm_documents z where z.id=r.document_id and z.tenant_id=t for share;
  if r.id is null or d.current_version_id is distinct from i or d.status not in('approved','published') or r.status not in('approved','published') then raise exception using errcode='42501',message='Aktuelle freigegebene QM-Fassung fehlt.';end if;
  s:=jsonb_build_object('tenant_id',t::text,'document',to_jsonb(d),'version',to_jsonb(r));
 elsif k='asset' then
  select * into x from public.inventory_items z where z.id=i and z.tenant_id=t for share;
  select * into g from public.inventory_categories z where z.id=x.category_id and z.tenant_id=t for share;
  if x.id is null or g.id is null or g.group_key not in('devices','keys_access') then raise exception using errcode='42501',message='Eigenes Geräte- oder Schlüsseloriginal fehlt.';end if;
  s:=(select jsonb_object_agg(j.key,j.value) from jsonb_each(to_jsonb(x)) j where j.key=any(array['id','tenant_id','category_id','name','serial_number','manufacturer','model','status','condition','updated_at']));
  s:=s||jsonb_build_object('group_key',g.group_key,'category_updated_at',g.updated_at);
 elsif k='case_document' then
  perform care_supply_private.require_keys(t,a,array['office.documents.view']);
  select * into q from public.client_documents z where z.id=i and z.tenant_id=t and z.client_id=c and z.status='aktiv' for share;
  if q.id is null then raise exception using errcode='42501',message='Aktiver eigener Dokumentbezug fehlt.';end if;
  if q.sensitivity='restricted' then perform care_supply_private.require_keys(t,a,array['office.clients.view_sensitive']);end if;
  s:=(select jsonb_object_agg(j.key,j.value) from jsonb_each(to_jsonb(q)) j where j.key=any(array['id','tenant_id','client_id','title','file_name','mime_type','category','status','sensitivity','valid_until','created_at','updated_at']));
 else raise exception using errcode='23514',message='Unbekannte Originalart.';
 end if;
 return jsonb_build_object('kind',k,'id',i::text,'snapshot',s);
end$$;
create or replace function care_supply_private.reference_access(t uuid,a uuid,c uuid,v jsonb,current_original boolean) returns void language plpgsql set search_path='' as $$declare actual jsonb;k text:=v->>'kind';i uuid:=(v->>'id')::uuid;begin
 if jsonb_typeof(v)<>'object' or v-array['kind','id','snapshot']<>'{}' or (select count(*) from jsonb_each(v))<>3 or v->'snapshot'->>'tenant_id' is distinct from t::text then raise exception using errcode='23514',message='Fremder oder unvollständiger Originalbezug.';end if;
 if current_original then actual:=care_supply_private.source(t,a,c,k,i);if actual is distinct from v then raise exception using errcode='40001',message='Die ausgewählte Originalfassung wurde geändert.';end if;
 else
  if k='case_document' then
   perform care_supply_private.require_keys(t,a,array['office.documents.view']);
   perform 1 from public.client_documents z where z.id=i and z.tenant_id=t and z.client_id=c;
   if not found or v->'snapshot'->>'client_id' is distinct from c::text then raise exception using errcode='42501',message='Historischer Dokumentbezug nicht mehr zugänglich.';end if;
   if v->'snapshot'->>'sensitivity'='restricted' or exists(select 1 from public.client_documents z where z.id=i and z.tenant_id=t and z.client_id=c and z.sensitivity='restricted') then perform care_supply_private.require_keys(t,a,array['office.clients.view_sensitive']);end if;
  elsif k='qm_version' then perform care_supply_private.require_keys(t,a,array['qm.view','qm.view_versions']);
  elsif k<>'asset' then raise exception using errcode='42501',message='Unbekannter historischer Quellenzugang.';end if;
 end if;
end$$;
create or replace function care_supply_private.command_access(t uuid,a uuid,c uuid,cmd jsonb,w boolean) returns void language plpgsql set search_path='' as $$declare v jsonb;begin
 perform care_supply_private.require_keys(t,a,care_supply_private.keys(cmd->>'kind',cmd->'payload',false)||case when w then care_supply_private.keys(cmd->>'kind',cmd->'payload',true) else array[]::text[] end);
 if w and cmd->'payload'?'responsible' then
  v:=cmd->'payload'->'responsible';
  if jsonb_typeof(v) is distinct from 'object' or v-array['id','tenantId','name','roleKey','updatedAt']<>'{}' or (select count(*) from jsonb_each(v))<>5 then raise exception using errcode='23514',message='Vollständige zuständige Person fehlt.';end if;
  perform 1 from public.profiles p where p.id=(v->>'id')::uuid and p.tenant_id=t for share;
  if care_supply_private.person(t,(v->>'id')::uuid) is distinct from v then raise exception using errcode='40001',message='Zuständige Person wurde geändert.';end if;
 end if;
 for v in select value from jsonb_each(cmd->'payload') loop
  if jsonb_typeof(v)='object' and v?'snapshot' then perform care_supply_private.reference_access(t,a,c,v,w);end if;
  if w and jsonb_typeof(v)='object' and v?'roleKey' then
   perform 1 from public.profiles p where p.id=(v->>'id')::uuid and p.tenant_id=t for share;
   if care_supply_private.person(t,(v->>'id')::uuid) is distinct from v then raise exception using errcode='40001',message='Zuständige Person wurde geändert.';end if;
  end if;
 end loop;
end$$;
create or replace function care_supply_private.event_json(e care_supply_private.events) returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('id',e.id::text,'sequence',e.sequence,'previousId',e.previous_id::text,'tenantId',e.tenant_id::text,'clientId',e.client_id::text,'actorId',e.actor_id::text,'actorName',e.actor_name,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)$$;
create or replace function care_supply_private.history(t uuid,a uuid,c uuid) returns jsonb language plpgsql set search_path='' as $$declare answer jsonb;e care_supply_private.events;begin
 for e in select * from care_supply_private.events z where z.tenant_id=t and z.client_id=c order by z.sequence loop perform care_supply_private.command_access(t,a,c,e.command,false);end loop;
 select jsonb_build_object('version','2026-10-16.1','tenantId',t::text,'clientId',c::text,'count',count(*),'headId',(array_agg(e.id::text order by e.sequence desc))[1],'events',coalesce(jsonb_agg(care_supply_private.event_json(e) order by e.sequence),'[]')) into answer from care_supply_private.events e where e.tenant_id=t and e.client_id=c;
 return answer;
end$$;

create or replace function care_supply_private.quantity(v jsonb,z boolean default false) returns bigint language plpgsql immutable set search_path='' as $$declare n numeric;begin
 if jsonb_typeof(v) is distinct from 'number' then raise exception using errcode='23514',message='Ganze Mengen in der kleinsten Einheit erforderlich.';end if;n:=v::text::numeric;
 if n<>trunc(n) or n<case when z then 0 else 1 end or n>1000000000 then raise exception using errcode='23514',message='Ungültige ganze Menge.';end if;return n::bigint;
end$$;
create or replace function care_supply_private.date(v text) returns date language plpgsql immutable set search_path='' as $$declare d date;begin
 d:=v::date;if v is null or v!~'^\d{4}-\d{2}-\d{2}$' or to_char(d,'YYYY-MM-DD')<>v then raise exception using errcode='23514',message='Ungültiges Originaldatum.';end if;return d;
end$$;
create or replace function care_supply_private.instant(v text) returns timestamptz language plpgsql immutable set search_path='' as $$declare d timestamptz;begin
 if v is null or v!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then raise exception using errcode='23514',message='Die vollständige Ereigniszeit fehlt.';end if;d:=v::timestamptz;return d;
end$$;
-- The fold is also replayed before each append. It has no public EXECUTE grant.
create or replace function care_supply_private.fold(s jsonb,cmd jsonb,at_time timestamptz) returns jsonb language plpgsql set search_path='' as $$
declare k text:=cmd->>'kind';p jsonb:=cmd->'payload';eid text:=cmd->>'eventId';keys text[];required text[]:='{}';name text;v jsonb;q jsonb;o jsonb;l jsonb;target jsonb;prior jsonb;check_event jsonb;training jsonb;cleaning jsonb;used jsonb;released jsonb;plan jsonb;
 actor text:=cmd->>'actorId';actual_time timestamptz;lotid text;articleid text;oid text;qty bigint;delta bigint;newqty bigint;held boolean;idx integer;i integer;ref text;seq integer:=jsonb_array_length(s->'events')+1;
begin
 if cmd->>'version' is distinct from '2026-10-16.1' or jsonb_typeof(cmd)<>'object' or cmd-array['version','requestId','eventId','tenantId','clientId','actorId','expectedHeadId','kind','occurredAt','note','payload']<>'{}' or (select count(*) from jsonb_each(cmd))<>11
 or jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(cmd->'note') is distinct from 'string' or length(btrim(coalesce(cmd->>'note',''))) not between 1 and 4000 or cmd->'expectedHeadId' is distinct from s->'headId'
 then raise exception using errcode='23514',message='Unvollständige Buchung oder geänderte Fassung.';end if;
 foreach name in array array['requestId','eventId','tenantId','clientId','actorId'] loop
  if cmd->>name is null or (cmd->>name)::uuid::text<>cmd->>name then raise exception using errcode='23514',message='Ungültige native Identität.';end if;
 end loop;
 if cmd->>'requestId'=eid or exists(select 1 from jsonb_array_elements(s->'events') x where x->>'id'=eid or x->'command'->>'requestId'=cmd->>'requestId') then raise exception using errcode='23514',message='Doppelte Ereignis- oder Anfragekennung.';end if;
 actual_time:=care_supply_private.instant(cmd->>'occurredAt');if actual_time>at_time then raise exception using errcode='23514',message='Tatsächliche Ereignisse dürfen nicht in der Zukunft liegen.';end if;
 keys:=case k
 when 'article' then array['name','unit','minimum','supplier'] when 'hygiene_plan' then array['qm','activity','site','protection','validFrom','validUntil','responsible']
 when 'infection' then array['status','organism','document','planId','observedAt','limitations'] when 'order' then array['articleId','quantity','supplier','reference']
 when 'receipt' then array['orderId','quantity','batch','expiry','location','document'] when 'consume' then array['lotId','quantity','planId','activity','site','execution']
 when 'hold' then array['lotId','reason','document'] when 'release_lot' then array['lotId','reason','document'] when 'dispose' then array['lotId','quantity','method','document']
 when 'count' then array['lotId','lotHeadId','expected','counted'] when 'approve_count' then array['countId','reason'] when 'reverse_stock' then array['targetId','reason']
 when 'device_check' then array['asset','type','result','dueAt','document'] when 'device_training' then array['asset','document','instructor']
 when 'device_release' then array['asset','planId','activity','site'] when 'device_use' then array['asset','planId','activity','site']
 when 'cleaning' then array['asset','method','agent','result','deviation','document'] when 'housekeeping' then array['category','activity','site','startedAt','endedAt','outcome','deviation','document']
 when 'key' then array['asset','action','responsible','reference','document'] else null end;
 if keys is null or p-keys<>'{}' or (select count(*) from jsonb_each(p))<>cardinality(keys) or exists(select 1 from jsonb_each(p) x where x.value='null'::jsonb) then raise exception using errcode='23514',message='Unbekannter Vorgang oder unvollständige Angaben.';end if;
 foreach name in array keys loop
  v:=p->name;
  if name='responsible' and (jsonb_typeof(v) is distinct from 'object' or v-array['id','tenantId','name','roleKey','updatedAt']<>'{}' or (select count(*) from jsonb_each(v))<>5 or v->>'tenantId' is distinct from cmd->>'tenantId' or (v->>'id')::uuid::text is distinct from v->>'id' or jsonb_typeof(v->'name') is distinct from 'string' or length(btrim(coalesce(v->>'name',''))) not between 1 and 2000 or coalesce(v->>'roleKey','') not in('business_admin','business_manager','nurse','caregiver','counselor','dispatch','billing','akademie_admin')) then raise exception using errcode='23514',message='Ungültige zuständige Originalperson.';end if;
  if name='responsible' then perform care_supply_private.instant(v->>'updatedAt');end if;
  if name=any(array['name','unit','supplier','activity','site','protection','organism','limitations','reference','batch','location','reason','method','instructor','agent','deviation']) and (jsonb_typeof(v) is distinct from 'string' or length(btrim(p->>name)) not between 1 and 4000) then raise exception using errcode='23514',message='Tatsächliche Tätigkeit, Ort oder Nachweis fehlt.';end if;
  if name=any(array['articleId','orderId','planId','lotId','lotHeadId','countId','targetId']) and ((p->>name)::uuid::text is distinct from p->>name) then raise exception using errcode='23514',message='Originalbeleg nicht ausgewählt.';end if;
  if name=any(array['qm','asset','document','execution']) then
   if jsonb_typeof(v) is distinct from 'object' or v-array['kind','id','snapshot']<>'{}' or (select count(*) from jsonb_each(v))<>3 or v->'snapshot'->>'tenant_id' is distinct from cmd->>'tenantId'
    or v->>'kind' is distinct from case name when 'qm' then 'qm_version' when 'asset' then 'asset' else 'case_document' end then raise exception using errcode='23514',message='Vollständiger eigener Originalbezug fehlt.';end if;
  end if;
 end loop;
 if k='article' then
  perform care_supply_private.quantity(p->'minimum',true);
  s:=jsonb_set(s,array['articles',eid],jsonb_build_object('id',eid,'name',p->'name','unit',p->'unit','minimum',p->'minimum','supplier',p->'supplier'));
 elsif k='hygiene_plan' then
  if care_supply_private.date(p->>'validFrom')>care_supply_private.date(p->>'validUntil') or p->'qm'->'snapshot'->'document'->>'current_version_id' is distinct from p->'qm'->>'id'
  or p->'qm'->'snapshot'->'version'->>'document_id' is distinct from p->'qm'->'snapshot'->'document'->>'id'
  or coalesce(p->'qm'->'snapshot'->'document'->>'status','') not in('approved','published') or coalesce(p->'qm'->'snapshot'->'version'->>'status','') not in('approved','published') then raise exception using errcode='23514',message='Aktuelle QM-Fassung oder tatsächliche Gültigkeit fehlt.';end if;
 elsif k='order' then
  if not (s->'articles')?(p->>'articleId') then raise exception using errcode='23514',message='Originalartikel fehlt.';end if;
  qty:=care_supply_private.quantity(p->'quantity');s:=jsonb_set(s,array['orders',eid],jsonb_build_object('id',eid,'articleId',p->'articleId','quantity',qty,'received',0,'supplier',p->'supplier','reference',p->'reference'));
 elsif k='receipt' then
  oid:=p->>'orderId';o:=s->'orders'->oid;qty:=care_supply_private.quantity(p->'quantity');perform care_supply_private.date(p->>'expiry');
  if o is null or (o->>'received')::bigint+qty>(o->>'quantity')::bigint then raise exception using errcode='23514',message='Bestellung fehlt oder Eingang übersteigt offene Menge.';end if;
  s:=jsonb_set(s,array['orders',oid,'received'],to_jsonb((o->>'received')::bigint+qty));
  s:=jsonb_set(s,array['lots',eid],jsonb_build_object('id',eid,'articleId',o->'articleId','orderId',oid,'batch',p->'batch','expiry',p->'expiry','location',p->'location','quantity',qty,'held',care_supply_private.date(p->>'expiry')<(actual_time at time zone 'UTC')::date,'headId',eid));
 elsif k in('consume','dispose','hold','release_lot','count') then
  lotid:=p->>'lotId';l:=s->'lots'->lotid;if l is null then raise exception using errcode='23514',message='Originalcharge fehlt.';end if;
  if k='count' then
   if l->>'headId' is distinct from p->>'lotHeadId' or care_supply_private.quantity(p->'expected',true)<>(l->>'quantity')::bigint then raise exception using errcode='40001',message='Sollbestand wurde geändert. Erneut zählen.';end if;perform care_supply_private.quantity(p->'counted',true);
  else
   held:=(l->>'held')::boolean;delta:=0;
   if k in('consume','dispose') then delta:=-care_supply_private.quantity(p->'quantity');end if;
   if k='consume' and (held or (l->>'expiry')::date<(actual_time at time zone 'UTC')::date or (l->>'expiry')::date<(at_time at time zone 'UTC')::date) then raise exception using errcode='23514',message='Gesperrte oder abgelaufene Charge.';end if;
   if k='hold' then if held then raise exception using errcode='23514',message='Charge bereits gesperrt.';end if;held:=true;end if;
   if k='release_lot' then if not held or (l->>'expiry')::date<(actual_time at time zone 'UTC')::date or (l->>'expiry')::date<(at_time at time zone 'UTC')::date then raise exception using errcode='23514',message='Charge nicht aktuell freigebbar.';end if;held:=false;end if;
   newqty:=care_supply_private.quantity(to_jsonb((l->>'quantity')::bigint+delta),true);s:=jsonb_set(s,array['lots',lotid],l||jsonb_build_object('quantity',newqty,'held',held,'headId',eid));
  end if;
 elsif k='approve_count' then
  select x into target from jsonb_array_elements(s->'events') x where x->>'id'=p->>'countId' and x->'command'->>'kind'='count';q:=target->'command'->'payload';lotid:=q->>'lotId';l:=s->'lots'->lotid;
  if target is null or target->'command'->>'actorId'=actor or exists(select 1 from jsonb_array_elements(s->'events') x where x->'command'->>'kind'='approve_count' and x->'command'->'payload'->>'countId'=p->>'countId') then raise exception using errcode='23514',message='Andere prüfende Person und noch nicht gebuchter Zählbeleg erforderlich.';end if;
  if l->>'headId' is distinct from q->>'lotHeadId' or l->'quantity' is distinct from q->'expected' then raise exception using errcode='40001',message='Seit der Zählung wurde Bestand verändert.';end if;
  s:=jsonb_set(s,array['lots',lotid],l||jsonb_build_object('quantity',q->'counted','held',true,'headId',eid));
 elsif k='reverse_stock' then
  select x into target from jsonb_array_elements(s->'events') x where x->>'id'=p->>'targetId' and x->'command'->>'kind' in('receipt','consume','dispose');
  if target is null or (s->'reversed')?(p->>'targetId') then raise exception using errcode='23514',message='Mengenoriginal fehlt oder wurde bereits berichtigt.';end if;
  q:=target->'command'->'payload';lotid:=case when target->'command'->>'kind'='receipt' then target->>'id' else q->>'lotId' end;l:=s->'lots'->lotid;
  delta:=care_supply_private.quantity(q->'quantity')*case when target->'command'->>'kind'='receipt' then -1 else 1 end;
  newqty:=care_supply_private.quantity(to_jsonb((l->>'quantity')::bigint+delta),true);
  s:=jsonb_set(s,array['lots',lotid],l||jsonb_build_object('quantity',newqty,'held',true,'headId',eid));
  if delta<0 then oid:=l->>'orderId';s:=jsonb_set(s,array['orders',oid,'received'],to_jsonb((s->'orders'->oid->>'received')::bigint+delta));end if;
  s:=jsonb_set(s,array['reversed'],(s->'reversed')||jsonb_build_array(p->>'targetId'));
 end if;
 if k in('consume','infection','device_release','device_use') then
  select x into plan from jsonb_array_elements(s->'events') x where x->'command'->>'kind'='hygiene_plan'
   and (k='infection' or x->'command'->'payload'->>'activity'=p->>'activity' and x->'command'->'payload'->>'site'=p->>'site')
   and (k<>'infection' or x->>'id'=p->>'planId') order by (x->>'sequence')::integer desc limit 1;
  if k='infection' and plan is not null then
   select x into v from jsonb_array_elements(s->'events') x where x->'command'->>'kind'='hygiene_plan' and x->'command'->'payload'->>'activity'=plan->'command'->'payload'->>'activity' and x->'command'->'payload'->>'site'=plan->'command'->'payload'->>'site' order by (x->>'sequence')::integer desc limit 1;
   if v->>'id' is distinct from plan->>'id' then raise exception using errcode='23514',message='Neuere Hygienezuordnung vorhanden.';end if;
  end if;
  if plan is null or plan->>'id' is distinct from p->>'planId' or care_supply_private.instant(plan->'command'->>'occurredAt')>actual_time or care_supply_private.date(plan->'command'->'payload'->>'validFrom')>(actual_time at time zone 'UTC')::date or care_supply_private.date(plan->'command'->'payload'->>'validUntil')<(actual_time at time zone 'UTC')::date then raise exception using errcode='23514',message='Hygienezuordnung passt nicht zu Tätigkeit, Einsatzstelle oder Datum.';end if;
 end if;
 if k='infection' then
  if coalesce(p->>'status','') not in('suspected','confirmed','ruled_out') or care_supply_private.instant(p->>'observedAt')>actual_time then raise exception using errcode='23514',message='Expliziter Befundstatus und Originalbefundzeit erforderlich.';end if;
 end if;
 if k in('device_check','device_training','device_release','device_use','cleaning') then
  if p->'asset'->'snapshot'->>'group_key' is distinct from 'devices' then raise exception using errcode='23514',message='Tatsächliches Geräteoriginal erforderlich.';end if;
  if k='device_check' and (coalesce(p->>'type','') not in('maintenance','inspection','calibration') or coalesce(p->>'result','') not in('passed','failed') or care_supply_private.instant(p->>'dueAt')<=actual_time) or k='cleaning' and coalesce(p->>'result','') not in('passed','failed') then raise exception using errcode='23514',message='Prüfergebnis oder Fälligkeit ungültig.';end if;
  if k in('device_release','device_use') then
   ref:=p->'asset'->>'id';
   if coalesce(p->'asset'->'snapshot'->>'status','') not in('available','assigned','in_use','reserved','returned') or coalesce(p->'asset'->'snapshot'->>'condition','unknown') in('damaged','unusable','lost','unknown') then raise exception using errcode='23514',message='Nativer Gerätezustand erlaubt keine Nutzung.';end if;
   select x into check_event from jsonb_array_elements(s->'events') x where x->'command'->>'kind'='device_check' and x->'command'->'payload'->'asset'->>'id'=ref order by (x->>'sequence')::integer desc limit 1;
   select x into training from jsonb_array_elements(s->'events') x where x->'command'->>'kind'='device_training' and x->'command'->>'actorId'=actor and x->'command'->'payload'->'asset'->>'id'=ref order by (x->>'sequence')::integer desc limit 1;
   select x into cleaning from jsonb_array_elements(s->'events') x where x->'command'->>'kind'='cleaning' and x->'command'->'payload'->'asset'->>'id'=ref order by (x->>'sequence')::integer desc limit 1;
   select x into used from jsonb_array_elements(s->'events') x where x->'command'->>'kind'='device_use' and x->'command'->'payload'->'asset'->>'id'=ref order by (x->>'sequence')::integer desc limit 1;
   if check_event is null or training is null or cleaning is null or check_event->'command'->'payload'->>'result'<>'passed' or cleaning->'command'->'payload'->>'result'<>'passed'
    or care_supply_private.instant(check_event->'command'->'payload'->>'dueAt')<=greatest(actual_time,at_time) or used is not null and (used->>'sequence')::integer>(cleaning->>'sequence')::integer then raise exception using errcode='23514',message='Aktuelle Prüfung, eigene Einweisung und Reinigung fehlen.';end if;
   foreach v in array array[check_event,training,cleaning] loop if v->'command'->'payload'->'asset' is distinct from p->'asset' or care_supply_private.instant(v->'command'->>'occurredAt')>actual_time then raise exception using errcode='40001',message='Gerätefassung oder Nachweiszeit passt nicht.';end if;end loop;
   if k='device_use' then
    select x into released from jsonb_array_elements(s->'events') x where x->'command'->>'kind'='device_release' and x->'command'->>'actorId'=actor and x->'command'->'payload'->'asset'->>'id'=ref order by (x->>'sequence')::integer desc limit 1;
    if released is null or released->'command'->'payload' is distinct from p or care_supply_private.instant(released->'command'->>'occurredAt')>actual_time or (released->>'sequence')::integer<greatest((check_event->>'sequence')::integer,(training->>'sequence')::integer,(cleaning->>'sequence')::integer,coalesce((used->>'sequence')::integer,0)) then raise exception using errcode='23514',message='Aktuelle eigene Gerätefreigabe fehlt.';end if;
   end if;
  end if;
 end if;
 if k='housekeeping' then
  if coalesce(p->>'category','') not in('cleaning','laundry','shopping','meals','everyday_support') or coalesce(p->>'outcome','') not in('done','not_done') or p->>'activity'~*'(medikament|injektion|insulin|wund|verband|katheter|infusion|behandlungspflege|sauerstoff|kompression|absaug|tracheo|blutzucker|stoma|intimpflege|körperpflege)'
   or care_supply_private.instant(p->>'startedAt')>care_supply_private.instant(p->>'endedAt') or care_supply_private.instant(p->>'endedAt')>actual_time then raise exception using errcode='23514',message='Nur tatsächliche Hauswirtschaft und Alltagshilfe dokumentieren.';end if;
 end if;
 if k='key' then
  if p->'asset'->'snapshot'->>'group_key' is distinct from 'keys_access' or (p->>'reference'~*'\m(pin|passwort|kennwort|türcode|zugangscode)\M' or p->>'reference'~'^\s*[0-9]{4,12}\s*$') then raise exception using errcode='23514',message='Schlüsseloriginal und nicht geheime Vorgangsreferenz erforderlich.';end if;
  select x into prior from jsonb_array_elements(s->'events') x where x->'command'->>'kind'='key' and x->'command'->'payload'->'asset'->>'id'=p->'asset'->>'id' order by (x->>'sequence')::integer desc limit 1;
  q:=prior->'command'->'payload';name:=p->>'action';
  if name='offer' then if prior is not null and q->>'action' not in('return','resolve') then raise exception using errcode='23514',message='Offene Schlüsselverwahrung vorhanden.';end if;
  else
   if prior is null or p->'asset'->>'id' is distinct from q->'asset'->>'id' or p->'responsible'->>'id' is distinct from q->'responsible'->>'id' or not case name
    when 'acknowledge' then q->>'action'='offer' and p->'responsible'->>'id'=actor when 'return' then q->>'action'='acknowledge' and p->'responsible'->>'id'=actor when 'lost' then q->>'action'='acknowledge' and p->'responsible'->>'id'=actor when 'block' then q->>'action'='lost' when 'resolve' then q->>'action'='block' else false end then raise exception using errcode='23514',message='Schlüsselaktion passt nicht zur eigenen Verwahrung oder Verlustbearbeitung.';end if;
  end if;
 end if;
 return jsonb_set(s,array['headId'],to_jsonb(eid));
end$$;

create or replace function care_supply_private.context(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare rows jsonb:='[]';v jsonb;i uuid;h jsonb;answer jsonb;begin
 perform care_supply_private.authorize(p_tenant_id,p_actor_id,p_client_id,false);h:=care_supply_private.history(p_tenant_id,p_actor_id,p_client_id);
 for i in select x.id from public.inventory_items x join public.inventory_categories g on g.id=x.category_id and g.tenant_id=p_tenant_id where x.tenant_id=p_tenant_id and g.group_key in('devices','keys_access') order by x.id loop rows:=rows||jsonb_build_array(care_supply_private.source(p_tenant_id,p_actor_id,p_client_id,'asset',i));end loop;
 if public.has_permission('qm.view') and public.has_permission('qm.view_versions') and care_handover_private.profile_has(p_tenant_id,p_actor_id,array['qm.view','qm.view_versions']) then
  for i in select r.id from public.qm_document_versions r join public.qm_documents d on d.id=r.document_id and d.tenant_id=p_tenant_id where r.tenant_id=p_tenant_id and d.current_version_id=r.id and d.status in('approved','published') and r.status in('approved','published') order by r.id loop rows:=rows||jsonb_build_array(care_supply_private.source(p_tenant_id,p_actor_id,p_client_id,'qm_version',i));end loop;
 end if;
 if public.has_permission('office.documents.view') and care_handover_private.profile_has(p_tenant_id,p_actor_id,array['office.documents.view']) then
  for i in select d.id from public.client_documents d where d.tenant_id=p_tenant_id and d.client_id=p_client_id and d.status='aktiv' and (d.sensitivity<>'restricted' or public.has_permission('office.clients.view_sensitive') and care_handover_private.profile_has(p_tenant_id,p_actor_id,array['office.clients.view_sensitive'])) order by d.id loop rows:=rows||jsonb_build_array(care_supply_private.source(p_tenant_id,p_actor_id,p_client_id,'case_document',i));end loop;
 end if;
 answer:=jsonb_build_object('version','2026-10-16.1','tenantId',p_tenant_id::text,'actorId',p_actor_id::text,'clientId',p_client_id::text,'loadedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'client',(select jsonb_build_object('id',c.id::text,'tenant_id',c.tenant_id::text,'first_name',c.first_name,'last_name',c.last_name,'sensitivity',c.sensitivity,'updated_at',c.updated_at) from public.clients c where c.id=p_client_id and c.tenant_id=p_tenant_id),
  'sources',jsonb_build_object('count',jsonb_array_length(rows),'rows',rows),'people',(select jsonb_build_object('count',count(*),'rows',coalesce(jsonb_agg(v order by v->>'name',v->>'id'),'[]')) from (select care_supply_private.person(p_tenant_id,p.id) v from public.profiles p where p.tenant_id=p_tenant_id) q where v is not null),'history',h);
 if octet_length(answer::text)>16000000 then raise exception using errcode='23514',message='Vollständiger Fallbestand ist zu groß.';end if;return answer;
end$$;
create or replace function care_supply_private.clients(p_tenant_id uuid,p_actor_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare answer jsonb;begin
 perform care_supply_private.authorize(p_tenant_id,p_actor_id,null,false);
 select jsonb_build_object('version','2026-10-16.1','tenantId',p_tenant_id::text,'actorId',p_actor_id::text,'count',count(*),'clients',coalesce(jsonb_agg(jsonb_build_object('id',c.id::text,'tenant_id',c.tenant_id::text,'first_name',c.first_name,'last_name',c.last_name) order by c.last_name,c.first_name,c.id),'[]')) into answer from public.clients c where c.tenant_id=p_tenant_id and c.status='active' and c.deleted_at is null and public.is_active_pfleger_client(c.id) and (c.sensitivity<>'restricted' or public.has_permission('office.clients.view_sensitive') and care_handover_private.profile_has(p_tenant_id,p_actor_id,array['office.clients.view_sensitive']));
 if (answer->>'count')::integer>10000 then raise exception using errcode='23514',message='Vollständiger Pflegefallbestand ist zu groß.';end if;return answer;
end$$;
create or replace function care_supply_private.receipt(e care_supply_private.events) returns jsonb language sql stable set search_path='' as $$select jsonb_build_object('version','2026-10-16.1','requestId',e.request_id::text,'command',e.command,'event',care_supply_private.event_json(e))$$;
create or replace function care_supply_private.confirm(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid,p_request_id uuid,p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare e care_supply_private.events;begin
 perform care_supply_private.authorize(p_tenant_id,p_actor_id,p_client_id,false);
 select * into e from care_supply_private.events z where z.tenant_id=p_tenant_id and z.client_id=p_client_id and z.request_id=p_request_id and z.actor_id=p_actor_id;
 if e.id is null or e.command is distinct from p_command then raise exception using errcode='42501',message='Passende Originalquittung noch nicht zugänglich.';end if;
 perform care_supply_private.command_access(p_tenant_id,p_actor_id,p_client_id,e.command,false);return care_supply_private.receipt(e);
end$$;
create or replace function care_supply_private.commit(p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(p_command->>'tenantId')::uuid;a uuid:=(p_command->>'actorId')::uuid;c uuid:=(p_command->>'clientId')::uuid;request uuid:=(p_command->>'requestId')::uuid;eid uuid:=(p_command->>'eventId')::uuid;expected uuid:=(p_command->>'expectedHeadId')::uuid;
 root care_supply_private.roots;prior care_supply_private.events;e care_supply_private.events;selected_plan jsonb;state jsonb:=jsonb_build_object('headId',null,'events','[]'::jsonb,'articles','{}'::jsonb,'orders','{}'::jsonb,'lots','{}'::jsonb,'reversed','[]'::jsonb);now_at timestamptz;name text;
begin
 if octet_length(p_command::text)>2000000 then raise exception using errcode='23514',message='Originalanfrage ist zu groß.';end if;
 perform care_supply_private.authorize(t,a,c,true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t::text||':case-supply-request:'||request::text,0));
 select * into prior from care_supply_private.events z where z.tenant_id=t and z.request_id=request;
 if prior.id is not null then
  if prior.actor_id<>a or prior.client_id<>c or prior.command is distinct from p_command then raise exception using errcode='23514',message='Anfragekennung bereits anders belegt.';end if;
  perform care_supply_private.command_access(t,a,c,prior.command,false);return care_supply_private.receipt(prior);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t::text||':case-supply-root:'||c::text,0));
 insert into care_supply_private.roots(tenant_id,client_id) values(t,c) on conflict do nothing;
 select * into root from care_supply_private.roots z where z.tenant_id=t and z.client_id=c for update;
 if root.head_id is distinct from expected or root.event_count>=10000 then raise exception using errcode='40001',message='Fallbestand geändert oder vollständiger Umfang überschritten.';end if;
 for e in select * from care_supply_private.events z where z.tenant_id=t and z.client_id=c order by z.sequence loop
  if e.sequence<>jsonb_array_length(state->'events')+1 or e.previous_id::text is distinct from state->>'headId' or e.command->>'actorId' is distinct from e.actor_id::text or e.command->>'tenantId' is distinct from t::text or e.command->>'clientId' is distinct from c::text or e.command->>'eventId' is distinct from e.id::text then raise exception using errcode='23514',message='Originalkette widersprüchlich.';end if;
  perform care_supply_private.command_access(t,a,c,e.command,false);state:=care_supply_private.fold(state,e.command,e.recorded_at);
  state:=jsonb_set(state,array['events'],(state->'events')||jsonb_build_array(care_supply_private.event_json(e)));
 end loop;
 if state->>'headId' is distinct from expected::text or jsonb_array_length(state->'events')<>root.event_count then raise exception using errcode='23514',message='Vollständiger Originalbestand fehlt.';end if;
 perform care_supply_private.command_access(t,a,c,p_command,true);
 if p_command->>'kind' in('consume','infection','device_release','device_use') then
  select x into selected_plan from jsonb_array_elements(state->'events') x where x->>'id'=p_command->'payload'->>'planId' and x->'command'->>'kind'='hygiene_plan';
  if selected_plan is null then raise exception using errcode='23514',message='Originalhygienezuordnung fehlt.';end if;
  perform care_supply_private.reference_access(t,a,c,selected_plan->'command'->'payload'->'qm',true);
  if care_supply_private.person(t,(selected_plan->'command'->'payload'->'responsible'->>'id')::uuid) is null then raise exception using errcode='42501',message='Aktive hygieneverantwortliche Person fehlt.';end if;
 end if;
 now_at:=clock_timestamp();state:=care_supply_private.fold(state,p_command,now_at);
 -- Recheck native session/profile and actual rights immediately before the append.
 perform care_supply_private.authorize(t,a,c,true);
 name:=care_supply_private.person(t,a)->>'name';
 insert into care_supply_private.events(id,tenant_id,client_id,sequence,previous_id,request_id,actor_id,actor_name,recorded_at,command) values(eid,t,c,root.event_count+1,expected,request,a,name,now_at,p_command) returning * into e;
 update care_supply_private.roots set head_id=eid,event_count=root.event_count+1 where tenant_id=t and client_id=c;
 return care_supply_private.receipt(e);
end$$;
revoke all on all functions in schema care_supply_private from public,anon,authenticated;
-- Only guarded entry points are callable; helpers, state folds and tables stay private.
grant usage on schema care_supply_private to authenticated;
grant execute on function care_supply_private.clients(uuid,uuid),care_supply_private.context(uuid,uuid,uuid),care_supply_private.commit(jsonb),care_supply_private.confirm(uuid,uuid,uuid,uuid,jsonb) to authenticated;
create or replace function public.web_supply_clients(p_tenant_id uuid,p_actor_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_supply_private.clients(p_tenant_id,p_actor_id)$$;
create or replace function public.web_supply_context(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid) returns jsonb language sql security invoker set search_path='' as $$select care_supply_private.context(p_tenant_id,p_actor_id,p_client_id)$$;
create or replace function public.web_commit_supply(p_command jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_supply_private.commit(p_command)$$;
create or replace function public.web_confirm_supply(p_tenant_id uuid,p_actor_id uuid,p_client_id uuid,p_request_id uuid,p_command jsonb) returns jsonb language sql security invoker set search_path='' as $$select care_supply_private.confirm(p_tenant_id,p_actor_id,p_client_id,p_request_id,p_command)$$;
revoke all on function public.web_supply_clients(uuid,uuid),public.web_supply_context(uuid,uuid,uuid),public.web_commit_supply(jsonb),public.web_confirm_supply(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.web_supply_clients(uuid,uuid),public.web_supply_context(uuid,uuid,uuid),public.web_commit_supply(jsonb),public.web_confirm_supply(uuid,uuid,uuid,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
