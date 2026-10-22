-- Quarantined followup after ambulatory_vital_workspace_quarantined.sql.
-- Bind all path and review pages to one complete native/source/path/review ledger.
begin;
create or replace function care_private.vital_workspace_state_fingerprint(t uuid,c uuid,m uuid,a uuid)
returns text language plpgsql security definer set search_path='' as $$
declare context_value jsonb;reviews jsonb;
begin
 context_value:=care_private.read_vital_care_path_context(t,c,m,a);
 select coalesce(jsonb_agg(care_private.vital_care_review_original(r.id) order by r.created_at,r.id),'[]'::jsonb) into reviews from public.vital_care_review_roots r where r.tenant_id=t and r.client_id=c and r.measurement_id=m;
 return 'sha256:'||encode(extensions.digest(convert_to(jsonb_build_object('context',context_value,'reviews',reviews)::text,'UTF8'),'sha256'),'hex');
end$$;
revoke all on function care_private.vital_workspace_state_fingerprint(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
create or replace function care_private.read_vital_care_path_page(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid,p_cursor_recorded_at timestamptz,p_cursor_id uuid,p_page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;last_at timestamptz;last_id uuid;state_before text;state_after text;
begin
 perform care_private.lock_vital_measurement_scope(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,false);if p_page_size is null or (p_cursor_recorded_at is null)<>(p_cursor_id is null) or p_page_size not between 1 and 100 or care_private.vital_client_active(p_client_id) is not true then raise exception 'Ungültige Verlaufsauswahl.' using errcode='42501';end if;
 state_before:=care_private.vital_workspace_state_fingerprint(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id);
 if p_cursor_recorded_at is not null and not exists(select 1 from public.vital_care_paths h where h.tenant_id=p_tenant_id and h.client_id=p_client_id and h.measurement_id=p_measurement_id and h.id=p_cursor_id and h.recorded_at=p_cursor_recorded_at and not exists(select 1 from public.vital_care_paths newer where newer.root_id=h.root_id and newer.revision>h.revision)) then raise exception 'Vitalpfadcursor gehört nicht mehr zu einem aktuellen Originalkopf.' using errcode='40001';end if;
 with heads as(select distinct on(root_id) * from public.vital_care_paths where tenant_id=p_tenant_id and client_id=p_client_id and measurement_id=p_measurement_id order by root_id,revision desc),page as(select * from heads where p_cursor_recorded_at is null or (recorded_at,id)<(p_cursor_recorded_at,p_cursor_id) order by recorded_at desc,id desc limit p_page_size)
 select coalesce(jsonb_agg(care_private.vital_path_original(id) order by recorded_at desc,id desc),'[]'::jsonb),(array_agg(recorded_at order by recorded_at desc,id desc))[count(*)],(array_agg(id order by recorded_at desc,id desc))[count(*)] into rows,last_at,last_id from page;
 state_after:=care_private.vital_workspace_state_fingerprint(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id);if state_before is distinct from state_after then raise exception 'Vollständiger Vitalbestand wurde während der Projektion geändert.' using errcode='40001';end if;
 return jsonb_build_object('rows',rows,'nextCursorRecordedAt',case when last_at is null then null else to_char(last_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,'nextCursorId',last_id,'stateFingerprint',state_after);
end $$;

create or replace function care_private.read_vital_care_review_page(t uuid,c uuid,m uuid,actor uuid,at_cursor timestamptz,id_cursor uuid,page_size integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;state_before text;state_after text;begin
 perform care_private.lock_vital_measurement_scope(t,c,m,actor,false);
 if care_private.vital_client_active(c) is not true or page_size is null or page_size<1 or page_size>100 or(at_cursor is null)<>(id_cursor is null) then raise exception 'Ungueltige Cursor- oder Pflegefallbindung.' using errcode='22023';end if;
 state_before:=care_private.vital_workspace_state_fingerprint(t,c,m,actor);
 if at_cursor is not null and not exists(select 1 from public.vital_care_review_roots r where r.tenant_id=t and r.client_id=c and r.measurement_id=m and r.id=id_cursor and r.created_at=at_cursor) then raise exception 'Vitalfachprüfcursor ist fremd oder nicht bestätigt.' using errcode='40001';end if;
 with page as materialized(select r.* from public.vital_care_review_roots r where r.tenant_id=t and r.client_id=c and r.measurement_id=m and(at_cursor is null or(r.created_at,r.id)<(at_cursor,id_cursor)) order by r.created_at desc,r.id desc limit page_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(care_private.vital_care_review_original(p.id) order by p.created_at desc,p.id desc) from page p),'[]'::jsonb),
 'nextCursorRecordedAt',(select to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from page p order by p.created_at,p.id limit 1),
 'nextCursorId',(select p.id::text from page p order by p.created_at,p.id limit 1)) into result;state_after:=care_private.vital_workspace_state_fingerprint(t,c,m,actor);if state_before is distinct from state_after then raise exception 'Vollständiger Vitalprüfbestand wurde während der Projektion geändert.' using errcode='40001';end if;return result||jsonb_build_object('stateFingerprint',state_after);
end$$;

revoke all on function care_private.read_vital_care_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),care_private.read_vital_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_read_vital_care_path_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer),public.web_read_vital_care_review_page(uuid,uuid,uuid,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
commit;
