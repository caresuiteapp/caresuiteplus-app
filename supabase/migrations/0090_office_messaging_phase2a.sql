-- ==========================================================================
-- CareSuite+ — Migration 0090: Office Messaging Phase 2A
-- Participants, status audit, assignment, unread counts, extended statuses
-- ==========================================================================

-- Extended thread statuses (compatible with 0089 values open/waiting/resolved/archived/deleted)
DO $$ BEGIN
  ALTER TYPE public.message_thread_status ADD VALUE IF NOT EXISTS 'new';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.message_thread_status ADD VALUE IF NOT EXISTS 'received';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.message_thread_status ADD VALUE IF NOT EXISTS 'in_progress';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.message_thread_status ADD VALUE IF NOT EXISTS 'waiting_for_reply';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.message_thread_status ADD VALUE IF NOT EXISTS 'internal_review';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.message_thread_status ADD VALUE IF NOT EXISTS 'closed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- message_threads — assignment, close metadata, unread counter
-- --------------------------------------------------------------------------
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS office_unread_count INTEGER NOT NULL DEFAULT 0;

-- --------------------------------------------------------------------------
-- message_thread_participants — internal office chats
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_thread_participants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id   UUID        NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  profile_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thread_id, profile_id)
);

DROP TRIGGER IF EXISTS set_message_thread_participants_updated_at ON public.message_thread_participants;
CREATE TRIGGER set_message_thread_participants_updated_at
  BEFORE UPDATE ON public.message_thread_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- message_status_events — audit trail for thread status changes
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_status_events (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id               UUID        NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  old_status              public.message_thread_status,
  new_status              public.message_thread_status NOT NULL,
  changed_by_profile_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  note                    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_message_threads_assigned
  ON public.message_threads (tenant_id, assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_thread_participants_thread
  ON public.message_thread_participants (thread_id, is_active);

CREATE INDEX IF NOT EXISTS idx_message_status_events_thread
  ON public.message_status_events (thread_id, created_at DESC);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
ALTER TABLE public.message_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_status_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_thread_participants_tenant ON public.message_thread_participants;
CREATE POLICY message_thread_participants_tenant ON public.message_thread_participants
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS message_status_events_tenant ON public.message_status_events;
CREATE POLICY message_status_events_tenant ON public.message_status_events
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.message_thread_participants TO authenticated;
GRANT SELECT, INSERT ON public.message_status_events TO authenticated;

COMMENT ON TABLE public.message_thread_participants IS 'Teilnehmer interner Office-Chats (Büro-Benutzer:innen)';
COMMENT ON TABLE public.message_status_events IS 'Audit-Trail für Thread-Statusänderungen im Office-Messenger';
