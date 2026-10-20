-- ==========================================================================
-- CareSuite+ — Migration 0113: VoiceCore AI foundation
-- ai_sessions, ai_messages, ai_pending_actions, ai_action_logs, document_chunks
-- tenant_memberships + is_tenant_member() for tenant-scoped AI access
-- ==========================================================================

-- pgcrypto: bereits in 0001_core_schema.sql
DO $voicecore_ext$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE EXTENSION vector WITH SCHEMA extensions;
  END IF;
EXCEPTION
  WHEN insufficient_privilege OR OTHERS THEN
    IF SQLSTATE = '42501' OR SQLERRM LIKE '%pg_read_file%' THEN
      RAISE NOTICE '0113: vector extension skipped (local migration role): %', SQLERRM;
    ELSE
      RAISE;
    END IF;
END
$voicecore_ext$;

-- --------------------------------------------------------------------------
-- tenant_memberships (not present in prior migrations)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'staff',
  permissions  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, permissions, is_active)
SELECT
  p.tenant_id,
  COALESCE(p.auth_user_id, p.id),
  COALESCE(NULLIF(trim(p.role_key), ''), r.key, 'staff'),
  '{}'::jsonb,
  COALESCE(p.is_active, TRUE)
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.role_id
WHERE p.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.user_id = auth.uid()
      AND tm.is_active = TRUE
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.id = auth.uid() OR p.auth_user_id = auth.uid())
      AND p.tenant_id = p_tenant_id
      AND COALESCE(p.is_active, TRUE) = TRUE
  );
$$;

DROP POLICY IF EXISTS tenant_memberships_select ON public.tenant_memberships;
CREATE POLICY tenant_memberships_select ON public.tenant_memberships
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- --------------------------------------------------------------------------
-- ai_sessions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT,
  status              TEXT        NOT NULL DEFAULT 'active',
  current_module      TEXT,
  current_route       TEXT,
  current_entity_type TEXT,
  current_entity_id   UUID,
  last_goal           TEXT,
  last_step           TEXT,
  memory_summary      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_ai_sessions_updated_at ON public.ai_sessions;
CREATE TRIGGER set_ai_sessions_updated_at
  BEFORE UPDATE ON public.ai_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------------
-- ai_messages
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id  UUID        NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content     TEXT        NOT NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- ai_pending_actions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_pending_actions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id        UUID        NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type       TEXT        NOT NULL,
  module            TEXT        NOT NULL,
  entity_type       TEXT,
  entity_id         UUID,
  title             TEXT        NOT NULL,
  description       TEXT,
  payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  preview_markdown  TEXT,
  risk_level        TEXT        NOT NULL DEFAULT 'normal'
                    CHECK (risk_level IN ('low', 'normal', 'high', 'critical')),
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'committed', 'failed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  committed_at      TIMESTAMPTZ
);

ALTER TABLE public.ai_pending_actions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- ai_action_logs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_action_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id        UUID        REFERENCES public.ai_sessions(id) ON DELETE SET NULL,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pending_action_id UUID        REFERENCES public.ai_pending_actions(id) ON DELETE SET NULL,
  action_type       TEXT        NOT NULL,
  input_payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  output_payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT        NOT NULL,
  error_message     TEXT,
  ip_address        TEXT,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- document_chunks (embedding optional for v1 — ohne vector lokal ohne embedding-Spalte)
DO $document_chunks$
DECLARE
  v_ext_schema TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    SELECT n.nspname
      INTO v_ext_schema
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'vector';
    IF v_ext_schema IS NULL THEN
      v_ext_schema := 'extensions';
    END IF;

    EXECUTE $sql$
      CREATE TABLE IF NOT EXISTS public.document_chunks (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        document_id      UUID        NOT NULL,
        document_type    TEXT        NOT NULL,
        title            TEXT,
        source_table     TEXT,
        source_entity_id UUID,
        chunk_index      INT         NOT NULL DEFAULT 0,
        content          TEXT        NOT NULL,
        metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,
        embedding        extensions.vector(1536),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    $sql$;
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
         ON public.document_chunks
         USING hnsw (embedding %I.vector_cosine_ops)
         WHERE embedding IS NOT NULL',
      v_ext_schema
    );
  ELSE
    CREATE TABLE IF NOT EXISTS public.document_chunks (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      document_id      UUID        NOT NULL,
      document_type    TEXT        NOT NULL,
      title            TEXT,
      source_table     TEXT,
      source_entity_id UUID,
      chunk_index      INT         NOT NULL DEFAULT 0,
      content          TEXT        NOT NULL,
      metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    RAISE NOTICE '0113: document_chunks ohne embedding (vector extension nicht verfuegbar)';
  END IF;
END
$document_chunks$;

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ai_sessions_tenant_user_idx
  ON public.ai_sessions (tenant_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_pending_actions_status_idx
  ON public.ai_pending_actions (tenant_id, user_id, status, created_at DESC);

-- document_chunks_embedding_idx: siehe DO-Block oben (nur mit vector extension)

-- --------------------------------------------------------------------------
-- RLS policies
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS ai_sessions_tenant_access ON public.ai_sessions;
CREATE POLICY ai_sessions_tenant_access ON public.ai_sessions
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id) AND user_id = auth.uid())
  WITH CHECK (public.is_tenant_member(tenant_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_tenant_access ON public.ai_messages;
CREATE POLICY ai_messages_tenant_access ON public.ai_messages
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS ai_pending_actions_tenant_access ON public.ai_pending_actions;
CREATE POLICY ai_pending_actions_tenant_access ON public.ai_pending_actions
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id) AND user_id = auth.uid())
  WITH CHECK (public.is_tenant_member(tenant_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS ai_action_logs_tenant_select ON public.ai_action_logs;
CREATE POLICY ai_action_logs_tenant_select ON public.ai_action_logs
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS ai_action_logs_tenant_insert ON public.ai_action_logs;
CREATE POLICY ai_action_logs_tenant_insert ON public.ai_action_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS document_chunks_tenant_access ON public.document_chunks;
CREATE POLICY document_chunks_tenant_access ON public.document_chunks
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- --------------------------------------------------------------------------
-- GRANTs
-- --------------------------------------------------------------------------
GRANT SELECT ON public.tenant_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_sessions TO authenticated;
GRANT SELECT, INSERT ON public.ai_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_pending_actions TO authenticated;
GRANT SELECT, INSERT ON public.ai_action_logs TO authenticated;
GRANT SELECT ON public.document_chunks TO authenticated;
