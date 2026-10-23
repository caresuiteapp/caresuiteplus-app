-- Quarantined structured transcription proposals, history and independently scoped apply.
-- Technical original bytes and software transcription are not medical prescribing approval.
create function care_private.medication_order_candidate_native(candidate jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$declare mapped jsonb;begin
 perform care_private.med_packet_require(care_private.med_packet_keys(candidate,array['medicationName','activeIngredient','strength','form','dose','unit','route','prescriber','validFrom','validUntil','indication','isPrn','minimumIntervalMinutes','maximumDose','maximumDoseUnit','maximumPeriodHours']),'Verordnungsentwurf benötigt genau die strukturierten Angaben.');
 mapped:=jsonb_build_object('name',candidate->'medicationName','active_ingredient',candidate->'activeIngredient','strength',candidate->'strength','form',candidate->'form','prescribed_dose',candidate->'dose','dose_unit',candidate->'unit','route',candidate->'route','prescribed_by',candidate->'prescriber','start_date',candidate->'validFrom','end_date',candidate->'validUntil','indication',candidate->'indication','is_prn',candidate->'isPrn','minimum_interval_minutes',candidate->'minimumIntervalMinutes','maximum_dose',candidate->'maximumDose','maximum_dose_unit',candidate->'maximumDoseUnit','maximum_period_hours',candidate->'maximumPeriodHours');
 perform care_private.med_packet_require(candidate is not distinct from care_private.medication_native_order(mapped),'Strukturierter Entwurf widersprüchlich.');return mapped;
end$$;
revoke all on function care_private.medication_order_candidate_native(jsonb) from public,anon,authenticated,service_role;

create table care_private.medication_order_revisions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),medication_id uuid not null references public.medications(id),source_id uuid not null references public.medication_order_sources(id),request_id uuid not null,
 recorded_by uuid not null references public.profiles(id),recorded_by_name text not null,recorded_at timestamptz not null default clock_timestamp(),expected_updated_at timestamptz not null,
 before_snapshot jsonb not null,proposed_order jsonb not null,source_snapshot jsonb not null,archive_snapshot jsonb not null,reason text not null,packet jsonb not null,unique(tenant_id,request_id)
);
create index medication_order_revision_page on care_private.medication_order_revisions(tenant_id,medication_id,recorded_at desc,id desc);
create table care_private.medication_order_review_authorizations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),revision_id uuid not null references care_private.medication_order_revisions(id),actor_id uuid not null references public.profiles(id),session_id uuid not null,
 reviewed_by uuid not null references public.profiles(id),review_reference text not null check(length(btrim(review_reference)) between 10 and 2000),
 proposal_fingerprint text not null,native_before_fingerprint text not null,source_fingerprint text not null,archive_fingerprint text not null,
 issued_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,revoked_at timestamptz,check(expires_at>issued_at),check(actor_id<>reviewed_by)
);
create table care_private.medication_order_applications(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),medication_id uuid not null references public.medications(id),source_id uuid not null references public.medication_order_sources(id),revision_id uuid not null unique references care_private.medication_order_revisions(id),authorization_id uuid not null unique references care_private.medication_order_review_authorizations(id),
 request_id uuid not null,recorded_by uuid not null references public.profiles(id),recorded_at timestamptz not null default clock_timestamp(),before_snapshot jsonb not null,after_snapshot jsonb not null,reason text not null,packet jsonb not null,unique(tenant_id,request_id)
);
alter table care_private.medication_order_revisions enable row level security;
alter table care_private.medication_order_review_authorizations enable row level security;
alter table care_private.medication_order_applications enable row level security;
create policy medication_order_revisions_deny on care_private.medication_order_revisions for all to public using(false) with check(false);
create policy medication_order_review_authorizations_deny on care_private.medication_order_review_authorizations for all to public using(false) with check(false);
create policy medication_order_applications_deny on care_private.medication_order_applications for all to public using(false) with check(false);
revoke all on care_private.medication_order_revisions,care_private.medication_order_review_authorizations,care_private.medication_order_applications from public,anon,authenticated,service_role;
create trigger medication_order_revision_immutable before update or delete on care_private.medication_order_revisions for each row execute function care_private.keep_medication_archive_proof_receipt();
create trigger medication_order_application_immutable before update or delete on care_private.medication_order_applications for each row execute function care_private.keep_medication_archive_proof_receipt();
create function care_private.guard_medication_order_review_authorization()
returns trigger language plpgsql security invoker set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'Übertragungsberechtigung darf nur widerrufen werden.' using errcode='42501';end if;
 if (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at') or old.revoked_at is not null or new.revoked_at is null or new.revoked_at<new.issued_at or new.revoked_at>clock_timestamp() then raise exception 'Übertragungsberechtigung darf nur einmal widerrufen werden.' using errcode='42501';end if;return new;
end$$;
revoke all on function care_private.guard_medication_order_review_authorization() from public,anon,authenticated,service_role;
create trigger medication_order_review_authorization_guard before update or delete on care_private.medication_order_review_authorizations for each row execute function care_private.guard_medication_order_review_authorization();

create function care_private.medication_order_archived_source(p_tenant uuid,p_client uuid,p_medication uuid,p_source uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare s public.medication_order_sources%rowtype;a public.medication_source_archives%rowtype;proof care_private.medication_archive_proof_receipts%rowtype;rec jsonb;begin
 select * into s from public.medication_order_sources where id=p_source and tenant_id=p_tenant and client_id=p_client and medication_id=p_medication for share;
 select * into a from public.medication_source_archives where source_id=s.id and tenant_id=p_tenant and client_id=p_client and medication_id=p_medication and status='ready' for share;
 if s.id is null or a.id is null then raise exception 'Gesicherte Originalquelle fehlt.' using errcode='23514';end if;
 select * into proof from care_private.medication_archive_proof_receipts r where r.source_id=s.id and r.archive_id=a.id and r.tenant_id=p_tenant and r.packet#>>'{record,sourceFingerprint}'=care_private.medication_json_fingerprint(to_jsonb(s)) order by r.recorded_at desc,r.request_id desc limit 1 for share;
 rec:=proof.packet->'record';
 perform care_private.med_packet_require(proof.request_id is not null and rec->>'tenantId'=p_tenant::text and rec->>'clientId'=p_client::text and rec->>'medicationId'=p_medication::text and rec->>'sourceId'=p_source::text and rec->>'documentId'=s.document_id::text and a.document_id=s.document_id and a.original_path=rec->>'originalPath' and a.archive_path=rec->>'archivePath' and a.archive_path='tenant/'||p_tenant||'/clients/'||p_client||'/medication-sources/'||p_source||'/'||(rec->>'sha256')||'.bin' and a.content_sha256=rec->>'sha256' and to_jsonb(a.content_size)=rec->'sizeBytes' and a.document_version=care_private.med_packet_time(to_jsonb(replace(rec->>'documentVersion',' ','T'))) and proof.packet->'verifiedSha256'=rec->'sha256' and proof.packet->'verifiedSize'=rec->'sizeBytes' and a.finalized_at is not null and a.finalized_at>=a.created_at and a.finalized_at<=clock_timestamp() and exists(select 1 from public.profiles p where p.id=a.finalized_by and p.tenant_id=p_tenant),'Originalquelle oder Archivprüfbeleg widersprüchlich.');
 return jsonb_build_object('source',to_jsonb(s),'archive',to_jsonb(a));
end$$;
revoke all on function care_private.medication_order_archived_source(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function care_private.medication_order_revision_json(p_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select (to_jsonb(r)-'packet')||jsonb_build_object('state',case when a.id is null then 'proposed' else 'transcribed' end,'application',case when a.id is null then null else to_jsonb(a)-'packet' end) from care_private.medication_order_revisions r left join care_private.medication_order_applications a on a.revision_id=r.id where r.id=p_id
$$;
revoke all on function care_private.medication_order_revision_json(uuid) from public,anon,authenticated,service_role;

create function care_private.propose_medication_order_revision(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;r care_private.medication_order_revisions%rowtype;originals jsonb;req uuid;src uuid;actor_name text;begin
 perform care_private.require_workspace_session(tenant,actor);
 perform care_private.med_packet_require(care_private.med_packet_keys(p_packet,array['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','expectedUpdatedAt','sourceId','reason','order']) and p_packet->'schemaVersion'='1'::jsonb and p_packet->>'tenantId'=tenant::text and p_packet->>'actorId'=actor::text and care_private.med_packet_uuid(p_packet->'requestId') and care_private.med_packet_uuid(p_packet->'clientId') and care_private.med_packet_uuid(p_packet->'medicationId') and care_private.med_packet_uuid(p_packet->'sourceId') and care_private.med_packet_text(p_packet->'reason',10,2000),'Eigener Übertragungsentwurf unvollständig.');
 perform care_private.medication_order_candidate_native(p_packet->'order');
 req:=(p_packet->>'requestId')::uuid;src:=(p_packet->>'sourceId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('medication-order-proposal:'||tenant||':'||req,0));
 perform care_private.lock_medication_source_scope(tenant,(p_packet->>'clientId')::uuid,(p_packet->>'medicationId')::uuid,actor);
 select * into r from care_private.medication_order_revisions where tenant_id=tenant and request_id=req for share;
 if r.id is not null then
  perform care_private.med_packet_require(r.recorded_by=actor and r.packet is not distinct from p_packet,'Entwurfsanfrage wurde für andere Originalangaben verwendet.');return care_private.medication_order_revision_json(r.id);
 end if;
 select * into m from public.medications where id=(p_packet->>'medicationId')::uuid and tenant_id=tenant for share;
 perform care_private.med_packet_require(care_private.med_packet_time(to_jsonb(replace(p_packet->>'expectedUpdatedAt',' ','T')))=m.updated_at,'Verordnungsstand wurde geändert.');
 originals:=care_private.medication_order_archived_source(tenant,m.client_id,m.id,src);
 select coalesce(nullif(p.display_name,''),p.email,'Name nicht verfügbar') into actor_name from public.profiles p where p.id=actor;
 insert into care_private.medication_order_revisions(tenant_id,client_id,medication_id,source_id,request_id,recorded_by,recorded_by_name,expected_updated_at,before_snapshot,proposed_order,source_snapshot,archive_snapshot,reason,packet)
 values(tenant,m.client_id,m.id,src,req,actor,actor_name,m.updated_at,to_jsonb(m),p_packet->'order',originals->'source',originals->'archive',btrim(p_packet->>'reason'),p_packet) returning * into r;
 return care_private.medication_order_revision_json(r.id);
end$$;
create function public.propose_ambulatory_medication_order_revision(packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.propose_medication_order_revision(packet)$$;

create function care_private.confirm_medication_order_revision(p_revision uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();r care_private.medication_order_revisions%rowtype;begin
 perform care_private.require_workspace_session(tenant,actor);
 select * into r from care_private.medication_order_revisions where id=p_revision and tenant_id=tenant and request_id=p_request and recorded_by=actor for share;
 if r.id is null then raise exception 'Eigener Übertragungsentwurf nicht zugänglich.' using errcode='42501';end if;
 perform care_private.lock_medication_source_scope(tenant,r.client_id,r.medication_id,actor);
 return care_private.medication_order_revision_json(r.id);
end$$;
create function public.confirm_ambulatory_medication_order_revision(revision_id uuid,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_medication_order_revision(revision_id,request_id)$$;

create function care_private.read_medication_order_revision_context(p_medication uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;originals jsonb:='[]'::jsonb;item record;begin
 perform care_private.require_workspace_session(tenant,actor);
 select * into m from public.medications where id=p_medication and tenant_id=tenant;
 if m.id is null then raise exception 'Verordnung nicht zugänglich.' using errcode='42501';end if;
 perform care_private.lock_medication_source_scope(tenant,m.client_id,m.id,actor);
 select * into m from public.medications where id=p_medication and tenant_id=tenant for share;
 for item in select s.id from public.medication_order_sources s join public.medication_source_archives a on a.source_id=s.id where s.tenant_id=tenant and s.client_id=m.client_id and s.medication_id=m.id and a.status='ready' and exists(select 1 from care_private.medication_archive_proof_receipts r where r.tenant_id=tenant and r.source_id=s.id and r.archive_id=a.id) order by s.created_at desc,s.id desc loop
  originals:=originals||jsonb_build_array(care_private.medication_order_archived_source(tenant,m.client_id,m.id,item.id));
 end loop;
 return jsonb_build_object('order',to_jsonb(m),'sources',originals);
end$$;
create function public.read_ambulatory_medication_order_revision_context(medication_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_order_revision_context(medication_id)$$;

create function care_private.read_medication_order_revisions(p_medication uuid,p_cursor_at timestamptz,p_cursor_id uuid,p_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;items jsonb:='[]'::jsonb;row_data care_private.medication_order_revisions%rowtype;last_at timestamptz;last_id uuid;position integer:=0;more boolean:=false;begin
 perform care_private.require_workspace_session(tenant,actor);
 perform care_private.med_packet_require(p_size between 1 and 100 and (p_cursor_at is null)=(p_cursor_id is null) and (p_cursor_at is null or isfinite(p_cursor_at)),'Ungültige Verlaufsseite.');
 select * into m from public.medications where id=p_medication and tenant_id=tenant;
 if m.id is null then raise exception 'Verordnung nicht zugänglich.' using errcode='42501';end if;
 perform care_private.lock_medication_source_scope(tenant,m.client_id,m.id,actor);
 if p_cursor_id is not null and not exists(select 1 from care_private.medication_order_revisions r where r.id=p_cursor_id and r.tenant_id=tenant and r.medication_id=m.id and r.recorded_at=p_cursor_at) then raise exception 'Verlaufscursor gehört nicht zu dieser Akte.' using errcode='23514';end if;
 for row_data in select * from care_private.medication_order_revisions r where r.tenant_id=tenant and r.medication_id=m.id and (p_cursor_at is null or (r.recorded_at,r.id)<(p_cursor_at,p_cursor_id)) order by r.recorded_at desc,r.id desc limit p_size+1 loop
  position:=position+1;if position>p_size then more:=true;exit;end if;
  items:=items||jsonb_build_array(care_private.medication_order_revision_json(row_data.id));last_at:=row_data.recorded_at;last_id:=row_data.id;
 end loop;
 return jsonb_build_object('items',items,'nextCursor',case when more then jsonb_build_object('at',last_at,'id',last_id) else null end);
end$$;
create function public.read_ambulatory_medication_order_revisions(medication_id uuid,cursor_at timestamptz default null,cursor_id uuid default null,page_size integer default 50)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_order_revisions(medication_id,cursor_at,cursor_id,page_size)$$;

create function care_private.apply_medication_order_revision(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();r care_private.medication_order_revisions%rowtype;a care_private.medication_order_review_authorizations%rowtype;event care_private.medication_order_applications%rowtype;m public.medications%rowtype;updated public.medications%rowtype;reviewer public.profiles%rowtype;mapped jsonb;originals jsonb;req uuid;revision uuid;review_authorization_id uuid;key text;begin
 perform care_private.require_workspace_session(tenant,actor);
 perform care_private.med_packet_require(care_private.med_packet_keys(p_packet,array['requestId','revisionId','authorizationId','reason']) and care_private.med_packet_uuid(p_packet->'requestId') and care_private.med_packet_uuid(p_packet->'revisionId') and care_private.med_packet_uuid(p_packet->'authorizationId') and care_private.med_packet_text(p_packet->'reason',10,2000),'Übertragungsauftrag unvollständig.');
 req:=(p_packet->>'requestId')::uuid;revision:=(p_packet->>'revisionId')::uuid;review_authorization_id:=(p_packet->>'authorizationId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('medication-order-apply:'||tenant||':'||req,0));
 select * into r from care_private.medication_order_revisions where id=revision and tenant_id=tenant and recorded_by=actor for share;
 if r.id is null then raise exception 'Eigener Übertragungsentwurf fehlt.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||r.medication_id,0));
 perform care_private.lock_medication_source_scope(tenant,r.client_id,r.medication_id,actor);
 select * into event from care_private.medication_order_applications where tenant_id=tenant and request_id=req for share;
 if event.id is not null then
  perform care_private.med_packet_require(event.packet is not distinct from p_packet and event.recorded_by=actor and event.revision_id=revision,'Übertragungsanfrage wurde anderweitig verwendet.');return to_jsonb(event)-'packet';
 end if;
 select * into m from public.medications where id=r.medication_id and tenant_id=tenant for update;
 if exists(select 1 from care_private.medication_order_applications x where x.revision_id=r.id) then raise exception 'Dieser Entwurf wurde bereits übertragen.' using errcode='23514';end if;
 select * into a from care_private.medication_order_review_authorizations where id=review_authorization_id and tenant_id=tenant and revision_id=r.id and actor_id=actor for update;
 if a.id is null or a.revoked_at is not null or a.session_id is distinct from (auth.jwt()->>'session_id')::uuid or a.issued_at>clock_timestamp() or a.expires_at<=clock_timestamp() then raise exception 'Unabhängige aktuelle Übertragungsberechtigung fehlt.' using errcode='42501';end if;
 select * into reviewer from public.profiles p where p.id=a.reviewed_by and p.tenant_id=tenant and p.is_active and p.status='active' for share;
 perform 1 from public.role_permissions rp where rp.role_id=reviewer.role_id for share;
 if reviewer.id is null or reviewer.id=actor or coalesce(reviewer.auth_user_id,reviewer.id)=auth.uid() or not exists(select 1 from public.role_permissions rp where rp.role_id=reviewer.role_id and rp.permission_key='pflege.documentation.sign') then raise exception 'Unabhängiger dokumentierter Prüfbezug fehlt.' using errcode='42501';end if;
 originals:=care_private.medication_order_archived_source(tenant,r.client_id,r.medication_id,r.source_id);
 perform care_private.med_packet_require(to_jsonb(m) is not distinct from r.before_snapshot and a.proposal_fingerprint=care_private.medication_json_fingerprint(to_jsonb(r)) and a.native_before_fingerprint=care_private.medication_json_fingerprint(to_jsonb(m)) and a.source_fingerprint=care_private.medication_json_fingerprint(originals->'source') and a.archive_fingerprint=care_private.medication_json_fingerprint(originals->'archive') and r.source_snapshot is not distinct from originals->'source' and r.archive_snapshot is not distinct from originals->'archive','Native Fassung, geprüfter Entwurf oder Quellenoriginal wurde geändert.');
 -- Do not silently carry a previous daily plan into a changed structured order.
 foreach key in array array['frequency','schedule','morning_dose','noon_dose','evening_dose','night_dose'] loop perform care_private.med_packet_require(nullif(btrim(to_jsonb(m)->>key),'') is null,'Vorhandener Gabeplan benötigt eine eigene abgestimmte Fortschreibung.');end loop;
 mapped:=care_private.medication_order_candidate_native(r.proposed_order);
 update public.medications set name=mapped->>'name',active_ingredient=mapped->>'active_ingredient',strength=mapped->>'strength',form=mapped->>'form',prescribed_dose=mapped->>'prescribed_dose',dose_unit=mapped->>'dose_unit',dosage=(mapped->>'prescribed_dose')||' '||(mapped->>'dose_unit'),route=mapped->>'route',prescribed_by=mapped->>'prescribed_by',start_date=(mapped->>'start_date')::date,end_date=(mapped->>'end_date')::date,indication=mapped->>'indication',is_prn=(mapped->>'is_prn')::boolean,minimum_interval_minutes=mapped->>'minimum_interval_minutes',maximum_dose=mapped->>'maximum_dose',maximum_dose_unit=mapped->>'maximum_dose_unit',maximum_period_hours=mapped->>'maximum_period_hours',updated_at=clock_timestamp() where id=m.id and tenant_id=tenant returning * into updated;
 perform care_private.med_packet_require(care_private.medication_native_order(to_jsonb(updated)) is not distinct from r.proposed_order,'Zurückgelesene strukturierte Verordnung widersprüchlich.');
 perform care_private.med_packet_require((to_jsonb(updated)-array['name','active_ingredient','strength','form','prescribed_dose','dose_unit','dosage','route','prescribed_by','start_date','end_date','indication','is_prn','minimum_interval_minutes','maximum_dose','maximum_dose_unit','maximum_period_hours','updated_at','updated_by']) is not distinct from (to_jsonb(m)-array['name','active_ingredient','strength','form','prescribed_dose','dose_unit','dosage','route','prescribed_by','start_date','end_date','indication','is_prn','minimum_interval_minutes','maximum_dose','maximum_dose_unit','maximum_period_hours','updated_at','updated_by']),'Andere native Verordnungsangaben wurden unzulässig geändert.');
 insert into care_private.medication_order_applications(tenant_id,client_id,medication_id,source_id,revision_id,authorization_id,request_id,recorded_by,before_snapshot,after_snapshot,reason,packet) values(tenant,r.client_id,r.medication_id,r.source_id,r.id,a.id,req,actor,to_jsonb(m),to_jsonb(updated),btrim(p_packet->>'reason'),p_packet) returning * into event;
 return to_jsonb(event)-'packet';
end$$;
create function public.apply_ambulatory_medication_order_revision(packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.apply_medication_order_revision(packet)$$;
revoke all on function care_private.propose_medication_order_revision(jsonb),public.propose_ambulatory_medication_order_revision(jsonb),care_private.confirm_medication_order_revision(uuid,uuid),public.confirm_ambulatory_medication_order_revision(uuid,uuid),care_private.read_medication_order_revision_context(uuid),public.read_ambulatory_medication_order_revision_context(uuid),care_private.read_medication_order_revisions(uuid,timestamptz,uuid,integer),public.read_ambulatory_medication_order_revisions(uuid,timestamptz,uuid,integer),care_private.apply_medication_order_revision(jsonb),public.apply_ambulatory_medication_order_revision(jsonb) from public,anon,authenticated,service_role;

-- Context join indexes (separate applied follow-up migration).
create index medication_source_revision_context on public.medication_order_sources(tenant_id,medication_id,client_id,created_at desc,id desc);
create index medication_archive_proof_source on care_private.medication_archive_proof_receipts(tenant_id,source_id,archive_id,recorded_at desc,request_id desc);
