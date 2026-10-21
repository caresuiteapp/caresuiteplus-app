create or replace function care_private.medication_client_is_active(p_tenant uuid,p_client uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform care_private.require_workspace_session(p_tenant,public.resolve_current_profile_id());
 return exists(select 1 from public.clients c join public.client_module_assignments a
 on a.tenant_id=c.tenant_id and a.client_id=c.id and a.module_key='pflege'
 where c.tenant_id=p_tenant and c.id=p_client and c.status::text in('active','aktiv')
 and c.lifecycle_status::text in('active','aktiv') and a.is_active and a.status in('active','aktiv'));
end $$;
create or replace function care_private.medication_packet_actor(permission_name text,p_tenant uuid,p_client uuid,p_medication uuid,p_actor uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare claims jsonb;session_id uuid;actor uuid;
begin
 perform care_private.require_workspace_session(p_tenant,p_actor);
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 if claims->>'session_id' is null or claims->>'session_id' !~* '^[0-9a-f-]{36}$' then raise exception 'Sitzungsbindung fehlt.' using errcode='42501';end if;
 session_id:=(claims->>'session_id')::uuid;actor:=public.resolve_current_profile_id();
 if auth.uid() is null or p_tenant is distinct from public.current_tenant_id() or actor is distinct from p_actor
 or not exists(select 1 from auth.sessions s where s.id=session_id and s.user_id=auth.uid() and coalesce(s.not_after,clock_timestamp()+interval '1 second')>clock_timestamp())
 or not exists(select 1 from public.profiles p where p.id=actor and p.tenant_id=p_tenant and p.is_active)
 or public.has_permission('pflege.medications.view') is not true or public.has_permission(permission_name) is not true
 or care_private.medication_client_is_active(p_tenant,p_client) is not true
 or not exists(select 1 from public.medications m where m.id=p_medication and m.tenant_id=p_tenant and m.client_id=p_client)
 then raise exception 'Aktueller Medikationsbezug oder Berechtigung fehlt.' using errcode='42501';end if;
 return actor;
end $$;
revoke all on function care_private.medication_client_is_active(uuid,uuid),care_private.medication_packet_actor(text,uuid,uuid,uuid,uuid) from public,anon,authenticated;