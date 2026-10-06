-- Existing Supabase database services; no Docker or external scheduler required.
-- Installation alone sends no messages: configuration is a separate explicit step.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE SCHEMA IF NOT EXISTS registration_mail_private;
REVOKE ALL ON SCHEMA registration_mail_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA registration_mail_private TO service_role;
CREATE TABLE registration_mail_private.registration_welcome_scheduler (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  project_url text NOT NULL,
  token_secret_id uuid NOT NULL,
  token_hash text NOT NULL
);
ALTER TABLE registration_mail_private.registration_welcome_scheduler ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON registration_mail_private.registration_welcome_scheduler FROM PUBLIC, anon, authenticated;
GRANT SELECT ON registration_mail_private.registration_welcome_scheduler TO service_role;

CREATE OR REPLACE FUNCTION public.registration_welcome_worker_authorized(p_token_hash text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
  SELECT EXISTS(SELECT 1 FROM registration_mail_private.registration_welcome_scheduler WHERE token_hash=p_token_hash);
$$;
REVOKE ALL ON FUNCTION public.registration_welcome_worker_authorized(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registration_welcome_worker_authorized(text) TO service_role;

CREATE OR REPLACE FUNCTION registration_mail_private.dispatch_registration_welcome()
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,extensions,pg_temp
AS $$
DECLARE v_url text; v_token text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.registration_welcome_outbox
    WHERE (state='pending' AND next_attempt_at<=now()) OR (state='sending' AND lease_until<=now())) THEN
    RETURN NULL;
  END IF;
  SELECT s.project_url,v.decrypted_secret INTO v_url,v_token
    FROM registration_mail_private.registration_welcome_scheduler s JOIN vault.decrypted_secrets v ON v.id=s.token_secret_id;
  IF v_url IS NULL OR v_token IS NULL THEN RETURN NULL; END IF;
  RETURN net.http_post(
    url:=v_url||'/functions/v1/registration-welcome-dispatch',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_token),
    body:='{}'::jsonb,timeout_milliseconds:=10000);
END;
$$;
REVOKE ALL ON FUNCTION registration_mail_private.dispatch_registration_welcome() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION registration_mail_private.configure_registration_welcome_scheduler(p_project_url text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,extensions,pg_temp
AS $$
DECLARE v_token text; v_secret uuid; v_old uuid;
BEGIN
  IF p_project_url IS NULL OR p_project_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' THEN
    RAISE EXCEPTION 'invalid_registration_project_url' USING ERRCODE='22023';
  END IF;
  -- Rotation keeps both the plaintext secret and cron command out of public tables.
  v_token:=encode(gen_random_bytes(32),'hex');
  SELECT token_secret_id INTO v_old FROM registration_mail_private.registration_welcome_scheduler;
  IF v_old IS NOT NULL THEN DELETE FROM vault.secrets WHERE id=v_old; END IF;
  SELECT vault.create_secret(v_token,'registration_welcome_worker_token','Dedicated registration mail worker token') INTO v_secret;
  INSERT INTO registration_mail_private.registration_welcome_scheduler(singleton,project_url,token_secret_id,token_hash)
    VALUES(true,p_project_url,v_secret,encode(digest(v_token,'sha256'),'hex'))
  ON CONFLICT(singleton) DO UPDATE SET project_url=EXCLUDED.project_url,token_secret_id=EXCLUDED.token_secret_id,token_hash=EXCLUDED.token_hash;
  PERFORM cron.schedule('caresuite-registration-welcome','* * * * *','SELECT registration_mail_private.dispatch_registration_welcome();');
END;
$$;
REVOKE ALL ON FUNCTION registration_mail_private.configure_registration_welcome_scheduler(text) FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
