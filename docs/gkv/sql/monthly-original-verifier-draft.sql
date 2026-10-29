-- REVIEW ONLY. Requires monthly-proofs-draft.sql and its canonical Office source
-- verifier. No migration, worker credential, Data API entry, role grant or rollout.
-- The future worker connection must retain a verified personal actor context.
-- Representative support additionally requires monthly-authorities-draft.sql.
BEGIN;
ALTER TABLE care_security.gkv_monthly_confirmation_receipts
 ADD COLUMN signature_ink_sha256 text NOT NULL CHECK(signature_ink_sha256 ~ '^[a-f0-9]{64}$'),
 ADD CONSTRAINT gkv_monthly_signature_ink_once UNIQUE(tenant_id,signature_ink_sha256);

CREATE FUNCTION care_security.gkv_monthly_verifier_context(p_tenant uuid,p_proof uuid,p_revision integer,p_authority uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.gkv_monthly_proofs; s public.gkv_monthly_proof_series; v_series uuid; authority jsonb;
BEGIN
 IF auth.uid() IS NULL OR care_security.gkv_monthly_writer(p_tenant) IS NOT TRUE THEN
  RAISE EXCEPTION 'Aktive persönliche Beauftragung erforderlich' USING ERRCODE='42501'; END IF;
 SELECT series_id INTO v_series FROM public.gkv_monthly_proofs WHERE tenant_id=p_tenant AND id=p_proof;
 -- Same lock order as the existing edit/confirm/correct command.
 SELECT * INTO s FROM public.gkv_monthly_proof_series WHERE tenant_id=p_tenant AND id=v_series FOR UPDATE;
 SELECT * INTO p FROM public.gkv_monthly_proofs WHERE tenant_id=p_tenant AND id=p_proof FOR UPDATE;
 IF NOT FOUND OR p.status<>'open' OR p.revision IS DISTINCT FROM p_revision THEN
  RAISE EXCEPTION 'Offene Originalfassung wurde geändert' USING ERRCODE='40001'; END IF;
 IF p.content_sha256 IS DISTINCT FROM care_security.gkv_monthly_hash(p.id,p.series_id,p.version,p.payload) THEN
  RAISE EXCEPTION 'Inhaltsbindung der Originalfassung ist ungültig' USING ERRCODE='40001'; END IF;
 PERFORM care_security.gkv_monthly_assert_current_sources(p,s);
 authority:=care_security.gkv_monthly_resolve_authority(p_tenant,p_proof,p_authority);
 RETURN jsonb_build_object('actorId',auth.uid(),'checkedAt',clock_timestamp(),'proof',to_jsonb(p))
  || CASE WHEN authority IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('authority',authority) END;
END $$;
CREATE FUNCTION care_security.gkv_monthly_verified_receipt_status(p_receipt jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r care_security.gkv_monthly_confirmation_receipts;
BEGIN
 IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR octet_length(p_receipt::text)>8000 THEN
  RAISE EXCEPTION 'Ungültige Belegabfrage'; END IF;
 PERFORM care_security.gkv_monthly_verifier_context((p_receipt->>'tenant_id')::uuid,(p_receipt->>'proof_id')::uuid,(p_receipt->>'proof_revision')::integer,CASE WHEN p_receipt->>'signer_role'='representative' THEN (p_receipt->>'authority_reference')::uuid END);
 SELECT * INTO r FROM care_security.gkv_monthly_confirmation_receipts WHERE id=(p_receipt->>'id')::uuid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF r.actor_id IS DISTINCT FROM auth.uid() OR r.consumed_at IS NOT NULL
  OR (to_jsonb(r)-'consumed_at') IS DISTINCT FROM p_receipt THEN
  RAISE EXCEPTION 'Beleg gehört nicht zur offenen Erfassung' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('receiptId',r.id,'captureId',r.capture_id,'proofId',r.proof_id,
  'revision',r.proof_revision,'tenantId',r.tenant_id,'actorId',r.actor_id,'contentSha256',r.content_sha256,
  'originalSha256',r.original_sha256,'signatureSha256',r.signature_sha256);
END $$;

CREATE FUNCTION care_security.gkv_monthly_original_read_context(p_tenant uuid,p_proof uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.gkv_monthly_proofs;
BEGIN
 IF auth.uid() IS NULL OR care_security.gkv_exchange_actor(p_tenant,'office.invoices.view') IS NOT TRUE THEN
  RAISE EXCEPTION 'Persönliche Leseberechtigung erforderlich' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.gkv_monthly_proofs WHERE tenant_id=p_tenant AND id=p_proof;
 IF NOT FOUND OR p.status NOT IN ('final','invalidated') OR p.confirmation->>'kind' IS DISTINCT FROM 'signature'
  OR p.content_sha256 IS DISTINCT FROM care_security.gkv_monthly_hash(p.id,p.series_id,p.version,p.payload) THEN
  RAISE EXCEPTION 'Bestätigte Originalfassung nicht verfügbar' USING ERRCODE='40001'; END IF;
 -- Archive reads use the immutable snapshot, not later edits to its sources.
 RETURN jsonb_build_object('actorId',auth.uid(),'checkedAt',clock_timestamp(),'proof',to_jsonb(p));
END $$;

CREATE FUNCTION care_security.gkv_monthly_accept_verified_receipt(p_receipt jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r care_security.gkv_monthly_confirmation_receipts; previous care_security.gkv_monthly_confirmation_receipts;
 context jsonb; prefix text;
 keys text[]:=ARRAY['id','tenant_id','proof_id','proof_revision','content_sha256','capture_id','actor_id',
  'signer_role','signer_name','authority_reference','original_path','original_version','original_sha256',
  'signature_path','signature_version','signature_sha256','signature_ink_sha256','captured_at','verified_at'];
BEGIN
 IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR octet_length(p_receipt::text)>8000
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_receipt) k WHERE NOT k=ANY(keys))
  OR EXISTS(SELECT 1 FROM unnest(keys) k WHERE NOT p_receipt?k OR (k<>'authority_reference' AND p_receipt->k='null'::jsonb))
  OR jsonb_typeof(p_receipt->'proof_revision') IS DISTINCT FROM 'number' THEN
  RAISE EXCEPTION 'Originalprüfbeleg ist unvollständig'; END IF;
 SELECT * INTO r FROM jsonb_populate_record(NULL::care_security.gkv_monthly_confirmation_receipts,p_receipt);
 context:=care_security.gkv_monthly_verifier_context(r.tenant_id,r.proof_id,r.proof_revision,CASE WHEN r.signer_role='representative' THEN r.authority_reference::uuid END);
 prefix:='tenant/'||r.tenant_id||'/gkv/monthly/'||r.proof_id||'/captures/'||r.capture_id;
 IF r.actor_id IS DISTINCT FROM auth.uid() OR r.content_sha256 IS DISTINCT FROM context->'proof'->>'content_sha256'
  OR NOT ((r.signer_role='patient' AND r.authority_reference IS NULL AND r.signer_name=context->'proof'->'payload'->>'clientName')
   OR (r.signer_role='representative' AND context->'authority' IS NOT NULL
    AND r.authority_reference=context->'authority'->>'id' AND r.signer_name=context->'authority'->>'signer_name'
    AND r.captured_at>=(context->'authority'->>'reviewed_at')::timestamptz AND r.captured_at>=(context->'authority'->>'valid_from')::timestamptz AND r.captured_at<(context->'authority'->>'valid_until')::timestamptz))
  OR r.original_path IS DISTINCT FROM prefix||'/original.pdf' OR r.signature_path IS DISTINCT FROM prefix||'/signature.png'
  OR r.original_version !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  OR r.signature_version !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  OR NOT isfinite(r.captured_at) OR NOT isfinite(r.verified_at)
  OR r.captured_at<(context->'proof'->>'updated_at')::timestamptz OR r.verified_at<r.captured_at
  OR r.verified_at>clock_timestamp() OR r.captured_at<clock_timestamp()-interval '30 minutes' THEN
  RAISE EXCEPTION 'Prüfbeleg gehört nicht zur aktuellen persönlichen Erfassung' USING ERRCODE='40001'; END IF;
 SELECT * INTO previous FROM care_security.gkv_monthly_confirmation_receipts WHERE id=r.id FOR UPDATE;
 IF FOUND THEN
  IF previous.consumed_at IS NOT NULL OR (to_jsonb(previous)-'consumed_at') IS DISTINCT FROM (to_jsonb(r)-'consumed_at') THEN
   RAISE EXCEPTION 'Prüfbeleg wurde bereits anders verwendet' USING ERRCODE='40001'; END IF;
 ELSE
  -- Exact bytes and decoded appearance are independently unique per tenant.
  INSERT INTO care_security.gkv_monthly_confirmation_receipts SELECT r.*;
 END IF;
 RETURN jsonb_build_object('receiptId',r.id,'captureId',r.capture_id,'proofId',r.proof_id,
  'revision',r.proof_revision,'tenantId',r.tenant_id,'actorId',r.actor_id,'contentSha256',r.content_sha256,
  'originalSha256',r.original_sha256,'signatureSha256',r.signature_sha256);
END $$;
-- Narrow private capabilities avoid granting a future verifier raw access to
-- proof/receipt tables. Definer functions check the personal actor and current
-- write delegation or read permission; no runtime role is authorized here.
REVOKE ALL ON FUNCTION care_security.gkv_monthly_verifier_context(uuid,uuid,integer,uuid),
 care_security.gkv_monthly_original_read_context(uuid,uuid),
 care_security.gkv_monthly_verified_receipt_status(jsonb),
 care_security.gkv_monthly_accept_verified_receipt(jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
