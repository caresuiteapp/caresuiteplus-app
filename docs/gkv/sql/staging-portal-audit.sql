-- Restores the signing audit sink on the designated staging database only.
-- Physical schema from the PostgreSQL 17 reference catalog, 2026-11-04.
-- The original read policies also depend on Academy. Until the full policy
-- stack is available, application roles have NO direct rights (even TRUNCATE).
-- The portal writes through its authenticated SECURITY DEFINER transaction.
CREATE TYPE public.audit_action_type AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'download', 'upload', 'signature', 'status_change', 'permission_change', 'system');
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action public.audit_action_type NOT NULL DEFAULT 'system',
  table_name text,
  record_id uuid,
  product_key public.product_key,
  title text,
  description text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name,record_id);
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id,created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM PUBLIC,anon,authenticated,service_role;
DO $acl$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE c.oid='public.audit_logs'::regclass AND a.grantee<>c.relowner) THEN
    RAISE EXCEPTION 'Unexpected non-owner grant on audit_logs';
  END IF;
END
$acl$;
