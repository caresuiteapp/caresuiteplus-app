-- Quarantined source capture and exact own-write confirmation. No clinical approval.
create function care_private.lock_medication_source_scope(p_tenant uuid,p_client uuid,p_medication uuid,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare own_role uuid;required text;
begin
 perform care_private.require_workspace_session(p_tenant,p_actor);
 perform 1 from public.clients c where c.id=p_client and c.tenant_id=p_tenant and c.status::text in('active','aktiv') and c.lifecycle_status::text in('active','aktiv') for share;
 if not found then raise exception 'Aktive eigene Klientenakte fehlt.' using errcode='42501';end if;
 perform 1 from public.client_module_assignments a where a.tenant_id=p_tenant and a.client_id=p_client and a.module_key='pflege' and a.is_active and a.status in('active','aktiv') for share;
 if not found then raise exception 'Aktive Pflegezuordnung fehlt.' using errcode='42501';end if;
 select p.role_id into own_role from public.profiles p where p.id=p_actor and p.tenant_id=p_tenant and p.is_active and p.status='active' for share;
 perform 1 from public.role_permissions rp where rp.role_id=own_role for share;
 foreach required in array array['pflege.medications.manage','pflege.medications.view','office.documents.view','office.clients.view_sensitive'] loop
  if not exists(select 1 from public.role_permissions rp where rp.role_id=own_role and (rp.permission_key=required or (rp.permission_key=split_part(required,'.',2) and ((required like '%.view' and coalesce(rp.can_view,false)) or (required like '%.manage' and coalesce(rp.can_update,false)))))) then raise exception 'Aktuelles eigenes Quellenrecht fehlt.' using errcode='42501';end if;
 end loop;
 perform 1 from public.medications m where m.id=p_medication and m.tenant_id=p_tenant and m.client_id=p_client for share;
 if not found then raise exception 'Eigene Verordnung fehlt.' using errcode='42501';end if;
end$$;
revoke all on function care_private.lock_medication_source_scope(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create table care_private.medication_source_capture_receipts(
 tenant_id uuid not null references public.tenants(id),request_id uuid not null,source_id uuid not null unique references public.medication_order_sources(id),
 actor_id uuid not null references public.profiles(id),payload jsonb not null,source_fingerprint text not null,
 recorded_at timestamptz not null default clock_timestamp(),primary key(tenant_id,request_id)
);
alter table care_private.medication_source_capture_receipts enable row level security;
create policy medication_source_capture_receipts_deny on care_private.medication_source_capture_receipts for all to public using(false) with check(false);
revoke all on care_private.medication_source_capture_receipts from public,anon,authenticated,service_role;
create trigger medication_source_capture_receipt_immutable before update or delete on care_private.medication_source_capture_receipts for each row execute function care_private.keep_medication_archive_proof_receipt();
create function care_private.guard_captured_medication_source()
returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from care_private.medication_source_capture_receipts r where r.source_id=old.id) then raise exception 'Bestätigtes Quellenoriginal darf nicht ersetzt oder entfernt werden.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
revoke all on function care_private.guard_captured_medication_source() from public,anon,authenticated,service_role;
create trigger captured_medication_source_immutable before update or delete on public.medication_order_sources for each row execute function care_private.guard_captured_medication_source();

create function care_private.capture_medication_source(p_medication uuid,p_request uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;d public.client_documents%rowtype;s public.medication_order_sources%rowtype;r care_private.medication_source_capture_receipts%rowtype;prefix text;sz numeric;actor_name text;
begin
 perform care_private.require_workspace_session(tenant,actor);
 perform care_private.med_packet_require(p_request is not null and care_private.med_packet_keys(p_payload,array['documentId','documentUpdatedAt','expectedUpdatedAt','reason','contentSha256','contentSize']),'Quellenanfrage unvollständig oder unbekannte Felder.');
 perform care_private.med_packet_require(care_private.med_packet_uuid(p_payload->'documentId') and care_private.med_packet_text(p_payload->'reason',1,2000) and jsonb_typeof(p_payload->'contentSha256')='string' and p_payload->>'contentSha256' ~ '^[0-9a-f]{64}$' and jsonb_typeof(p_payload->'contentSize')='number','Begründung, Dokument oder beobachteter Dateiinhalt ungültig.');
 sz:=(p_payload->>'contentSize')::numeric;perform care_private.med_packet_require(sz between 1 and 52428800 and sz=trunc(sz),'Dateigröße außerhalb des erlaubten Bereichs.');
 perform pg_advisory_xact_lock(hashtextextended('medication-capture-request:'||tenant||':'||p_request,0));
 select * into m from public.medications where id=p_medication and tenant_id=tenant;
 if m.id is null then raise exception 'Verordnung nicht zugänglich.' using errcode='42501';end if;
 perform care_private.lock_medication_source_scope(tenant,m.client_id,m.id,actor);
 select * into m from public.medications where id=p_medication and tenant_id=tenant for share;
 select * into r from care_private.medication_source_capture_receipts where tenant_id=tenant and request_id=p_request for share;
 if r.source_id is not null then
  select * into s from public.medication_order_sources where id=r.source_id for share;
  perform care_private.med_packet_require(r.actor_id=actor and r.payload is not distinct from p_payload and s.tenant_id=tenant and s.medication_id=m.id and s.client_id=m.client_id and s.request_id=p_request and s.recorded_by=actor and r.source_fingerprint=care_private.medication_json_fingerprint(to_jsonb(s)),'Anfrage-ID oder gespeichertes Quellenoriginal widersprüchlich.');
  return s.id;
 end if;
 perform care_private.med_packet_require(care_private.med_packet_time(to_jsonb(replace(p_payload->>'expectedUpdatedAt',' ','T')))=m.updated_at,'Verordnungsstand wurde geändert.');
 select * into d from public.client_documents where id=(p_payload->>'documentId')::uuid and tenant_id=tenant and client_id=m.client_id for share;
 perform care_private.med_packet_require(d.id is not null and d.status='aktiv' and nullif(btrim(d.title),'') is not null and nullif(btrim(d.file_name),'') is not null and nullif(btrim(d.mime_type),'') is not null and care_private.med_packet_time(to_jsonb(replace(p_payload->>'documentUpdatedAt',' ','T')))=d.updated_at,'Aktives Dokument oder ursprüngliche Dokumentfassung fehlt.');
 prefix:='tenant/'||tenant||'/clients/'||m.client_id||'/documents/';
 perform care_private.med_packet_require(d.storage_path is not null and left(d.storage_path,length(prefix))=prefix and length(d.storage_path)>length(prefix) and position('..' in d.storage_path)=0 and d.storage_path !~ '[\\%?#[:cntrl:]]' and (d.size_bytes is null or d.size_bytes=sz),'Dokumentpfad oder Dateigröße widersprüchlich.');
 select coalesce(nullif(to_jsonb(p)->>'full_name',''),nullif(p.display_name,''),p.email,'Name nicht verfügbar') into actor_name from public.profiles p where p.id=actor;
 insert into public.medication_order_sources(tenant_id,medication_id,client_id,document_id,request_id,payload,document_snapshot,order_snapshot,reason,recorded_by,recorded_by_name)
 values(tenant,m.id,m.client_id,d.id,p_request,p_payload,to_jsonb(d)||jsonb_build_object('content_sha256',p_payload->>'contentSha256','content_size',sz,'content_fingerprint_origin','client_observed'),to_jsonb(m),btrim(p_payload->>'reason'),actor,actor_name) returning * into s;
 insert into care_private.medication_source_capture_receipts(tenant_id,request_id,source_id,actor_id,payload,source_fingerprint) values(tenant,p_request,s.id,actor,p_payload,care_private.medication_json_fingerprint(to_jsonb(s)));
 return s.id;
end$$;
create function public.capture_ambulatory_medication_source(medication_id uuid,request_id uuid,payload jsonb)
returns uuid language sql security invoker set search_path='' as $$select care_private.capture_medication_source(medication_id,request_id,payload)$$;

create function care_private.confirm_medication_source_capture(p_source uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();s public.medication_order_sources%rowtype;r care_private.medication_source_capture_receipts%rowtype;
begin
 perform care_private.require_workspace_session(tenant,actor);
 select * into r from care_private.medication_source_capture_receipts where tenant_id=tenant and request_id=p_request and source_id=p_source and actor_id=actor for share;
 if r.source_id is null then raise exception 'Eigener Quellenbeleg nicht zugänglich.' using errcode='42501';end if;
 select * into s from public.medication_order_sources where id=p_source and tenant_id=tenant for share;
 perform care_private.lock_medication_source_scope(tenant,s.client_id,s.medication_id,actor);
 perform care_private.med_packet_require(s.request_id=p_request and s.recorded_by=actor and s.payload is not distinct from r.payload and care_private.medication_json_fingerprint(to_jsonb(s))=r.source_fingerprint,'Gespeichertes Quellenoriginal widersprüchlich.');
 return to_jsonb(s);
end$$;
create function public.confirm_ambulatory_medication_source_capture(source_id uuid,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_medication_source_capture(source_id,request_id)$$;
revoke all on function care_private.capture_medication_source(uuid,uuid,jsonb),public.capture_ambulatory_medication_source(uuid,uuid,jsonb),care_private.confirm_medication_source_capture(uuid,uuid),public.confirm_ambulatory_medication_source_capture(uuid,uuid) from public,anon,authenticated,service_role;
