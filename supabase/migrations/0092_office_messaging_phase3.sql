-- ==========================================================================
-- CareSuite+ — Migration 0092: Office Messaging Phase 3
-- Portal RLS hardening, unread counters, quick-reply templates, Realtime
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Portal unread counter
-- --------------------------------------------------------------------------
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS portal_unread_count INTEGER NOT NULL DEFAULT 0;

-- --------------------------------------------------------------------------
-- Portal auth linkage (for RLS helpers when Supabase Auth is used)
-- --------------------------------------------------------------------------
ALTER TABLE public.client_portal_access
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.employee_portal_accounts
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_portal_access_auth_user
  ON public.client_portal_access (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employee_portal_accounts_auth_user
  ON public.employee_portal_accounts (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- RLS helpers: resolve portal actor from auth.uid()
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cpa.client_id
  FROM public.client_portal_access cpa
  WHERE cpa.auth_user_id = auth.uid()
    AND cpa.tenant_id = public.current_tenant_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT epa.employee_id
  FROM public.employee_portal_accounts epa
  WHERE epa.auth_user_id = auth.uid()
    AND epa.tenant_id = public.current_tenant_id()
  LIMIT 1
$$;

-- Fallback: employee linked via profiles → employees.profile_id
CREATE OR REPLACE FUNCTION public.current_employee_id_from_profile()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  INNER JOIN public.profiles pr ON pr.id = e.profile_id
  WHERE (pr.id = auth.uid() OR pr.auth_user_id = auth.uid())
    AND e.tenant_id = public.current_tenant_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.resolve_current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_employee_id(), public.current_employee_id_from_profile())
$$;

-- --------------------------------------------------------------------------
-- Stricter Portal RLS — own threads only
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS message_threads_portal_client_select ON public.message_threads;
CREATE POLICY message_threads_portal_client_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'
    AND client_id IS NOT NULL
    AND client_id = public.current_client_id()
  );

DROP POLICY IF EXISTS message_threads_portal_employee_select ON public.message_threads;
CREATE POLICY message_threads_portal_employee_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'employee'
    AND employee_id IS NOT NULL
    AND employee_id = public.resolve_current_employee_id()
  );

DROP POLICY IF EXISTS message_threads_portal_client_insert ON public.message_threads;
CREATE POLICY message_threads_portal_client_insert ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'
    AND client_id IS NOT NULL
    AND client_id = public.current_client_id()
    AND employee_id IS NULL
  );

DROP POLICY IF EXISTS message_threads_portal_employee_insert ON public.message_threads;
CREATE POLICY message_threads_portal_employee_insert ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'employee'
    AND employee_id IS NOT NULL
    AND employee_id = public.resolve_current_employee_id()
    AND client_id IS NULL
  );

DROP POLICY IF EXISTS messages_portal_insert ON public.messages;
CREATE POLICY messages_portal_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND is_internal_note = FALSE
    AND (
      (
        sender_client_id IS NOT NULL
        AND sender_client_id = public.current_client_id()
      )
      OR (
        sender_employee_id IS NOT NULL
        AND sender_employee_id = public.resolve_current_employee_id()
      )
    )
  );

DROP POLICY IF EXISTS messages_portal_select ON public.messages;
CREATE POLICY messages_portal_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_internal_note = FALSE
    AND is_system_message = FALSE
    AND EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = messages.thread_id
        AND mt.tenant_id = messages.tenant_id
        AND (
          (mt.thread_type = 'client' AND mt.client_id = public.current_client_id())
          OR (mt.thread_type = 'employee' AND mt.employee_id = public.resolve_current_employee_id())
        )
    )
  );

-- message_attachments: portal read via own thread messages
DROP POLICY IF EXISTS message_attachments_portal_select ON public.message_attachments;
CREATE POLICY message_attachments_portal_select ON public.message_attachments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      INNER JOIN public.message_threads mt ON mt.id = m.thread_id
      WHERE m.id = message_attachments.message_id
        AND m.tenant_id = message_attachments.tenant_id
        AND m.is_internal_note = FALSE
        AND (
          (mt.thread_type = 'client' AND mt.client_id = public.current_client_id())
          OR (mt.thread_type = 'employee' AND mt.employee_id = public.resolve_current_employee_id())
        )
    )
  );

DROP POLICY IF EXISTS message_attachments_portal_insert ON public.message_attachments;
CREATE POLICY message_attachments_portal_insert ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      INNER JOIN public.message_threads mt ON mt.id = m.thread_id
      WHERE m.id = message_attachments.message_id
        AND m.tenant_id = message_attachments.tenant_id
        AND (
          (mt.thread_type = 'client' AND mt.client_id = public.current_client_id())
          OR (mt.thread_type = 'employee' AND mt.employee_id = public.resolve_current_employee_id())
        )
    )
  );

-- --------------------------------------------------------------------------
-- Quick-reply templates (Office admin)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_quick_reply_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, key)
);

DROP TRIGGER IF EXISTS set_message_quick_reply_templates_updated_at ON public.message_quick_reply_templates;
CREATE TRIGGER set_message_quick_reply_templates_updated_at
  BEFORE UPDATE ON public.message_quick_reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.message_quick_reply_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_quick_reply_templates_select ON public.message_quick_reply_templates;
CREATE POLICY message_quick_reply_templates_select ON public.message_quick_reply_templates
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS message_quick_reply_templates_write ON public.message_quick_reply_templates;
CREATE POLICY message_quick_reply_templates_write ON public.message_quick_reply_templates
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.access')
  );

GRANT SELECT, INSERT, UPDATE ON public.message_quick_reply_templates TO authenticated;

INSERT INTO public.message_quick_reply_templates (tenant_id, key, label, body, sort_order)
SELECT t.id, v.key, v.label, v.body, v.sort_order
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('received', 'Eingegangen', 'Vielen Dank für Ihre Nachricht. Wir haben diese erhalten und melden uns zeitnah.', 1),
    ('in_progress', 'In Bearbeitung', 'Ihr Anliegen wird derzeit bearbeitet. Wir informieren Sie, sobald es Neuigkeiten gibt.', 2),
    ('waiting_info', 'Rückfrage', 'Für die weitere Bearbeitung benötigen wir noch eine kurze Rückmeldung von Ihnen.', 3),
    ('resolved', 'Erledigt', 'Ihr Anliegen wurde bearbeitet. Bei weiteren Fragen starten Sie gerne einen neuen Chat.', 4),
    ('appointment', 'Termin', 'Wir prüfen die Terminmöglichkeiten und melden uns mit einem Vorschlag.', 5)
) AS v(key, label, body, sort_order)
ON CONFLICT (tenant_id, key) DO NOTHING;

-- --------------------------------------------------------------------------
-- Supabase Realtime publication
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

COMMENT ON TABLE public.message_quick_reply_templates IS 'Office-Messenger Schnellantwort-Vorlagen (Deutsch)';
COMMENT ON COLUMN public.message_threads.portal_unread_count IS 'Ungelesene Nachrichten für Portal-Nutzer:innen';
