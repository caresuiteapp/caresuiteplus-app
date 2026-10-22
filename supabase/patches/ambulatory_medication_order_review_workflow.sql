-- Quarantined technical transcription review. This does not establish medical qualification.
-- Creator session IDs stay private; the reviewer can authorize only a retained creator request.
create table care_private.medication_order_review_requests(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),medication_id uuid not null references public.medications(id),
 revision_id uuid not null references care_private.medication_order_revisions(id),creator_id uuid not null references public.profiles(id),creator_session_id uuid not null,
 request_id uuid not null,created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,reason text not null,proposal_snapshot jsonb not null,packet jsonb not null,
 unique(tenant_id,request_id),check(expires_at>created_at),check(length(btrim(reason)) between 10 and 2000)
);
create table care_private.medication_order_review_writes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),medication_id uuid not null references public.medications(id),
 request_id uuid not null,review_request_id uuid not null references care_private.medication_order_review_requests(id),actor_id uuid not null references public.profiles(id),actor_session_id uuid not null,
 action text not null check(action in('request','authorize','reject','revoke')),authorization_id uuid references care_private.medication_order_review_authorizations(id),
 recorded_at timestamptz not null,review_reference text not null,packet jsonb not null,original jsonb not null,unique(tenant_id,request_id)
);
create unique index medication_order_review_decision_once on care_private.medication_order_review_writes(review_request_id) where action in('authorize','reject');
create unique index medication_order_review_revocation_once on care_private.medication_order_review_writes(review_request_id) where action='revoke';
create index medication_order_review_request_page on care_private.medication_order_review_requests(tenant_id,medication_id,created_at desc,id desc);
create index medication_order_review_writes_context on care_private.medication_order_review_writes(tenant_id,medication_id,review_request_id,recorded_at,id);
alter table care_private.medication_order_review_requests enable row level security;
alter table care_private.medication_order_review_writes enable row level security;
create policy medication_order_review_requests_deny on care_private.medication_order_review_requests for all to public using(false) with check(false);
create policy medication_order_review_writes_deny on care_private.medication_order_review_writes for all to public using(false) with check(false);
revoke all on care_private.medication_order_review_requests,care_private.medication_order_review_writes from public,anon,authenticated,service_role;
create trigger medication_order_review_request_immutable before update or delete on care_private.medication_order_review_requests for each row execute function care_private.keep_medication_archive_proof_receipt();
create trigger medication_order_review_write_immutable before update or delete on care_private.medication_order_review_writes for each row execute function care_private.keep_medication_archive_proof_receipt();

create function care_private.medication_order_review_item(p_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('request',jsonb_build_object('id',r.id,'tenantId',r.tenant_id,'clientId',r.client_id,'medicationId',r.medication_id,'revisionId',r.revision_id,'creatorId',r.creator_id,
 'createdAt',r.created_at,'expiresAt',r.expires_at,'reason',r.reason,'revision',(r.proposal_snapshot-'packet')||jsonb_build_object('state','proposed','application',null)),
 'decision',(select jsonb_build_object('action',w.action,'actorId',w.actor_id,'recordedAt',w.recorded_at,'reviewReference',w.review_reference) from care_private.medication_order_review_writes w where w.review_request_id=r.id and w.action in('authorize','reject')),
 'authorization',(select jsonb_build_object('id',a.id,'tenantId',a.tenant_id,'revisionId',a.revision_id,'actorId',a.actor_id,'reviewedBy',a.reviewed_by,'reviewReference',a.review_reference,'issuedAt',a.issued_at,'expiresAt',a.expires_at,'revokedAt',a.revoked_at,
 'proposalFingerprint',a.proposal_fingerprint,'nativeBeforeFingerprint',a.native_before_fingerprint,'sourceFingerprint',a.source_fingerprint,'archiveFingerprint',a.archive_fingerprint) from care_private.medication_order_review_authorizations a join care_private.medication_order_review_writes w on w.authorization_id=a.id and w.action='authorize' where w.review_request_id=r.id),
 'revocation',(select jsonb_build_object('action',w.action,'actorId',w.actor_id,'recordedAt',w.recorded_at,'reviewReference',w.review_reference) from care_private.medication_order_review_writes w where w.review_request_id=r.id and w.action='revoke'))
 from care_private.medication_order_review_requests r where r.id=p_id
$$;
revoke all on function care_private.medication_order_review_item(uuid) from public,anon,authenticated,service_role;

create function care_private.commit_medication_order_review(p_packet jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();sid uuid;req uuid;operation text;rr care_private.medication_order_review_requests%rowtype;r care_private.medication_order_revisions%rowtype;
 write_row care_private.medication_order_review_writes%rowtype;prior care_private.medication_order_review_writes%rowtype;a care_private.medication_order_review_authorizations%rowtype;m public.medications%rowtype;
 creator public.profiles%rowtype;own_role uuid;creator_role uuid;creator_session auth.sessions%rowtype;originals jsonb;now_at timestamptz;until_at timestamptz;authorization_id_value uuid;result jsonb;item jsonb;authorization_json jsonb;needed text;
begin
 perform care_private.require_workspace_session(tenant,actor);sid:=(auth.jwt()->>'session_id')::uuid;
 perform care_private.med_packet_require(care_private.med_packet_keys(p_packet,case when p_packet->>'action'='request' then array['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','action','revisionId','reason'] else array['schemaVersion','requestId','tenantId','clientId','medicationId','actorId','action','reviewRequestId','reviewReference'] end)
 and p_packet->'schemaVersion'='1'::jsonb and p_packet->>'tenantId'=tenant::text and p_packet->>'actorId'=actor::text and care_private.med_packet_uuid(p_packet->'requestId') and care_private.med_packet_uuid(p_packet->'clientId') and care_private.med_packet_uuid(p_packet->'medicationId'),'Eigener technischer Prüfauftrag ist unvollständig.');
 operation:=p_packet->>'action';req:=(p_packet->>'requestId')::uuid;
 perform care_private.med_packet_require(operation in('request','authorize','reject','revoke'),'Technische Prüfaktion unbekannt.');
 perform pg_advisory_xact_lock(hashtextextended('medication-order-review:'||tenant||':'||req,0));
 perform pg_advisory_xact_lock(hashtextextended('medication-order-native:'||tenant||':'||(p_packet->>'medicationId'),0));
 perform care_private.lock_medication_source_scope(tenant,(p_packet->>'clientId')::uuid,(p_packet->>'medicationId')::uuid,actor);
 select * into write_row from care_private.medication_order_review_writes where tenant_id=tenant and request_id=req for share;
 if write_row.id is not null then
  perform care_private.med_packet_require(write_row.packet is not distinct from p_packet and write_row.actor_id=actor,'Prüfanfrage wurde anderweitig verwendet.');return write_row.original;
 end if;
 now_at:=clock_timestamp();
 if operation='request' then
  perform care_private.med_packet_require(care_private.med_packet_uuid(p_packet->'revisionId') and care_private.med_packet_text(p_packet->'reason',10,2000),'Eigener Entwurf und Prüfbegründung fehlen.');
  select * into r from care_private.medication_order_revisions where id=(p_packet->>'revisionId')::uuid and tenant_id=tenant and client_id=(p_packet->>'clientId')::uuid and medication_id=(p_packet->>'medicationId')::uuid and recorded_by=actor for share;
  if r.id is null then raise exception 'Eigener Übertragungsentwurf fehlt.' using errcode='42501';end if;
  select * into m from public.medications where id=r.medication_id and tenant_id=tenant for share;
  originals:=care_private.medication_order_archived_source(tenant,r.client_id,r.medication_id,r.source_id);
  perform care_private.med_packet_require(not exists(select 1 from care_private.medication_order_applications e where e.revision_id=r.id) and to_jsonb(m) is not distinct from r.before_snapshot and originals->'source' is not distinct from r.source_snapshot and originals->'archive' is not distinct from r.archive_snapshot,'Entwurf oder Originale wurden fortgeschrieben.');
  select * into creator_session from auth.sessions where id=sid and user_id=auth.uid() and (not_after is null or not_after>now_at) for share;
  if creator_session.id is null then raise exception 'Eigene aktuelle Sitzung fehlt.' using errcode='42501';end if;
  until_at:=least(now_at+interval '30 minutes',creator_session.not_after);
  insert into care_private.medication_order_review_requests(tenant_id,client_id,medication_id,revision_id,creator_id,creator_session_id,request_id,created_at,expires_at,reason,proposal_snapshot,packet)
  values(tenant,r.client_id,r.medication_id,r.id,actor,sid,req,now_at,until_at,btrim(p_packet->>'reason'),to_jsonb(r),p_packet) returning * into rr;
 else
  perform care_private.med_packet_require(care_private.med_packet_uuid(p_packet->'reviewRequestId') and care_private.med_packet_text(p_packet->'reviewReference',10,2000),'Unveränderte Prüfanfrage und Prüfbezug fehlen.');
  select * into rr from care_private.medication_order_review_requests where id=(p_packet->>'reviewRequestId')::uuid and tenant_id=tenant and client_id=(p_packet->>'clientId')::uuid and medication_id=(p_packet->>'medicationId')::uuid for share;
  if rr.id is null then raise exception 'Prüfanfrage nicht zugänglich.' using errcode='42501';end if;
  select p.role_id into own_role from public.profiles p where p.id=actor and p.tenant_id=tenant and p.is_active and p.status='active' for share;
  if operation<>'revoke' or actor<>rr.creator_id then
   perform 1 from public.role_permissions rp where rp.role_id=own_role for share;
   if not exists(select 1 from public.role_permissions rp where rp.role_id=own_role and rp.permission_key='pflege.documentation.sign') then raise exception 'Eigenes technisches Prüfungsrecht fehlt.' using errcode='42501';end if;
  end if;
  select * into prior from care_private.medication_order_review_writes where review_request_id=rr.id and action in('authorize','reject') for share;
  if operation='revoke' then
   select * into a from care_private.medication_order_review_authorizations where id=prior.authorization_id and tenant_id=tenant for update;
   if a.id is null or a.revoked_at is not null or (actor<>rr.creator_id and actor<>a.reviewed_by) or exists(select 1 from care_private.medication_order_applications e where e.authorization_id=a.id) then raise exception 'Eigene ungenutzte Übertragungsberechtigung nicht widerrufbar.' using errcode='42501';end if;
   update care_private.medication_order_review_authorizations set revoked_at=now_at where id=a.id;authorization_id_value:=a.id;
  else
   if prior.id is not null then raise exception 'Prüfanfrage wurde bereits entschieden.' using errcode='23514';end if;
   select * into creator from public.profiles p where p.id=rr.creator_id and p.tenant_id=tenant and p.is_active and p.status='active' for share;
   if creator.id is null or creator.id=actor or coalesce(creator.auth_user_id,creator.id)=auth.uid() then raise exception 'Prüfende Person muss ein anderes aktives Benutzerkonto verwenden.' using errcode='42501';end if;
   if rr.expires_at<=now_at then raise exception 'Prüfanfrage ist abgelaufen.' using errcode='42501';end if;
   select * into creator_session from auth.sessions where id=rr.creator_session_id and user_id=coalesce(creator.auth_user_id,creator.id) and (not_after is null or not_after>now_at) for share;
   if creator_session.id is null then raise exception 'Ursprüngliche Erfassungssitzung wurde beendet.' using errcode='42501';end if;
   select * into r from care_private.medication_order_revisions where id=rr.revision_id and tenant_id=tenant for share;
   select * into m from public.medications where id=rr.medication_id and tenant_id=tenant for share;
   originals:=care_private.medication_order_archived_source(tenant,rr.client_id,rr.medication_id,r.source_id);
   perform care_private.med_packet_require(to_jsonb(r) is not distinct from rr.proposal_snapshot and to_jsonb(m) is not distinct from r.before_snapshot and originals->'source' is not distinct from r.source_snapshot and originals->'archive' is not distinct from r.archive_snapshot and not exists(select 1 from care_private.medication_order_applications e where e.revision_id=r.id),'Geprüfte Originale wurden geändert oder bereits übertragen.');
   if operation='authorize' then
    -- Creator must still own every required source permission, even in the reviewer's transaction.
    creator_role:=creator.role_id;perform 1 from public.role_permissions rp where rp.role_id=creator_role for share;
    foreach needed in array array['pflege.medications.manage','pflege.medications.view','office.documents.view','office.clients.view_sensitive'] loop
     if not exists(select 1 from public.role_permissions rp where rp.role_id=creator_role and (rp.permission_key=needed or (rp.permission_key=split_part(needed,'.',2) and ((needed like '%.view' and coalesce(rp.can_view,false)) or (needed like '%.manage' and coalesce(rp.can_update,false)))))) then raise exception 'Aktuelles Quellenrecht der erfassenden Person fehlt.' using errcode='42501';end if;
    end loop;
    until_at:=least(rr.expires_at,now_at+interval '15 minutes',creator_session.not_after);
    insert into care_private.medication_order_review_authorizations(tenant_id,revision_id,actor_id,session_id,reviewed_by,review_reference,proposal_fingerprint,native_before_fingerprint,source_fingerprint,archive_fingerprint,issued_at,expires_at)
    values(tenant,r.id,rr.creator_id,rr.creator_session_id,actor,btrim(p_packet->>'reviewReference'),care_private.medication_json_fingerprint(to_jsonb(r)),care_private.medication_json_fingerprint(to_jsonb(m)),care_private.medication_json_fingerprint(originals->'source'),care_private.medication_json_fingerprint(originals->'archive'),now_at,until_at) returning id into authorization_id_value;
   end if;
  end if;
 end if;
 item:=care_private.medication_order_review_item(rr.id);
 if operation in('authorize','reject') then
  item:=jsonb_set(item,'{decision}',jsonb_build_object('action',operation,'actorId',actor,'recordedAt',now_at,'reviewReference',btrim(p_packet->>'reviewReference')));
 end if;
 if operation='authorize' then
  select jsonb_build_object('id',auth_row.id,'tenantId',auth_row.tenant_id,'revisionId',auth_row.revision_id,'actorId',auth_row.actor_id,'reviewedBy',auth_row.reviewed_by,'reviewReference',auth_row.review_reference,'issuedAt',auth_row.issued_at,'expiresAt',auth_row.expires_at,'revokedAt',auth_row.revoked_at,
   'proposalFingerprint',auth_row.proposal_fingerprint,'nativeBeforeFingerprint',auth_row.native_before_fingerprint,'sourceFingerprint',auth_row.source_fingerprint,'archiveFingerprint',auth_row.archive_fingerprint)
  into authorization_json from care_private.medication_order_review_authorizations auth_row where auth_row.id=authorization_id_value;
  item:=jsonb_set(item,'{authorization}',authorization_json);
 elsif operation='revoke' then
  item:=jsonb_set(item,'{revocation}',jsonb_build_object('action',operation,'actorId',actor,'recordedAt',now_at,'reviewReference',btrim(p_packet->>'reviewReference')));
 end if;
 result:=jsonb_build_object('requestId',req,'action',operation,'actorId',actor,'recordedAt',now_at,'item',item);
 insert into care_private.medication_order_review_writes(tenant_id,client_id,medication_id,request_id,review_request_id,actor_id,actor_session_id,action,authorization_id,recorded_at,review_reference,packet,original)
 values(tenant,rr.client_id,rr.medication_id,req,rr.id,actor,sid,operation,authorization_id_value,now_at,btrim(coalesce(p_packet->>'reviewReference',p_packet->>'reason')),p_packet,result);
 return result;
end$$;
create function public.commit_ambulatory_medication_order_review(packet jsonb)
returns jsonb language sql security invoker set search_path='' as $$select care_private.commit_medication_order_review(packet)$$;
revoke all on function care_private.commit_medication_order_review(jsonb),public.commit_ambulatory_medication_order_review(jsonb) from public,anon,authenticated,service_role;

create function care_private.confirm_medication_order_review(p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();w care_private.medication_order_review_writes%rowtype;begin
 perform care_private.require_workspace_session(tenant,actor);
 select * into w from care_private.medication_order_review_writes where tenant_id=tenant and request_id=p_request and actor_id=actor for share;
 if w.id is null then raise exception 'Eigener unveränderter Prüfbeleg fehlt.' using errcode='42501';end if;
 perform care_private.lock_medication_source_scope(tenant,w.client_id,w.medication_id,actor);
 return w.original;
end$$;
create function public.confirm_ambulatory_medication_order_review(request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select care_private.confirm_medication_order_review(request_id)$$;
revoke all on function care_private.confirm_medication_order_review(uuid),public.confirm_ambulatory_medication_order_review(uuid) from public,anon,authenticated,service_role;

create function care_private.read_medication_order_review_context(p_medication uuid,p_cursor_at timestamptz,p_cursor_id uuid,p_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare tenant uuid:=public.current_tenant_id();actor uuid:=public.resolve_current_profile_id();m public.medications%rowtype;rr care_private.medication_order_review_requests%rowtype;items jsonb:='[]';last_at timestamptz;last_id uuid;position integer:=0;more boolean:=false;state_fingerprint text;begin
 perform care_private.require_workspace_session(tenant,actor);
 perform care_private.med_packet_require(p_size between 1 and 100 and (p_cursor_at is null)=(p_cursor_id is null) and (p_cursor_at is null or isfinite(p_cursor_at)),'Ungültige technische Prüfverlaufsseite.');
 select * into m from public.medications where id=p_medication and tenant_id=tenant;
 if m.id is null then raise exception 'Eigene Verordnung fehlt.' using errcode='42501';end if;
 perform care_private.lock_medication_source_scope(tenant,m.client_id,m.id,actor);
 -- Re-read after the source-scope row lock; the earlier lookup only resolved scope.
 select * into m from public.medications where id=p_medication and tenant_id=tenant for share;
 if p_cursor_id is not null and not exists(select 1 from care_private.medication_order_review_requests r where r.id=p_cursor_id and r.tenant_id=tenant and r.medication_id=m.id and r.created_at=p_cursor_at) then raise exception 'Prüfverlaufscursor gehört nicht zur Akte.' using errcode='23514';end if;
 select care_private.medication_json_fingerprint(jsonb_build_object(
  'requests',coalesce((select jsonb_agg(jsonb_build_array(r.id,r.created_at,r.expires_at) order by r.id) from care_private.medication_order_review_requests r where r.tenant_id=tenant and r.medication_id=m.id),'[]'::jsonb),
  'writes',coalesce((select jsonb_agg(jsonb_build_array(w.id,w.recorded_at,w.action,w.authorization_id) order by w.id) from care_private.medication_order_review_writes w where w.tenant_id=tenant and w.medication_id=m.id),'[]'::jsonb),
  'authorizations',coalesce((select jsonb_agg(jsonb_build_array(a.id,a.revoked_at) order by a.id) from care_private.medication_order_review_authorizations a join care_private.medication_order_review_writes w on w.authorization_id=a.id and w.action='authorize' where w.tenant_id=tenant and w.medication_id=m.id),'[]'::jsonb))) into state_fingerprint;
 for rr in select * from care_private.medication_order_review_requests r where r.tenant_id=tenant and r.medication_id=m.id and (p_cursor_at is null or (r.created_at,r.id)<(p_cursor_at,p_cursor_id)) order by r.created_at desc,r.id desc limit p_size+1 loop
  position:=position+1;if position>p_size then more:=true;exit;end if;
  items:=items||jsonb_build_array(care_private.medication_order_review_item(rr.id));last_at:=rr.created_at;last_id:=rr.id;
 end loop;
 return jsonb_build_object('order',to_jsonb(m),'stateFingerprint',state_fingerprint,'items',items,'nextCursor',case when more then jsonb_build_object('at',last_at,'id',last_id) else null end);
end$$;
create function public.read_ambulatory_medication_order_review_context(medication_id uuid,cursor_at timestamptz default null,cursor_id uuid default null,page_size integer default 50)
returns jsonb language sql security invoker set search_path='' as $$select care_private.read_medication_order_review_context(medication_id,cursor_at,cursor_id,page_size)$$;
revoke all on function care_private.read_medication_order_review_context(uuid,timestamptz,uuid,integer),public.read_ambulatory_medication_order_review_context(uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
