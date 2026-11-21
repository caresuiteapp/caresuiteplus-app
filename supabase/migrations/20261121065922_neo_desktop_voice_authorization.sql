BEGIN;
-- Desktop speech processes only the authenticated actor's supplied audio. This
-- capability returns no records and grants no person/assessment or write access.
CREATE OR REPLACE FUNCTION public.neo_desktop_voice_authorize(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(
   auth.uid() IS NOT NULL
   AND p_tenant_id IS NOT NULL
   AND p_tenant_id = public.current_tenant_id()
   AND coalesce(public.current_portal_type(),'business') = 'business'
   AND coalesce(public.has_permission('office.access'),false)
   -- The established company guard additionally validates the live active
   -- business profile, current permission denials and applicable data scopes.
   AND coalesce(care_security.company_actor(p_tenant_id,'office.access'),false),
 false)
$$;
REVOKE ALL ON FUNCTION public.neo_desktop_voice_authorize(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.neo_desktop_voice_authorize(uuid) TO authenticated;
COMMENT ON FUNCTION public.neo_desktop_voice_authorize(uuid) IS
 'Authorizes user-scoped desktop voice inference only; no case-data or write authority.';
COMMIT;
