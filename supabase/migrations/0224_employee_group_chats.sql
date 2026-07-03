-- ==========================================================================
-- CareSuite+ — Migration 0224: Employee Group Chats (Gruppen-Chats Mitarbeitende)
-- Office can create group conversations with multiple employees.
-- Reuses message_threads + messages; adds employee_group type + participants.
-- Apply before live group chat usage. Office UI works without migration in preview.
-- ==========================================================================

-- New thread type for multi-employee group chats
DO $$ BEGIN
  ALTER TYPE public.message_thread_type ADD VALUE IF NOT EXISTS 'employee_group';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow employee_group threads without single employee_id
ALTER TABLE public.message_threads
  DROP CONSTRAINT IF EXISTS message_threads_no_cross_participants;

ALTER TABLE public.message_threads
  ADD CONSTRAINT message_threads_no_cross_participants CHECK (
    (thread_type = 'client' AND client_id IS NOT NULL AND employee_id IS NULL)
    OR (thread_type = 'employee' AND employee_id IS NOT NULL AND client_id IS NULL)
    OR (thread_type = 'employee_group' AND client_id IS NULL AND employee_id IS NULL)
    OR (thread_type = 'internal' AND client_id IS NULL AND employee_id IS NULL)
    OR (thread_type IN ('support', 'system'))
  );

-- --------------------------------------------------------------------------
-- message_thread_employee_participants — group chat members (Mitarbeitende)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_thread_employee_participants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id   UUID        NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  employee_id UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thread_id, employee_id)
);

DROP TRIGGER IF EXISTS set_message_thread_employee_participants_updated_at
  ON public.message_thread_employee_participants;
CREATE TRIGGER set_message_thread_employee_participants_updated_at
  BEFORE UPDATE ON public.message_thread_employee_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_message_thread_employee_participants_thread
  ON public.message_thread_employee_participants (thread_id, is_active);

CREATE INDEX IF NOT EXISTS idx_message_thread_employee_participants_employee
  ON public.message_thread_employee_participants (tenant_id, employee_id, is_active);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.message_thread_employee_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_thread_employee_participants_tenant
  ON public.message_thread_employee_participants;
CREATE POLICY message_thread_employee_participants_tenant
  ON public.message_thread_employee_participants
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Office: include employee_group in thread policies
DROP POLICY IF EXISTS message_threads_office_select ON public.message_threads;
CREATE POLICY message_threads_office_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type IN ('client', 'employee', 'employee_group', 'internal')
  );

DROP POLICY IF EXISTS message_threads_office_write ON public.message_threads;
CREATE POLICY message_threads_office_write ON public.message_threads
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type IN ('client', 'employee', 'employee_group', 'internal')
  );

-- Portal employee: 1:1 employee threads OR group membership
DROP POLICY IF EXISTS message_threads_portal_employee_select ON public.message_threads;
CREATE POLICY message_threads_portal_employee_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (
      (
        thread_type = 'employee'
        AND employee_id IS NOT NULL
        AND employee_id = public.resolve_current_employee_id()
      )
      OR (
        thread_type = 'employee_group'
        AND EXISTS (
          SELECT 1
          FROM public.message_thread_employee_participants p
          WHERE p.thread_id = message_threads.id
            AND p.tenant_id = message_threads.tenant_id
            AND p.is_active = TRUE
            AND p.employee_id = public.resolve_current_employee_id()
        )
      )
    )
  );

-- Portal messages: include employee_group threads
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
          OR (
            mt.thread_type = 'employee_group'
            AND EXISTS (
              SELECT 1
              FROM public.message_thread_employee_participants p
              WHERE p.thread_id = mt.id
                AND p.tenant_id = mt.tenant_id
                AND p.is_active = TRUE
                AND p.employee_id = public.resolve_current_employee_id()
            )
          )
        )
    )
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
        AND EXISTS (
          SELECT 1
          FROM public.message_threads mt
          WHERE mt.id = messages.thread_id
            AND mt.tenant_id = messages.tenant_id
            AND (
              (mt.thread_type = 'employee' AND mt.employee_id = sender_employee_id)
              OR (
                mt.thread_type = 'employee_group'
                AND EXISTS (
                  SELECT 1
                  FROM public.message_thread_employee_participants p
                  WHERE p.thread_id = mt.id
                    AND p.tenant_id = mt.tenant_id
                    AND p.is_active = TRUE
                    AND p.employee_id = sender_employee_id
                )
              )
            )
        )
      )
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.message_thread_employee_participants TO authenticated;

COMMENT ON TABLE public.message_thread_employee_participants IS
  'Teilnehmer Gruppen-Chats mit Mitarbeitenden (Office ↔ mehrere Mitarbeitende)';
