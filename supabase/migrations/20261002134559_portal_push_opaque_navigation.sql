-- Expo receives only a random outbox ID. Destination metadata stays inside
-- authenticated CareSuite/Supabase requests and is resolved for the active account.
BEGIN;
CREATE FUNCTION public.portal_push_resolve_destination(p_notification_id uuid,p_expected_account_id uuid)
RETURNS TABLE(route text,account_id uuid,tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT
   CASE
     WHEN q.event_kind IN ('visit','visit_reminder','visit_overdue') THEN '/portal/'||d.portal_type||'/'||
       CASE WHEN d.portal_type='client' THEN 'appointments/'||q.source_id ELSE 'assignments/'||q.source_id||'/execute' END
     WHEN q.event_kind='message' THEN '/portal/'||d.portal_type||'/messages/'||
       (SELECT m.thread_id::text FROM public.messages m WHERE m.id=q.source_id AND m.tenant_id=q.tenant_id)
     WHEN q.event_kind IN ('proof','proof_signature') THEN '/portal/'||d.portal_type||'/documents/'||q.source_id
     WHEN q.event_kind='proof_signed' THEN '/portal/employee/assignments/'||
       (SELECT p.visit_id::text FROM public.assist_visit_proofs p WHERE p.id=q.source_id AND p.tenant_id=q.tenant_id)||'/execute'
     WHEN q.event_kind='document' THEN '/portal/'||d.portal_type||'/documents/signatures/'||q.source_id
     WHEN q.event_kind='notice' THEN '/portal/'||d.portal_type||'/announcements'
     WHEN q.event_kind='update' THEN '/portal/'||d.portal_type||'/profile?pushUpdate='||
       (SELECT r.version_code::text FROM public.portal_app_releases r WHERE r.id=q.source_id)
   END,
   q.account_id,q.tenant_id
 FROM public.portal_push_outbox q
 JOIN public.portal_push_devices d ON d.id=q.device_id AND d.portal_account_id=q.account_id
   AND d.auth_user_id=q.auth_user_id AND d.tenant_id=q.tenant_id
 WHERE auth.uid() IS NOT NULL AND q.id=p_notification_id AND q.account_id=p_expected_account_id AND q.auth_user_id=auth.uid()
   -- app_metadata is server-owned; never authorize from editable user_metadata.
   AND lower(auth.jwt()->'app_metadata'->>'portal_account_id')=p_expected_account_id::text
   AND lower(auth.jwt()->'app_metadata'->>'tenant_id')=q.tenant_id::text
   AND auth.jwt()->'app_metadata'->>'portal_type'=d.portal_type AND d.portal_type IN ('employee','client')
   AND q.state IN ('processing','accepted','delivered') AND q.expires_at>now()
   AND public.portal_push_event_visible(d,q.event_kind,q.source_id)
$$;
REVOKE ALL ON FUNCTION public.portal_push_resolve_destination(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.portal_push_resolve_destination(uuid,uuid) TO authenticated;
COMMIT;
