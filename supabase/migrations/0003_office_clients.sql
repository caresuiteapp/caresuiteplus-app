-- ==========================================================================
-- CareSuite+ — Migration 0003: Office Klient:innen (Arbeitspaket 010)
-- Voraussetzung: 0001 + 0002
-- Entspricht src/types/modules/office.ts + src/types/detail/
-- ==========================================================================

-- Workflow-Status wie in src/types/core/base.ts
-- entwurf | aktiv | in_bearbeitung | abgeschlossen | archiviert | fehlerhaft | gesperrt

CREATE TABLE IF NOT EXISTS public.clients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name            TEXT        NOT NULL,
  last_name             TEXT        NOT NULL,
  date_of_birth         DATE,
  care_level            TEXT,
  status                TEXT        NOT NULL DEFAULT 'entwurf'
                        CHECK (status IN (
                          'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                          'archiviert','fehlerhaft','gesperrt'
                        )),
  street                TEXT,
  city                  TEXT,
  zip                   TEXT,
  phone                 TEXT,
  email                 TEXT,
  notes                 TEXT,
  primary_contact_phone TEXT,
  sensitivity           TEXT        NOT NULL DEFAULT 'care'
                        CHECK (sensitivity IN ('public','internal','care','health','restricted')),
  visibility            TEXT        NOT NULL DEFAULT 'team'
                        CHECK (visibility IN ('own','shared','team','tenant_admin')),
  owned_by_profile_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  shared_with_profile_ids UUID[]    NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id       UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  relationship    TEXT        NOT NULL,
  phone           TEXT,
  email           TEXT,
  is_emergency    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_consents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  scope       TEXT        NOT NULL CHECK (scope IN ('own','shared','team','tenant_admin')),
  granted     BOOLEAN     NOT NULL DEFAULT FALSE,
  granted_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_audit_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  actor_name  TEXT        NOT NULL,
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_history_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  icon        TEXT        NOT NULL DEFAULT '📋',
  title       TEXT        NOT NULL,
  subtitle    TEXT,
  status      TEXT        NOT NULL
              CHECK (status IN (
                'entwurf','aktiv','in_bearbeitung','abgeschlossen',
                'archiviert','fehlerhaft','gesperrt'
              )),
  actor_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at Trigger
DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_audit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_history_entries ENABLE ROW LEVEL SECURITY;

-- Lesen: Mandant + Berechtigung office.clients.view
DROP POLICY IF EXISTS "clients_select_tenant" ON public.clients;
CREATE POLICY "clients_select_tenant"
  ON public.clients FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.view')
  );

-- Anlegen
DROP POLICY IF EXISTS "clients_insert_tenant" ON public.clients;
CREATE POLICY "clients_insert_tenant"
  ON public.clients FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.create')
  );

-- Bearbeiten
DROP POLICY IF EXISTS "clients_update_tenant" ON public.clients;
CREATE POLICY "clients_update_tenant"
  ON public.clients FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.edit')
  );

-- Kind-Tabellen: gleicher Mandant + view-Berechtigung
CREATE POLICY "client_contacts_select"
  ON public.client_contacts FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('office.clients.view'));

CREATE POLICY "client_contacts_write"
  ON public.client_contacts FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('office.clients.edit'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('office.clients.edit'));

CREATE POLICY "client_consents_select"
  ON public.client_consents FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('office.clients.view'));

CREATE POLICY "client_consents_write"
  ON public.client_consents FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('office.clients.manage_consents'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.has_permission('office.clients.manage_consents'));

CREATE POLICY "client_audit_select"
  ON public.client_audit_entries FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('office.clients.view'));

CREATE POLICY "client_audit_insert"
  ON public.client_audit_entries FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "client_history_select"
  ON public.client_history_entries FOR SELECT
  USING (tenant_id = public.current_tenant_id() AND public.has_permission('office.clients.view'));

CREATE POLICY "client_history_insert"
  ON public.client_history_entries FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- RPC: Statuswechsel mit Berechtigungsprüfung
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_client_status(
  p_client_id UUID,
  p_new_status TEXT
)
RETURNS public.clients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.clients;
  v_old_status TEXT;
BEGIN
  IF NOT public.has_permission('office.clients.status_change') THEN
    RAISE EXCEPTION 'Keine Berechtigung für Statusänderungen';
  END IF;

  IF p_new_status NOT IN (
    'entwurf','aktiv','in_bearbeitung','abgeschlossen','archiviert','fehlerhaft','gesperrt'
  ) THEN
    RAISE EXCEPTION 'Ungültiger Status: %', p_new_status;
  END IF;

  SELECT * INTO v_client
  FROM public.clients
  WHERE id = p_client_id AND tenant_id = public.current_tenant_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Klient:in nicht gefunden';
  END IF;

  v_old_status := v_client.status;

  UPDATE public.clients
  SET status = p_new_status, updated_at = NOW()
  WHERE id = p_client_id
  RETURNING * INTO v_client;

  INSERT INTO public.client_history_entries (
    tenant_id, client_id, icon, title, subtitle, status, actor_name
  ) VALUES (
    v_client.tenant_id,
    v_client.id,
    '🔄',
    'Status geändert',
    'Neuer Status: ' || p_new_status,
    p_new_status,
    COALESCE((SELECT display_name FROM public.profiles WHERE id = auth.uid()), 'System')
  );

  INSERT INTO public.client_audit_entries (
    tenant_id, client_id, action, actor_name, details
  ) VALUES (
    v_client.tenant_id,
    v_client.id,
    'Status geändert',
    COALESCE((SELECT display_name FROM public.profiles WHERE id = auth.uid()), 'System'),
    'Von ' || v_old_status || ' nach ' || p_new_status
  );

  RETURN v_client;
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_client_status(UUID, TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- RPC: Klient:innen-Liste (tenant_id-Filter serverseitig)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_clients_for_tenant()
RETURNS SETOF public.clients
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.*
  FROM public.clients c
  WHERE c.tenant_id = public.current_tenant_id()
    AND public.has_permission('office.clients.view')
  ORDER BY c.last_name ASC, c.first_name ASC
$$;

GRANT EXECUTE ON FUNCTION public.list_clients_for_tenant() TO authenticated;

-- --------------------------------------------------------------------------
-- Indizes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(tenant_id, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_clients_sensitivity ON public.clients(tenant_id, sensitivity);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON public.client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_consents_client ON public.client_consents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_audit_client ON public.client_audit_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_client_history_client ON public.client_history_entries(client_id);

-- GRANTs
GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_consents TO authenticated;
GRANT SELECT, INSERT ON public.client_audit_entries TO authenticated;
GRANT SELECT, INSERT ON public.client_history_entries TO authenticated;
