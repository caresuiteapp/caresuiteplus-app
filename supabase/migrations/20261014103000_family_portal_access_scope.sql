-- W-05: Angehörigenzugang nur aus aktiver, nicht abgelaufener Serververknüpfung
-- und dem aktuell gespeicherten Freigabeumfang ableiten.

CREATE OR REPLACE FUNCTION public.current_family_portal_access_scope()
RETURNS TABLE (
  tenant_id uuid,
  account_id uuid,
  client_id uuid,
  relative_contact_id uuid,
  valid_from text,
  expires_at text,
  can_view_appointments boolean,
  can_view_documents boolean,
  can_view_messages boolean,
  can_send_messages boolean,
  can_view_service_records boolean,
  can_view_invoices boolean,
  can_download_documents boolean,
  can_confirm_appointments boolean,
  can_sign_records boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT rpc.tenant_id, rpc.id, rpc.client_id, rpc.relative_contact_id,
         to_char(rpc.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
         CASE WHEN rpc.expires_at IS NULL THEN NULL
              ELSE to_char(rpc.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
         END,
         pap.can_view_appointments, pap.can_view_documents,
         pap.can_view_messages, pap.can_send_messages,
         pap.can_view_service_records, pap.can_view_invoices,
         pap.can_download_documents, pap.can_confirm_appointments,
         pap.can_sign_records
  FROM public.relative_portal_codes rpc
  JOIN LATERAL (
    SELECT p.*
    FROM public.portal_access_permissions p
    WHERE p.tenant_id = rpc.tenant_id
      AND p.portal_type = 'relative'
      AND p.portal_account_id = rpc.id
    ORDER BY p.updated_at DESC, p.id DESC
    LIMIT 1
  ) pap ON true
  WHERE (auth.jwt()->'app_metadata'->>'portal_type') = 'relative'
    AND rpc.id = public.current_portal_account_id()
    AND rpc.auth_user_id = auth.uid()
    AND rpc.status = 'active'
    AND rpc.created_at <= CURRENT_TIMESTAMP
    AND (rpc.expires_at IS NULL OR rpc.expires_at > CURRENT_TIMESTAMP)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_family_portal_access_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_family_portal_access_scope() TO authenticated;

CREATE OR REPLACE FUNCTION public.family_portal_has_capability(
  p_capability text,
  p_tenant_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.current_family_portal_access_scope() s
    WHERE s.tenant_id = COALESCE(p_tenant_id, s.tenant_id)
      AND s.client_id = COALESCE(p_client_id, s.client_id)
      AND CASE p_capability
        WHEN 'appointments' THEN s.can_view_appointments
        WHEN 'documents' THEN s.can_view_documents
        WHEN 'messages' THEN s.can_view_messages
        WHEN 'send_messages' THEN s.can_send_messages
        WHEN 'service_records' THEN s.can_view_service_records
        WHEN 'invoices' THEN s.can_view_invoices
        WHEN 'download_documents' THEN s.can_download_documents
        WHEN 'confirm_appointments' THEN s.can_confirm_appointments
        WHEN 'sign_records' THEN s.can_sign_records
        ELSE false
      END
  )
$$;

REVOKE ALL ON FUNCTION public.family_portal_has_capability(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_portal_has_capability(text, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.current_family_portal_access_scope() IS
  'W-05: active exact relative account, representation contact, lifetime and current content grants; revoked/expired/missing permissions return no row.';
COMMENT ON FUNCTION public.family_portal_has_capability(text, uuid, uuid) IS
  'W-05 server authority for family portal content gates; unknown capabilities fail closed.';

-- Die Rohdatensätze enthalten mandantenweite Konten und Änderungsrechte. Portalrollen
-- erhalten ausschließlich den oben auf das eigene Konto zugeschnittenen RPC-Scope.
DROP POLICY IF EXISTS portal_access_permissions_tenant_isolation ON public.portal_access_permissions;
CREATE POLICY portal_access_permissions_business_management ON public.portal_access_permissions
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('office.access') OR public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (public.has_permission('office.access') OR public.is_tenant_admin())
  );

CREATE OR REPLACE FUNCTION public.portal_actor_has_capability(
  p_capability text,
  p_tenant_id uuid,
  p_client_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE public.current_role_key()
    WHEN 'client_portal' THEN
      public.current_tenant_id() = p_tenant_id
      AND public.current_client_id() = p_client_id
    WHEN 'family_portal' THEN
      public.family_portal_has_capability(p_capability, p_tenant_id, p_client_id)
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.portal_actor_has_capability(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_actor_has_capability(text, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS client_documents_portal_select ON public.client_documents;
CREATE POLICY client_documents_portal_select ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND portal_visible = true
    AND status IN ('aktiv', 'abgeschlossen', 'bestaetigt')
    AND sensitivity NOT IN ('internal', 'restricted')
    AND public.portal_actor_has_capability('documents', tenant_id, client_id)
  );

DROP POLICY IF EXISTS assist_visits_portal_client_select ON public.assist_visits;
CREATE POLICY assist_visits_portal_client_select ON public.assist_visits
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND client_id = public.current_client_id()
    AND planning_status <> 'draft'
    AND public.portal_actor_has_capability('appointments', tenant_id, client_id)
  );

DROP POLICY IF EXISTS assist_visit_tasks_portal_client_select ON public.assist_visit_tasks;
CREATE POLICY assist_visit_tasks_portal_client_select ON public.assist_visit_tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND visit_id IN (
      SELECT v.id FROM public.assist_visits v
      WHERE v.tenant_id = assist_visit_tasks.tenant_id
        AND v.client_id = public.current_client_id()
        AND v.planning_status <> 'draft'
        AND public.portal_actor_has_capability('appointments', v.tenant_id, v.client_id)
    )
  );

DROP POLICY IF EXISTS message_threads_portal_client_select ON public.message_threads;
CREATE POLICY message_threads_portal_client_select ON public.message_threads
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'
    AND client_id = public.current_client_id()
    AND public.portal_actor_has_capability('messages', tenant_id, client_id)
  );

DROP POLICY IF EXISTS message_threads_portal_client_insert ON public.message_threads;
CREATE POLICY message_threads_portal_client_insert ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'
    AND client_id = public.current_client_id()
    AND employee_id IS NULL
    AND public.portal_actor_has_capability('send_messages', tenant_id, client_id)
  );

DROP POLICY IF EXISTS message_threads_portal_client_update ON public.message_threads;
CREATE POLICY message_threads_portal_client_update ON public.message_threads
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'
    AND client_id = public.current_client_id()
    AND public.portal_actor_has_capability('send_messages', tenant_id, client_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND thread_type = 'client'
    AND client_id = public.current_client_id()
    AND public.portal_actor_has_capability('send_messages', tenant_id, client_id)
  );

DROP POLICY IF EXISTS messages_portal_select ON public.messages;
CREATE POLICY messages_portal_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND is_internal_note = false
    AND is_system_message = false
    AND EXISTS (
      SELECT 1 FROM public.message_threads mt
      WHERE mt.id = messages.thread_id
        AND mt.tenant_id = messages.tenant_id
        AND (
          (
            mt.thread_type = 'client'
            AND mt.client_id = public.current_client_id()
            AND public.portal_actor_has_capability('messages', mt.tenant_id, mt.client_id)
          )
          OR (
            mt.thread_type = 'employee'
            AND mt.employee_id = public.resolve_current_employee_id()
          )
          OR (
            mt.thread_type = 'employee_group'
            AND EXISTS (
              SELECT 1 FROM public.message_thread_employee_participants p
              WHERE p.thread_id = mt.id
                AND p.tenant_id = mt.tenant_id
                AND p.is_active = true
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
    AND is_internal_note = false
    AND (
      (
        sender_client_id = public.current_client_id()
        AND public.portal_actor_has_capability('send_messages', tenant_id, sender_client_id)
      )
      OR (
        sender_employee_id = public.resolve_current_employee_id()
        AND EXISTS (
          SELECT 1 FROM public.message_threads mt
          WHERE mt.id = messages.thread_id
            AND mt.tenant_id = messages.tenant_id
            AND (
              (mt.thread_type = 'employee' AND mt.employee_id = sender_employee_id)
              OR (
                mt.thread_type = 'employee_group'
                AND EXISTS (
                  SELECT 1 FROM public.message_thread_employee_participants p
                  WHERE p.thread_id = mt.id
                    AND p.tenant_id = mt.tenant_id
                    AND p.is_active = true
                    AND p.employee_id = sender_employee_id
                )
              )
            )
        )
      )
    )
  );
