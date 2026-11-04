-- Review draft 10. Apply only with the compatible monthly drafts. No backfill.
-- A correction of the narrative is a new employee statement. Neither the old
-- signature nor the actual service facts are transferred to that statement.
BEGIN;
CREATE TABLE care_security.gkv_assist_amendments (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 assignment_id uuid NOT NULL, proof_id uuid NOT NULL REFERENCES care_security.gkv_assist_originals(proof_id),
 proof_hash text NOT NULL CHECK(proof_hash ~ '^sha256:[0-9a-f]{64}$'),
 revision integer NOT NULL CHECK(revision>0), previous_id uuid,
 actor_id uuid NOT NULL, employee_id uuid NOT NULL, session_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL CHECK(isfinite(recorded_at)),
 description text NOT NULL CHECK(length(description) BETWEEN 3 AND 1500),
 reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 400),
 UNIQUE(tenant_id,proof_id,revision), UNIQUE(tenant_id,proof_id,id),
 FOREIGN KEY(tenant_id,proof_id,previous_id) REFERENCES care_security.gkv_assist_amendments(tenant_id,proof_id,id),
 CHECK((revision=1)=(previous_id IS NULL))
);
ALTER TABLE care_security.gkv_assist_amendments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.gkv_assist_amendments FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER gkv_assist_amendment_immutable BEFORE UPDATE OR DELETE ON care_security.gkv_assist_amendments
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_employee_immutable();
CREATE INDEX gkv_monthly_current_amendment_sources ON public.gkv_monthly_proofs
 USING gin ((payload->'records') jsonb_path_ops) WHERE status IN ('open','final');

CREATE FUNCTION care_security.gkv_assist_amendment_json(a care_security.gkv_assist_amendments)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',a.id,'proofId',a.proof_id,'proofHash',a.proof_hash,'revision',a.revision,
  'previousId',a.previous_id,'actorId',a.actor_id,'employeeId',a.employee_id,'recordedAt',a.recorded_at,
  'description',a.description,'reason',a.reason)
$$;
CREATE OR REPLACE FUNCTION care_security.gkv_assist_monthly_amendment(t uuid,p_id uuid,h text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a care_security.gkv_assist_amendments;
BEGIN
 SELECT * INTO a FROM care_security.gkv_assist_amendments WHERE tenant_id=t AND proof_id=p_id ORDER BY revision DESC LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF h IS DISTINCT FROM a.proof_hash THEN RAISE EXCEPTION 'Berichtigung gehört zu einer anderen Originalfassung' USING ERRCODE='40001'; END IF;
 RETURN care_security.gkv_assist_amendment_json(a);
END $$;

CREATE FUNCTION care_security.gkv_assist_amendment_state(t uuid,a_id uuid,p_before integer,p_lookup uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb; o uuid; h text; original_text text; entries jsonb; latest integer; matched jsonb; cursor_value integer;
BEGIN
 PERFORM care_security.gkv_monthly_live_session();
 IF NOT EXISTS(SELECT 1 FROM care_security.gkv_assist_originals WHERE tenant_id=t AND assignment_id=a_id AND actor_id=auth.uid()) THEN
  RAISE EXCEPTION 'Persönliche Originalfassung erforderlich' USING ERRCODE='42501'; END IF;
 -- Wait for a write which may have committed after the client lost its reply.
 PERFORM pg_advisory_xact_lock_shared(hashtextextended(t::text||':gkv-assist-amendment',0));
 c:=care_security.gkv_assist_original_context(t,a_id);
 IF c->>'phase' IS DISTINCT FROM 'sealed' THEN RAISE EXCEPTION 'Persönlicher Originalabschluss fehlt' USING ERRCODE='40001'; END IF;
 o:=(c#>>'{original,proofId}')::uuid; h:=c#>>'{original,payloadHash}';
 SELECT btrim(coalesce(payload_snapshot->>'documentationNote',payload_snapshot->>'documentation')) INTO STRICT original_text
  FROM public.assist_visit_proofs WHERE tenant_id=t AND id=o AND payload_hash=h;
 SELECT coalesce(max(revision),0) INTO latest FROM care_security.gkv_assist_amendments WHERE tenant_id=t AND proof_id=o;
 IF p_before IS NOT NULL AND (p_before<2 OR p_before>latest) THEN RAISE EXCEPTION 'Ungültige Verlaufsseite' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(care_security.gkv_assist_amendment_json(s.item) ORDER BY (s.item).revision DESC),'[]'),min((s.item).revision)
  INTO entries,cursor_value FROM (SELECT a AS item FROM care_security.gkv_assist_amendments a
   WHERE tenant_id=t AND proof_id=o AND (p_before IS NULL OR revision<p_before) ORDER BY revision DESC LIMIT 10) s;
 SELECT care_security.gkv_assist_amendment_json(a) INTO matched FROM care_security.gkv_assist_amendments a
  WHERE tenant_id=t AND proof_id=o AND id=p_lookup AND actor_id=auth.uid();
 RETURN jsonb_build_object('contract','gkv-assist-amendments-v1','tenantId',t,'assignmentId',a_id,'employeeId',c->>'employeeId',
  'actorId',auth.uid(),'proofId',o,'proofHash',h,'originalText',original_text,'revision',latest,
  'before',p_before,'nextBefore',CASE WHEN cursor_value>1 THEN cursor_value END,'entries',entries,'lookup',matched);
END $$;

-- Update only months that actually contain this exact original. Preserve the
-- complete final predecessor and its archive; never reuse an open capture,
-- receipt, freeze, confirmation, or signature in the replacement.
CREATE FUNCTION care_security.gkv_assist_amend_months(a care_security.gkv_assist_amendments) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.gkv_monthly_proofs; saved public.gkv_monthly_proofs; before_state jsonb; records jsonb;
 payload_new jsonb; id_new uuid; amendment jsonb:=care_security.gkv_assist_amendment_json(a);
BEGIN
 FOR p IN SELECT m.* FROM public.gkv_monthly_proofs m WHERE m.tenant_id=a.tenant_id AND m.status IN ('open','final')
  AND (m.payload->'records') @> jsonb_build_array(jsonb_build_object('sourceReceipt',jsonb_build_object('proof_id',a.proof_id)))
  ORDER BY m.series_id,m.id FOR UPDATE LOOP
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p.payload->'records') r WHERE r#>>'{sourceReceipt,proof_id}'=a.proof_id::text
   AND (r#>>'{sourceReceipt,proof_payload_hash}' IS DISTINCT FROM a.proof_hash OR r->>'employeeId' IS DISTINCT FROM a.employee_id::text)) THEN
   RAISE EXCEPTION 'Gespeicherte Monatsquelle widerspricht dem Original' USING ERRCODE='40001'; END IF;
  SELECT jsonb_agg(CASE WHEN r#>>'{sourceReceipt,proof_id}'=a.proof_id::text THEN r||jsonb_build_object('amendment',amendment)
   ELSE r END ORDER BY n) INTO records FROM jsonb_array_elements(p.payload->'records') WITH ORDINALITY x(r,n);
  payload_new:=(p.payload-'xmlFacts')||jsonb_build_object('schema','gkv-monthly-amended-source-v1','records',records); before_state:=to_jsonb(p);
  IF p.status='final' THEN
   UPDATE public.gkv_monthly_proofs SET status='invalidated',revision=revision+1,invalidated_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id=p.id RETURNING * INTO saved;
   INSERT INTO public.gkv_monthly_proof_events(tenant_id,proof_id,actor_id,action,before_state,after_state,reason)
    VALUES(a.tenant_id,p.id,a.actor_id,'invalidate_for_amendment',before_state,to_jsonb(saved),a.reason);
   id_new:=gen_random_uuid();
   INSERT INTO public.gkv_monthly_proofs(id,tenant_id,series_id,version,predecessor_id,payload,content_sha256,created_by)
    VALUES(id_new,a.tenant_id,p.series_id,p.version+1,p.id,payload_new,
     care_security.gkv_monthly_hash(id_new,p.series_id,p.version+1,payload_new),a.actor_id) RETURNING * INTO saved;
   before_state:=NULL;
  ELSE
   UPDATE public.gkv_monthly_proofs SET revision=revision+1,payload=payload_new,
    content_sha256=care_security.gkv_monthly_hash(p.id,p.series_id,p.version,payload_new),updated_at=clock_timestamp()
    WHERE id=p.id RETURNING * INTO saved;
  END IF;
  INSERT INTO public.gkv_monthly_proof_events(tenant_id,proof_id,actor_id,action,before_state,after_state,reason)
   VALUES(a.tenant_id,saved.id,a.actor_id,'assist_description_amended',before_state,to_jsonb(saved),a.reason);
 END LOOP;
END $$;

CREATE FUNCTION care_security.gkv_assist_amend_description(t uuid,a_id uuid,p_request uuid,p_input jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb; o uuid; h text; current_a care_security.gkv_assist_amendments; a care_security.gkv_assist_amendments;
 original_text text; new_text text:=p_input->>'description'; why text:=p_input->>'reason'; employee uuid; sid uuid;
 trim_chars text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
 sid:=care_security.gkv_monthly_live_session();
 IF NOT EXISTS(SELECT 1 FROM care_security.gkv_assist_originals WHERE tenant_id=t AND assignment_id=a_id AND actor_id=auth.uid()) THEN
  RAISE EXCEPTION 'Nur die ursprünglich eingesetzte Pflegekraft darf berichtigen' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>10000 THEN
  RAISE EXCEPTION 'Ungültiger Berichtigungsauftrag' USING ERRCODE='22023'; END IF;
 IF NOT (p_input ?& ARRAY['proofId','proofHash','revision','previousId','description','reason'])
  OR (SELECT count(*) FROM jsonb_object_keys(p_input))<>6
  OR jsonb_typeof(p_input->'description') IS DISTINCT FROM 'string' OR jsonb_typeof(p_input->'reason') IS DISTINCT FROM 'string'
  OR length(new_text) NOT BETWEEN 3 AND 1500 OR new_text<>btrim(new_text,trim_chars)
  OR length(why) NOT BETWEEN 5 AND 400 OR why<>btrim(why,trim_chars)
  OR (new_text||why) ~ U&'[\007F-\009F\061C\200B-\200F\2028-\202E\2060-\206F\FEFF]'
  OR replace(new_text,chr(10),'')~'[[:cntrl:]]' OR replace(why,chr(10),'')~'[[:cntrl:]]' THEN
  RAISE EXCEPTION 'Berichtigte Beschreibung und nachvollziehbare Begründung erforderlich' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':gkv-assist-amendment',0));
 c:=care_security.gkv_assist_original_context(t,a_id);
 IF c->>'phase' IS DISTINCT FROM 'sealed' THEN RAISE EXCEPTION 'Original nicht abgeschlossen' USING ERRCODE='40001'; END IF;
 o:=(c#>>'{original,proofId}')::uuid; h:=c#>>'{original,payloadHash}'; employee:=(c->>'employeeId')::uuid;
 IF p_input->'proofId' IS DISTINCT FROM to_jsonb(o) OR p_input->'proofHash' IS DISTINCT FROM to_jsonb(h) THEN
  RAISE EXCEPTION 'Andere Originalfassung' USING ERRCODE='40001'; END IF;
 SELECT * INTO a FROM care_security.gkv_assist_amendments WHERE id=p_request;
 IF FOUND THEN
  IF a.tenant_id<>t OR a.proof_id<>o OR a.actor_id<>auth.uid() OR a.description<>new_text OR a.reason<>why
   OR p_input->'revision' IS DISTINCT FROM to_jsonb(a.revision-1)
   OR p_input->'previousId' IS DISTINCT FROM coalesce(to_jsonb(a.previous_id),'null'::jsonb) THEN
   RAISE EXCEPTION 'Auftragskennung anders verwendet' USING ERRCODE='40001'; END IF;
  RETURN care_security.gkv_assist_amendment_json(a);
 END IF;
 SELECT * INTO current_a FROM care_security.gkv_assist_amendments WHERE tenant_id=t AND proof_id=o ORDER BY revision DESC LIMIT 1;
 SELECT btrim(coalesce(payload_snapshot->>'documentationNote',payload_snapshot->>'documentation')) INTO STRICT original_text
  FROM public.assist_visit_proofs WHERE tenant_id=t AND id=o AND payload_hash=h;
 IF p_input->'revision' IS DISTINCT FROM to_jsonb(coalesce(current_a.revision,0))
  OR p_input->'previousId' IS DISTINCT FROM coalesce(to_jsonb(current_a.id),'null'::jsonb) THEN
  RAISE EXCEPTION 'Berichtigungsstand hat sich geändert' USING ERRCODE='40001'; END IF;
 IF new_text=coalesce(current_a.description,original_text) THEN RAISE EXCEPTION 'Beschreibung ist unverändert' USING ERRCODE='22023'; END IF;
 INSERT INTO care_security.gkv_assist_amendments VALUES(p_request,t,a_id,o,h,coalesce(current_a.revision,0)+1,current_a.id,
  auth.uid(),employee,sid,clock_timestamp(),new_text,why) RETURNING * INTO a;
 PERFORM care_security.gkv_assist_amend_months(a);
 RETURN care_security.gkv_assist_amendment_json(a);
END $$;

CREATE FUNCTION public.gkv_assist_amendment_state(t uuid,a_id uuid,p_before integer DEFAULT NULL,p_lookup uuid DEFAULT NULL) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_assist_amendment_state(t,a_id,p_before,p_lookup) $$;
CREATE FUNCTION public.gkv_assist_amend_description(t uuid,a_id uuid,p_request uuid,p_input jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT care_security.gkv_assist_amend_description(t,a_id,p_request,p_input) $$;
REVOKE ALL ON FUNCTION care_security.gkv_assist_monthly_amendment(uuid,uuid,text),
 care_security.gkv_assist_amendment_json(care_security.gkv_assist_amendments),care_security.gkv_assist_amend_months(care_security.gkv_assist_amendments),
 care_security.gkv_assist_amendment_state(uuid,uuid,integer,uuid),public.gkv_assist_amendment_state(uuid,uuid,integer,uuid),
 care_security.gkv_assist_amend_description(uuid,uuid,uuid,jsonb),public.gkv_assist_amend_description(uuid,uuid,uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION care_security.gkv_assist_amendment_state(uuid,uuid,integer,uuid),public.gkv_assist_amendment_state(uuid,uuid,integer,uuid),
 care_security.gkv_assist_amend_description(uuid,uuid,uuid,jsonb),public.gkv_assist_amend_description(uuid,uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
