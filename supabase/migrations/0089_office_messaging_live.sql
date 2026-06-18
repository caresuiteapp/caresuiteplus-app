-- ==========================================================================
-- CareSuite+ — Migration 0089: Office Messaging (message_threads, messages)
-- Office-only messenger: Klient:innen↔Office, Mitarbeitende↔Office, Intern
-- Keine direkte Klient:innen↔Mitarbeitende-Kommunikation.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Enums (idempotent — may already exist from remote schema)
-- --------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.message_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.message_status AS ENUM ('draft', 'sent', 'read', 'archived', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.message_thread_status AS ENUM ('open', 'waiting', 'resolved', 'archived', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.message_thread_type AS ENUM ('internal', 'employee', 'client', 'support', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- message_categories — Kategorien für Klient:innen- und Mitarbeitenden-Chats
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  audience    TEXT        NOT NULL CHECK (audience IN ('client', 'employee', 'internal', 'all')),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, key)
);

DROP TRIGGER IF EXISTS set_message_categories_updated_at ON public.message_categories;
CREATE TRIGGER set_message_categories_updated_at
  BEFORE UPDATE ON public.message_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- message_threads — Office-Chat-Threads (nur Office-Modul)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_threads (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_type             public.message_thread_type NOT NULL DEFAULT 'internal',
  status                  public.message_thread_status NOT NULL DEFAULT 'open',
  priority                public.message_priority NOT NULL DEFAULT 'normal',
  subject                 TEXT        NOT NULL,
  category_id             UUID        REFERENCES public.message_categories(id) ON DELETE SET NULL,
  client_id               UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  employee_id             UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  assignment_id           UUID,
  service_record_id       UUID,
  created_by_profile_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_client_id    UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by_employee_id  UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  last_message_at         TIMESTAMPTZ,
  last_message_preview    TEXT,
  archived_at             TIMESTAMPTZ,
  archived_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_threads_no_cross_participants CHECK (
    (thread_type = 'client' AND client_id IS NOT NULL AND employee_id IS NULL)
    OR (thread_type = 'employee' AND employee_id IS NOT NULL AND client_id IS NULL)
    OR (thread_type = 'internal' AND client_id IS NULL AND employee_id IS NULL)
    OR (thread_type IN ('support', 'system'))
  )
);

ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.message_categories(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_message_threads_updated_at ON public.message_threads;
CREATE TRIGGER set_message_threads_updated_at
  BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- messages — Chat-Nachrichten pro Thread
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id           UUID        NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  body                TEXT        NOT NULL,
  is_internal_note    BOOLEAN     NOT NULL DEFAULT FALSE,
  is_system_message   BOOLEAN     NOT NULL DEFAULT FALSE,
  sender_profile_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_client_id    UUID        REFERENCES public.clients(id) ON DELETE SET NULL,
  sender_employee_id  UUID        REFERENCES public.employees(id) ON DELETE SET NULL,
  sent_at             TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  status              public.message_status NOT NULL DEFAULT 'sent',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT messages_single_sender CHECK (
    num_nonnulls(sender_profile_id, sender_client_id, sender_employee_id) <= 1
    OR is_system_message = TRUE
  )
);

DROP TRIGGER IF EXISTS set_messages_updated_at ON public.messages;
CREATE TRIGGER set_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- message_attachments (stub for Phase 2)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  message_id      UUID        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  document_id     UUID,
  file_name       TEXT,
  file_path       TEXT,
  file_url        TEXT,
  file_size_bytes BIGINT,
  mime_type       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_message_threads_tenant
  ON public.message_threads (tenant_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_message_threads_type
  ON public.message_threads (tenant_id, thread_type, status);
CREATE INDEX IF NOT EXISTS idx_messages_thread
  ON public.messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_categories_tenant
  ON public.message_categories (tenant_id, audience, sort_order);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.message_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- message_categories: tenant-scoped read for authenticated business users
DROP POLICY IF EXISTS message_categories_select ON public.message_categories;
CREATE POLICY message_categories_select ON public.message_categories
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS message_categories_write ON public.message_categories;
CREATE POLICY message_categories_write ON public.message_categories
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- message_threads: Office business users see all office thread types
DROP POLICY IF EXISTS message_threads_office_select ON public.message_threads;
CREATE POLICY message_threads_office_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type IN ('client', 'employee', 'internal')
  );

DROP POLICY IF EXISTS message_threads_office_write ON public.message_threads;
CREATE POLICY message_threads_office_write ON public.message_threads
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type IN ('client', 'employee', 'internal')
  );

-- Portal client: only own client threads, not internal
DROP POLICY IF EXISTS message_threads_portal_client_select ON public.message_threads;
CREATE POLICY message_threads_portal_client_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'
    AND client_id IS NOT NULL
  );

-- Portal employee: only own employee threads, not internal
DROP POLICY IF EXISTS message_threads_portal_employee_select ON public.message_threads;
CREATE POLICY message_threads_portal_employee_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'employee'
    AND employee_id IS NOT NULL
  );

-- messages: office users see all tenant messages
DROP POLICY IF EXISTS messages_office_select ON public.messages;
CREATE POLICY messages_office_select ON public.messages
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS messages_office_write ON public.messages;
CREATE POLICY messages_office_write ON public.messages
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Portal: hide internal notes
DROP POLICY IF EXISTS messages_portal_select ON public.messages;
CREATE POLICY messages_portal_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_internal_note = FALSE
    AND is_system_message = FALSE
  );

-- message_attachments: tenant-scoped (stub)
DROP POLICY IF EXISTS message_attachments_tenant ON public.message_attachments;
CREATE POLICY message_attachments_tenant ON public.message_attachments
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.message_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.message_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.message_attachments TO authenticated;

-- --------------------------------------------------------------------------
-- Seed message_categories (system defaults — applied per tenant on first use)
-- Demo seed for known demo tenant if present
-- --------------------------------------------------------------------------
INSERT INTO public.message_categories (tenant_id, key, label, audience, sort_order)
SELECT t.id, v.key, v.label, v.audience, v.sort_order
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('general', 'Allgemein', 'client', 1),
    ('appointment', 'Termine', 'client', 2),
    ('billing', 'Abrechnung', 'client', 3),
    ('schedule', 'Einsatzplanung', 'employee', 1),
    ('hr', 'Personal & HR', 'employee', 2),
    ('dispatch', 'Disposition', 'internal', 1),
    ('billing_internal', 'Abrechnung intern', 'internal', 2)
) AS v(key, label, audience, sort_order)
ON CONFLICT (tenant_id, key) DO NOTHING;

COMMENT ON TABLE public.message_threads IS 'Office-Messenger-Threads — nur Office-Modul, keine Klient↔Mitarbeiter-Direktkommunikation';
COMMENT ON TABLE public.messages IS 'Office-Messenger-Nachrichten — is_internal_note nie im Portal sichtbar';
COMMENT ON TABLE public.message_categories IS 'Kategorien für Office-Nachrichten nach Zielgruppe';
