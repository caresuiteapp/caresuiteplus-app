-- LOCAL ONLY. Requires ambulatory_medication_sources.sql. No production application.
-- Protected archive copy; not WORM storage or clinical approval.
begin;
insert into storage.buckets(id,name,public,file_size_limit)
values('medication-source-archives','medication-source-archives',false,52428800)
on conflict(id) do nothing;
-- An existing public bucket or incompatible limit is a release blocker, never silently altered.
do $$begin
 if not exists(select 1 from storage.buckets where id='medication-source-archives' and public=false and file_size_limit=52428800) then raise exception 'Archiv-Bucket ist nicht passend privat konfiguriert.'; end if;
end$$;
create table if not exists public.medication_source_archives(
 id uuid primary key,tenant_id uuid not null references public.tenants(id),
 source_id uuid not null unique references public.medication_order_sources(id),
 client_id uuid not null references public.clients(id),medication_id uuid not null references public.medications(id),
 document_id uuid not null references public.client_documents(id),
 document_version timestamptz not null,original_path text not null,archive_path text not null unique,
 content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 content_size bigint not null check(content_size between 1 and 52428800),
 recorded_by uuid not null references public.profiles(id),status text not null default 'pending' check(status in ('pending','ready')),finalized_by uuid references public.profiles(id),finalized_at timestamptz,created_at timestamptz not null default clock_timestamp()
);
alter table public.medication_source_archives enable row level security;
drop policy if exists medication_archive_read on public.medication_source_archives;
create policy medication_archive_read on public.medication_source_archives for select to authenticated using(
 status='ready' and tenant_id=public.current_tenant_id() and exists(select 1 from public.medication_order_sources s where s.id=source_id and s.tenant_id=medication_source_archives.tenant_id and s.client_id=medication_source_archives.client_id and s.medication_id=medication_source_archives.medication_id)
);
revoke all on public.medication_source_archives from authenticated,anon,service_role;
grant select on public.medication_source_archives to authenticated;
grant select,insert on public.medication_source_archives to service_role;
-- Do not create authenticated insert/update/delete Storage policies for this bucket.
drop policy if exists medication_archive_object_read on storage.objects;
create policy medication_archive_object_read on storage.objects for select to authenticated using(
 bucket_id='medication-source-archives' and exists(select 1 from public.medication_source_archives a where a.archive_path=name and a.tenant_id=public.current_tenant_id())
);
create or replace function care_private.prepare_medication_source_archive(source_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=care_private.assert_medication_actor('pflege.medications.manage');s public.medication_order_sources%rowtype;d public.client_documents%rowtype;a public.medication_source_archives%rowtype;
begin
 if public.has_permission('pflege.medications.view') is not true or public.has_permission('office.documents.view') is not true or public.has_permission('office.clients.view_sensitive') is not true then raise exception 'Keine Berechtigung für vertrauliche Quellen.' using errcode='42501';end if;
 select * into s from public.medication_order_sources where id=source_id and tenant_id=public.current_tenant_id();
 if s.id is null or public.is_active_pfleger_client(s.client_id) is not true then raise exception 'Quelle nicht zugänglich.' using errcode='42501';end if;
 if coalesce((s.document_snapshot->>'content_sha256') ~ '^[0-9a-f]{64}$',false) is not true or jsonb_typeof(s.document_snapshot->'content_size') is distinct from 'number' then raise exception 'Für diese Quelle fehlt der erfasste Inhaltsfingerabdruck.' using errcode='23514';end if;
 select * into a from public.medication_source_archives where medication_source_archives.source_id=s.id and status='ready';
 if a.id is null then
  select * into d from public.client_documents where id=s.document_id and tenant_id=s.tenant_id and client_id=s.client_id;
  if d.id is null or d.status is distinct from 'aktiv' or d.updated_at is distinct from (s.document_snapshot->>'updated_at')::timestamptz or d.storage_path is distinct from s.document_snapshot->>'storage_path' then raise exception 'Dokument wurde geändert oder ist nicht mehr aktiv zugänglich.' using errcode='40001';end if;
 end if;
 return jsonb_build_object('sourceId',s.id,'tenantId',s.tenant_id,'clientId',s.client_id,'medicationId',s.medication_id,'documentId',s.document_id,'actorId',actor,'documentVersion',s.document_snapshot->>'updated_at','originalPath',s.document_snapshot->>'storage_path','sha256',s.document_snapshot->>'content_sha256','sizeBytes',(s.document_snapshot->>'content_size')::bigint,'archiveId',a.id);
end$$;
create or replace function public.prepare_ambulatory_medication_source_archive(source_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.prepare_medication_source_archive(source_id)$$;
revoke all on function care_private.prepare_medication_source_archive(uuid),public.prepare_ambulatory_medication_source_archive(uuid) from public,anon;
grant execute on function care_private.prepare_medication_source_archive(uuid),public.prepare_ambulatory_medication_source_archive(uuid) to authenticated;
create or replace function care_private.check_medication_source_archive()
returns trigger language plpgsql security definer set search_path='' as $$
declare s public.medication_order_sources%rowtype;d public.client_documents%rowtype;expected text;
begin
 if new.status is distinct from 'pending' or new.finalized_by is not null or new.finalized_at is not null then raise exception 'Archivkopie muss zuerst vorbereitet werden.' using errcode='23514';end if;
 select * into s from public.medication_order_sources where id=new.source_id for share;
 select * into d from public.client_documents where id=s.document_id for share;
 expected:='tenant/'||s.tenant_id::text||'/clients/'||s.client_id::text||'/medication-sources/'||s.id::text||'/'||new.content_sha256||'.bin';
 if s.id is null or new.tenant_id<>s.tenant_id or new.client_id<>s.client_id or new.medication_id<>s.medication_id or new.document_id<>s.document_id or new.document_version is distinct from (s.document_snapshot->>'updated_at')::timestamptz or new.original_path is distinct from s.document_snapshot->>'storage_path' or new.content_sha256 is distinct from s.document_snapshot->>'content_sha256' or new.content_size is distinct from (s.document_snapshot->>'content_size')::bigint or new.archive_path is distinct from expected then raise exception 'Archivbezug stimmt nicht mit der Quelle überein.' using errcode='23514';end if;
 if d.id is null or d.tenant_id<>s.tenant_id or d.client_id<>s.client_id or d.status is distinct from 'aktiv' or d.updated_at is distinct from new.document_version or d.storage_path is distinct from new.original_path or not exists(select 1 from public.profiles p where p.id=new.recorded_by and p.tenant_id=s.tenant_id and p.is_active) then raise exception 'Dokument oder verantwortliches Profil nicht mehr aktiv.' using errcode='42501';end if;
 return new;
end$$;
revoke all on function care_private.check_medication_source_archive() from public,anon,authenticated;
drop trigger if exists medication_source_archive_scope on public.medication_source_archives;
create trigger medication_source_archive_scope before insert on public.medication_source_archives for each row execute function care_private.check_medication_source_archive();
-- The service stages only. The authenticated caller must finalize in a fresh SQL transaction.
create or replace function care_private.finalize_medication_source_archive(archive_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=care_private.assert_medication_actor('pflege.medications.manage');a public.medication_source_archives%rowtype;s public.medication_order_sources%rowtype;d public.client_documents%rowtype;
begin
 if public.has_permission('pflege.medications.view') is not true or public.has_permission('office.documents.view') is not true or public.has_permission('office.clients.view_sensitive') is not true then raise exception 'Keine Berechtigung für vertrauliche Quellen.' using errcode='42501';end if;
 select * into a from public.medication_source_archives where id=archive_id and tenant_id=public.current_tenant_id() for update;
 if a.id is null or public.is_active_pfleger_client(a.client_id) is not true then raise exception 'Archiv nicht zugänglich.' using errcode='42501';end if;
 if a.status='ready' then return a.id;end if;
 select * into s from public.medication_order_sources where id=a.source_id for share;
 select * into d from public.client_documents where id=a.document_id for share;
 if s.id is null or s.tenant_id<>a.tenant_id or s.client_id<>a.client_id or s.medication_id<>a.medication_id or s.document_id<>a.document_id or a.content_sha256 is distinct from s.document_snapshot->>'content_sha256' or a.content_size is distinct from (s.document_snapshot->>'content_size')::bigint or a.original_path is distinct from s.document_snapshot->>'storage_path' or a.document_version is distinct from (s.document_snapshot->>'updated_at')::timestamptz or d.id is null or d.tenant_id<>a.tenant_id or d.client_id<>a.client_id or d.status is distinct from 'aktiv' or d.updated_at is distinct from a.document_version or d.storage_path is distinct from a.original_path then raise exception 'Archivbezug oder Dokument geändert.' using errcode='40001';end if;
 update public.medication_source_archives set status='ready',finalized_by=actor,finalized_at=clock_timestamp() where id=a.id;
 return a.id;
end$$;
create or replace function public.finalize_ambulatory_medication_source_archive(archive_id uuid)
returns uuid language sql security invoker set search_path='' as $$select care_private.finalize_medication_source_archive(archive_id)$$;
revoke all on function care_private.finalize_medication_source_archive(uuid),public.finalize_ambulatory_medication_source_archive(uuid) from public,anon;
grant execute on function care_private.finalize_medication_source_archive(uuid),public.finalize_ambulatory_medication_source_archive(uuid) to authenticated;
commit;
