-- Wundakte. Apply to a clinical acceptance database with the wound workspace schema first.
-- This patch preserves the original wound workspace grants and correction history.
begin;

create table if not exists public.ambulatory_wound_clinical_entries (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  wound_case_id uuid references public.clinical_wound_cases(id),
  kind text not null check (kind in ('measurement','note','risk','anamnesis','diabetic_foot','tracheostomy','material','body_mark')),
  observed_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  recorded_by uuid not null references public.profiles(id),
  recorded_by_name text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  check ((wound_case_id is null) = (kind in ('risk','anamnesis','diabetic_foot','tracheostomy')))
);
create index if not exists wound_record_client_page on public.ambulatory_wound_clinical_entries
  (tenant_id,client_id,wound_case_id,created_at desc,id desc);
create index if not exists wound_record_factors on public.ambulatory_wound_clinical_entries
  (tenant_id,client_id,observed_at) where kind = 'anamnesis';

create table if not exists public.ambulatory_wound_media (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id),
  wound_case_id uuid references public.clinical_wound_cases(id),
  assessment_id uuid references public.clinical_wound_assessments(id),
  consent_id uuid references public.client_consents(id),
  kind text not null check (kind in ('wound_photo','patient_photo','voice')),
  storage_path text not null unique,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check (state in ('pending','ready')),
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  observed_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  recorded_by uuid not null references public.profiles(id),
  check ((kind = 'wound_photo') = (wound_case_id is not null and assessment_id is not null)),
  check ((kind <> 'voice') = (consent_id is not null))
);
create index if not exists wound_record_media_page on public.ambulatory_wound_media
  (tenant_id,client_id,wound_case_id,created_at desc,id desc) where state = 'ready';
create unique index if not exists wound_record_media_photo_original on public.ambulatory_wound_media
  (tenant_id,wound_case_id,content_sha256) where kind = 'wound_photo';

create table if not exists public.ambulatory_wound_catalog (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  kind text not null check (kind in ('description','treatment','article')),
  name text not null,
  text text not null default '',
  supplier text not null default '',
  code text not null default '',
  unit text not null default '',
  unit_cents integer check (unit_cents between 0 and 100000000),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists wound_catalog_tenant_page on public.ambulatory_wound_catalog (tenant_id,created_at desc,id desc);

alter table public.ambulatory_wound_clinical_entries enable row level security;
alter table public.ambulatory_wound_media enable row level security;
alter table public.ambulatory_wound_catalog enable row level security;
revoke all on public.ambulatory_wound_clinical_entries,public.ambulatory_wound_media,public.ambulatory_wound_catalog
  from public,anon,authenticated;
grant select on public.ambulatory_wound_clinical_entries,public.ambulatory_wound_catalog to authenticated;
grant select (id,tenant_id,client_id,wound_case_id,assessment_id,kind,file_name,mime_type,size_bytes,observed_at,created_at,state)
  on public.ambulatory_wound_media to authenticated;

create or replace function care_private.wound_record_allowed(t uuid,c uuid,w uuid,writing boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or t is null or t is distinct from public.current_tenant_id() then return false; end if;
  if care_private.wound_has_permission('pflege.wounds.view') is not true then return false; end if;
  if writing and care_private.wound_has_permission('pflege.wounds.manage') is not true then return false; end if;
  if c is not null and care_private.wound_active_client(c) is not true then return false; end if;
  return w is null or exists(
    select 1 from public.clinical_wound_cases x where x.tenant_id=t and x.client_id=c and x.id=w
  );
end $$;

create or replace function care_private.wound_record_consent(t uuid,c uuid,consent uuid,observed timestamptz)
returns boolean language sql security definer set search_path = '' as $$
  select consent is not null and exists(
    select 1 from public.client_consents x
    where x.id=consent and x.tenant_id=t and x.client_id=c and x.consent_type='foto_video' and x.granted
      and x.granted_at is not null and isfinite(x.granted_at) and x.granted_at<=observed
      and (x.expires_at is null or x.expires_at>clock_timestamp())
  );
$$;

create or replace function care_private.assert_wound_record_scope(t uuid,a uuid,c uuid,w uuid,writing boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if a is null or a is distinct from public.resolve_current_profile_id()
     or (w is not null and c is null) or care_private.wound_record_allowed(t,c,w,writing) is not true then
    raise exception 'Keine Berechtigung für diesen Wundaktenbezug.' using errcode = '42501';
  end if;
end $$;

create or replace function care_private.wound_record_media_visible(t uuid,c uuid,w uuid,k text,g uuid,observed timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  return care_private.wound_record_allowed(t,c,w,false)
    and (k='voice' or care_private.wound_record_consent(t,c,g,observed));
end $$;

drop policy if exists wound_record_read on public.ambulatory_wound_clinical_entries;
create policy wound_record_read on public.ambulatory_wound_clinical_entries for select to authenticated
  using (tenant_id=(select public.current_tenant_id()) and care_private.wound_record_allowed(tenant_id,client_id,wound_case_id,false));
drop policy if exists wound_record_catalog_read on public.ambulatory_wound_catalog;
create policy wound_record_catalog_read on public.ambulatory_wound_catalog for select to authenticated
  using (tenant_id=(select public.current_tenant_id()) and (select care_private.wound_record_allowed(public.current_tenant_id(),null,null,false)));
drop policy if exists wound_record_media_read on public.ambulatory_wound_media;
create policy wound_record_media_read on public.ambulatory_wound_media for select to authenticated
  using (state='ready' and tenant_id=(select public.current_tenant_id())
    and care_private.wound_record_media_visible(tenant_id,client_id,wound_case_id,kind,consent_id,observed_at));

create or replace function care_private.read_wound_record_context(t uuid,a uuid,c uuid,w uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare person jsonb; consents jsonb;
begin
  if w is null or c is null then raise exception 'Wundbezug fehlt.' using errcode='22023'; end if;
  perform care_private.assert_wound_record_scope(t,a,c,w,false);
  select jsonb_build_object('date_of_birth',x.date_of_birth,'gender',x.gender)
    into strict person from public.clients x where x.id=c and x.tenant_id=t;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'granted_at',x.granted_at,'expires_at',x.expires_at)
    order by x.granted_at desc),'[]'::jsonb) into consents
  from public.client_consents x where x.tenant_id=t and x.client_id=c and x.consent_type='foto_video'
    and x.granted and x.granted_at is not null and isfinite(x.granted_at)
    and (x.expires_at is null or x.expires_at>clock_timestamp());
  return jsonb_build_object('person',person,'consents',consents);
end $$;

create or replace function care_private.validate_wound_record_entry(k text,p jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare fields text[]; key text; val numeric; n integer; expected integer; item jsonb; shares_total numeric := 0;
begin
  if jsonb_typeof(p) is distinct from 'object' or pg_column_size(p)>350000 then
    raise exception 'Der Wundbefund ist ungültig.' using errcode='22023';
  end if;
  fields := case k
    when 'note' then array['description','treatment']
    when 'risk' then array['assessment','plan']
    when 'anamnesis' then array['general','nutrition','psychosocial','diagnoses','effects','notes']
    when 'diabetic_foot' then array['history','findings','neurology','angiology','footwear','assessment']
    when 'tracheostomy' then array['stoma','device','secretion','skin','care','training','participants','followUp']
    when 'material' then array['name','supplier','code','unit','reference']
    when 'body_mark' then array['name','kind','text']
    else array[]::text[]
  end;
  foreach key in array fields loop
    if p ? key and (jsonb_typeof(p->key) is distinct from 'string' or char_length(p->>key)>2000) then
      raise exception 'Textangaben der Wundakte prüfen.' using errcode='22023';
    end if;
  end loop;
  if k in ('note','anamnesis','diabetic_foot','tracheostomy') and not exists(
    select 1 from unnest(fields) as field(name) where nullif(btrim(p->>field.name),'') is not null
  ) and not (k='anamnesis' and (p ?| array['vas','heightCm','weightKg','factors'])) then
    raise exception 'Mindestens eine Befundangabe erfassen.' using errcode='22023';
  end if;
  if k='risk' then
    expected := case p->>'scale' when 'norton' then 5 when 'braden' then 6 else 0 end;
    if expected=0 or jsonb_typeof(p->'scores') is distinct from 'array' or jsonb_array_length(p->'scores')<>expected then
      raise exception 'Vollständige Risikoskala erfassen.' using errcode='22023';
    end if;
    for n in 0..expected-1 loop
      if jsonb_typeof(p->'scores'->n) is distinct from 'number'
         or (p->'scores'->>n) !~ '^[1-4]$'
         or (expected=6 and n=5 and p->'scores'->>n='4') then
        raise exception 'Punktwert der Risikoskala prüfen.' using errcode='22023';
      end if;
    end loop;
    if nullif(btrim(p->>'assessment'),'') is null then
      raise exception 'Fachliche Risikoeinschätzung fehlt.' using errcode='22023';
    end if;
  elsif k='anamnesis' then
    foreach key in array array['vas','heightCm','weightKg'] loop
      if p ? key then
        if jsonb_typeof(p->key) is distinct from 'number' then
          raise exception 'Messwert prüfen.' using errcode='22023';
        end if;
        val := (p->>key)::numeric;
        if val<0 or (key='vas' and val>100)
           or (key='heightCm' and (val<20 or val>300)) or (key='weightKg' and (val=0 or val>1000)) then
          raise exception 'Messwert liegt außerhalb des Eingabebereichs.' using errcode='22023';
        end if;
      end if;
    end loop;
    if p ? 'factors' and (jsonb_typeof(p->'factors') is distinct from 'array'
      or (p->'factors') - array['diabetes','perfusion','pressure','mobility','nutrition','oedema','infection','other'] <> '[]'::jsonb) then
      raise exception 'Einflussfaktoren prüfen.' using errcode='22023';
    end if;
  elsif k='diabetic_foot' then
    if coalesce(p->>'side','') not in ('left','right','both') then
      raise exception 'Untersuchte Fußseite auswählen.' using errcode='22023';
    end if;
  elsif k='tracheostomy' then
    if coalesce(p->>'mode','') not in ('admission','follow_up','training')
      or (p->>'mode'='training' and (nullif(btrim(p->>'training'),'') is null or nullif(btrim(p->>'participants'),'') is null)) then
      raise exception 'Art des Protokolls, Schulungsinhalt und Teilnehmende prüfen.' using errcode='22023';
    end if;
  elsif k='material' then
    if jsonb_typeof(p->'quantity') is distinct from 'number' or (p->>'quantity')::numeric not between 0.001 and 100000
       or nullif(btrim(p->>'name'),'') is null or nullif(btrim(p->>'unit'),'') is null
       or coalesce(p->>'mode','') not in ('used','delivered','proposed')
       or (p->>'mode'='delivered' and nullif(btrim(p->>'reference'),'') is null)
       or (p ? 'unitCents' and jsonb_typeof(p->'unitCents') <> 'null'
         and (jsonb_typeof(p->'unitCents') <> 'number' or (p->>'unitCents') !~ '^[0-9]+$'
           or (p->>'unitCents')::numeric not between 0 and 100000000)) then
      raise exception 'Material, Menge, Preis und Vorgang prüfen.' using errcode='22023';
    end if;
  elsif k='measurement' then
    if jsonb_typeof(p->'trace') is distinct from 'object'
      or coalesce(p->'trace'->>'width','') !~ '^[0-9]{1,5}$' or coalesce(p->'trace'->>'height','') !~ '^[0-9]{1,5}$'
      or (p->'trace'->>'width')::integer not between 2 and 50000 or (p->'trace'->>'height')::integer not between 2 and 50000
      or jsonb_typeof(p->'trace'->'outline') is distinct from 'array'
      or jsonb_array_length(p->'trace'->'outline') not between 3 and 600
      or jsonb_typeof(p->'trace'->'sections') is distinct from 'array' or jsonb_array_length(p->'trace'->'sections')>24
      or jsonb_typeof(p->'trace'->'shares') is distinct from 'object'
      or jsonb_typeof(p->'trace'->'scale'->'millimetres') is distinct from 'number'
      or (p->'trace'->'scale'->>'millimetres')::numeric not between 0.00001 and 1000 then
      raise exception 'Kalibrierung und Wundkontur prüfen.' using errcode='22023';
    end if;
    foreach key in array array['areaCm2','lengthCm','widthCm'] loop
      if jsonb_typeof(p->'trace'->key) is distinct from 'number' or (p->'trace'->>key)::numeric<=0 then
        raise exception 'Vermessungswerte prüfen.' using errcode='22023';
      end if;
    end loop;
    foreach key in array array['necrosis','granulation','fibrin','epithelium','unassigned'] loop
      if jsonb_typeof(p->'trace'->'shares'->key) is distinct from 'number' then
        raise exception 'Gewebeanteile prüfen.' using errcode='22023';
      end if;
      val := (p->'trace'->'shares'->>key)::numeric;
      if val not between 0 and 100 or val<>round(val,2) then raise exception 'Gewebeanteile prüfen.' using errcode='22023'; end if;
      shares_total := shares_total+val;
    end loop;
    if shares_total<>100 then raise exception 'Gewebeanteile müssen zusammen 100 Prozent ergeben.' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(p->'trace'->'outline') loop
      if jsonb_typeof(item->'x') is distinct from 'number' or jsonb_typeof(item->'y') is distinct from 'number'
        or (item->>'x')::numeric not between 0 and 1 or (item->>'y')::numeric not between 0 and 1 then
        raise exception 'Konturkoordinaten prüfen.' using errcode='22023';
      end if;
    end loop;
  elsif k='body_mark' then
    if nullif(btrim(p->>'name'),'') is null or coalesce(p->>'figure','') not in
      ('older-man','older-woman','adult-man','adult-woman','boy','girl') then
      raise exception 'Körperstelle und Figur prüfen.' using errcode='22023';
    end if;
  end if;
end $$;

create or replace function care_private.write_wound_record_entry(t uuid,a uuid,c uuid,w uuid,r uuid,k text,seen timestamptz,p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  bound_wound uuid := case when k in ('risk','anamnesis','diabetic_foot','tracheostomy') then null else w end;
  original public.ambulatory_wound_clinical_entries%rowtype;
  media public.ambulatory_wound_media%rowtype;
  name text; birth date;
begin
  if w is null or c is null or r is null or seen is null or not isfinite(seen) or seen>clock_timestamp()
    or coalesce(k,'') not in ('measurement','note','risk','anamnesis','diabetic_foot','tracheostomy','material','body_mark') then
    raise exception 'Bezug, Art oder Zeitpunkt des Eintrags prüfen.' using errcode='22023';
  end if;
  perform care_private.assert_wound_record_scope(t,a,c,w,true);
  perform pg_advisory_xact_lock(hashtextextended(t::text||':wound-entry:'||r::text,0));
  select * into original from public.ambulatory_wound_clinical_entries x where x.id=r and x.tenant_id=t;
  if found then
    if original.client_id=c and original.wound_case_id is not distinct from bound_wound and original.recorded_by=a
       and original.kind=k and original.observed_at=seen and original.payload=p then return r; end if;
    raise exception 'Die Anfrage gehört zu einer anderen Erfassung.' using errcode='22023';
  end if;
  perform care_private.validate_wound_record_entry(k,p);
  if k='risk' then
    select x.date_of_birth into birth from public.clients x where x.id=c and x.tenant_id=t for share;
    if birth is null or age((seen at time zone 'Europe/Berlin')::date,birth)<interval '18 years' then
      raise exception 'Norton und Braden sind in diesem Formular für Erwachsene vorgesehen. Geburtsdatum und Zeitpunkt prüfen.' using errcode='22023';
    end if;
  elsif k='measurement' then
    select * into media from public.ambulatory_wound_media x where x.id=(p->>'photoId')::uuid
      and x.tenant_id=t and x.client_id=c and x.wound_case_id=w and x.state='ready' and x.kind='wound_photo';
    if not found or media.assessment_id is distinct from (p->>'assessmentId')::uuid
       or media.observed_at<>seen or not care_private.wound_record_consent(t,c,media.consent_id,media.observed_at) then
      raise exception 'Aktuell nutzbares Originalfoto und Befundzuordnung prüfen.' using errcode='42501';
    end if;
  end if;
  select coalesce(nullif(x.display_name,''),'Pflegekraft') into strict name from public.profiles x where x.id=a and x.tenant_id=t;
  insert into public.ambulatory_wound_clinical_entries
    (id,tenant_id,client_id,wound_case_id,kind,observed_at,recorded_by,recorded_by_name,payload)
  values(r,t,c,bound_wound,k,seen,a,name,p);
  insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
  values(t,c,'wound_record_entry',r,'created','Wundakte ergänzt',jsonb_build_object('kind',k,'woundId',bound_wound),a,name);
  return r;
end $$;

create or replace function care_private.save_wound_catalog_item(t uuid,a uuid,p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare old public.ambulatory_wound_catalog%rowtype; r uuid; k text; v_name text; content text; v_supplier text; v_code text; v_unit text; cents integer;
begin
  perform care_private.assert_wound_record_scope(t,a,null,null,true);
  r:=(p->>'id')::uuid; k:=p->>'kind'; v_name:=btrim(p->>'name'); content:=coalesce(p->>'text','');
  v_supplier:=btrim(coalesce(p->>'supplier','')); v_code:=btrim(coalesce(p->>'code',''));
  v_unit:=btrim(coalesce(p->>'unit','')); cents:=(p->>'unit_cents')::integer;
  if r is null or coalesce(k,'') not in ('description','treatment','article') or coalesce(length(v_name),0) not between 1 and 160
    or length(content)>2000 or length(v_supplier)>160 or length(v_code)>80 or length(v_unit)>40
    or (k='article' and v_unit='') or (k<>'article' and btrim(content)='') then
    raise exception 'Katalogeintrag vervollständigen.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(t::text||':wound-catalog:'||r::text,0));
  select * into old from public.ambulatory_wound_catalog x where x.tenant_id=t and x.id=r for update;
  if found then
    if old.kind=k and old.name=v_name and old.text=content and old.supplier=v_supplier and old.code=v_code and old.unit=v_unit
      and old.unit_cents is not distinct from cents then return r; end if;
    if old.kind<>k or old.updated_at is distinct from (p->>'updated_at')::timestamptz then
      raise exception 'Der Katalogeintrag wurde geändert. Neu laden und erneut bearbeiten.' using errcode='40001';
    end if;
    update public.ambulatory_wound_catalog set name=v_name, text=content,
      supplier=v_supplier,code=v_code,
      unit=v_unit,unit_cents=cents,updated_by=a,updated_at=clock_timestamp()
    where tenant_id=t and id=r;
  else
    insert into public.ambulatory_wound_catalog (id,tenant_id,kind,name,text,supplier,code,unit,unit_cents,created_by,updated_by)
      values(r,t,k,v_name,content,v_supplier,v_code,v_unit,cents,a,a);
  end if;
  return r;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pflege-wound-media','pflege-wound-media',false,26214400,array[
  'image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a','audio/m4a'
]) on conflict (id) do nothing;

create or replace function care_private.prepare_wound_media(t uuid,a uuid,c uuid,w uuid,p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  old public.ambulatory_wound_media%rowtype;
  r uuid:=(p->>'id')::uuid; k text:=p->>'kind'; name text:=p->>'name'; mime text:=p->>'mime';
  size bigint:=(p->>'size')::bigint; digest text:=p->>'digest'; seen timestamptz:=(p->>'observedAt')::timestamptz;
  assessment uuid:=(p->>'assessmentId')::uuid; consent uuid:=(p->>'consentId')::uuid;
  bound_wound uuid := case when k='wound_photo' then w else null end;
  path text:=t::text||'/'||c::text||'/'||r::text;
begin
  if w is null or c is null then raise exception 'Wundbezug fehlt.' using errcode='22023'; end if;
  perform care_private.assert_wound_record_scope(t,a,c,w,true);
  if r is null or coalesce(k,'') not in ('wound_photo','patient_photo','voice')
    or coalesce(length(btrim(name)),0) not between 1 and 180 or name ~ '[[:cntrl:]/\\]'
    or coalesce(size,0) not between 1 and 26214400 or coalesce(digest,'') !~ '^[a-f0-9]{64}$'
    or seen is null or not isfinite(seen) or seen>clock_timestamp()
    or not (case when k='voice' then coalesce(mime,'') in ('audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a','audio/m4a')
         else coalesce(mime,'') in ('image/jpeg','image/png','image/webp') end)
    or (k<>'wound_photo' and assessment is not null) or (k='voice' and consent is not null) then
    raise exception 'Format oder Zuordnung der Datei prüfen.' using errcode='22023';
  end if;
  if k='wound_photo' and not exists(
    select 1 from public.clinical_wound_assessments x where x.id=assessment and x.tenant_id=t and x.client_id=c and x.wound_case_id=w
  ) then raise exception 'Das Foto benötigt einen Befund dieser Wunde.' using errcode='22023'; end if;
  if k<>'voice' and not care_private.wound_record_consent(t,c,consent,seen) then
    raise exception 'Zum Aufnahmezeitpunkt und jetzt muss die Fotoeinwilligung vorliegen.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(t::text||':wound-media:'||r::text,0));
  select * into old from public.ambulatory_wound_media x where x.id=r and x.tenant_id=t;
  if found then
    if old.client_id=c and old.wound_case_id is not distinct from bound_wound and old.recorded_by=a
      and old.assessment_id is not distinct from assessment and old.consent_id is not distinct from consent
      and old.kind=k and old.file_name=name and old.mime_type=mime and old.size_bytes=size and old.observed_at=seen and old.content_sha256=digest then
      return jsonb_build_object('id',r,'state',old.state,'path',path);
    end if;
    raise exception 'Die Anfrage gehört zu einer anderen Datei.' using errcode='22023';
  end if;
  if bound_wound is not null then
    perform pg_advisory_xact_lock(hashtextextended(t::text||':wound-photo:'||w::text||':'||digest,0));
    select * into old from public.ambulatory_wound_media x where x.tenant_id=t
      and x.wound_case_id=w and x.kind='wound_photo' and x.content_sha256=digest;
    if found then
      if old.state='pending' and old.client_id=c and old.recorded_by=a and old.assessment_id=assessment
        and old.consent_id=consent and old.file_name=name and old.mime_type=mime and old.size_bytes=size and old.observed_at=seen then
        return jsonb_build_object('id',old.id,'state','pending','path',old.storage_path);
      end if;
      raise exception 'Dieses Original ist bereits zugeordnet oder hat einen offenen Uploadauftrag mit anderen Angaben.' using errcode='23505';
    end if;
    if exists(select 1 from public.ambulatory_wound_photo_links x
      where x.tenant_id=t and x.wound_case_id=w and x.content_sha256=digest) then
      raise exception 'Das gleiche Original ist dieser Wunde bereits zugeordnet.' using errcode='23505';
    end if;
  end if;
  insert into public.ambulatory_wound_media
    (id,tenant_id,client_id,wound_case_id,assessment_id,consent_id,kind,storage_path,content_sha256,file_name,mime_type,size_bytes,observed_at,recorded_by)
  values(r,t,c,bound_wound,assessment,consent,k,path,digest,name,mime,size,seen,a);
  return jsonb_build_object('id',r,'state','pending','path',path);
end $$;

create or replace function care_private.complete_wound_media(t uuid,a uuid,c uuid,w uuid,r uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare file public.ambulatory_wound_media%rowtype; name text;
begin
  if w is null or c is null then raise exception 'Wundbezug fehlt.' using errcode='22023'; end if;
  perform care_private.assert_wound_record_scope(t,a,c,w,true);
  select * into file from public.ambulatory_wound_media x where x.id=r and x.tenant_id=t and x.client_id=c and x.recorded_by=a
    and (x.wound_case_id is null or x.wound_case_id=w) for update;
  if not found then raise exception 'Uploadauftrag nicht gefunden.' using errcode='42501'; end if;
  if file.state='ready' then return r; end if;
  if file.kind<>'voice' and not care_private.wound_record_consent(t,c,file.consent_id,file.observed_at) then
    raise exception 'Fotoeinwilligung prüfen.' using errcode='42501';
  end if;
  if not exists(select 1 from storage.objects x where x.bucket_id='pflege-wound-media' and x.name=file.storage_path
    and coalesce(x.owner_id,x.owner::text)=auth.uid()::text and (x.metadata->>'size')::bigint=file.size_bytes
    and lower(split_part(x.metadata->>'mimetype',';',1))=file.mime_type) then
    raise exception 'Das gespeicherte Original konnte noch nicht bestätigt werden.' using errcode='22023';
  end if;
  select coalesce(nullif(x.display_name,''),'Pflegekraft') into strict name from public.profiles x where x.id=a and x.tenant_id=t;
  if file.kind='wound_photo' then
    insert into public.ambulatory_wound_photo_links
      (id,tenant_id,client_id,wound_case_id,assessment_id,consent_id,storage_path,file_name,content_sha256,captured_at,recorded_by,recorded_by_name)
    values(r,t,c,w,file.assessment_id,file.consent_id,file.storage_path,file.file_name,file.content_sha256,file.observed_at,a,name);
  end if;
  update public.ambulatory_wound_media set state='ready' where id=r;
  insert into public.care_audit_events(tenant_id,client_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
  values(t,c,'wound_record_media',r,'created','Datei der Wundakte zugeordnet',jsonb_build_object('kind',file.kind,'woundId',file.wound_case_id),a,name);
  return r;
end $$;

create or replace function care_private.wound_record_storage_access(path text,writing boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare file public.ambulatory_wound_media%rowtype;
begin
  select * into file from public.ambulatory_wound_media x where x.storage_path=path and x.tenant_id=public.current_tenant_id();
  if not found then return false; end if;
  if writing and (file.state<>'pending' or file.recorded_by is distinct from public.resolve_current_profile_id()) then return false; end if;
  if not writing and file.state<>'ready' then return false; end if;
  return care_private.wound_record_allowed(file.tenant_id,file.client_id,file.wound_case_id,writing)
    and (file.kind='voice' or care_private.wound_record_consent(file.tenant_id,file.client_id,file.consent_id,file.observed_at));
end $$;

drop policy if exists wound_record_storage_upload on storage.objects;
create policy wound_record_storage_upload on storage.objects for insert to authenticated
  with check (bucket_id='pflege-wound-media' and care_private.wound_record_storage_access(name,true));
drop policy if exists wound_record_storage_read on storage.objects;
create policy wound_record_storage_read on storage.objects for select to authenticated
  using (bucket_id='pflege-wound-media' and care_private.wound_record_storage_access(name,false));
-- Restrictive policies also protect this bucket from broad policies added for other buckets.
drop policy if exists wound_record_storage_upload_guard on storage.objects;
create policy wound_record_storage_upload_guard on storage.objects as restrictive for insert to authenticated
  with check (bucket_id<>'pflege-wound-media' or care_private.wound_record_storage_access(name,true));
drop policy if exists wound_record_storage_read_guard on storage.objects;
create policy wound_record_storage_read_guard on storage.objects as restrictive for select to authenticated
  using (bucket_id<>'pflege-wound-media' or care_private.wound_record_storage_access(name,false));
drop policy if exists wound_record_storage_update_guard on storage.objects;
create policy wound_record_storage_update_guard on storage.objects as restrictive for update to authenticated
  using (bucket_id<>'pflege-wound-media') with check (bucket_id<>'pflege-wound-media');
drop policy if exists wound_record_storage_delete_guard on storage.objects;
create policy wound_record_storage_delete_guard on storage.objects as restrictive for delete to authenticated
  using (bucket_id<>'pflege-wound-media');

create or replace function care_private.read_wound_statistics(t uuid,a uuid,from_day date,to_day date,filter_client uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform care_private.assert_wound_record_scope(t,a,filter_client,null,false);
  if from_day is null or to_day is null or not isfinite(from_day) or not isfinite(to_day) or from_day>to_day
    or to_day>(clock_timestamp() at time zone 'Europe/Berlin')::date then
    raise exception 'Auswertungszeitraum prüfen.' using errcode='22023';
  end if;
  with cases as materialized (
    select w.id,w.client_id,coalesce(nullif(btrim(w.wound_type),''),'Ohne Angabe') as wound_type,
      coalesce((select min((x.observed_at at time zone 'Europe/Berlin')::date)
        from public.clinical_wound_assessments x where x.tenant_id=t and x.client_id=w.client_id and x.wound_case_id=w.id),null) as first_observed,
      (select (e.occurred_at at time zone 'Europe/Berlin')::date from public.ambulatory_wound_lifecycle_events e
        where e.tenant_id=t and e.client_id=w.client_id and e.wound_case_id=w.id
          and (e.occurred_at at time zone 'Europe/Berlin')::date<=to_day
        order by e.created_at desc,e.id desc limit 1) as last_event_day,
      (select e.action from public.ambulatory_wound_lifecycle_events e
        where e.tenant_id=t and e.client_id=w.client_id and e.wound_case_id=w.id
          and (e.occurred_at at time zone 'Europe/Berlin')::date<=to_day
        order by e.created_at desc,e.id desc limit 1) as last_action
    from public.clinical_wound_cases w
    where w.tenant_id=t and w.created_at >= (from_day::timestamp at time zone 'Europe/Berlin')
      and w.created_at < ((to_day+1)::timestamp at time zone 'Europe/Berlin')
      and (filter_client is null or w.client_id=filter_client)
      and care_private.wound_active_client(w.client_id)
  ), people as materialized (
    select x.id,coalesce(x.gender::text,'Ohne Angabe') as gender,
      case when x.date_of_birth is null or x.date_of_birth>to_day then 'Ohne Angabe'
        when age(to_day,x.date_of_birth)<interval '18 years' then 'Unter 18'
        when age(to_day,x.date_of_birth)<interval '65 years' then '18–64'
        when age(to_day,x.date_of_birth)<interval '80 years' then '65–79' else '80+' end as band
    from public.clients x where x.tenant_id=t and x.id in (select z.client_id from cases z)
  ), durations as (
    select last_event_day-first_observed as days from cases
    where last_action='close' and first_observed<=last_event_day
  ), factors as (
    select distinct x.client_id,f.value from public.ambulatory_wound_clinical_entries x
      cross join lateral jsonb_array_elements_text(coalesce(x.payload->'factors','[]'::jsonb)) as f
    where x.tenant_id=t and x.kind='anamnesis' and x.client_id in (select id from people)
      and x.observed_at < ((to_day+1)::timestamp at time zone 'Europe/Berlin')
  )
  select jsonb_build_object(
    'total',(select count(*) from cases),
    'people',(select count(*) from people),
    'dated',(select count(*) from durations),
    'medianDays',(select percentile_cont(.5) within group(order by days) from durations),
    'types',coalesce((select jsonb_object_agg(k,n) from (select wound_type k,count(*) n from cases group by wound_type) s),'{}'::jsonb),
    'ageGroups',coalesce((select jsonb_object_agg(k,n) from (select band k,count(*) n from people group by band) s),'{}'::jsonb),
    'gender',coalesce((select jsonb_object_agg(k,n) from (select gender k,count(*) n from people group by gender) s),'{}'::jsonb),
    'factors',coalesce((select jsonb_object_agg(k,n) from (select value k,count(*) n from factors group by value) s),'{}'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function care_private.read_wound_statistics(t uuid,a uuid,from_day date,to_day date)
returns jsonb language sql security invoker set search_path='' as $$
  select care_private.read_wound_statistics(t,a,from_day,to_day,null::uuid)
$$;

create or replace function public.read_wound_record_context(p_tenant uuid,p_actor uuid,p_client uuid,p_wound uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select care_private.read_wound_record_context(p_tenant,p_actor,p_client,p_wound)
$$;
create or replace function public.write_wound_record_entry(p_tenant uuid,p_actor uuid,p_client uuid,p_wound uuid,
  p_id uuid,p_kind text,p_observed timestamptz,p_payload jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select care_private.write_wound_record_entry(p_tenant,p_actor,p_client,p_wound,p_id,p_kind,p_observed,p_payload)
$$;
create or replace function public.save_wound_catalog_item(p_tenant uuid,p_actor uuid,p_item jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select care_private.save_wound_catalog_item(p_tenant,p_actor,p_item)
$$;
create or replace function public.prepare_wound_media(p_tenant uuid,p_actor uuid,p_client uuid,p_wound uuid,p_file jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select care_private.prepare_wound_media(p_tenant,p_actor,p_client,p_wound,p_file)
$$;
create or replace function public.complete_wound_media(p_tenant uuid,p_actor uuid,p_client uuid,p_wound uuid,p_id uuid)
returns uuid language sql security invoker set search_path='' as $$
  select care_private.complete_wound_media(p_tenant,p_actor,p_client,p_wound,p_id)
$$;
create or replace function public.read_wound_statistics(p_tenant uuid,p_actor uuid,p_from date,p_to date)
returns jsonb language sql security invoker set search_path='' as $$
  select care_private.read_wound_statistics(p_tenant,p_actor,p_from,p_to)
$$;
create or replace function public.read_wound_statistics_for_client(p_tenant uuid,p_actor uuid,p_from date,p_to date,p_client uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if p_client is null then raise exception 'Pflegeakte für die Auswertung prüfen.' using errcode='22023'; end if;
  return care_private.read_wound_statistics(p_tenant,p_actor,p_from,p_to,p_client);
end $$;

revoke all on function care_private.read_wound_statistics(uuid,uuid,date,date,uuid),
  public.read_wound_statistics_for_client(uuid,uuid,date,date,uuid) from public,anon,authenticated,service_role;
grant execute on function care_private.read_wound_statistics(uuid,uuid,date,date,uuid),
  public.read_wound_statistics_for_client(uuid,uuid,date,date,uuid) to authenticated;

revoke all on function care_private.wound_record_consent(uuid,uuid,uuid,timestamptz),
  care_private.validate_wound_record_entry(text,jsonb),care_private.assert_wound_record_scope(uuid,uuid,uuid,uuid,boolean)
  from public,anon,authenticated,service_role;
do $grants$
declare fn regprocedure;
begin
  for fn in select unnest(array[
    'care_private.wound_record_allowed(uuid,uuid,uuid,boolean)',
    'care_private.wound_record_storage_access(text,boolean)',
    'care_private.wound_record_media_visible(uuid,uuid,uuid,text,uuid,timestamptz)',
    'care_private.read_wound_record_context(uuid,uuid,uuid,uuid)',
    'care_private.write_wound_record_entry(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb)',
    'care_private.save_wound_catalog_item(uuid,uuid,jsonb)',
    'care_private.prepare_wound_media(uuid,uuid,uuid,uuid,jsonb)',
    'care_private.complete_wound_media(uuid,uuid,uuid,uuid,uuid)',
    'care_private.read_wound_statistics(uuid,uuid,date,date)',
    'public.read_wound_record_context(uuid,uuid,uuid,uuid)',
    'public.write_wound_record_entry(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb)',
    'public.save_wound_catalog_item(uuid,uuid,jsonb)',
    'public.prepare_wound_media(uuid,uuid,uuid,uuid,jsonb)',
    'public.complete_wound_media(uuid,uuid,uuid,uuid,uuid)',
    'public.read_wound_statistics(uuid,uuid,date,date)'
  ]::regprocedure[])
  loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',fn);
    execute format('grant execute on function %s to authenticated',fn);
  end loop;
end
$grants$;
commit;
