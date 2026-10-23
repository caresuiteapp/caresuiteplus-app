-- Narrow followup: keep the selected responsible-person payload while binding its full native row.
-- No public profile projection, grants, seeds or activation.
begin;
create or replace function care_private.read_vital_care_path_context(p_tenant_id uuid,p_client_id uuid,p_measurement_id uuid,p_actor_profile_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.vital_sign_measurements%rowtype;result jsonb;
begin
 perform care_private.lock_vital_measurement_scope(p_tenant_id,p_client_id,p_measurement_id,p_actor_profile_id,false);
 lock table public.client_vital_sign_settings,public.vital_measurement_devices,public.vital_device_calibrations,public.vital_measurement_follow_ups,public.vital_measurement_invalidations,public.vital_sign_events,public.vital_care_paths in share row exclusive mode;
 perform 1 from public.profiles p where p.tenant_id=p_tenant_id and p.is_active and p.status='active' for share;
 select * into m from public.vital_sign_measurements x where x.id=p_measurement_id and x.tenant_id=p_tenant_id and x.client_id=p_client_id;
 if m.id is null or care_private.vital_client_active(p_client_id) is not true then raise exception 'Messung oder aktiver Pflegefall fehlt.' using errcode='42501';end if;
 select jsonb_build_object(
 'measurements',jsonb_build_array(care_private.vital_ref(m.id,1,m.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(m))),
 'settings',coalesce((select jsonb_agg(care_private.vital_ref(s.id,s.revision,s.updated_at,p_tenant_id,p_client_id,m.id,to_jsonb(s)-'tenant_id'-'client_id') order by s.updated_at,s.id) from public.client_vital_sign_settings s where s.tenant_id=p_tenant_id and s.client_id=p_client_id and s.vital_key=m.vital_key),'[]'::jsonb),
 'devices',coalesce((select jsonb_agg(care_private.vital_ref(d.id,d.revision,d.updated_at,p_tenant_id,p_client_id,m.id,to_jsonb(d)-'tenant_id'-'client_id') order by d.updated_at,d.id) from public.vital_measurement_devices d where d.tenant_id=p_tenant_id and d.active and (d.client_id is null or d.client_id=p_client_id)),'[]'::jsonb),
 'calibrations',coalesce((select jsonb_agg(care_private.vital_ref(c.id,c.revision,c.updated_at,p_tenant_id,p_client_id,m.id,to_jsonb(c)-'tenant_id') order by c.updated_at,c.id) from public.vital_device_calibrations c join public.vital_measurement_devices d on d.id=c.device_id where c.tenant_id=p_tenant_id and d.tenant_id=p_tenant_id and (d.client_id is null or d.client_id=p_client_id)),'[]'::jsonb),
 'followUps',coalesce((select jsonb_agg(care_private.vital_ref(f.id,1,f.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(f)-'tenant_id'-'client_id'-'measurement_id') order by f.created_at,f.id) from public.vital_measurement_follow_ups f where f.tenant_id=p_tenant_id and f.client_id=p_client_id and f.measurement_id=m.id),'[]'::jsonb),
 'invalidations',coalesce((select jsonb_agg(care_private.vital_ref(i.id,1,i.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(i)-'tenant_id'-'client_id'-'measurement_id') order by i.created_at,i.id) from public.vital_measurement_invalidations i where i.tenant_id=p_tenant_id and i.client_id=p_client_id and i.measurement_id=m.id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(care_private.vital_ref(e.id,1,e.created_at,p_tenant_id,p_client_id,m.id,to_jsonb(e)-'tenant_id'-'client_id'-'measurement_id') order by e.created_at,e.id) from public.vital_sign_events e where e.tenant_id=p_tenant_id and e.client_id=p_client_id and e.measurement_id=m.id),'[]'::jsonb),
 'people',coalesce((select jsonb_agg((care_private.vital_ref(p.id,1,coalesce(p.updated_at,p.created_at),p_tenant_id,p_client_id,m.id,jsonb_build_object('display_name',coalesce(nullif(p.display_name,''),p.email),'active',p.is_active))||jsonb_build_object('fingerprint','sha256:'||encode(extensions.digest(convert_to(to_jsonb(p)::text,'UTF8'),'sha256'),'hex'))) order by p.id) from public.profiles p where p.tenant_id=p_tenant_id and p.is_active and p.status='active'),'[]'::jsonb),
 'paths',coalesce((select jsonb_agg(care_private.vital_ref(v.id,v.revision,v.recorded_at,p_tenant_id,p_client_id,m.id,jsonb_build_object('title',v.payload->>'title','kind',v.kind,'control_state',v.payload#>>'{control,state}'))||jsonb_build_object('fingerprint',v.content_fingerprint) order by v.recorded_at,v.id) from public.vital_care_paths v where v.tenant_id=p_tenant_id and v.client_id=p_client_id and v.measurement_id=m.id),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function care_private.read_vital_care_path_context(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
commit;
