-- Add Gmail SMTP while preserving queues, leases and existing provider behavior.
BEGIN;
ALTER TABLE public.registration_welcome_outbox DROP CONSTRAINT registration_welcome_outbox_provider_check;
ALTER TABLE public.registration_welcome_outbox ADD CONSTRAINT registration_welcome_outbox_provider_check CHECK (provider IN ('resend','sendgrid','gmail'));
CREATE OR REPLACE FUNCTION public.registration_welcome_claim(p_tenant_id uuid DEFAULT NULL,p_limit integer DEFAULT 10,p_provider text DEFAULT 'resend')
RETURNS SETOF public.registration_welcome_outbox
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('resend','sendgrid','gmail') THEN
    RAISE EXCEPTION 'invalid_mail_provider' USING ERRCODE='22023';
  END IF;
  -- SendGrid and Gmail SMTP have no idempotency key. An expired in-flight attempt may already
  -- have been accepted; preserve it for operator review instead of sending twice.
  UPDATE public.registration_welcome_outbox SET state='failed',lease_token=NULL,lease_until=NULL,
    last_error_code='mail_delivery_needs_review',updated_at=now()
  WHERE state='sending' AND provider IN ('sendgrid','gmail') AND lease_until<=now()
    AND (p_tenant_id IS NULL OR tenant_id=p_tenant_id);
  -- Resend idempotency expires after 24 h. Never retry an ambiguous delivery later.
  UPDATE public.registration_welcome_outbox SET state='failed',lease_token=NULL,lease_until=NULL,
    last_error_code='mail_retry_window_expired',updated_at=now()
  WHERE state IN ('pending','sending') AND (p_tenant_id IS NULL OR tenant_id=p_tenant_id)
    AND (lease_until IS NULL OR lease_until <= now())
    AND (attempts >= 8 OR first_attempt_at <= now()-interval '23 hours');
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.registration_welcome_outbox
    WHERE (p_tenant_id IS NULL OR tenant_id=p_tenant_id)
      AND attempts < 8
      AND (provider IS NULL OR provider=p_provider)
      AND (first_attempt_at IS NULL OR first_attempt_at > now()-interval '23 hours')
      AND ((state='pending' AND next_attempt_at<=now()) OR (state='sending' AND lease_until<=now()))
    ORDER BY created_at,id LIMIT greatest(1,least(coalesce(p_limit,10),10))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.registration_welcome_outbox q SET state='sending',provider=p_provider,attempts=q.attempts+1,
    first_attempt_at=coalesce(q.first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
  FROM due WHERE q.id=due.id RETURNING q.*;
END;
$$;
REVOKE ALL ON FUNCTION public.registration_welcome_claim(uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registration_welcome_claim(uuid,integer,text) TO service_role;

COMMIT;
