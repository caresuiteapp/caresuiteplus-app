-- LOCAL REVIEW ONLY: not applied. Requires care clinical core + care_private schema.
-- No pump control, dose calculation, medication/stock/billing booking or clinical authorization.
begin;
create table if not exists public.care_infusion_episodes(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 version text not null,route text not null check(route in ('iv','sc')),purpose text not null check(purpose in ('fluid','nutrition','medication')),title text not null,
 recorded_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 unique(id,tenant_id,client_id)
);
create table if not exists public.care_infusion_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),episode_id uuid not null,
 sequence integer not null check(sequence>0),previous_id uuid,actor_id uuid not null references public.profiles(id),request_id uuid not null,
 recorded_at timestamptz not null,actor_name text not null,checker_name text,draft jsonb not null,request_payload jsonb not null,
 foreign key(episode_id,tenant_id,client_id) references public.care_infusion_episodes(id,tenant_id,client_id),
 unique(episode_id,sequence),unique(tenant_id,request_id),unique(id,episode_id),
 foreign key(previous_id,episode_id) references public.care_infusion_events(id,episode_id),
 check((sequence=1)=(previous_id is null)),check(jsonb_typeof(draft)='object'),check(jsonb_typeof(request_payload)='object')
);
create index if not exists care_infusion_episode_client on public.care_infusion_episodes(tenant_id,client_id,created_at desc,id desc);
create index if not exists care_infusion_event_course on public.care_infusion_events(tenant_id,episode_id,sequence);
alter table public.care_infusion_episodes enable row level security;
alter table public.care_infusion_events enable row level security;
revoke all on public.care_infusion_episodes,public.care_infusion_events from public,anon,authenticated;
grant select on public.care_infusion_episodes,public.care_infusion_events to authenticated;
drop policy if exists infusion_episode_read on public.care_infusion_episodes;
create policy infusion_episode_read on public.care_infusion_episodes for select to authenticated using(
 auth.uid() is not null and tenant_id=public.current_tenant_id() and public.has_permission('pflege.treatment.view') and public.has_permission('pflege.orders.view')
 and public.is_active_pfleger_client(client_id) and exists(select 1 from public.clients c where c.id=care_infusion_episodes.client_id and c.tenant_id=care_infusion_episodes.tenant_id and c.deleted_at is null and c.status='active')
 and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=care_infusion_episodes.tenant_id and p.is_active)
);
drop policy if exists infusion_event_read on public.care_infusion_events;
create policy infusion_event_read on public.care_infusion_events for select to authenticated using(
 auth.uid() is not null and tenant_id=public.current_tenant_id() and public.has_permission('pflege.treatment.view') and public.has_permission('pflege.orders.view')
 and exists(select 1 from public.care_infusion_episodes e where e.id=episode_id and e.tenant_id=care_infusion_events.tenant_id and e.client_id=care_infusion_events.client_id)
);

create or replace function care_private.infusion_uuid(value text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false)
$$;
create or replace function care_private.infusion_ml(value text) returns numeric language plpgsql immutable set search_path='' as $$
declare n numeric;begin
 if value is null or value !~ '^[0-9]{1,7}([.,][0-9]{1,6})?$' then raise exception 'Tatsächliche Dezimalmenge ungültig.' using errcode='23514';end if;
 n:=replace(value,',','.')::numeric;if n>1000000 then raise exception 'Technische Mengengrenze überschritten.' using errcode='23514';end if;return n;
end $$;
create or replace function care_private.infusion_time(value text) returns timestamptz language plpgsql immutable set search_path='' set timezone='UTC' as $$
declare t timestamptz;begin
 if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'ISO-Zeitpunkt mit Zeitzone fehlt.' using errcode='23514';end if;
 t:=value::timestamptz;if not isfinite(t) then raise exception 'Zeitpunkt ungültig.' using errcode='23514';end if;return t;
end $$;
create or replace function care_private.validate_infusion_draft(ep jsonb,d jsonb,server_now timestamptz) returns void language plpgsql set search_path='' as $$
declare f text;k text:=d->>'kind';at_time timestamptz;s jsonb;day date;config boolean;container boolean;correction boolean;
 keys text[]:=array['kind','occurredAt','observation','accessReview','communication','personDecision','qualificationBasis','deviation','orderState','orderId','orderSnapshotJson','orderRelation','orderReason','medicationDocumentation','medicationReason','deviceMode','deviceId','deviceModel','deviceCheck','checkerId','rateMlHour','parameterBasis','containerId','solution','concentration','preparedMl','remainingState','remainingMl','remainingReason','deliveredState','deliveredMl','deliveredReason','volumeException','alarmAction','closure','reviewState','reviewAt','reviewReason','targetEventId','expectedCorrectionId','correctionReason'];
 config_keys text[]:=array['deviceMode','deviceId','deviceModel','deviceCheck','checkerId','rateMlHour','parameterBasis'];
 container_keys text[]:=array['containerId','solution','concentration','preparedMl'];
 quantity_keys text[]:=array['remainingState','remainingMl','remainingReason','deliveredState','deliveredMl','deliveredReason','volumeException'];
 source_keys text[]:=array['orderState','orderId','orderSnapshotJson','orderRelation','orderReason','medicationDocumentation','medicationReason'];
 clinical_keys text[]:=array['observation','accessReview','communication','personDecision','qualificationBasis','deviation'];
begin
 if jsonb_typeof(d) is distinct from 'object' or (d-keys)<>'{}'::jsonb then raise exception 'Ereignisfelder ungültig.' using errcode='23514';end if;
 foreach f in array keys loop if jsonb_typeof(d->f) is distinct from 'string' or length(d->>f)>case when f='orderSnapshotJson' then 180000 else 2000 end then raise exception 'Ereignisfeld fehlt oder zu umfangreich: %',f using errcode='23514';end if;end loop;
 if k not in ('start','check','pause','resume','parameters','container','device','alarm','finish','abort','review','correction') then raise exception 'Ereignisart ungültig.' using errcode='23514';end if;
 at_time:=care_private.infusion_time(d->>'occurredAt');if at_time>server_now then raise exception 'Tatsächlicher Zeitpunkt liegt in der Zukunft.' using errcode='23514';end if;
 foreach f in array array['containerId','deviceId','deviceModel'] loop if d->>f<>btrim(d->>f) then raise exception 'Kennung mit Rand-Leerzeichen.' using errcode='23514';end if;end loop;
 foreach f in array array['orderId','checkerId','targetEventId','expectedCorrectionId'] loop if d->>f<>lower(d->>f) then raise exception 'Originalkennung in kanonischer Schreibweise übernehmen.' using errcode='23514';end if;end loop;
 correction:=k='correction';
 if correction then
  if not care_private.infusion_uuid(d->>'targetEventId') or ((d->>'expectedCorrectionId')<>'' and not care_private.infusion_uuid(d->>'expectedCorrectionId')) or nullif(btrim(d->>'correctionReason'),'') is null
   or not exists(select 1 from unnest(clinical_keys) x where nullif(btrim(d->>x),'') is not null) then raise exception 'Berichtigungsbezug, Grund oder Text fehlt.' using errcode='23514';end if;
  foreach f in array config_keys||container_keys||quantity_keys||source_keys||array['alarmAction','closure','reviewState','reviewAt','reviewReason'] loop if nullif(btrim(d->>f),'') is not null then raise exception 'Textberichtigung darf Parameter, Mengen, Quellen oder Status nicht ersetzen.' using errcode='23514';end if;end loop;return;
 end if;
 foreach f in array array['targetEventId','expectedCorrectionId','correctionReason'] loop if nullif(btrim(d->>f),'') is not null then raise exception 'Original darf keinen Berichtigungsbezug tragen.' using errcode='23514';end if;end loop;
 foreach f in array array['observation','accessReview','communication','personDecision','qualificationBasis'] loop if nullif(btrim(d->>f),'') is null then raise exception 'Tatsächliche Beobachtung und Grundlage fehlen.' using errcode='23514';end if;end loop;
 if k in ('pause','abort','alarm') and nullif(btrim(d->>'deviation'),'') is null then raise exception 'Tatsächlicher Abweichungsgrund fehlt.' using errcode='23514';end if;
 if d->>'orderState'='linked' then
  s:=(d->>'orderSnapshotJson')::jsonb;day:=(at_time at time zone 'Europe/Berlin')::date;
  if jsonb_typeof(s) is distinct from 'object' or not care_private.infusion_uuid(d->>'orderId') or s->>'id' is distinct from d->>'orderId' or s->>'tenant_id' is distinct from ep->>'tenantId' or s->>'client_id' is distinct from ep->>'clientId'
   or s->>'status' is distinct from 'active' or nullif(btrim(s->>'ordering_physician'),'') is null or nullif(btrim(s->>'description'),'') is null
   or s->>'ordered_at' is null or s->>'valid_from' is null or day<(s->>'ordered_at')::date or day<(s->>'valid_from')::date or ((s->>'valid_until') is not null and day>(s->>'valid_until')::date)
   or nullif(btrim(d->>'orderRelation'),'') is null or nullif(btrim(d->>'orderReason'),'') is not null then raise exception 'Damals gültige ärztliche Anordnungsfassung fehlt oder fremd.' using errcode='23514';end if;
 else
  if d->>'orderState'<>'unconfirmed' or d->>'orderId'<>'' or d->>'orderSnapshotJson'<>'' or d->>'orderRelation'<>'' or nullif(btrim(d->>'orderReason'),'') is null or nullif(btrim(d->>'deviation'),'') is null then raise exception 'Ungeklärte Grundlage ausdrücklich dokumentieren.' using errcode='23514';end if;
 end if;
 if d->>'medicationDocumentation'<>case when ep->>'purpose'='medication' then 'separate_required' else 'not_applicable' end or nullif(btrim(d->>'medicationReason'),'') is null then raise exception 'Medikamentengabe benötigt eigene Dokumentation.' using errcode='23514';end if;
 config:=k in ('start','parameters','device');container:=k in ('start','container');
 if config then
  if d->>'deviceMode' not in ('pump','gravity') or care_private.infusion_ml(d->>'rateMlHour')<=0 or nullif(btrim(d->>'parameterBasis'),'') is null or nullif(btrim(d->>'deviceCheck'),'') is null or not care_private.infusion_uuid(d->>'checkerId') then raise exception 'Einstellung, Geräteprüfung oder prüfende Person fehlt.' using errcode='23514';end if;
  if d->>'deviceMode'='pump' and (nullif(btrim(d->>'deviceId'),'') is null or nullif(btrim(d->>'deviceModel'),'') is null) then raise exception 'Tatsächliche Pumpe fehlt.' using errcode='23514';end if;
  if d->>'deviceMode'='gravity' and (nullif(btrim(d->>'deviceId'),'') is not null or nullif(btrim(d->>'deviceModel'),'') is not null) then raise exception 'Schwerkraftinfusion darf keine Pumpe vortäuschen.' using errcode='23514';end if;
 else foreach f in array config_keys loop if nullif(btrim(d->>f),'') is not null then raise exception 'Parameteränderung benötigt eigenes Ereignis.' using errcode='23514';end if;end loop;end if;
 if container then
  foreach f in array container_keys loop if nullif(btrim(d->>f),'') is null then raise exception 'Behälterangaben fehlen.' using errcode='23514';end if;end loop;
  if care_private.infusion_ml(d->>'preparedMl')<=0 then raise exception 'Vorbereitete tatsächliche Menge fehlt.' using errcode='23514';end if;
 else foreach f in array container_keys loop if nullif(btrim(d->>f),'') is not null then raise exception 'Behälteränderung benötigt eigenes Ereignis.' using errcode='23514';end if;end loop;end if;
 if k='review' then foreach f in array quantity_keys loop if nullif(btrim(d->>f),'') is not null then raise exception 'Nachkontrolle darf keine verabreichte Menge ersetzen.' using errcode='23514';end if;end loop;
 else
  foreach f in array array['remaining','delivered'] loop
   if d->>(f||'State')='measured' then perform care_private.infusion_ml(d->>(f||'Ml'));if nullif(btrim(d->>(f||'Reason')),'') is not null then raise exception 'Messwert und fehlende Messung widersprüchlich.' using errcode='23514';end if;
   elsif d->>(f||'State')<>'not_measured' or nullif(btrim(d->>(f||'Ml')),'') is not null or nullif(btrim(d->>(f||'Reason')),'') is null then raise exception 'Fehlende Messung begründen.' using errcode='23514';end if;
  end loop;
 end if;
 if k='alarm' then if nullif(btrim(d->>'alarmAction'),'') is null then raise exception 'Alarmreaktion fehlt.' using errcode='23514';end if;
 elsif nullif(btrim(d->>'alarmAction'),'') is not null then raise exception 'Alarmreaktion braucht Alarmereignis.' using errcode='23514';end if;
 if k in ('finish','abort') then if nullif(btrim(d->>'closure'),'') is null then raise exception 'Zugangsabschluss fehlt.' using errcode='23514';end if;
 elsif nullif(btrim(d->>'closure'),'') is not null then raise exception 'Abschluss braucht Abschlussereignis.' using errcode='23514';end if;
 if k='review' then if d->>'reviewState'<>'completed' or d->>'reviewAt'<>'' or nullif(btrim(d->>'reviewReason'),'') is null then raise exception 'Tatsächliche Nachkontrolle fehlt.' using errcode='23514';end if;
 elsif d->>'reviewState'='scheduled' then if care_private.infusion_time(d->>'reviewAt')<=at_time or nullif(btrim(d->>'reviewReason'),'') is null then raise exception 'Späteren tatsächlichen Kontrolltermin begründen.' using errcode='23514';end if;
 elsif d->>'reviewState' not in ('pending','not_required') or d->>'reviewAt'<>'' or nullif(btrim(d->>'reviewReason'),'') is null then raise exception 'Kontrollbedarf ausdrücklich dokumentieren.' using errcode='23514';end if;
end $$;

create or replace function care_private.write_infusion_event(request_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();actor_name text;checker_name text;ep jsonb;d jsonb;subject uuid;episode uuid;server_now timestamptz;at_time timestamptz;
 receipt public.care_infusion_events%rowtype;existing public.care_infusion_episodes%rowtype;e public.care_infusion_events%rowtype;o public.care_medical_orders%rowtype;
 head uuid;seq integer:=0;state text:='not_started';last_at timestamptz;last_recorded timestamptz;config jsonb;prepared numeric;last_known numeric;containers text[]:=array[]::text[];kind text;result uuid;original public.care_infusion_events%rowtype;correction_head uuid;
begin
 if auth.uid() is null or tenant is null or actor is null or public.has_permission('pflege.treatment.view') is not true or public.has_permission('pflege.treatment.manage') is not true or public.has_permission('pflege.orders.view') is not true
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active) then raise exception 'Keine Berechtigung oder kein aktives Profil.' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or payload-array['episode','expectedHeadId','draft']<>'{}'::jsonb or jsonb_typeof(payload->'episode') is distinct from 'object' or jsonb_typeof(payload->'expectedHeadId') is distinct from 'string' or length(payload::text)>300000 then raise exception 'Infusionsanfrage ungültig.' using errcode='23514';end if;
 ep:=payload->'episode';if ep-array['id','clientId','version','route','purpose','title']<>'{}'::jsonb or (select count(*) from jsonb_each(ep))<>6 or exists(select 1 from jsonb_each(ep) x where jsonb_typeof(x.value)<>'string' or length(x.value#>>'{}')>2000)
 or not care_private.infusion_uuid(ep->>'id') or not care_private.infusion_uuid(ep->>'clientId') or ep->>'version'<>'2026-10-09.1' or ep->>'route' not in ('iv','sc') or ep->>'purpose' not in ('fluid','nutrition','medication') or nullif(btrim(ep->>'title'),'') is null
 or ep->>'id'<>lower(ep->>'id') or ep->>'clientId'<>lower(ep->>'clientId') or payload->>'expectedHeadId'<>lower(payload->>'expectedHeadId')
 or (payload->>'expectedHeadId'<>'' and not care_private.infusion_uuid(payload->>'expectedHeadId')) then raise exception 'Infusionsfall oder erwarteter Verlauf ungültig.' using errcode='23514';end if;
 subject:=(ep->>'clientId')::uuid;episode:=(ep->>'id')::uuid;ep:=ep||jsonb_build_object('tenantId',tenant::text);d:=payload->'draft';
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tenant::text||':infusion:'||request_id::text,0));
 perform 1 from public.clients c where c.id=subject and c.tenant_id=tenant and c.deleted_at is null and c.status='active' for no key update;
 if not found or public.is_active_pfleger_client(subject) is not true then raise exception 'Kein aktiver Pflegefall.' using errcode='42501';end if;
 select * into receipt from public.care_infusion_events x where x.tenant_id=tenant and x.request_id=write_infusion_event.request_id;
 if receipt.id is not null then
  if receipt.actor_id<>actor or receipt.request_payload<>payload then raise exception 'Anfrage-ID mit anderer Person oder anderen Angaben verwendet.' using errcode='23514';end if;
  return jsonb_build_object('id',receipt.id::text,'tenantId',tenant::text,'episodeId',receipt.episode_id::text,'requestId',request_id::text,'previousId',coalesce(receipt.previous_id::text,''),'sequence',receipt.sequence);
 end if;
 select * into existing from public.care_infusion_episodes x where x.id=episode for update;
 if existing.id is not null then
  if jsonb_build_object('id',existing.id::text,'tenantId',existing.tenant_id::text,'clientId',existing.client_id::text,'version',existing.version,'route',existing.route,'purpose',existing.purpose,'title',existing.title)<>ep then raise exception 'Infusionsfall geändert oder fremd.' using errcode='40001';end if;
 elsif d->>'kind' is distinct from 'start' or payload->>'expectedHeadId'<>'' then raise exception 'Neuer Verlauf braucht einen tatsächlichen Beginn.' using errcode='23514';end if;
 server_now:=clock_timestamp();perform care_private.validate_infusion_draft(ep,d,server_now);at_time:=care_private.infusion_time(d->>'occurredAt');kind:=d->>'kind';
 -- Reconstruct state from original events only; immutable text corrections never change numerical state.
 for e in select * from public.care_infusion_events x where x.episode_id=episode and x.tenant_id=tenant and x.client_id=subject order by x.sequence loop
  if e.sequence<>seq+1 or e.previous_id is distinct from head or e.recorded_at<care_private.infusion_time(e.draft->>'occurredAt') or (last_recorded is not null and e.recorded_at<last_recorded) then raise exception 'Verlaufskette beschädigt.' using errcode='23514';end if;
  perform care_private.validate_infusion_draft(ep,e.draft,server_now);seq:=e.sequence;head:=e.id;last_recorded:=e.recorded_at;
  if e.draft->>'kind'<>'correction' then
   last_at:=care_private.infusion_time(e.draft->>'occurredAt');
   if e.draft->>'kind' in ('start','resume') then state:='running';elsif e.draft->>'kind'='pause' then state:='paused';elsif e.draft->>'kind'='finish' then state:='finished';elsif e.draft->>'kind'='abort' then state:='aborted';end if;
   if e.draft->>'kind' in ('start','container') then containers:=array_append(containers,e.draft->>'containerId');prepared:=care_private.infusion_ml(e.draft->>'preparedMl');end if;
   if e.draft->>'kind' in ('start','parameters','device') then config:=e.draft;end if;
   if e.draft->>'deliveredState'='measured' then last_known:=care_private.infusion_ml(e.draft->>'deliveredMl');end if;
  end if;
 end loop;
 if coalesce(head::text,'')<>payload->>'expectedHeadId' then raise exception 'Verlauf zwischenzeitlich ergänzt.' using errcode='40001';end if;
 if last_recorded is not null and server_now<last_recorded then raise exception 'Serverzeit liegt vor letztem Erfassungszeitpunkt.' using errcode='23514';end if;
 if kind='correction' then
  select * into original from public.care_infusion_events x where x.id=(d->>'targetEventId')::uuid and x.episode_id=episode and x.tenant_id=tenant and x.client_id=subject;
  if original.id is null or original.draft->>'kind'='correction' or at_time<care_private.infusion_time(original.draft->>'occurredAt') then raise exception 'Vorheriges Originalereignis fehlt.' using errcode='23514';end if;
  select x.id into correction_head from public.care_infusion_events x where x.episode_id=episode and x.draft->>'kind'='correction' and x.draft->>'targetEventId'=d->>'targetEventId' order by sequence desc limit 1;
  if coalesce(correction_head::text,'')<>d->>'expectedCorrectionId' then raise exception 'Berichtigungsstand inzwischen geändert.' using errcode='40001';end if;
 else
  if last_at is not null and at_time<last_at then raise exception 'Rückdatierte Handlung verändert Verlauf; eigenes Nachtragsverfahren erforderlich.' using errcode='23514';end if;
  if (state='not_started' and kind<>'start') or (state<>'not_started' and kind='start') or (state in ('finished','aborted') and kind<>'review') or (kind='review' and state not in ('finished','aborted')) or (kind='pause' and state<>'running') or (kind='resume' and state<>'paused') then raise exception 'Ereignis passt nicht zum tatsächlichen Verlaufszustand.' using errcode='23514';end if;
  if d->>'orderState'='linked' then
   select * into o from public.care_medical_orders x where x.id=(d->>'orderId')::uuid and x.tenant_id=tenant and x.client_id=subject for share;
   if o.id is null or to_jsonb(o) is distinct from (d->>'orderSnapshotJson')::jsonb then raise exception 'Anordnungsquelle geändert oder fremd.' using errcode='40001';end if;
  end if;
  if kind in ('start','parameters','device') then
   select coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt') into checker_name from public.profiles p where p.id=(d->>'checkerId')::uuid and p.tenant_id=tenant and p.is_active for share;
   if not found then raise exception 'Prüfende Person gehört nicht zum aktiven eigenen Team.' using errcode='42501';end if;
  end if;
  if kind in ('start','container') then
   if d->>'containerId'=any(containers) then raise exception 'Behälterkennung bereits verwendet.' using errcode='23514';end if;prepared:=care_private.infusion_ml(d->>'preparedMl');
  end if;
  if kind='parameters' and (config is null or d->>'deviceMode'<>config->>'deviceMode' or d->>'deviceId'<>config->>'deviceId' or d->>'deviceModel'<>config->>'deviceModel' or care_private.infusion_ml(d->>'rateMlHour')=care_private.infusion_ml(config->>'rateMlHour')) then raise exception 'Parameteränderung benötigt gleiches Gerät und tatsächlich andere Rate.' using errcode='23514';end if;
  if kind='device' and config is not null and d->>'deviceMode'=config->>'deviceMode' and d->>'deviceId'=config->>'deviceId' and d->>'deviceModel'=config->>'deviceModel' then raise exception 'Kein tatsächlicher Gerätewechsel.' using errcode='23514';end if;
  if kind<>'review' then
   if d->>'deliveredState'='measured' and last_known is not null then
    if care_private.infusion_ml(d->>'deliveredMl')<last_known then raise exception 'Kumulative verabreichte Menge darf nicht sinken.' using errcode='23514';end if;
    if state='paused' and care_private.infusion_ml(d->>'deliveredMl')<>last_known and nullif(btrim(d->>'volumeException'),'') is null then raise exception 'Mengenanstieg während Pause tatsächlich erklären.' using errcode='23514';end if;
   end if;
   if d->>'remainingState'='measured' and prepared is not null and care_private.infusion_ml(d->>'remainingMl')>prepared and nullif(btrim(d->>'volumeException'),'') is null then raise exception 'Behälterrest größer als vorbereitete Menge; Abweichung erforderlich.' using errcode='23514';end if;
  end if;
 end if;
 if existing.id is null then insert into public.care_infusion_episodes(id,tenant_id,client_id,version,route,purpose,title,recorded_by,created_at) values(episode,tenant,subject,ep->>'version',ep->>'route',ep->>'purpose',ep->>'title',actor,server_now);end if;
 select coalesce(nullif(btrim(p.display_name),''),nullif(btrim(p.email),''),'Person ohne Anzeigenamen') into actor_name from public.profiles p where p.id=actor;
 insert into public.care_infusion_events(tenant_id,client_id,episode_id,sequence,previous_id,actor_id,request_id,recorded_at,actor_name,checker_name,draft,request_payload) values(tenant,subject,episode,seq+1,head,actor,request_id,server_now,actor_name,checker_name,d,payload) returning id into result;
 -- Protected table holds clinical details. General audit carries identity/revision only, not clinical snapshots.
 insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name) values(tenant,subject,'infusion_event',result,'created','Tatsächliches Infusionsereignis dokumentiert',jsonb_build_object('episodeId',episode::text,'sequence',seq+1,'kind',kind),actor,actor_name);
 return jsonb_build_object('id',result::text,'tenantId',tenant::text,'episodeId',episode::text,'requestId',request_id::text,'previousId',coalesce(head::text,''),'sequence',seq+1);
end $$;
create or replace function public.write_infusion_event(request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select care_private.write_infusion_event(request_id,payload) $$;

-- One statement returns count, metadata, head and all events from one MVCC statement snapshot.
create or replace function public.read_infusion_courses(requested_tenant uuid,requested_client uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare answer jsonb;begin
 if auth.uid() is null or requested_tenant is distinct from public.current_tenant_id() or public.has_permission('pflege.treatment.view') is not true or public.has_permission('pflege.orders.view') is not true
 or not exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=requested_tenant and p.is_active) then raise exception 'Infusionsleserecht oder aktives Profil fehlt.' using errcode='42501';end if;
 if requested_client is not null and (public.is_active_pfleger_client(requested_client) is not true or not exists(select 1 from public.clients c where c.id=requested_client and c.tenant_id=requested_tenant and c.deleted_at is null and c.status='active')) then raise exception 'Pflegeakte nicht zugänglich.' using errcode='42501';end if;
 with courses as (
  select e.created_at,e.id,jsonb_build_object('episode',jsonb_build_object('id',e.id::text,'tenantId',e.tenant_id::text,'clientId',e.client_id::text,'version',e.version,'route',e.route,'purpose',e.purpose,'title',e.title),
   'events',coalesce(history.items,'[]'::jsonb),'headId',coalesce(history.head_id,''),'eventCount',history.n,'names',coalesce(history.names,'{}'::jsonb)) item
  from public.care_infusion_episodes e cross join lateral (
   select count(*) n,(array_agg(x.id::text order by x.sequence desc))[1] head_id,jsonb_object_agg(x.id::text,jsonb_build_object('actorName',x.actor_name,'checkerName',x.checker_name)) names,
    jsonb_agg(jsonb_build_object('id',x.id::text,'episodeId',x.episode_id::text,'tenantId',x.tenant_id::text,'clientId',x.client_id::text,'sequence',x.sequence,'previousId',coalesce(x.previous_id::text,''),'actorId',x.actor_id::text,'requestId',x.request_id::text,'recordedAt',to_char(x.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'draft',x.draft) order by x.sequence) items
   from public.care_infusion_events x where x.episode_id=e.id and x.tenant_id=e.tenant_id and x.client_id=e.client_id
  ) history where e.tenant_id=requested_tenant and (requested_client is null or e.client_id=requested_client)
 ) select jsonb_build_object('version','2026-10-09.1','tenantId',requested_tenant::text,'clientId',requested_client::text,'count',count(*),'courses',coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb)) into answer from courses;
 return answer;
end $$;
revoke all on function care_private.infusion_uuid(text),care_private.infusion_ml(text),care_private.infusion_time(text),care_private.validate_infusion_draft(jsonb,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function care_private.write_infusion_event(uuid,jsonb),public.write_infusion_event(uuid,jsonb),public.read_infusion_courses(uuid,uuid) from public,anon;
grant execute on function care_private.write_infusion_event(uuid,jsonb),public.write_infusion_event(uuid,jsonb),public.read_infusion_courses(uuid,uuid) to authenticated;
commit;
