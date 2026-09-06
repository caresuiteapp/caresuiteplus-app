-- Run only after portal-push-dispatch, portal-push-register and office-push-send
-- have been deployed to euagyyztvmemuaiumvxm. Never prints or returns the token.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
DO $$
DECLARE worker_secret text; secret_id uuid;
BEGIN
 SELECT id INTO secret_id FROM vault.secrets WHERE name='caresuite_portal_push_dispatch';
 IF secret_id IS NULL THEN
  worker_secret:=encode(extensions.gen_random_bytes(32),'hex');
  PERFORM vault.create_secret(worker_secret,'caresuite_portal_push_dispatch','CareSuite push worker only');
 ELSE
  SELECT decrypted_secret INTO worker_secret FROM vault.decrypted_secrets WHERE id=secret_id;
 END IF;
 IF worker_secret !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid worker secret'; END IF;
 UPDATE public.portal_push_runtime SET worker_token_hash=encode(extensions.digest(worker_secret,'sha256'),'hex'),enabled=true,updated_at=now() WHERE singleton;
END $$;
CREATE OR REPLACE FUNCTION public.portal_push_tick() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE worker_secret text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM portal_push_runtime WHERE enabled) THEN RETURN; END IF;
 SELECT decrypted_secret INTO worker_secret FROM vault.decrypted_secrets WHERE name='caresuite_portal_push_dispatch';
 IF worker_secret IS NULL THEN RAISE EXCEPTION 'Push worker secret missing'; END IF;
 PERFORM net.http_post(
  url:='https://euagyyztvmemuaiumvxm.supabase.co/functions/v1/portal-push-dispatch',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_secret),
  body:='{}'::jsonb,timeout_milliseconds:=90000
 );
 DELETE FROM portal_push_outbox WHERE id IN (SELECT id FROM portal_push_outbox WHERE state IN ('delivered','failed','cancelled') AND created_at<now()-interval '30 days' ORDER BY created_at LIMIT 2000);
END $$;
REVOKE ALL ON FUNCTION public.portal_push_tick() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_push_tick() TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='caresuite-portal-push-minute') THEN PERFORM cron.unschedule('caresuite-portal-push-minute'); END IF;
 PERFORM cron.schedule('caresuite-portal-push-minute','* * * * *','SELECT public.portal_push_tick();');
END $$;
COMMIT;
SELECT enabled AS automatischer_push_aktiv,
       (worker_token_hash IS NOT NULL) AS dienst_geschuetzt,
       EXISTS(SELECT 1 FROM cron.job WHERE jobname='caresuite-portal-push-minute' AND active) AS zeitplan_aktiv
FROM public.portal_push_runtime;
