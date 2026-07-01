-- Client portal messages + visit list production repair (Helferhasen+ / multi-tenant).
-- Root causes:
-- 1) assist_visits client portal list required portal_release_enabled=true (defaults false → empty lists)
-- 2) Missing message_threads portal client UPDATE → send/reply metadata updates blocked by RLS
-- 3) current_client_id() ignored JWT portal_account_id; some portal profiles lacked tenant_id
-- 4) client_portal_access self-select required client_id = current_client_id() (bootstrap circular)

-- --------------------------------------------------------------------------
-- Helpers — reliable client portal actor resolution (JWT + access row)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_client_portal_rls_context(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_role_key() IN ('client_portal', 'family_portal')
    OR EXISTS (
      SELECT 1
      FROM public.client_portal_access cpa
      WHERE cpa.auth_user_id = auth.uid()
        AND cpa.tenant_id = COALESCE(p_tenant_id, public.current_tenant_id())
        AND cpa.portal_enabled = TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.client_portal_codes cpc
      WHERE cpc.auth_user_id = auth.uid()
        AND cpc.tenant_id = COALESCE(p_tenant_id, public.current_tenant_id())
    )
    OR EXISTS (
      SELECT 1
      FROM public.relative_portal_codes rpc
      WHERE rpc.auth_user_id = auth.uid()
        AND rpc.tenant_id = COALESCE(p_tenant_id, public.current_tenant_id())
    );
$$;

COMMENT ON FUNCTION public.is_client_portal_rls_context(UUID) IS
  'True when auth user is an active client/relative portal actor for tenant.';

GRANT EXECUTE ON FUNCTION public.is_client_portal_rls_context(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT cpa.client_id
      FROM public.client_portal_access cpa
      WHERE cpa.id = NULLIF(auth.jwt()->'app_metadata'->>'portal_account_id', '')::uuid
        AND cpa.auth_user_id = auth.uid()
        AND cpa.portal_enabled = TRUE
      LIMIT 1
    ),
    (
      SELECT cpa.client_id
      FROM public.client_portal_access cpa
      WHERE cpa.auth_user_id = auth.uid()
        AND cpa.tenant_id = public.current_tenant_id()
        AND cpa.portal_enabled = TRUE
      LIMIT 1
    ),
    (
      SELECT cpc.client_id
      FROM public.client_portal_codes cpc
      WHERE cpc.auth_user_id = auth.uid()
        AND cpc.tenant_id = public.current_tenant_id()
      LIMIT 1
    ),
    (
      SELECT rpc.client_id
      FROM public.relative_portal_codes rpc
      WHERE rpc.auth_user_id = auth.uid()
        AND rpc.tenant_id = public.current_tenant_id()
      LIMIT 1
    )
  )
$$;

COMMENT ON FUNCTION public.current_client_id() IS
  'Resolves linked client for portal RLS — JWT portal_account_id first, then auth_user_id fallbacks.';

-- Backfill portal profile tenant context (NULL tenant_id breaks categories + messaging helpers).
UPDATE public.profiles p
SET
  tenant_id = cpa.tenant_id,
  updated_at = NOW()
FROM public.client_portal_access cpa
WHERE p.auth_user_id = cpa.auth_user_id
  AND cpa.auth_user_id IS NOT NULL
  AND cpa.portal_enabled = TRUE
  AND p.tenant_id IS NULL;

-- --------------------------------------------------------------------------
-- assist_visits — scoped client portal read (non-draft own visits)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS assist_visits_portal_client_select ON public.assist_visits;
CREATE POLICY assist_visits_portal_client_select ON public.assist_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_client_portal_rls_context(tenant_id)
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
    AND planning_status <> 'draft'
  );

DROP POLICY IF EXISTS assist_visit_tasks_portal_client_select ON public.assist_visit_tasks;
CREATE POLICY assist_visit_tasks_portal_client_select ON public.assist_visit_tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_client_portal_rls_context(tenant_id)
    AND visit_id IN (
      SELECT v.id
      FROM public.assist_visits v
      WHERE v.tenant_id = public.current_tenant_id()
        AND v.client_id = public.current_client_id()
        AND v.planning_status <> 'draft'
    )
  );

-- --------------------------------------------------------------------------
-- message_threads — portal client may update own thread metadata on reply
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS message_threads_portal_client_update ON public.message_threads;
CREATE POLICY message_threads_portal_client_update ON public.message_threads
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'::public.message_thread_type
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'::public.message_thread_type
    AND client_id = public.current_client_id()
    AND public.current_client_id() IS NOT NULL
  );

-- --------------------------------------------------------------------------
-- client_portal_access — allow self-read by auth_user_id (clientId bootstrap)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS client_portal_access_portal_self_select ON public.client_portal_access;
CREATE POLICY client_portal_access_portal_self_select ON public.client_portal_access
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND auth_user_id = auth.uid()
    AND portal_enabled = TRUE
  );
