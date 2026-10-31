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
