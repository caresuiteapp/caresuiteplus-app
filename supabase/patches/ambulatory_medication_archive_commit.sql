-- Quarantined worker completion. SQL trusts a privileged worker's byte readback,
-- never a caller-supplied browser assertion. No clinical approval or WORM claim.
create table care_private.medication_archive_proof_receipts(
 tenant_id uuid not null references public.tenants(id),request_id uuid not null,
 archive_id uuid not null references public.medication_source_archives(id),
 source_id uuid not null references public.medication_order_sources(id),
 actor_id uuid not null references public.profiles(id),
 packet jsonb not null,recorded_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,request_id)
);
alter table care_private.medication_archive_proof_receipts enable row level security;
create policy medication_archive_proof_receipt_deny on care_private.medication_archive_proof_receipts for all to public using (false) with check (false);
revoke all on care_private.medication_archive_proof_receipts from public,anon,authenticated,service_role;
create function care_private.keep_medication_archive_proof_receipt()
returns trigger language plpgsql security invoker set search_path='' as $$begin
 raise exception 'Dateiprüfbeleg darf nicht ersetzt oder entfernt werden.' using errcode='42501';
end$$;
revoke all on function care_private.keep_medication_archive_proof_receipt() from public,anon,authenticated,service_role;
create trigger medication_archive_proof_receipt_immutable before update or delete on care_private.medication_archive_proof_receipts for each row execute function care_private.keep_medication_archive_proof_receipt();

create function care_private.commit_medication_source_proof(packet jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous_claims text:=current_setting('request.jwt.claims',true);caller jsonb:=packet->'caller';rec jsonb:=packet->'record';fresh jsonb;normalized jsonb;prior care_private.medication_archive_proof_receipts%rowtype;a public.medication_source_archives%rowtype;rid uuid;sid uuid;tid uuid;actor uuid;expected_path text;
begin
 -- API ACL and verified service JWT are both mandatory; no authenticated proxy bypass.
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Nur der geprüfte Archivdienst darf Dateiprüfbelege abschließen.' using errcode='42501';end if;
 perform care_private.med_packet_require(jsonb_typeof(packet)='object' and packet->'schemaVersion'='1'::jsonb and jsonb_typeof(rec)='object' and jsonb_typeof(caller)='object','Prüfauftrag unvollständig.');
 perform care_private.med_packet_require((select count(*) from jsonb_object_keys(packet))=6 and packet ?& array['schemaVersion','requestId','record','caller','verifiedSha256','verifiedSize'],'Unbekannte Auftragsfelder.');
 perform care_private.med_packet_require((select count(*) from jsonb_object_keys(caller))=4 and caller ?& array['sub','role','session_id','exp'] and caller->>'role'='authenticated' and jsonb_typeof(caller->'exp')='number','Bestätigte Benutzersitzung fehlt.');
 perform care_private.med_packet_require(care_private.med_packet_uuid(packet->'requestId') and care_private.med_packet_uuid(rec->'sourceId') and care_private.med_packet_uuid(rec->'tenantId') and care_private.med_packet_uuid(rec->'actorId') and care_private.med_packet_uuid(caller->'sub') and care_private.med_packet_uuid(caller->'session_id'),'Ungültige Auftrags- oder Sitzungsidentität.');
 rid:=(packet->>'requestId')::uuid;sid:=(rec->>'sourceId')::uuid;tid:=(rec->>'tenantId')::uuid;actor:=(rec->>'actorId')::uuid;
 perform set_config('request.jwt.claims',caller::text,true);
 -- Serialize source commits and request collisions in consistent order. Ordinary source,
 -- order, document, profile and session changes are blocked by prepare's row locks.
 perform pg_advisory_xact_lock(hashtextextended('medication-proof-request:'||tid||':'||rid,0));
 perform pg_advisory_xact_lock(hashtextextended('medication-proof-source:'||sid,0));
 fresh:=care_private.prepare_medication_source_proof(sid);
 expected_path:='tenant/'||tid||'/clients/'||(fresh->>'clientId')||'/medication-sources/'||sid||'/'||(fresh->>'sha256')||'.bin';
 perform care_private.med_packet_require(rec is not distinct from ((fresh-'archiveId'-'verificationState')||jsonb_build_object('archivePath',expected_path)) and fresh->>'actorId'=actor::text and fresh->>'tenantId'=tid::text,'Quelle, Verordnung, Dokument oder Berechtigung wurde geändert.');
 perform care_private.med_packet_require(packet->'verifiedSha256'=fresh->'sha256' and packet->'verifiedSize'=fresh->'sizeBytes','Dateiprüfung widerspricht den gebundenen Quelldaten.');
 normalized:=packet-'caller';
 select * into prior from care_private.medication_archive_proof_receipts where tenant_id=tid and request_id=rid;
 if prior.request_id is not null then
  perform care_private.med_packet_require(prior.packet is not distinct from normalized and prior.actor_id=actor and prior.source_id=sid and fresh->>'archiveId'=prior.archive_id::text,'Anfrage-ID wurde bereits für einen anderen Stand verwendet.');
  perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);return prior.archive_id;
 end if;
 select * into a from public.medication_source_archives where source_id=sid for update;
 if a.id is null then
  insert into public.medication_source_archives(id,tenant_id,source_id,client_id,medication_id,document_id,document_version,original_path,archive_path,content_sha256,content_size,recorded_by,status)
  values(rid,tid,sid,(fresh->>'clientId')::uuid,(fresh->>'medicationId')::uuid,(fresh->>'documentId')::uuid,(fresh->>'documentVersion')::timestamptz,fresh->>'originalPath',expected_path,fresh->>'sha256',(fresh->>'sizeBytes')::bigint,actor,'pending') returning * into a;
 end if;
 if a.status='pending' then
  update public.medication_source_archives set status='ready',finalized_by=actor,finalized_at=clock_timestamp() where id=a.id;
 end if;
 insert into care_private.medication_archive_proof_receipts(tenant_id,request_id,archive_id,source_id,actor_id,packet) values(tid,rid,a.id,sid,actor,normalized);
 perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);return a.id;
exception when others then
 perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);raise;
end$$;
create function public.commit_ambulatory_medication_source_proof(packet jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.commit_medication_source_proof(packet)$$;
-- Activation is a separate release. Even service_role is denied until then.
revoke all on function care_private.commit_medication_source_proof(jsonb),public.commit_ambulatory_medication_source_proof(jsonb) from public,anon,authenticated,service_role;
