-- REVIEW DRAFT ONLY. Do not apply automatically or to production.
-- Source: read-only pg_get_functiondef/effective EXECUTE metadata 2026-10-11.
-- No current src/app/Edge callers exist outside generated types.
-- Release gate: verify historical external consumers in staging before rollout.
-- Move any legitimate legacy integration to the trusted service-role boundary;
-- never grant browser/API execution back without explicit actor/tenant checks.
-- Existing messages, jobs, reports and function bodies are not changed.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.send_thread_message(uuid,text,uuid,uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_thread_message(uuid,text,uuid,uuid,uuid,boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_outbound_message(uuid,public.outbox_channel,text,text,text,text,text,jsonb,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_outbound_message(uuid,public.outbox_channel,text,text,text,text,text,jsonb,text,uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_pdf_generation_job(uuid,text,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_pdf_generation_job(uuid,text,text,text,uuid,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_care_report(uuid,uuid,uuid,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_care_report(uuid,uuid,uuid,text,text,text,boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_dunning_case_for_invoice(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_dunning_case_for_invoice(uuid,integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.seed_tenant_billing_handoff_defaults(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_tenant_billing_handoff_defaults(uuid) TO service_role;

COMMIT;
