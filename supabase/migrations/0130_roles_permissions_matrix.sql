-- Prompt 68: Rollen- & Rechtematrix (prepared — nicht remote pushen)
-- Erweitert bestehende roles/role_permissions um mandantenspezifische Matrix

CREATE TABLE IF NOT EXISTS public.tenant_custom_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_key        TEXT NOT NULL,
  label           TEXT NOT NULL,
  copied_from_key TEXT,
  is_system_role  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, role_key)
);

CREATE TABLE IF NOT EXISTS public.tenant_role_area_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_key        TEXT NOT NULL,
  area_key        TEXT NOT NULL,
  can_view        BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit        BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve     BOOLEAN NOT NULL DEFAULT FALSE,
  can_export      BOOLEAN NOT NULL DEFAULT FALSE,
  can_administer  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, role_key, area_key)
);

CREATE TABLE IF NOT EXISTS public.permission_audit_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_user_id       UUID,
  actor_role_key      TEXT,
  target_role_key     TEXT NOT NULL,
  action              TEXT NOT NULL,
  area_key            TEXT,
  permission_action   TEXT,
  previous_value      BOOLEAN,
  new_value           BOOLEAN,
  summary             TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_role_area_permissions_tenant
  ON public.tenant_role_area_permissions (tenant_id, role_key);

CREATE INDEX IF NOT EXISTS idx_permission_audit_events_tenant_created
  ON public.permission_audit_events (tenant_id, created_at DESC);

ALTER TABLE public.tenant_custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_role_area_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_events ENABLE ROW LEVEL SECURITY;
