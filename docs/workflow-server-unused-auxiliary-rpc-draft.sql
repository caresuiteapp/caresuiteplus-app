-- REVIEW DRAFT ONLY. Do not apply automatically or to production.
-- Source: read-only pg_get_functiondef/effective EXECUTE metadata 2026-10-11.
-- Exactly these thirteen captured APIs have no current src/app/Edge callers
-- outside generated types/tests and lack an actor/tenant/object write boundary.
-- Release gate: verify historical external and dynamic consumers in staging.
-- Move legitimate legacy integrations to the trusted service-role boundary;
-- restoring browser/API EXECUTE requires a separate actor/tenant authorization
-- review. Function bodies, signatures, defaults and existing records are intact.
-- The companion tests use explicitly ACL-shaped synthetic stub bodies. They
-- prove permission changes and service compatibility, not new body exploits.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.add_ai_message(uuid,public.ai_message_role,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_ai_message(uuid,public.ai_message_role,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_final_readiness(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_final_readiness(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_follow_up(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_follow_up(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.add_support_ticket_message(uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_support_ticket_message(uuid,text,boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.calculate_assessment_score(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_assessment_score(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_measure(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_measure(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.copy_system_template_to_tenant(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_system_template_to_tenant(uuid,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_ai_conversation(uuid,text,public.product_key,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_ai_conversation(uuid,text,public.product_key,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_app_event(uuid,text,text,text,public.app_event_level,public.product_key,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_app_event(uuid,text,text,text,public.app_event_level,public.product_key,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_error(uuid,text,text,public.product_key,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_error(uuid,text,text,public.product_key,text,text,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_course_progress(uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_course_progress(uuid,numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_health_check(uuid,text,public.health_check_status,numeric,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_health_check(uuid,text,public.health_check_status,numeric,text,jsonb) TO service_role;

COMMIT;
