-- Client portal: username + hashed access code on client_portal_access (replaces e-mail invitation)

ALTER TABLE public.client_portal_access
  ADD COLUMN IF NOT EXISTS portal_username TEXT,
  ADD COLUMN IF NOT EXISTS portal_access_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS code_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS code_rotated_at TIMESTAMPTZ;

ALTER TABLE public.client_portal_access
  ALTER COLUMN email DROP NOT NULL;

UPDATE public.client_portal_access
SET status = 'nicht_eingerichtet'
WHERE status = 'eingeladen';

ALTER TABLE public.client_portal_access
  DROP CONSTRAINT IF EXISTS client_portal_access_status_check;

ALTER TABLE public.client_portal_access
  ADD CONSTRAINT client_portal_access_status_check
  CHECK (status IN ('aktiv', 'nicht_eingerichtet', 'gesperrt', 'deaktiviert', 'eingeladen'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_access_tenant_username
  ON public.client_portal_access (tenant_id, lower(portal_username))
  WHERE portal_username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_portal_access_username_lookup
  ON public.client_portal_access (lower(portal_username))
  WHERE portal_enabled = TRUE AND portal_username IS NOT NULL;

COMMENT ON COLUMN public.client_portal_access.portal_username IS
  'Tenant-unique login name derived from client first/last name.';
COMMENT ON COLUMN public.client_portal_access.portal_access_code_hash IS
  'SHA-256 hash of 6-char portal code (never store plain code).';
COMMENT ON COLUMN public.client_portal_access.portal_enabled IS
  'TRUE when office staff completed portal setup and credentials were issued.';
COMMENT ON COLUMN public.client_portal_access.last_login_at IS
  'Last successful client portal login (portal_last_login_at).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_portal_access TO service_role;
