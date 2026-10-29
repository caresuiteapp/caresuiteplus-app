-- REVIEW DRAFT. Not a numbered migration and not applied to a connected database.
-- Requires the GKV workspace and canonical Office source verifier. The existing
-- CLI is unavailable here; generate the release migration through the normal CLI.
-- No rollout, automatic delegation, signature verifier or XML export is enabled.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('care_security.gkv_exchange_actor(uuid,text)') IS NULL
 OR to_regprocedure('care_security.office_invoice_assert_source(public.service_records,boolean)') IS NULL THEN
  RAISE EXCEPTION 'Geprüfter Office-/GKV-Quellstand erforderlich';
 END IF;
END $$;

-- Deliberate assignment by the deployment administrator after checking the
-- responsible nurse/deputy. Billing permission alone is not clinical delegation.
CREATE TABLE care_security.gkv_monthly_responsibilities (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), actor_id uuid NOT NULL,
 valid_until timestamptz NOT NULL CHECK(isfinite(valid_until)), revoked_at timestamptz,
 assigned_by uuid NOT NULL, reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 3 AND 1000),
 PRIMARY KEY(tenant_id,actor_id)
);
CREATE TABLE public.gkv_monthly_proof_series (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 client_id uuid NOT NULL REFERENCES public.clients(id), month date NOT NULL,
 service_type text NOT NULL CHECK(service_type ~ '^(0[1-9]|1[0-5])$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(isfinite(month) AND extract(day FROM month)=1), UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,client_id,month,service_type)
);
CREATE TABLE public.gkv_monthly_proofs (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, series_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','final','invalidated')),
 predecessor_id uuid, payload jsonb NOT NULL, content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 confirmation jsonb, finalized_at timestamptz, invalidated_at timestamptz,
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,series_id,version),
 FOREIGN KEY(tenant_id,series_id) REFERENCES public.gkv_monthly_proof_series(tenant_id,id),
 FOREIGN KEY(tenant_id,predecessor_id) REFERENCES public.gkv_monthly_proofs(tenant_id,id),
 CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=2000000),
 CHECK((status='open' AND confirmation IS NULL AND finalized_at IS NULL AND invalidated_at IS NULL)
 OR (status='final' AND confirmation IS NOT NULL AND finalized_at IS NOT NULL AND invalidated_at IS NULL)
 OR (status='invalidated' AND confirmation IS NOT NULL AND finalized_at IS NOT NULL AND invalidated_at IS NOT NULL))
);
-- Enforces one current version even when requests race or have different IDs.
CREATE UNIQUE INDEX gkv_monthly_one_current ON public.gkv_monthly_proofs(tenant_id,series_id) WHERE status<>'invalidated';
CREATE INDEX gkv_monthly_proofs_history ON public.gkv_monthly_proofs(tenant_id,series_id,version DESC);
CREATE TABLE public.gkv_monthly_proof_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, proof_id uuid NOT NULL,
 actor_id uuid NOT NULL, action text NOT NULL, before_state jsonb, after_state jsonb NOT NULL,
 reason text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,proof_id) REFERENCES public.gkv_monthly_proofs(tenant_id,id)
);
CREATE INDEX gkv_monthly_events_scope ON public.gkv_monthly_proof_events(tenant_id,proof_id,created_at,id);
-- Until a reviewed per-task split exists, import whole canonical records only.
-- A record cannot be counted again under another monthly service type.
CREATE TABLE care_security.gkv_monthly_source_claims (
 tenant_id uuid NOT NULL, record_id uuid NOT NULL REFERENCES public.service_records(id), series_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,record_id),
 FOREIGN KEY(tenant_id,series_id) REFERENCES public.gkv_monthly_proof_series(tenant_id,id)
);
CREATE TABLE care_security.gkv_monthly_requests (
 tenant_id uuid NOT NULL, request_id uuid NOT NULL, actor_id uuid NOT NULL, request_sha256 text NOT NULL,
 proof_id uuid NOT NULL, PRIMARY KEY(tenant_id,request_id),
 FOREIGN KEY(tenant_id,proof_id) REFERENCES public.gkv_monthly_proofs(tenant_id,id)
);
-- Trust boundary: only an independently reviewed original-byte verifier may
-- produce these rows. No public/worker grant or metadata-only producer is added.
-- A receipt must follow a fresh per-proof capture, verify immutable stored bytes
-- of both the displayed original and signature, and validate representative authority.
CREATE TABLE care_security.gkv_monthly_confirmation_receipts (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, proof_id uuid NOT NULL, proof_revision integer NOT NULL,
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
 capture_id uuid NOT NULL UNIQUE, actor_id uuid NOT NULL,
 signer_role text NOT NULL CHECK(signer_role IN ('patient','representative')),
 signer_name text NOT NULL CHECK(length(btrim(signer_name)) BETWEEN 2 AND 300),
 authority_reference text,
 original_path text NOT NULL, original_version text NOT NULL CHECK(length(original_version)>0),
 original_sha256 text NOT NULL CHECK(original_sha256 ~ '^[a-f0-9]{64}$'),
 signature_path text NOT NULL, signature_version text NOT NULL CHECK(length(signature_version)>0),
 signature_sha256 text NOT NULL CHECK(signature_sha256 ~ '^[a-f0-9]{64}$'),
 captured_at timestamptz NOT NULL, verified_at timestamptz NOT NULL, consumed_at timestamptz,
 CHECK(isfinite(captured_at) AND isfinite(verified_at) AND verified_at>=captured_at),
 CHECK(signer_role='patient' OR length(btrim(authority_reference))>=3 AND authority_reference IS NOT NULL),
 UNIQUE(tenant_id,signature_sha256), UNIQUE(tenant_id,original_path), UNIQUE(tenant_id,signature_path),
 FOREIGN KEY(tenant_id,proof_id) REFERENCES public.gkv_monthly_proofs(tenant_id,id)
);

CREATE FUNCTION care_security.gkv_monthly_writer(p_tenant uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(care_security.gkv_exchange_actor(p_tenant,'office.invoices.view')
  AND care_security.gkv_exchange_actor(p_tenant,'office.invoices.create')
  AND EXISTS(SELECT 1 FROM care_security.gkv_monthly_responsibilities r
    WHERE r.tenant_id=p_tenant AND r.actor_id=auth.uid() AND r.revoked_at IS NULL AND r.valid_until>now()),false)
$$;

-- Reads original identities and receipts from canonical records. There is no
-- caller-supplied employee, source hash, signature, or claimed source attestation.
CREATE FUNCTION care_security.gkv_monthly_payload(p_series public.gkv_monthly_proof_series,p_ids uuid[]) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s public.service_records; e public.employees; c public.clients; proof public.assist_visit_proofs;
 v_id uuid; v_rows jsonb:='[]'; v_tasks jsonb; v_description text;
BEGIN
 IF coalesce(cardinality(p_ids),0) NOT BETWEEN 1 AND 500 OR array_position(p_ids,NULL) IS NOT NULL
 OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x) THEN RAISE EXCEPTION 'Eindeutige Leistungsreferenzen erforderlich'; END IF;
 SELECT * INTO c FROM public.clients WHERE tenant_id=p_series.tenant_id AND id=p_series.client_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Klientenakte nicht verfügbar' USING ERRCODE='42501'; END IF;
 FOR v_id IN SELECT x FROM unnest(p_ids) x ORDER BY x LOOP
  SELECT * INTO s FROM public.service_records WHERE tenant_id=p_series.tenant_id AND id=v_id FOR SHARE;
  IF NOT FOUND OR s.client_id IS DISTINCT FROM p_series.client_id OR s.employee_id IS NULL
  OR s.updated_at IS NULL OR NOT isfinite(s.updated_at) OR s.service_date IS NULL OR NOT isfinite(s.service_date)
  OR s.service_date<p_series.month OR s.service_date>=(p_series.month+interval '1 month')::date
  OR coalesce(s.status::text,'') NOT IN ('approved','billable','billed')
  OR s.actual_minutes IS NULL OR s.actual_minutes<=0 THEN
   RAISE EXCEPTION 'Geprüfte Leistung dieses Klienten und Monats erforderlich' USING ERRCODE='40001';
  END IF;
  PERFORM care_security.office_invoice_assert_source(s,true);
  IF s.source_receipt->>'employee_id' IS DISTINCT FROM s.employee_id::text
  OR s.source_receipt->>'client_id' IS DISTINCT FROM s.client_id::text
  OR s.source_receipt->>'tenant_id' IS DISTINCT FROM s.tenant_id::text THEN
   RAISE EXCEPTION 'Ursprüngliche Personenbindung fehlt' USING ERRCODE='40001';
  END IF;
  SELECT * INTO e FROM public.employees WHERE tenant_id=p_series.tenant_id AND id=s.employee_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ursprüngliche Pflegekraft nicht verfügbar' USING ERRCODE='40001'; END IF;
  SELECT * INTO proof FROM public.assist_visit_proofs WHERE tenant_id=p_series.tenant_id
   AND id::text=s.source_receipt->>'proof_id' FOR SHARE;
  IF NOT FOUND OR proof.payload_hash IS DISTINCT FROM s.source_receipt->>'proof_payload_hash'
   OR proof.visit_id::text IS DISTINCT FROM s.source_receipt->>'visit_id'
   OR jsonb_typeof(proof.payload_snapshot->'tasks') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Kanonische Leistungsbeschreibung fehlt; Altbelege werden noch nicht übernommen' USING ERRCODE='40001';
  END IF;
  v_description:=btrim(coalesce(proof.payload_snapshot->>'documentationNote',proof.payload_snapshot->>'documentation'));
  IF coalesce(length(v_description),0)=0 THEN RAISE EXCEPTION 'Bestätigte Leistungsbeschreibung fehlt' USING ERRCODE='40001'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',t->>'id','title',t->>'title','status',t->>'status',
   'completionNote',coalesce(t->>'completionNote',t->>'note')) ORDER BY n),'[]') INTO v_tasks
   FROM jsonb_array_elements(proof.payload_snapshot->'tasks') WITH ORDINALITY a(t,n);
  v_rows:=v_rows||jsonb_build_array(jsonb_build_object('recordId',s.id,'updatedAt',s.updated_at,
   'serviceDate',s.service_date,'employeeId',s.employee_id,'employeeName',btrim(e.first_name||' '||e.last_name),
   'actualMinutes',s.actual_minutes,'description',v_description,'tasks',v_tasks,'sourceReceipt',s.source_receipt));
 END LOOP;
 RETURN jsonb_build_object('schema','gkv-monthly-source-v1','tenantId',p_series.tenant_id,'clientId',c.id,
  'clientName',btrim(c.first_name||' '||c.last_name),'month',to_char(p_series.month,'YYYY-MM'),
  'serviceType',p_series.service_type,'records',v_rows);
END $$;
CREATE FUNCTION care_security.gkv_monthly_claim_sources(s public.gkv_monthly_proof_series,ids uuid[]) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_record_id uuid;
BEGIN
 DELETE FROM care_security.gkv_monthly_source_claims c WHERE c.tenant_id=s.tenant_id AND c.series_id=s.id AND NOT c.record_id=ANY(ids);
 FOR v_record_id IN SELECT x FROM unnest(ids) x ORDER BY x LOOP
  INSERT INTO care_security.gkv_monthly_source_claims VALUES(s.tenant_id,v_record_id,s.id) ON CONFLICT DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM care_security.gkv_monthly_source_claims c WHERE c.tenant_id=s.tenant_id AND c.record_id=v_record_id AND c.series_id=s.id) THEN
   RAISE EXCEPTION 'Leistung ist bereits einem anderen Monatsnachweis zugeordnet' USING ERRCODE='40001';
  END IF;
 END LOOP;
END $$;
CREATE FUNCTION care_security.gkv_monthly_hash(p_id uuid,p_series uuid,p_version integer,p_payload jsonb) RETURNS text
 LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('proofId',p_id,'seriesId',p_series,
  'version',p_version,'payload',p_payload)::text,'UTF8')),'hex')
$$;
CREATE FUNCTION care_security.gkv_monthly_assert_current_sources(p public.gkv_monthly_proofs,s public.gkv_monthly_proof_series) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ids uuid[];
BEGIN
 SELECT array_agg((r->>'recordId')::uuid ORDER BY r->>'recordId') INTO ids FROM jsonb_array_elements(p.payload->'records') r;
 IF care_security.gkv_monthly_payload(s,ids) IS DISTINCT FROM (p.payload-'xmlFacts') THEN
  RAISE EXCEPTION 'Quellen wurden geändert. Monatsnachweis erneut abgleichen' USING ERRCODE='40001';
 END IF;
 IF p.payload?'xmlFacts' THEN
  IF care_security.gkv_monthly_build_facts(p,(p.payload->'xmlFacts'->>'responsibleActorId')::uuid,
    (p.payload->'xmlFacts'->>'boundAt')::timestamptz) IS DISTINCT FROM p.payload->'xmlFacts' THEN
   RAISE EXCEPTION 'Fachangaben wurden geändert. Erneut übernehmen und persönlich bestätigen' USING ERRCODE='40001';
  END IF;
 END IF;
END $$;

CREATE FUNCTION care_security.gkv_monthly_proof_command(p_tenant_id uuid,p_request_id uuid,p_action text,p_input jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.gkv_monthly_proofs; old public.gkv_monthly_proofs; s public.gkv_monthly_proof_series;
 request care_security.gkv_monthly_requests; receipt care_security.gkv_monthly_confirmation_receipts;
 v_hash text; v_ids uuid[]; v_keys text[]; v_payload jsonb; v_reason text; v_before jsonb; v_id uuid;
BEGIN
 IF care_security.gkv_monthly_writer(p_tenant_id) IS NOT TRUE THEN RAISE EXCEPTION 'Aktive Beauftragung der verantwortlichen Pflegefachperson erforderlich' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_action IS NULL OR p_action NOT IN ('create','replace_sources','freeze_facts','confirm','finalize_missing','correct')
 OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>50000 THEN RAISE EXCEPTION 'Ungültiger Monatsnachweisauftrag'; END IF;
 v_keys:=CASE p_action WHEN 'create' THEN ARRAY['new_id','client_id','month','service_type','source_ids']
 WHEN 'replace_sources' THEN ARRAY['id','revision','source_ids','reason']
 WHEN 'freeze_facts' THEN ARRAY['id','revision']
 WHEN 'confirm' THEN ARRAY['id','revision','content_sha256','receipt_id']
 WHEN 'finalize_missing' THEN ARRAY['id','revision','content_sha256','reason']
 ELSE ARRAY['id','revision','new_id','reason'] END;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE NOT k=ANY(v_keys))
 OR EXISTS(SELECT 1 FROM unnest(v_keys) k WHERE NOT p_input?k OR p_input->k='null'::jsonb) THEN RAISE EXCEPTION 'Auftragsfelder fehlen oder sind unbekannt'; END IF;
 v_hash:=encode(sha256(convert_to(p_action||':'||p_input::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':monthly-request:'||p_request_id,0));
 SELECT * INTO request FROM care_security.gkv_monthly_requests WHERE tenant_id=p_tenant_id AND request_id=p_request_id;
 IF FOUND THEN
  IF request.actor_id<>auth.uid() OR request.request_sha256<>v_hash THEN RAISE EXCEPTION 'Auftragskennung bereits anders verwendet'; END IF;
  -- Return the current stored status, never resurrect a former final response.
  SELECT * INTO p FROM public.gkv_monthly_proofs WHERE tenant_id=p_tenant_id AND id=request.proof_id;
  RETURN to_jsonb(p)||jsonb_build_object('replayed',true);
 END IF;
 IF p_action IN ('create','replace_sources') THEN
  IF jsonb_typeof(p_input->'source_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'source_ids')>500
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_input->'source_ids') x WHERE jsonb_typeof(x)<>'string') THEN RAISE EXCEPTION 'Leistungsreferenzen fehlen'; END IF;
  SELECT array_agg(x::uuid) INTO v_ids FROM jsonb_array_elements_text(p_input->'source_ids') x;
 END IF;
 IF p_action='create' THEN
  IF p_input->>'month' !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' OR p_input->>'service_type' !~ '^(0[1-9]|1[0-5])$' THEN RAISE EXCEPTION 'Monat oder Leistungsart ungültig'; END IF;
  -- Same logical document is serialized regardless of caller-selected IDs.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id||':monthly:'||(p_input->>'client_id')||':'||(p_input->>'month')||':'||(p_input->>'service_type'),0));
  IF EXISTS(SELECT 1 FROM public.gkv_monthly_proof_series WHERE tenant_id=p_tenant_id AND client_id=(p_input->>'client_id')::uuid
    AND month=(p_input->>'month'||'-01')::date AND service_type=p_input->>'service_type') THEN
   RAISE EXCEPTION 'Monatsnachweis bereits vorhanden. Gespeicherte Fassung verwenden' USING ERRCODE='40001'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clients WHERE tenant_id=p_tenant_id AND id=(p_input->>'client_id')::uuid) THEN RAISE EXCEPTION 'Fremde Klientenzuordnung' USING ERRCODE='42501'; END IF;
  INSERT INTO public.gkv_monthly_proof_series(tenant_id,client_id,month,service_type)
   VALUES(p_tenant_id,(p_input->>'client_id')::uuid,(p_input->>'month'||'-01')::date,p_input->>'service_type') RETURNING * INTO s;
  v_payload:=care_security.gkv_monthly_payload(s,v_ids);
  PERFORM care_security.gkv_monthly_claim_sources(s,v_ids); v_id:=(p_input->>'new_id')::uuid;
  INSERT INTO public.gkv_monthly_proofs(id,tenant_id,series_id,version,payload,content_sha256,created_by)
   VALUES(v_id,p_tenant_id,s.id,1,v_payload,care_security.gkv_monthly_hash(v_id,s.id,1,v_payload),auth.uid()) RETURNING * INTO p;
 ELSE
  SELECT series_id INTO v_id FROM public.gkv_monthly_proofs WHERE tenant_id=p_tenant_id AND id=(p_input->>'id')::uuid;
  SELECT * INTO s FROM public.gkv_monthly_proof_series WHERE tenant_id=p_tenant_id AND id=v_id FOR UPDATE;
  SELECT * INTO p FROM public.gkv_monthly_proofs WHERE tenant_id=p_tenant_id AND id=(p_input->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR p.revision IS DISTINCT FROM (p_input->>'revision')::integer THEN RAISE EXCEPTION 'Fassung wurde geändert. Bitte neu laden' USING ERRCODE='40001'; END IF;
  v_before:=to_jsonb(p); v_reason:=btrim(p_input->>'reason');
  IF p_action IN ('correct','replace_sources','finalize_missing') AND (v_reason IS NULL OR length(v_reason) NOT BETWEEN 3 AND 2000) THEN RAISE EXCEPTION 'Nachvollziehbare Begründung erforderlich'; END IF;
  IF p_action='correct' THEN
   IF p.status<>'final' THEN RAISE EXCEPTION 'Nur endgültige Fassung darf korrigiert werden'; END IF;
   old:=p; v_id:=(p_input->>'new_id')::uuid;
   UPDATE public.gkv_monthly_proofs SET status='invalidated',revision=revision+1,invalidated_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id=p.id RETURNING * INTO old;
   INSERT INTO public.gkv_monthly_proof_events(tenant_id,proof_id,actor_id,action,before_state,after_state,reason)
    VALUES(p_tenant_id,old.id,auth.uid(),'invalidate_for_correction',v_before,to_jsonb(old),v_reason);
   -- Copy confirmed data, not confirmation, image, receipt, or XML/signature state.
   INSERT INTO public.gkv_monthly_proofs(id,tenant_id,series_id,version,predecessor_id,payload,content_sha256,created_by)
    VALUES(v_id,p_tenant_id,s.id,p.version+1,p.id,p.payload,care_security.gkv_monthly_hash(v_id,s.id,p.version+1,p.payload),auth.uid()) RETURNING * INTO p;
   v_before:=NULL;
  ELSE
   IF p.status<>'open' THEN RAISE EXCEPTION 'Endgültige oder ungültige Fassung ist gesperrt'; END IF;
   IF p_action='replace_sources' THEN
    v_payload:=care_security.gkv_monthly_payload(s,v_ids);
    PERFORM care_security.gkv_monthly_claim_sources(s,v_ids);
    UPDATE public.gkv_monthly_proofs SET payload=v_payload,content_sha256=care_security.gkv_monthly_hash(p.id,s.id,p.version,v_payload),
     revision=revision+1,updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
   ELSIF p_action='freeze_facts' THEN
    SELECT array_agg((r->>'recordId')::uuid) INTO v_ids FROM jsonb_array_elements(p.payload->'records') r;
    IF care_security.gkv_monthly_payload(s,v_ids) IS DISTINCT FROM (p.payload-'xmlFacts') THEN
     RAISE EXCEPTION 'Leistungsquellen zuerst abgleichen' USING ERRCODE='40001';
    END IF;
    v_payload:=(p.payload-'xmlFacts')||jsonb_build_object('xmlFacts',care_security.gkv_monthly_freeze_facts(p));
    UPDATE public.gkv_monthly_proofs SET payload=v_payload,content_sha256=care_security.gkv_monthly_hash(p.id,s.id,p.version,v_payload),
     revision=revision+1,updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
   ELSE
    IF p_input->>'content_sha256' IS DISTINCT FROM p.content_sha256 THEN RAISE EXCEPTION 'Bestätigung gehört zu einer anderen Originalfassung' USING ERRCODE='40001'; END IF;
    PERFORM care_security.gkv_monthly_assert_current_sources(p,s);
    IF p_action='confirm' THEN
     SELECT * INTO receipt FROM care_security.gkv_monthly_confirmation_receipts WHERE tenant_id=p_tenant_id AND id=(p_input->>'receipt_id')::uuid FOR UPDATE;
     IF NOT FOUND OR receipt.proof_id<>p.id OR receipt.proof_revision<>p.revision OR receipt.content_sha256<>p.content_sha256
      OR receipt.actor_id<>auth.uid() OR receipt.consumed_at IS NOT NULL OR receipt.captured_at<p.updated_at
      OR receipt.verified_at>clock_timestamp() OR receipt.verified_at<clock_timestamp()-interval '30 minutes'
      OR receipt.signature_path IS DISTINCT FROM 'tenant/'||p_tenant_id||'/gkv/monthly/'||p.id||'/captures/'||receipt.capture_id||'/signature.png'
      OR receipt.original_path IS DISTINCT FROM 'tenant/'||p_tenant_id||'/gkv/monthly/'||p.id||'/captures/'||receipt.capture_id||'/original.pdf' THEN
      RAISE EXCEPTION 'Frische, originalgebundene Bestätigung fehlt'; END IF;
     UPDATE care_security.gkv_monthly_confirmation_receipts SET consumed_at=clock_timestamp() WHERE id=receipt.id;
     p.confirmation:=jsonb_build_object('kind','signature','receiptId',receipt.id,'captureId',receipt.capture_id,
      'signerRole',receipt.signer_role,'signerName',receipt.signer_name,'authorityReference',receipt.authority_reference,
      'contentSha256',receipt.content_sha256,'originalPath',receipt.original_path,'originalVersion',receipt.original_version,
      'originalSha256',receipt.original_sha256,'signaturePath',receipt.signature_path,'signatureVersion',receipt.signature_version,
      'signatureSha256',receipt.signature_sha256,'capturedAt',receipt.captured_at,'verifiedAt',receipt.verified_at);
     IF to_regprocedure('care_security.gkv_monthly_receipt_paper(uuid)') IS NOT NULL THEN
      p.confirmation:=p.confirmation||care_security.gkv_monthly_receipt_paper(receipt.id);
     END IF;
    ELSE
     -- This is an explicit missing-signature exception, never a deferred portal signature.
     p.confirmation:=jsonb_build_object('kind','missing_signature','reason',v_reason,'recordedBy',auth.uid(),'contentSha256',p.content_sha256);
    END IF;
    UPDATE public.gkv_monthly_proofs SET status='final',confirmation=p.confirmation,finalized_at=clock_timestamp(),
     revision=revision+1,updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
   END IF;
  END IF;
 END IF;
 INSERT INTO public.gkv_monthly_proof_events(tenant_id,proof_id,actor_id,action,before_state,after_state,reason)
  VALUES(p_tenant_id,p.id,auth.uid(),p_action,v_before,to_jsonb(p),v_reason);
 INSERT INTO care_security.gkv_monthly_requests(tenant_id,request_id,actor_id,request_sha256,proof_id)
  VALUES(p_tenant_id,p_request_id,auth.uid(),v_hash,p.id);
 RETURN to_jsonb(p)||jsonb_build_object('replayed',false);
END $$;

CREATE FUNCTION public.gkv_monthly_proof_command(p_tenant_id uuid,p_request_id uuid,p_action text,p_input jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT care_security.gkv_monthly_proof_command(p_tenant_id,p_request_id,p_action,p_input)
$$;
DO $$ DECLARE name text; f regprocedure; BEGIN
 FOREACH name IN ARRAY ARRAY['gkv_monthly_proof_series','gkv_monthly_proofs','gkv_monthly_proof_events'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',name);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',name);
  EXECUTE format('CREATE POLICY gkv_monthly_read ON public.%I FOR SELECT TO authenticated USING(care_security.gkv_exchange_actor(tenant_id,''office.invoices.view''))',name);
 END LOOP;
 FOREACH name IN ARRAY ARRAY['gkv_monthly_responsibilities','gkv_monthly_requests','gkv_monthly_confirmation_receipts','gkv_monthly_source_claims'] LOOP
  EXECUTE format('ALTER TABLE care_security.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('REVOKE ALL ON care_security.%I FROM PUBLIC,anon,authenticated,service_role',name);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('care_security','public') AND p.proname IN ('gkv_monthly_writer','gkv_monthly_payload','gkv_monthly_claim_sources','gkv_monthly_hash','gkv_monthly_assert_current_sources','gkv_monthly_proof_command') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION care_security.gkv_monthly_proof_command(uuid,uuid,text,jsonb),public.gkv_monthly_proof_command(uuid,uuid,text,jsonb) TO authenticated;
COMMIT;
