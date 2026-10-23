-- Quarantined metadata preparation. Only the worker's downloaded bytes can prove file integrity.
create or replace function care_private.prepare_medication_source_proof(p_source uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.medication_order_sources%rowtype;m public.medications%rowtype;d public.client_documents%rowtype;a public.medication_source_archives%rowtype;actor uuid;tenant uuid;document_time timestamptz;prefix text;archive_path text;hash text;size numeric;
begin
 tenant:=public.current_tenant_id();
 perform care_private.require_workspace_session(tenant,public.resolve_current_profile_id());
 select * into s from public.medication_order_sources where id=p_source and tenant_id=tenant for share;
 if s.id is null then raise exception 'Quelle nicht zugänglich.' using errcode='42501';end if;
 actor:=care_private.medication_packet_actor('pflege.medications.manage',tenant,s.client_id,s.medication_id,public.resolve_current_profile_id());
 perform care_private.lock_medication_source_scope(tenant,s.client_id,s.medication_id,actor);
 if public.has_permission('pflege.medications.view') is not true or public.has_permission('office.documents.view') is not true or public.has_permission('office.clients.view_sensitive') is not true then raise exception 'Vertrauliche Quellenrechte fehlen.' using errcode='42501';end if;
 select * into m from public.medications where id=s.medication_id and tenant_id=tenant and client_id=s.client_id for share;
 select * into d from public.client_documents where id=s.document_id and tenant_id=tenant and client_id=s.client_id for share;
 perform care_private.med_packet_require(m.id is not null and d.id is not null and d.status='aktiv','Aktives Originaldokument oder native Verordnung fehlt.');
 perform care_private.medication_native_order(to_jsonb(m));
 if exists(select 1 from care_private.medication_source_capture_receipts r where r.source_id=s.id) then
  perform care_private.med_packet_require((s.document_snapshot-'content_sha256'-'content_size'-'content_fingerprint_origin') is not distinct from to_jsonb(d) and exists(select 1 from care_private.medication_source_capture_receipts r where r.source_id=s.id and r.tenant_id=tenant and r.source_fingerprint=care_private.medication_json_fingerprint(to_jsonb(s))),'Gespeichertes Quellenoriginal oder vollständiger Dokumentstand wurde geändert.');
 end if;
 perform care_private.med_packet_require((s.order_snapshot-'created_by'-'updated_by') is not distinct from (to_jsonb(m)-'created_by'-'updated_by'),'Verordnungsoriginal wurde geändert oder ist nicht vollständig gebunden.');
 perform care_private.med_packet_require(jsonb_typeof(s.document_snapshot)='object' and s.document_snapshot->>'id'=d.id::text and s.document_snapshot->>'title'=d.title and s.document_snapshot->>'file_name'=d.file_name and s.document_snapshot->>'mime_type'=d.mime_type and s.document_snapshot->>'status'=d.status and s.document_snapshot->>'storage_path'=d.storage_path and s.document_snapshot->>'content_fingerprint_origin'='client_observed','Dokumentoriginal ist nicht vollständig gebunden.');
 document_time:=care_private.med_packet_time(s.document_snapshot->'updated_at');
 perform care_private.med_packet_require(document_time is not distinct from d.updated_at,'Originaldokument wurde geändert.');
 hash:=s.document_snapshot->>'content_sha256';
 perform care_private.med_packet_require(jsonb_typeof(s.document_snapshot->'content_sha256')='string' and hash ~ '^[0-9a-f]{64}$' and jsonb_typeof(s.document_snapshot->'content_size')='number','Beobachteter Dateifingerabdruck oder Dateigröße fehlt.');
 size:=(s.document_snapshot->>'content_size')::numeric;
 perform care_private.med_packet_require(size between 1 and 52428800 and size=trunc(size) and (d.size_bytes is null or d.size_bytes=size),'Originaldateigröße widersprüchlich.');
 perform care_private.med_packet_require(s.payload->>'documentId'=d.id::text and care_private.med_packet_time(to_jsonb(replace(s.payload->>'documentUpdatedAt',' ','T')))=document_time and care_private.med_packet_time(to_jsonb(replace(s.payload->>'expectedUpdatedAt',' ','T')))=m.updated_at and s.payload->>'contentSha256'=hash and jsonb_typeof(s.payload->'contentSize')='number' and (s.payload->>'contentSize')::numeric=size,'Originalanfrage und Quelldaten widersprechen sich.');
 prefix:='tenant/'||tenant::text||'/clients/'||s.client_id::text||'/documents/';
 perform care_private.med_packet_require(d.storage_path is not null and left(d.storage_path,length(prefix))=prefix and length(d.storage_path)>length(prefix) and position('..' in d.storage_path)=0 and d.storage_path !~ '[\\%?#[:cntrl:]]','Originaldateipfad ist nicht eindeutig gebunden.');
 archive_path:='tenant/'||tenant::text||'/clients/'||s.client_id::text||'/medication-sources/'||s.id::text||'/'||hash||'.bin';
 select * into a from public.medication_source_archives where source_id=s.id for share;
 if a.id is not null then
  perform care_private.med_packet_require(a.tenant_id=tenant and a.client_id=s.client_id and a.medication_id=m.id and a.document_id=d.id and a.document_version=document_time and a.original_path=d.storage_path and a.archive_path=archive_path and a.content_sha256=hash and a.content_size=size and a.status in('pending','ready'),'Archivzuordnung widerspricht dem Original.');
  if a.status='ready' then
   perform care_private.med_packet_require(a.finalized_at is not null and a.finalized_at>=a.created_at and a.finalized_at<=clock_timestamp() and exists(select 1 from public.profiles p where p.id=a.finalized_by and p.tenant_id=tenant),'Archivabschluss ist nicht vollständig belegt.');
  end if;
 end if;
 return jsonb_build_object('sourceId',s.id,'tenantId',tenant,'clientId',s.client_id,'medicationId',m.id,'documentId',d.id,'actorId',actor,'documentVersion',s.document_snapshot->>'updated_at','originalPath',d.storage_path,'sha256',hash,'sizeBytes',size,'archiveId',case when a.status='ready' then a.id else null end,'sourceFingerprint',care_private.medication_json_fingerprint(to_jsonb(s)),'orderFingerprint',care_private.medication_json_fingerprint(to_jsonb(m)-'created_by'-'updated_by'),'documentFingerprint',care_private.medication_json_fingerprint(to_jsonb(d)),'verificationState','bytes_not_verified');
end $$;
create or replace function public.prepare_ambulatory_medication_source_proof(source_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.prepare_medication_source_proof(source_id)$$;
revoke all on function care_private.prepare_medication_source_proof(uuid),public.prepare_ambulatory_medication_source_proof(uuid) from public,anon,authenticated;

-- Recover only a previously committed own worker request. Current clinical facts may
-- have changed; current authorization and the original archived bytes remain required.
create function care_private.recover_medication_source_proof(p_source uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();r care_private.medication_archive_proof_receipts%rowtype;s public.medication_order_sources%rowtype;a public.medication_source_archives%rowtype;rec jsonb;expected_path text;
begin
 perform care_private.require_workspace_session(tenant,actor);
 select * into r from care_private.medication_archive_proof_receipts where tenant_id=tenant and request_id=p_request for share;
 if r.request_id is null then return null;end if;
 if r.source_id is distinct from p_source or r.actor_id is distinct from actor then raise exception 'Eigener Archivauftrag nicht zugänglich.' using errcode='42501';end if;
 rec:=r.packet->'record';
 perform care_private.lock_medication_source_scope(tenant,(rec->>'clientId')::uuid,(rec->>'medicationId')::uuid,actor);
 select * into s from public.medication_order_sources where id=p_source and tenant_id=tenant for share;
 select * into a from public.medication_source_archives where id=r.archive_id and tenant_id=tenant for share;
 perform care_private.med_packet_require(s.id is not null and s.id::text=rec->>'sourceId' and s.client_id::text=rec->>'clientId' and s.medication_id::text=rec->>'medicationId' and s.document_id::text=rec->>'documentId' and r.packet->>'requestId'=p_request::text and rec->>'tenantId'=tenant::text and rec->>'actorId'=actor::text and care_private.medication_json_fingerprint(to_jsonb(s))=rec->>'sourceFingerprint','Gespeicherter Quellenbezug des Archivauftrags wurde geändert.');
 expected_path:='tenant/'||tenant||'/clients/'||s.client_id||'/medication-sources/'||s.id||'/'||(rec->>'sha256')||'.bin';
 perform care_private.med_packet_require(a.id is not null and a.status='ready' and a.source_id=s.id and a.client_id=s.client_id and a.medication_id=s.medication_id and a.document_id=s.document_id and a.archive_path=expected_path and a.archive_path=rec->>'archivePath' and a.original_path=rec->>'originalPath' and a.document_version=care_private.med_packet_time(to_jsonb(replace(rec->>'documentVersion',' ','T'))) and a.content_sha256=rec->>'sha256' and to_jsonb(a.content_size)=rec->'sizeBytes' and r.packet->'verifiedSha256'=rec->'sha256' and r.packet->'verifiedSize'=rec->'sizeBytes' and a.finalized_at is not null and a.finalized_at>=a.created_at and a.finalized_at<=clock_timestamp() and exists(select 1 from public.profiles p where p.id=a.finalized_by and p.tenant_id=tenant),'Aufbewahrte Archivzuordnung widerspricht dem ursprünglichen Prüfbeleg.');
 return (rec-'archivePath')||jsonb_build_object('archiveId',a.id,'verificationState','recorded_worker_receipt');
end$$;
create function public.recover_ambulatory_medication_source_proof(source_id uuid,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.recover_medication_source_proof(source_id,request_id)$$;
revoke all on function care_private.recover_medication_source_proof(uuid,uuid),public.recover_ambulatory_medication_source_proof(uuid,uuid) from public,anon,authenticated,service_role;
