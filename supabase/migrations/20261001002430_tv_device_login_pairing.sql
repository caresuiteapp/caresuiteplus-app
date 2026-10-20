-- Applied through Supabase apply_migration on production euagyyztvmemuaiumvxm.
-- Version 20261001002430 was assigned by Supabase; this file records that exact migration.
-- Function name: tv_device_login_pairing.
BEGIN;

CREATE TABLE IF NOT EXISTS public.tv_device_login_requests (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('administration', 'employee', 'client')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','consumed','denied','expired','cancelled','failed')),
  device_secret_hash text NOT NULL,
  user_code_hash text UNIQUE NOT NULL,
  verification_code text NOT NULL CHECK (verification_code ~ '^[0-9]{6}$'),
  actor jsonb,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '5 minutes'),
  CHECK (device_secret_hash ~ '^token-sha256:[a-f0-9]{64}$'),
  CHECK (user_code_hash ~ '^token-sha256:[a-f0-9]{64}$'),
  CHECK (actor IS NULL OR (jsonb_typeof(actor) = 'object' AND actor->>'role' = role
    AND actor ? 'authUserId' AND actor ? 'authSessionId' AND actor ? 'tenantId'))
);
CREATE INDEX IF NOT EXISTS tv_device_login_expiry_idx ON public.tv_device_login_requests(expires_at);
ALTER TABLE public.tv_device_login_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tv_device_login_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_device_login_requests TO service_role;

CREATE TABLE IF NOT EXISTS public.tv_device_login_limits (
  key text PRIMARY KEY, window_start timestamptz NOT NULL, count integer NOT NULL CHECK (count > 0)
);
CREATE INDEX IF NOT EXISTS tv_device_login_limits_window_idx ON public.tv_device_login_limits(window_start);
ALTER TABLE public.tv_device_login_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tv_device_login_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_device_login_limits TO service_role;

-- SECURITY INVOKER: callable only with the Edge Function's service-role privileges.
CREATE OR REPLACE FUNCTION public.tv_device_rate_limit(p_key text, p_maximum integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer; v_now timestamptz := clock_timestamp();
BEGIN
  IF p_key IS NULL OR length(p_key) > 160 OR p_maximum NOT BETWEEN 1 AND 2400 OR p_window_seconds <> 300 THEN
    RAISE EXCEPTION 'invalid rate limit';
  END IF;
  INSERT INTO public.tv_device_login_limits(key, window_start, count) VALUES (p_key, v_now, 1)
  ON CONFLICT(key) DO UPDATE SET
    count = CASE WHEN tv_device_login_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
      THEN 1 ELSE LEAST(tv_device_login_limits.count + 1, p_maximum + 1) END,
    window_start = CASE WHEN tv_device_login_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
      THEN v_now ELSE tv_device_login_limits.window_start END
  RETURNING count INTO v_count;
  -- Bounded retention, independent of a scheduler. Only this feature's ephemeral rows.
  DELETE FROM public.tv_device_login_limits WHERE window_start < v_now - interval '1 day';
  DELETE FROM public.tv_device_login_requests WHERE expires_at < v_now - interval '1 day';
  RETURN v_count <= p_maximum;
END $$;
REVOKE ALL ON FUNCTION public.tv_device_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tv_device_rate_limit(text,integer,integer) TO service_role;

-- Narrow service-only bridge: auth.sessions is intentionally not exposed to clients.
-- The caller cannot read any auth/session data; only the active-session predicate.
CREATE OR REPLACE FUNCTION public.tv_device_source_session_active(p_session_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id
    AND (s.not_after IS NULL OR s.not_after > now()))
$$;
REVOKE ALL ON FUNCTION public.tv_device_source_session_active(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tv_device_source_session_active(uuid,uuid) TO service_role;

COMMIT;
