-- Portal profile: allow portal actors to read own insurance, care contexts, and support prefs.

DROP POLICY IF EXISTS client_insurance_profiles_portal_self_select ON public.client_insurance_profiles;
CREATE POLICY client_insurance_profiles_portal_self_select ON public.client_insurance_profiles
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS client_care_contexts_portal_self_select ON public.client_care_contexts;
CREATE POLICY client_care_contexts_portal_self_select ON public.client_care_contexts
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

DROP POLICY IF EXISTS client_support_preferences_portal_self_select ON public.client_support_preferences;
CREATE POLICY client_support_preferences_portal_self_select ON public.client_support_preferences
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

COMMENT ON POLICY client_insurance_profiles_portal_self_select ON public.client_insurance_profiles IS
  'Portal users read primary insurance profile for self-service profile view.';
COMMENT ON POLICY client_care_contexts_portal_self_select ON public.client_care_contexts IS
  'Portal users read care context keys for profile Betreuungsmodell display.';
COMMENT ON POLICY client_support_preferences_portal_self_select ON public.client_support_preferences IS
  'Portal users read communication preference for profile contact section.';
