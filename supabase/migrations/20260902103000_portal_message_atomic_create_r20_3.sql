-- Atomic, identity-safe portal chat creation.
-- The actor is resolved from the authenticated JWT; client supplied person IDs
-- are deliberately ignored so portal users cannot impersonate another actor.

CREATE OR REPLACE FUNCTION public.portal_create_office_thread(
  p_tenant_id UUID,
  p_audience TEXT,
  p_subject TEXT,
  p_category_id UUID DEFAULT NULL,
  p_initial_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id UUID := public.current_tenant_id();
  v_employee_id UUID;
  v_client_id UUID;
  v_thread public.message_threads%ROWTYPE;
  v_subject TEXT := btrim(COALESCE(p_subject, ''));
  v_message TEXT := btrim(COALESCE(p_initial_message, ''));
  v_now TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich.' USING ERRCODE = '42501';
  END IF;
  IF v_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'Mandant der Sitzung stimmt nicht überein.' USING ERRCODE = '42501';
  END IF;
  IF v_subject = '' THEN
    RAISE EXCEPTION 'Betreff darf nicht leer sein.' USING ERRCODE = '22023';
  END IF;
  IF p_audience NOT IN ('employee', 'client') THEN
    RAISE EXCEPTION 'Portaltyp ist ungültig.' USING ERRCODE = '22023';
  END IF;

  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.message_categories category
    WHERE category.id = p_category_id
      AND category.tenant_id = v_tenant_id
      AND category.is_active = TRUE
      AND category.audience::TEXT IN (p_audience, 'all')
  ) THEN
    RAISE EXCEPTION 'Das gewählte Thema ist nicht verfügbar.' USING ERRCODE = '22023';
  END IF;

  IF p_audience = 'employee' THEN
    v_employee_id := public.resolve_current_employee_id();
    IF v_employee_id IS NULL THEN
      RAISE EXCEPTION 'Kein Mitarbeitendenkonto mit dieser Sitzung verknüpft.' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_client_id := public.current_client_id();
    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'Kein Klient:innenkonto mit dieser Sitzung verknüpft.' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.message_threads (
    tenant_id,
    thread_type,
    status,
    priority,
    subject,
    category_id,
    client_id,
    employee_id,
    created_by_client_id,
    created_by_employee_id,
    last_message_at,
    last_message_preview
  ) VALUES (
    v_tenant_id,
    CASE WHEN p_audience = 'employee'
      THEN 'employee'::public.message_thread_type
      ELSE 'client'::public.message_thread_type
    END,
    'new',
    'normal',
    v_subject,
    p_category_id,
    v_client_id,
    v_employee_id,
    v_client_id,
    v_employee_id,
    v_now,
    CASE WHEN v_message = '' THEN 'Neuer Chat' ELSE left(v_message, 120) END
  )
  RETURNING * INTO v_thread;

  IF v_message <> '' THEN
    INSERT INTO public.messages (
      tenant_id,
      thread_id,
      body,
      is_internal_note,
      is_system_message,
      sender_client_id,
      sender_employee_id,
      sent_at,
      status
    ) VALUES (
      v_tenant_id,
      v_thread.id,
      v_message,
      FALSE,
      FALSE,
      v_client_id,
      v_employee_id,
      v_now,
      'sent'
    );
  END IF;

  RETURN to_jsonb(v_thread);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_create_office_thread(UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_create_office_thread(UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.portal_create_office_thread(UUID, TEXT, TEXT, UUID, TEXT)
  IS 'Atomically creates a portal-office thread and optional first message for the authenticated portal actor.';
