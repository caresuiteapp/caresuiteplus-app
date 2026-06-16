-- Prompt 69: Interne Aufgaben, Tickets & Teamkommunikation (prepared — nicht remote pushen)

CREATE TABLE IF NOT EXISTS public.internal_tasks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_type               TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'open',
  priority                TEXT NOT NULL DEFAULT 'normal',
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL DEFAULT '',
  assigned_to_user_id     UUID,
  assigned_to_employee_id UUID,
  created_by_user_id      UUID,
  due_at                  TIMESTAMPTZ,
  resolved_at             TIMESTAMPTZ,
  archived_at             TIMESTAMPTZ,
  escalated_at            TIMESTAMPTZ,
  linked_entity_type      TEXT NOT NULL DEFAULT 'none',
  linked_entity_id        UUID,
  source                  TEXT NOT NULL DEFAULT 'manual',
  is_internal_only        BOOLEAN NOT NULL DEFAULT TRUE,
  employee_visible        BOOLEAN NOT NULL DEFAULT FALSE,
  management_task_id      TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id           UUID NOT NULL REFERENCES public.internal_tasks(id) ON DELETE CASCADE,
  author_user_id    UUID,
  author_role_key   TEXT,
  body              TEXT NOT NULL,
  visibility        TEXT NOT NULL DEFAULT 'internal',
  is_internal_only  BOOLEAN NOT NULL DEFAULT TRUE,
  employee_visible  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_attachments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id             UUID NOT NULL REFERENCES public.internal_tasks(id) ON DELETE CASCADE,
  file_name           TEXT NOT NULL,
  mime_type           TEXT NOT NULL DEFAULT 'application/octet-stream',
  sensitivity_level   TEXT NOT NULL DEFAULT 'internal',
  uploaded_by_user_id UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_communication_threads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_key         TEXT NOT NULL,
  title               TEXT NOT NULL,
  linked_task_id      UUID REFERENCES public.internal_tasks(id) ON DELETE SET NULL,
  is_archived         BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id  UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_thread_comments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id           UUID NOT NULL REFERENCES public.team_communication_threads(id) ON DELETE CASCADE,
  author_user_id      UUID,
  author_display_name TEXT NOT NULL DEFAULT '',
  body                TEXT NOT NULL,
  mentions            TEXT[] NOT NULL DEFAULT '{}',
  is_internal_only    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_thread_read_status (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id     UUID NOT NULL REFERENCES public.team_communication_threads(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_internal_tasks_tenant_status
  ON public.internal_tasks (tenant_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_internal_tasks_tenant_type
  ON public.internal_tasks (tenant_id, task_type);

CREATE INDEX IF NOT EXISTS idx_team_threads_tenant_channel
  ON public.team_communication_threads (tenant_id, channel_key, is_archived);

ALTER TABLE public.internal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_thread_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_thread_read_status ENABLE ROW LEVEL SECURITY;
