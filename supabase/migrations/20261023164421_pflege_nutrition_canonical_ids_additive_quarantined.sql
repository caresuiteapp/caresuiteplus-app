-- ADDITIVE quarantine followup. Plain CREATE fails on collisions; no existing trigger/function is dropped or replaced.
-- Preflight must establish these three helpers and three trigger names absent.
-- Applies only to new inserts in the already closed Nutrition receipt family.
-- An exception rolls back the complete enclosing capture/care/review RPC statement.
-- Existing historical packets and their read/confirmation paths are not rewritten.
create function care_private.nutrition_canonical_uuid(v jsonb)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(v)='string' and length(v#>>'{}')=36 and(v#>>'{}')~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',false)
$$;

create function care_private.nutrition_require_canonical_packet_ids(p jsonb,family text)
returns void language plpgsql immutable set search_path='' as $$
declare k text;path text[];v jsonb;o jsonb;begin
 if family not in('capture','care','review') or family is null then raise exception 'Unbekannte ursprüngliche Paketfamilie.' using errcode='23514';end if;
 foreach k in array array['requestId','tenantId','clientId','actorId'] loop
  if care_private.nutrition_canonical_uuid(p->k) is not true then raise exception 'Neue Paketkennung ist nicht kanonisch: %',k using errcode='23514';end if;
 end loop;
 if family='capture' then
  foreach k in array array['planVersionId','measureId','visitId','assessmentId'] loop
   if care_private.nutrition_canonical_uuid(p->k) is not true then raise exception 'Neue native Bindungskennung ist nicht kanonisch: %',k using errcode='23514';end if;
  end loop;
 elsif family='care' then
  foreach k in array array['planVersionId','measureId','visitId','assessmentId'] loop
   if care_private.nutrition_canonical_uuid(p#>array['entry',k]) is not true then raise exception 'Neue Eintragskennung ist nicht kanonisch: %',k using errcode='23514';end if;
  end loop;
  foreach path slice 1 in array array[
   array['entry','elimination','profileId'],array['entry','weight','measurementId'],
   array['entry','device','deviceId'],array['entry','device','changeBasisId'],
   array['entry','enteral','deviceId'],array['entry','enteral','prescriptionId'],
   array['entry','followUp','responsibleProfileId'],array['entry','followUp','taskId']
  ] loop
   v:=p#>path;
   if v is not null and v<>'null'::jsonb and care_private.nutrition_canonical_uuid(v) is not true then raise exception 'Neue Personen-/Quellkennung ist nicht kanonisch.' using errcode='23514';end if;
  end loop;
  for v in select value from jsonb_array_elements(coalesce(p#>'{entry,assistance,helpers}','[]'::jsonb)) union all select value from jsonb_array_elements(coalesce(p#>'{entry,execution,performedBy}','[]'::jsonb)) loop
   if care_private.nutrition_canonical_uuid(v) is not true then raise exception 'Neue beteiligte Person ist nicht kanonisch gebunden.' using errcode='23514';end if;
  end loop;
 end if;
 if family in('care','review') then
  v:=p->'expectedHeadId';if v is not null and v<>'null'::jsonb and care_private.nutrition_canonical_uuid(v) is not true then raise exception 'Neuer Vergleichskopf ist nicht kanonisch.' using errcode='23514';end if;
  for o in select p->'original' where family='care' union all select p->'careOriginal' where family='review' union all select p->'reviewOriginal' where family='review' loop
   if o is not null and o<>'null'::jsonb then
    foreach k in array array['id','tenantId','clientId','rootId','headId'] loop
     if care_private.nutrition_canonical_uuid(o->k) is not true then raise exception 'Ursprüngliche Kopfkennung ist nicht kanonisch: %',k using errcode='23514';end if;
    end loop;
    if o?'recordedBy' and care_private.nutrition_canonical_uuid(o->'recordedBy') is not true then raise exception 'Ursprüngliche Person ist nicht kanonisch.' using errcode='23514';end if;
   end if;
  end loop;
 end if;
end$$;

create function care_private.nutrition_guard_canonical_wire_ids()
returns trigger language plpgsql security invoker set search_path='' as $$declare family text;begin
 family:=case when TG_TABLE_SCHEMA='care_private' and TG_TABLE_NAME='nutrition_binding_captures' then 'capture' when TG_TABLE_SCHEMA='public' and TG_TABLE_NAME='nutrition_elimination_receipts' then 'care' when TG_TABLE_SCHEMA='public' and TG_TABLE_NAME='nutrition_review_receipts' then 'review' else null end;
 perform care_private.nutrition_require_canonical_packet_ids(NEW.packet,family);
 if NEW.packet->>'requestId' is distinct from NEW.request_id::text or NEW.packet->>'tenantId' is distinct from NEW.tenant_id::text or NEW.packet->>'clientId' is distinct from NEW.client_id::text or NEW.packet->>'actorId' is distinct from NEW.actor_id::text then raise exception 'Paket und ursprüngliche Quittungskennungen unterscheiden sich.' using errcode='23514';end if;
 return NEW;
end$$;
create trigger nutrition_capture_canonical_ids before insert on care_private.nutrition_binding_captures for each row execute function care_private.nutrition_guard_canonical_wire_ids();
create trigger nutrition_care_canonical_ids before insert on public.nutrition_elimination_receipts for each row execute function care_private.nutrition_guard_canonical_wire_ids();
create trigger nutrition_review_canonical_ids before insert on public.nutrition_review_receipts for each row execute function care_private.nutrition_guard_canonical_wire_ids();
revoke all on function care_private.nutrition_canonical_uuid(jsonb),care_private.nutrition_require_canonical_packet_ids(jsonb,text),care_private.nutrition_guard_canonical_wire_ids() from PUBLIC,anon,authenticated,service_role;
