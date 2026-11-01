-- REVIEW ONLY. Eighth draft, after monthly-employees-draft.sql and the existing
-- verified_assignment_service_records migration. No deployment or backfill.
-- Working projections stay mutable; only a new, personally sealed original is
-- captured. This is NOT the separate ITSG monthly confirmation or a PDF attestation.
BEGIN;
CREATE TABLE care_security.gkv_assist_originals (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), visit_id uuid NOT NULL,
 assignment_id uuid NOT NULL, proof_id uuid PRIMARY KEY,
 draft_id uuid NOT NULL REFERENCES public.assist_visit_proofs(id),
 draft_updated_at timestamptz NOT NULL, payload_hash text NOT NULL,
 signature_id uuid NOT NULL, actor_id uuid NOT NULL, session_id uuid NOT NULL,
 sealed_at timestamptz NOT NULL,
 UNIQUE(tenant_id,visit_id), UNIQUE(tenant_id,assignment_id),
 FOREIGN KEY(proof_id) REFERENCES public.assist_visit_proofs(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE care_security.gkv_assist_requests (
 tenant_id uuid NOT NULL, request_id uuid NOT NULL, actor_id uuid NOT NULL,
 request_sha256 text NOT NULL, proof_id uuid NOT NULL REFERENCES care_security.gkv_assist_originals(proof_id),
 PRIMARY KEY(tenant_id,request_id)
);

-- Server-owned marker exists only inside the sealing transaction. Ordinary
-- INSERTs (including live unsigned documentation) never acquire personal provenance.
CREATE OR REPLACE FUNCTION care_security.gkv_employee_capture_insert() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM care_security.gkv_assist_originals o WHERE o.tenant_id=NEW.tenant_id
   AND o.proof_id=NEW.id AND o.visit_id=NEW.visit_id AND o.actor_id=auth.uid()
   AND o.session_id=care_security.gkv_monthly_live_session()) THEN
  PERFORM care_security.gkv_employee_capture_proof(NEW);
  IF NOT EXISTS(SELECT 1 FROM care_security.gkv_employee_captures WHERE tenant_id=NEW.tenant_id AND proof_id=NEW.id) THEN
   RAISE EXCEPTION 'Persönliche Ursprungsbindung fehlt' USING ERRCODE='40001'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION care_security.gkv_assist_proof_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o care_security.gkv_assist_originals; t uuid; v uuid;
BEGIN
 t:=CASE WHEN TG_OP='INSERT' THEN NEW.tenant_id ELSE OLD.tenant_id END;
 v:=CASE WHEN TG_OP='INSERT' THEN NEW.visit_id ELSE OLD.visit_id END;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':gkv-assist:'||v::text,0));
 IF TG_OP='UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.visit_id IS DISTINCT FROM OLD.visit_id
    OR NEW.id IS DISTINCT FROM OLD.id) THEN
  RAISE EXCEPTION 'Nachweisidentität darf nicht verschoben werden' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM care_security.gkv_assist_originals WHERE tenant_id=t AND visit_id=v;
 IF NOT FOUND THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.id IS DISTINCT FROM o.proof_id OR NEW.payload_hash IS DISTINCT FROM o.payload_hash
    OR NEW.signature_id IS DISTINCT FROM o.signature_id OR o.actor_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'Einsatz besitzt bereits ein abgeschlossenes Original' USING ERRCODE='40001'; END IF;
 ELSIF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Abschlussfassung und zugehöriger Entwurf bleiben erhalten' USING ERRCODE='42501';
 ELSIF OLD.id<>o.proof_id THEN
  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
   RAISE EXCEPTION 'Verspätete Entwurfsänderung nach Abschluss' USING ERRCODE='40001'; END IF;
 ELSIF NEW.payload_snapshot IS DISTINCT FROM OLD.payload_snapshot OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
   OR NEW.signature_id IS DISTINCT FROM OLD.signature_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.generated_at IS DISTINCT FROM OLD.generated_at OR NEW.generated_by IS DISTINCT FROM OLD.generated_by
   OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.proof_number IS DISTINCT FROM OLD.proof_number
   OR NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
  RAISE EXCEPTION 'Abgeschlossenes Original ist unveränderbar' USING ERRCODE='42501';
 END IF;
 -- The existing trusted byte worker may still attach/attest the final PDF.
 -- Existing record-bound guards protect those bytes after the service handoff.
 RETURN NEW;
END $$;
CREATE TRIGGER gkv_assist_proof_guard BEFORE INSERT OR UPDATE OR DELETE ON public.assist_visit_proofs
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_assist_proof_guard();

CREATE FUNCTION care_security.gkv_assist_source_guard(t uuid,source jsonb) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o care_security.gkv_assist_originals; receipt jsonb:=source->'sourceReceipt';
BEGIN
 SELECT * INTO o FROM care_security.gkv_assist_originals WHERE tenant_id=t AND visit_id=(receipt->>'visit_id')::uuid;
 IF FOUND THEN
  IF o.proof_id::text IS DISTINCT FROM receipt->>'proof_id' OR o.payload_hash IS DISTINCT FROM receipt->>'proof_payload_hash'
   OR NOT EXISTS(SELECT 1 FROM care_security.gkv_employee_captures WHERE tenant_id=t AND proof_id=o.proof_id) THEN
   RAISE EXCEPTION 'Monatsnachweis benötigt die persönlich abgeschlossene Originalfassung' USING ERRCODE='40001'; END IF;
 ELSIF EXISTS(SELECT 1 FROM care_security.gkv_employee_registrations r WHERE r.tenant_id=t
   AND r.employee_id=(source->>'employeeId')::uuid AND r.state IN ('approved','revoked')
   AND r.valid_from<=(receipt->>'service_started_at')::timestamptz
   AND r.valid_until>(receipt->>'service_started_at')::timestamptz) THEN
  RAISE EXCEPTION 'Persönlicher Assist-Abschluss fehlt; Entwurf ist kein Original' USING ERRCODE='40001';
 END IF;
END $$;

-- Protect the existing worker/record RPC even when an older client or a stale
-- PostgREST schema cache does not yet know the optional finalization endpoint.
-- No mutable source may be handed off first and then retroactively captured.
CREATE FUNCTION care_security.gkv_assist_record_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.source_receipt<>'{}'::jsonb AND (TG_OP='INSERT' OR NEW.source_receipt IS DISTINCT FROM OLD.source_receipt) THEN
  PERFORM care_security.gkv_employee_source(NEW.tenant_id,
   jsonb_build_object('employeeId',NEW.employee_id,'sourceReceipt',NEW.source_receipt));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gkv_assist_record_guard BEFORE INSERT OR UPDATE ON public.service_records
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_assist_record_guard();

CREATE FUNCTION care_security.gkv_assist_original_context(t uuid,a_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a public.assignments; v public.assist_visits; d public.assist_visit_proofs;
 o care_security.gkv_assist_originals; employee uuid; result jsonb; receipt jsonb;
BEGIN
 PERFORM care_security.gkv_monthly_live_session();
 SELECT * INTO a FROM public.assignments WHERE tenant_id=t AND id=a_id;
 IF NOT FOUND OR public.workflow_record_actor_allowed(t,a.employee_id) IS NOT TRUE THEN
  RAISE EXCEPTION 'Eigene Einsatz- oder Nachweisberechtigung fehlt' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.assist_visits WHERE tenant_id=t AND (id=a_id OR legacy_assignment_id=a_id))<>1 THEN
  RAISE EXCEPTION 'Eindeutige kanonische Einsatzfassung fehlt' USING ERRCODE='40001'; END IF;
 SELECT * INTO v FROM public.assist_visits WHERE tenant_id=t AND (id=a_id OR legacy_assignment_id=a_id);
 IF v.employee_id IS DISTINCT FROM a.employee_id OR v.client_id IS DISTINCT FROM a.client_id
  OR v.actual_start_at IS DISTINCT FROM a.actual_start_at OR v.actual_end_at IS DISTINCT FROM a.actual_end_at THEN
  RAISE EXCEPTION 'Einsatz und tatsächliche Zeiten widersprechen sich' USING ERRCODE='40001'; END IF;
 result:=jsonb_build_object('version','gkv-assist-original-v1','tenantId',t,'assignmentId',a_id,
   'visitId',v.id,'actorId',auth.uid(),'employeeId',v.employee_id,'draft',NULL,'original',NULL);
 SELECT * INTO o FROM care_security.gkv_assist_originals WHERE tenant_id=t AND visit_id=v.id;
 IF NOT FOUND AND NOT EXISTS(SELECT 1 FROM care_security.gkv_employee_registrations r WHERE r.tenant_id=t
    AND r.employee_id=v.employee_id AND r.state IN ('approved','revoked')
    AND (v.actual_start_at IS NULL OR r.valid_from<=v.actual_start_at AND r.valid_until>v.actual_start_at)) THEN
  RETURN result||jsonb_build_object('phase','legacy'); END IF;
 employee:=care_security.gkv_employee_self(t);
 IF employee IS DISTINCT FROM v.employee_id OR employee IS NULL THEN
  RAISE EXCEPTION 'Persönlicher Abschluss durch die eingesetzte Pflegekraft erforderlich' USING ERRCODE='42501'; END IF;
 IF o.proof_id IS NOT NULL THEN
  IF a.status::text<>'completed' THEN RAISE EXCEPTION 'Einsatzabschluss wurde geändert' USING ERRCODE='40001'; END IF;
  IF o.actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Ursprünglicher persönlicher Zugang erforderlich' USING ERRCODE='42501'; END IF;
  receipt:=public.workflow_signed_proof_source(t,v.id,o.proof_id,FALSE,FALSE);
  PERFORM care_security.gkv_employee_source(t,jsonb_build_object('employeeId',employee,'sourceReceipt',receipt));
  RETURN result||jsonb_build_object('phase','sealed','original',jsonb_build_object('proofId',o.proof_id,
    'draftId',o.draft_id,'draftUpdatedAt',o.draft_updated_at,'payloadHash',o.payload_hash,'signatureId',o.signature_id,'sealedAt',o.sealed_at));
 END IF;
 IF a.status::text<>'completed' OR v.canonical_status<>'completed' THEN
  RETURN result||jsonb_build_object('phase','working'); END IF;
 SELECT * INTO d FROM public.assist_visit_proofs WHERE tenant_id=t AND visit_id=v.id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF NOT FOUND OR d.signature_id IS NULL OR d.created_at>clock_timestamp() OR d.updated_at>clock_timestamp()
   OR d.status NOT IN ('draft','pending_review') OR d.billing_released OR d.portal_visible THEN
  RAISE EXCEPTION 'Aktueller persönlich unterschriebener Entwurf fehlt' USING ERRCODE='40001'; END IF;
 RETURN result||jsonb_build_object('phase','ready','draft',jsonb_build_object('proofId',d.id,
   'updatedAt',d.updated_at,'payloadHash',d.payload_hash,'signatureId',d.signature_id));
END $$;

CREATE FUNCTION care_security.gkv_assist_original_seal(t uuid,a_id uuid,p_request uuid,p_expected jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE context jsonb; d public.assist_visit_proofs; o care_security.gkv_assist_originals;
 previous care_security.gkv_assist_requests; fingerprint text; v_id uuid; source jsonb; instant timestamptz;
BEGIN
 PERFORM care_security.gkv_monthly_live_session();
 IF p_request IS NULL OR jsonb_typeof(p_expected) IS DISTINCT FROM 'object' OR pg_column_size(p_expected)>2000 THEN
  RAISE EXCEPTION 'Abschlussanfrage ungültig' USING ERRCODE='22023'; END IF;
 -- Validate scope before locking or exposing any private identity.
 context:=care_security.gkv_assist_original_context(t,a_id); v_id:=(context->>'visitId')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':gkv-assist:'||v_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':gkv-assist-request:'||p_request::text,0));
 PERFORM 1 FROM public.assignments WHERE tenant_id=t AND id=a_id FOR SHARE;
 PERFORM 1 FROM public.assist_visits WHERE tenant_id=t AND id=v_id FOR SHARE;
 context:=care_security.gkv_assist_original_context(t,a_id);
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('assignment',a_id,'expected',p_expected)::text,'UTF8')),'hex');
 SELECT * INTO previous FROM care_security.gkv_assist_requests WHERE tenant_id=t AND request_id=p_request;
 IF FOUND THEN
  IF previous.actor_id IS DISTINCT FROM auth.uid() OR previous.request_sha256<>fingerprint
    OR context->'original'->>'proofId' IS DISTINCT FROM previous.proof_id::text THEN
   RAISE EXCEPTION 'Abschlusskennung wurde für eine andere Fassung verwendet' USING ERRCODE='40001'; END IF;
  RETURN context;
 END IF;
 IF context->>'phase'='sealed' THEN
  IF p_expected IS DISTINCT FROM jsonb_build_object('proofId',context#>>'{original,draftId}',
   'updatedAt',context#>>'{original,draftUpdatedAt}','payloadHash',context#>>'{original,payloadHash}',
   'signatureId',context#>>'{original,signatureId}') THEN
   RAISE EXCEPTION 'Abschlussfassung entspricht nicht dem erwarteten Entwurf' USING ERRCODE='40001'; END IF;
  INSERT INTO care_security.gkv_assist_requests VALUES(t,p_request,auth.uid(),fingerprint,(context#>>'{original,proofId}')::uuid);
  RETURN context;
 END IF;
 IF context->>'phase'<>'ready' OR context->'draft' IS DISTINCT FROM p_expected THEN
  RAISE EXCEPTION 'Entwurfsfassung wurde geändert oder ist nicht abschlussbereit' USING ERRCODE='40001'; END IF;
 SELECT * INTO d FROM public.assist_visit_proofs WHERE tenant_id=t AND id=(p_expected->>'proofId')::uuid FOR UPDATE;
 IF jsonb_build_object('proofId',d.id,'updatedAt',d.updated_at,'payloadHash',d.payload_hash,'signatureId',d.signature_id) IS DISTINCT FROM p_expected THEN
  RAISE EXCEPTION 'Entwurf während des Abschlusses geändert' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.service_records WHERE tenant_id=t AND source_receipt->>'visit_id'=v_id::text) THEN
  RAISE EXCEPTION 'Bereits übergebene Quelle darf nicht nachträglich persönlich gebunden werden' USING ERRCODE='40001'; END IF;
 source:=public.workflow_signed_proof_source(t,v_id,d.id,FALSE,FALSE);
 instant:=clock_timestamp();
 INSERT INTO care_security.gkv_assist_originals VALUES(t,v_id,a_id,gen_random_uuid(),d.id,d.updated_at,d.payload_hash,
   d.signature_id,auth.uid(),care_security.gkv_monthly_live_session(),instant) RETURNING * INTO o;
 INSERT INTO public.assist_visit_proofs(id,tenant_id,visit_id,signature_id,proof_number,status,payload_snapshot,payload_hash,
   generated_at,generated_by,created_by,updated_by,created_at,updated_at,metadata)
  VALUES(o.proof_id,t,v_id,d.signature_id,d.proof_number,'draft',d.payload_snapshot,d.payload_hash,
   instant,d.generated_by,d.created_by,d.updated_by,instant,instant,'{}');
 -- INSERT capture enforces approval-before-start, personal session and the
 -- existing 15-minute product policy. No approval/bytes/storage copied from draft.
 INSERT INTO care_security.gkv_assist_requests VALUES(t,p_request,auth.uid(),fingerprint,o.proof_id);
 RETURN care_security.gkv_assist_original_context(t,a_id);
END $$;

CREATE TRIGGER gkv_assist_originals_immutable BEFORE UPDATE OR DELETE ON care_security.gkv_assist_originals
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_employee_immutable();
CREATE TRIGGER gkv_assist_requests_immutable BEFORE UPDATE OR DELETE ON care_security.gkv_assist_requests
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_employee_immutable();
CREATE FUNCTION public.gkv_assist_original_context(t uuid,a_id uuid) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_assist_original_context(t,a_id) $$;
CREATE FUNCTION public.gkv_assist_original_seal(t uuid,a_id uuid,p_request uuid,p_expected jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_assist_original_seal(t,a_id,p_request,p_expected) $$;
DO $$ DECLARE name text; f regprocedure; BEGIN
 FOREACH name IN ARRAY ARRAY['gkv_assist_originals','gkv_assist_requests'] LOOP
  EXECUTE format('ALTER TABLE care_security.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('REVOKE ALL ON care_security.%I FROM PUBLIC,anon,authenticated,service_role',name);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('care_security','public') AND p.proname LIKE 'gkv_assist_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION care_security.gkv_assist_original_context(uuid,uuid),public.gkv_assist_original_context(uuid,uuid),
 care_security.gkv_assist_original_seal(uuid,uuid,uuid,jsonb),public.gkv_assist_original_seal(uuid,uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
