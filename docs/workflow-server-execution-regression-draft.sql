-- REVIEW DRAFT ONLY. Not a deployment migration; not executed against Production.
-- Replaces the verified 2026-10-11 trigger which only guards early statuses.
-- Authorization policies and the canonical completion RPC remain independent gates.
-- The App must read the stored scope/status/version receipt, never infer success
-- from a 2xx response or a returned UUID. No backfill or business-row UPDATE here.
--
-- Permitted backwards changes: pause/resume while the service is open; a new
-- documentation submission before completion invalidates signature/proof flags;
-- an authorized, audited time correction may change a non-null time after the
-- canonical visit time has changed. This trigger does not grant those rights.
-- Reopening a completed/cancelled/no-show visit needs a separate reviewed workflow.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_assist_execution_state_regression()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v public.assist_visits%ROWTYPE;
  v_has_signature boolean;
  v_has_signed_proof boolean;
  v_has_deferred_proof boolean;
  v_has_any_proof boolean;
  v_doc text;
  v_closed text;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.visit_id IS DISTINCT FROM OLD.visit_id OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'Die Durchführungsfassung darf keinem anderen Einsatz zugeordnet werden.';
  END IF;
  SELECT * INTO v FROM public.assist_visits
    WHERE tenant_id=NEW.tenant_id AND id=NEW.visit_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Die kanonische Einsatzzuordnung fehlt.'; END IF;
  IF auth.uid() IS NOT NULL AND public.current_tenant_id() IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Der Einsatz gehört nicht zum aktuellen Mandanten.';
  END IF;
  IF public.current_role_key()='employee_portal'
      AND v.employee_id IS DISTINCT FROM public.resolve_current_employee_id() THEN
    RAISE EXCEPTION 'Der Einsatz ist Ihnen nicht zugeordnet.';
  END IF;
  IF public.current_role_key() IN ('client_portal','family_portal')
      AND v.client_id IS DISTINCT FROM public.current_client_id() THEN
    RAISE EXCEPTION 'Der Einsatz gehört nicht zu Ihrem Klientenportal.';
  END IF;

  -- Canonical timestamps also permit the existing audited time-correction RPC.
  -- Historical state timestamps survive missing canonical mirrors; a late job
  -- cannot erase them or replace them with its earlier UI clock.
  NEW.travel_started_at := COALESCE(v.on_the_way_at, CASE WHEN TG_OP='UPDATE' THEN OLD.travel_started_at END);
  NEW.travel_ended_at := COALESCE(v.arrived_at, CASE WHEN TG_OP='UPDATE' THEN OLD.travel_ended_at END);
  NEW.service_started_at := COALESCE(v.actual_start_at, CASE WHEN TG_OP='UPDATE' THEN OLD.service_started_at END);
  NEW.service_ended_at := COALESCE(v.actual_end_at, CASE WHEN TG_OP='UPDATE' THEN OLD.service_ended_at END);
  IF NEW.service_ended_at IS NOT NULL AND (NEW.service_started_at IS NULL OR NEW.service_ended_at < NEW.service_started_at) THEN
    RAISE EXCEPTION 'Einsatzende ohne gültigen Beginn.';
  END IF;
  IF NEW.travel_ended_at IS NOT NULL AND NEW.travel_started_at IS NOT NULL AND NEW.travel_ended_at < NEW.travel_started_at THEN
    RAISE EXCEPTION 'Ankunft liegt vor Beginn der Anfahrt.';
  END IF;

  SELECT NULLIF(trim(short_description),'') INTO v_doc
    FROM public.assist_visit_documentation WHERE tenant_id=NEW.tenant_id AND visit_id=NEW.visit_id AND submitted_at IS NOT NULL;
  SELECT EXISTS(SELECT 1 FROM public.assist_visit_signatures s
    WHERE s.tenant_id=NEW.tenant_id AND s.visit_id=NEW.visit_id AND s.is_valid
      AND NULLIF(trim(s.signature_hash),'') IS NOT NULL AND NULLIF(trim(s.payload_hash),'') IS NOT NULL
      AND NULLIF(trim(s.storage_path),'') IS NOT NULL) INTO v_has_signature;
  SELECT EXISTS(SELECT 1 FROM public.assist_visit_proofs p
    WHERE p.tenant_id=NEW.tenant_id AND p.visit_id=NEW.visit_id AND NULLIF(trim(p.payload_hash),'') IS NOT NULL
      AND jsonb_typeof(p.payload_snapshot)='object'
      AND COALESCE(p.payload_snapshot->>'documentationNote',p.payload_snapshot->>'documentation')=v_doc
      AND (p.payload_snapshot#>>'{visitTimes,serviceStartedAt}')::timestamptz IS NOT DISTINCT FROM NEW.service_started_at
      AND (p.payload_snapshot#>>'{visitTimes,serviceEndedAt}')::timestamptz IS NOT DISTINCT FROM NEW.service_ended_at) INTO v_has_any_proof;
  SELECT EXISTS(SELECT 1 FROM public.assist_visit_proofs p JOIN public.assist_visit_signatures s
    ON s.id=p.signature_id AND s.tenant_id=p.tenant_id AND s.visit_id=p.visit_id AND s.is_valid
    WHERE p.tenant_id=NEW.tenant_id AND p.visit_id=NEW.visit_id AND NULLIF(trim(p.payload_hash),'') IS NOT NULL
      AND NULLIF(trim(s.payload_hash),'') IS NOT NULL AND NULLIF(trim(s.signature_hash),'') IS NOT NULL
      AND COALESCE(p.payload_snapshot->>'documentationNote',p.payload_snapshot->>'documentation')=v_doc
      AND (p.payload_snapshot#>>'{visitTimes,serviceStartedAt}')::timestamptz IS NOT DISTINCT FROM NEW.service_started_at
      AND (p.payload_snapshot#>>'{visitTimes,serviceEndedAt}')::timestamptz IS NOT DISTINCT FROM NEW.service_ended_at) INTO v_has_signed_proof;
  SELECT EXISTS(SELECT 1 FROM public.assist_visit_proofs p
    WHERE p.tenant_id=NEW.tenant_id AND p.visit_id=NEW.visit_id AND p.portal_visible
      AND p.portal_release_status='released' AND p.payload_snapshot->>'signatureDeferredToClientPortal'='true'
      AND NULLIF(trim(p.payload_hash),'') IS NOT NULL
      AND COALESCE(p.payload_snapshot->>'documentationNote',p.payload_snapshot->>'documentation')=v_doc
      AND (p.payload_snapshot#>>'{visitTimes,serviceStartedAt}')::timestamptz IS NOT DISTINCT FROM NEW.service_started_at
      AND (p.payload_snapshot#>>'{visitTimes,serviceEndedAt}')::timestamptz IS NOT DISTINCT FROM NEW.service_ended_at) INTO v_has_deferred_proof;

  -- A signature replacement/client-portal completion can promote false->true.
  -- Actual invalidation can promote true->false; no blanket OR with OLD flags.
  NEW.documentation_complete := v_doc IS NOT NULL;
  NEW.signature_complete := v_has_signature;
  NEW.proof_generated := v_has_signed_proof OR v_has_deferred_proof
    OR (COALESCE(NEW.proof_generated,false) AND v_has_any_proof);

  v_closed := CASE v.canonical_status WHEN 'completed' THEN 'abgeschlossen'
    WHEN 'cancelled' THEN 'storniert' WHEN 'no_show' THEN 'nicht_erschienen' ELSE NULL END;
  IF TG_OP='UPDATE' THEN
    IF OLD.assignment_status IN ('abgeschlossen','storniert','nicht_erschienen') THEN v_closed := OLD.assignment_status; END IF;
    NEW.finalized_at := COALESCE(OLD.finalized_at, NEW.finalized_at);
  END IF;
  IF v_closed IS NULL AND NEW.assignment_status IN ('abgeschlossen','storniert','nicht_erschienen') THEN
    RAISE EXCEPTION 'Der kanonische Endstatus ist noch nicht bestätigt.';
  END IF;
  IF v_closed IS NOT NULL THEN
    NEW.assignment_status := v_closed;
    NEW.current_step := CASE v_closed WHEN 'abgeschlossen' THEN 'completed' WHEN 'nicht_erschienen' THEN 'no_show' ELSE 'locked' END;
  ELSIF NEW.finalized_at IS NOT NULL THEN
    -- A finalization timestamp alone is not proof of canonical completion.
    RAISE EXCEPTION 'Der kanonische Einsatzabschluss ist noch nicht bestätigt.';
  ELSIF NEW.service_ended_at IS NOT NULL THEN
    IF NEW.assignment_status IN ('geplant','bestaetigt','unterwegs','angekommen','gestartet','pausiert') THEN
      NEW.assignment_status := 'beendet'; NEW.current_step := 'documentation';
    END IF;
    IF TG_OP='UPDATE' AND OLD.assignment_status='unterschrift_offen'
      AND NEW.assignment_status IN ('beendet','dokumentation_offen') AND v_has_signature THEN
      NEW.assignment_status := 'unterschrift_offen'; NEW.current_step := 'signature';
    ELSIF TG_OP='UPDATE' AND OLD.assignment_status='dokumentation_offen' AND NEW.assignment_status='beendet' THEN
      NEW.assignment_status := 'dokumentation_offen'; NEW.current_step := 'documentation';
    END IF;
  ELSIF NEW.service_started_at IS NOT NULL AND NEW.assignment_status IN ('geplant','bestaetigt','unterwegs','angekommen') THEN
    NEW.assignment_status := CASE WHEN TG_OP='UPDATE' AND OLD.assignment_status='pausiert' THEN 'pausiert' ELSE 'gestartet' END;
    NEW.current_step := CASE WHEN NEW.assignment_status='pausiert' THEN 'paused' ELSE 'in_service' END;
  END IF;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN
    NEW.updated_at := OLD.updated_at;
  ELSE
    NEW.updated_at := CASE WHEN TG_OP='UPDATE' THEN GREATEST(clock_timestamp(),OLD.updated_at+interval '1 microsecond') ELSE clock_timestamp() END;
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.guard_assist_execution_state_regression()
IS 'caresuite:workflow-execution-regression-v1-review';

DROP TRIGGER IF EXISTS trg_guard_assist_execution_state_regression ON public.assist_visit_execution_state;
CREATE TRIGGER trg_guard_assist_execution_state_regression BEFORE INSERT OR UPDATE
ON public.assist_visit_execution_state FOR EACH ROW
EXECUTE FUNCTION public.guard_assist_execution_state_regression();

COMMIT;
