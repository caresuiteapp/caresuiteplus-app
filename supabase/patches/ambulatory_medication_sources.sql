-- LOCAL ONLY. Requires medication documentation patch and client_documents.
-- Linking is not clinical verification. No production application in this task.
begin;
create table if not exists public.medication_order_sources(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),
 medication_id uuid not null references public.medications(id),client_id uuid not null references public.clients(id),
 document_id uuid not null references public.client_documents(id),request_id uuid not null,payload jsonb not null,
 document_snapshot jsonb not null,order_snapshot jsonb not null,reason text not null,
 recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,
 created_at timestamptz not null default clock_timestamp(),unique(tenant_id,request_id)
);
alter table public.medication_order_sources enable row level security;
drop policy if exists medication_sources_read on public.medication_order_sources;
create policy medication_sources_read on public.medication_order_sources for select to authenticated using(
 tenant_id=public.current_tenant_id() and public.has_permission('pflege.medications.view')
 and public.has_permission('office.documents.view') and public.has_permission('office.clients.view_sensitive')
 and public.is_active_pfleger_client(client_id)
 and exists(select 1 from public.profiles p where p.id=public.resolve_current_profile_id() and p.tenant_id=public.current_tenant_id() and p.is_active)
);
grant select on public.medication_order_sources to authenticated;
revoke insert,update,delete on public.medication_order_sources from authenticated;
create or replace function care_private.link_medication_source(medication_id uuid,request_id uuid,payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=care_private.assert_medication_actor('pflege.medications.manage');
 m public.medications%rowtype; d public.client_documents%rowtype; old public.medication_order_sources%rowtype;
 actor_name text; result_id uuid; prefix text;
begin
 if public.has_permission('pflege.medications.view') is not true or public.has_permission('office.documents.view') is not true or public.has_permission('office.clients.view_sensitive') is not true then raise exception 'Keine Berechtigung für vertrauliche Quellen.' using errcode='42501'; end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Anfrage und Daten erforderlich.' using errcode='23514'; end if;
 select * into m from public.medications where id=medication_id and tenant_id=public.current_tenant_id() for update;
 if m.id is null or public.is_active_pfleger_client(m.client_id) is not true then raise exception 'Verordnung nicht zugänglich.' using errcode='42501'; end if;
 select * into old from public.medication_order_sources s where s.tenant_id=m.tenant_id and s.request_id=link_medication_source.request_id;
 if old.id is not null then
 if old.medication_id<>m.id or old.recorded_by<>actor or old.payload<>payload then raise exception 'Anfrage wurde mit anderen Daten verwendet.' using errcode='23514'; end if;
 return old.id; end if;
 if payload->>'expectedUpdatedAt' is null or (payload->>'expectedUpdatedAt')::timestamptz is distinct from m.updated_at then raise exception 'Verordnung wurde geändert.' using errcode='40001'; end if;
 select * into d from public.client_documents where id=(payload->>'documentId')::uuid and tenant_id=m.tenant_id and client_id=m.client_id for share;
 if d.id is null or d.status is distinct from 'aktiv' then raise exception 'Aktives Dokument dieser Klientenakte erforderlich.' using errcode='23514'; end if;
 if payload->>'documentUpdatedAt' is null or (payload->>'documentUpdatedAt')::timestamptz is distinct from d.updated_at then raise exception 'Dokument wurde geändert.' using errcode='40001'; end if;
 prefix:='tenant/'||m.tenant_id::text||'/clients/'||m.client_id::text||'/documents/';
 if d.storage_path is null or left(d.storage_path,length(prefix))<>prefix or length(d.storage_path)<=length(prefix) or position('..' in d.storage_path)>0 then raise exception 'Originaldatei ist nicht eindeutig hinterlegt.' using errcode='23514'; end if;
 if nullif(btrim(payload->>'reason'),'') is null or length(payload->>'reason')>2000 then raise exception 'Begründung bis 2000 Zeichen erforderlich.' using errcode='23514'; end if;
 -- Client-observed fingerprint. SQL cannot authenticate the downloaded file bytes.
 if jsonb_typeof(payload->'contentSha256') is distinct from 'string' or coalesce((payload->>'contentSha256') ~ '^[0-9a-f]{64}$',false) is not true or jsonb_typeof(payload->'contentSize') is distinct from 'number' then raise exception 'Inhaltsfingerabdruck und Dateigröße erforderlich.' using errcode='23514'; end if;
 if (payload->>'contentSize')::numeric not between 1 and 52428800 or (payload->>'contentSize')::numeric <> trunc((payload->>'contentSize')::numeric) then raise exception 'Dateigröße muss ganzzahlig und höchstens 50 MiB sein.' using errcode='23514'; end if;
 select coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(p.display_name,''),p.email,'Pflegekraft') into actor_name from public.profiles p where p.id=actor;
 insert into public.medication_order_sources(tenant_id,medication_id,client_id,document_id,request_id,payload,document_snapshot,order_snapshot,reason,recorded_by,recorded_by_name)
 values(m.tenant_id,m.id,m.client_id,d.id,request_id,payload,jsonb_build_object('id',d.id,'title',d.title,'file_name',d.file_name,'mime_type',d.mime_type,'storage_path',d.storage_path,'updated_at',d.updated_at,'status',d.status,'content_sha256',payload->>'contentSha256','content_size',(payload->>'contentSize')::bigint,'content_fingerprint_origin','client_observed'),to_jsonb(m),btrim(payload->>'reason'),actor,actor_name) returning id into result_id;
 return result_id;
end $$;
create or replace function public.link_ambulatory_medication_source(medication_id uuid,request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.link_medication_source(medication_id,request_id,payload)$$;
revoke all on function care_private.link_medication_source(uuid,uuid,jsonb),public.link_ambulatory_medication_source(uuid,uuid,jsonb) from public,anon;
grant execute on function care_private.link_medication_source(uuid,uuid,jsonb),public.link_ambulatory_medication_source(uuid,uuid,jsonb) to authenticated;
commit;
