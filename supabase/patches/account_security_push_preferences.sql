-- One existing recipient-visibility function gains a personal opt-out check.
-- No authorization helper, RLS policy, runtime switch or scheduler is changed.
-- Personal event preferences are checked at the existing sender visibility
-- boundary too, including queued deliveries. Existing source/recipient guards
-- and tenant switches remain authoritative; no dispatcher is enabled here.
DO $push$
DECLARE definition text;
BEGIN
 IF to_regprocedure('public.portal_push_event_visible(public.portal_push_devices,text,uuid)') IS NOT NULL THEN
  definition:=pg_get_functiondef('public.portal_push_event_visible(public.portal_push_devices,text,uuid)'::regprocedure);
  definition:=replace(definition,'FUNCTION public.portal_push_event_visible(', 'FUNCTION account_security.original_portal_push_event_visible(');
  EXECUTE definition;
  REVOKE ALL ON FUNCTION account_security.original_portal_push_event_visible(public.portal_push_devices,text,uuid) FROM PUBLIC,anon,authenticated;
  EXECUTE $definition$CREATE OR REPLACE FUNCTION public.portal_push_event_visible(d public.portal_push_devices,kind text,source uuid) RETURNS boolean
   LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,account_security AS $body$
   SELECT account_security.original_portal_push_event_visible(d,kind,source) AND coalesce((SELECT (p.events->>CASE
    WHEN kind='visit' THEN 'assignment' WHEN kind IN ('visit_reminder','visit_overdue') THEN 'reminder'
    WHEN kind='message' THEN 'message' WHEN kind IN ('proof_signature','document') THEN 'signature'
    WHEN kind IN ('proof','proof_signed') THEN 'proof' WHEN kind='notice' THEN 'announcement' WHEN kind='update' THEN 'update' ELSE 'unknown' END)::boolean
    FROM account_security.notification_preferences p WHERE p.auth_user_id=d.auth_user_id AND p.tenant_id=d.tenant_id),true)
   $body$ $definition$;
 END IF;
END $push$;

