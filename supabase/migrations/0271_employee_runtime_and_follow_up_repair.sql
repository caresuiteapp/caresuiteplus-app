-- CareSuite+ 0271 — Einsatzlaufzeit und administrative Nachbearbeitung reparieren.
-- Additiv, idempotent und ohne Löschung vorhandener Einsatzdaten.

ALTER TABLE public.assist_visits
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.resolve_current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.id = auth.uid()
     OR p.auth_user_id = auth.uid()
  ORDER BY CASE WHEN p.id = auth.uid() THEN 0 ELSE 1 END
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_current_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_current_profile_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_assist_visit_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_profile_id UUID;
BEGIN
  IF NEW.updated_by IS NULL THEN RETURN NEW; END IF;
  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.id = NEW.updated_by OR p.auth_user_id = NEW.updated_by
  ORDER BY CASE WHEN p.id = NEW.updated_by THEN 0 ELSE 1 END
  LIMIT 1;
  NEW.updated_by := v_profile_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_assist_visit_updated_by_trigger ON public.assist_visits;
CREATE TRIGGER normalize_assist_visit_updated_by_trigger
BEFORE INSERT OR UPDATE OF updated_by ON public.assist_visits
FOR EACH ROW EXECUTE FUNCTION public.normalize_assist_visit_updated_by();

CREATE OR REPLACE FUNCTION public.admin_append_assist_visit_documentation(
  p_visit_id UUID,
  p_content TEXT,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.assist_visits%ROWTYPE;
  v_old TEXT;
  v_actor UUID := public.resolve_current_profile_id();
BEGIN
  IF NOT (public.is_tenant_admin() OR public.has_permission('assist.execution.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  IF length(trim(coalesce(p_content, ''))) = 0
     OR length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Dokumentation und Begründung sind erforderlich';
  END IF;

  SELECT * INTO v
  FROM public.assist_visits
  WHERE id = p_visit_id AND tenant_id = public.current_tenant_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;

  SELECT short_description INTO v_old
  FROM public.assist_visit_documentation
  WHERE tenant_id = v.tenant_id AND visit_id = v.id
  FOR UPDATE;

  INSERT INTO public.assist_visit_documentation (
    tenant_id, visit_id, short_description, special_notes,
    submitted_at, submitted_by, metadata
  ) VALUES (
    v.tenant_id, v.id, trim(p_content), trim(p_content),
    now(), v_actor, jsonb_build_object('administrative_reason', trim(p_reason))
  )
  ON CONFLICT (tenant_id, visit_id) DO UPDATE SET
    short_description = CASE
      WHEN NULLIF(trim(public.assist_visit_documentation.short_description), '') IS NULL
        THEN trim(p_content)
      ELSE public.assist_visit_documentation.short_description
    END,
    special_notes = concat_ws(
      E'\n\n',
      public.assist_visit_documentation.special_notes,
      '[Administrative Ergänzung ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || '] ' || trim(p_content)
    ),
    submitted_at = now(),
    submitted_by = v_actor,
    metadata = public.assist_visit_documentation.metadata ||
      jsonb_build_object('last_administrative_reason', trim(p_reason)),
    updated_at = now();

  UPDATE public.assist_visits
  SET documentation_status = 'complete', updated_by = v_actor, updated_at = now()
  WHERE id = v.id AND tenant_id = v.tenant_id;

  INSERT INTO public.assist_visit_admin_audit (
    tenant_id, visit_id, action, previous_value, new_value, reason
  ) VALUES (
    v.tenant_id, v.id, 'documentation_appended',
    jsonb_build_object('short_description', v_old),
    jsonb_build_object('content', trim(p_content)), trim(p_reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_assist_visit_follow_up(
  p_visit_id UUID,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v public.assist_visits%ROWTYPE;
  v_signature_deferred BOOLEAN := FALSE;
  v_actor UUID := public.resolve_current_profile_id();
BEGIN
  IF NOT (public.is_tenant_admin() OR public.has_permission('assist.execution.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Begründung ist erforderlich';
  END IF;

  SELECT * INTO v
  FROM public.assist_visits
  WHERE id = p_visit_id AND tenant_id = public.current_tenant_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einsatz nicht gefunden'; END IF;
  IF v.actual_start_at IS NULL OR v.actual_end_at IS NULL OR coalesce(v.duration_minutes, 0) <= 0 THEN
    RAISE EXCEPTION 'Gültige Ist-Zeiten fehlen';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.assist_visit_tasks
    WHERE tenant_id = v.tenant_id AND visit_id = v.id
      AND is_required AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Pflichtaufgaben sind noch offen';
  END IF;
  IF v.documentation_status <> 'complete' THEN
    RAISE EXCEPTION 'Dokumentation ist nicht vollständig';
  END IF;

  IF v.proof_status NOT IN ('signed', 'verified') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.assist_visit_signature_requests
      WHERE tenant_id = v.tenant_id AND visit_id = v.id AND status = 'open'
      UNION ALL
      SELECT 1 FROM public.assist_visit_proofs
      WHERE tenant_id = v.tenant_id AND visit_id = v.id
        AND portal_visible = TRUE
        AND portal_release_status = 'pending_client_signature'
    ) INTO v_signature_deferred;
    IF NOT v_signature_deferred THEN
      RAISE EXCEPTION 'Signatur oder verifizierter Nachweis fehlt';
    END IF;
  END IF;

  UPDATE public.assist_visits
  SET
    execution_status = 'completed',
    canonical_status = 'completed',
    billing_status = CASE WHEN v_signature_deferred THEN 'blocked' ELSE 'ready' END,
    finished_at = coalesce(finished_at, actual_end_at),
    updated_by = v_actor,
    updated_at = now()
  WHERE id = v.id AND tenant_id = v.tenant_id;

  INSERT INTO public.assist_visit_admin_audit (
    tenant_id, visit_id, action, previous_value, new_value, reason
  ) VALUES (
    v.tenant_id, v.id, 'follow_up_completed',
    jsonb_build_object('canonical_status', v.canonical_status),
    jsonb_build_object(
      'canonical_status', 'completed',
      'signature_deferred_to_client_portal', v_signature_deferred,
      'billing_status', CASE WHEN v_signature_deferred THEN 'blocked' ELSE 'ready' END
    ),
    trim(p_reason)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_append_assist_visit_documentation(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_complete_assist_visit_follow_up(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_append_assist_visit_documentation(UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_assist_visit_follow_up(UUID, TEXT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_deferred_assist_signature_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.signature_id IS NOT NULL
     AND (OLD.signature_id IS DISTINCT FROM NEW.signature_id) THEN
    UPDATE public.assist_visits
    SET
      proof_status = 'signed',
      billing_status = CASE
        WHEN canonical_status = 'completed' OR execution_status = 'completed' THEN 'ready'
        ELSE billing_status
      END,
      updated_at = now()
    WHERE tenant_id = NEW.tenant_id AND id = NEW.visit_id;

    UPDATE public.assist_visit_signature_requests
    SET
      status = 'signed',
      signature_id = NEW.signature_id,
      signed_at = coalesce(signed_at, now())
    WHERE tenant_id = NEW.tenant_id AND visit_id = NEW.visit_id AND status = 'open';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_deferred_assist_signature_completion_trigger
  ON public.assist_visit_proofs;
CREATE TRIGGER sync_deferred_assist_signature_completion_trigger
AFTER UPDATE OF signature_id ON public.assist_visit_proofs
FOR EACH ROW EXECUTE FUNCTION public.sync_deferred_assist_signature_completion();

NOTIFY pgrst, 'reload schema';
