-- Checkpoint 245 / V-02: append-only QPR-Anforderungszuordnung zu konkreten Aktenstellen und offenen Lücken.
-- Lokaler additiver Entwurf; nicht gegen eine produktive Datenbank ausführen.

CREATE TABLE IF NOT EXISTS public.qm_quality_inspection_evidence_sets (
  id uuid PRIMARY KEY,
  client_request_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.qm_audits(id) ON DELETE RESTRICT,
  qpr_profile_code text NOT NULL CHECK (qpr_profile_code='QPR-AMB-TEIL1A-2026-07-30'),
  qpr_version_date date NOT NULL CHECK (qpr_version_date=DATE '2026-07-30'),
  qpr_effective_from date NOT NULL CHECK (qpr_effective_from=DATE '2026-07-30'),
  qpr_source_url text NOT NULL CHECK (qpr_source_url='https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf'),
  qpr_source_sha256 text NOT NULL CHECK (qpr_source_sha256~'^[0-9a-f]{64}$'),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_by_name text NOT NULL CHECK (btrim(recorded_by_name)<>''),
  recorded_at timestamptz NOT NULL,
  assessment_state text NOT NULL DEFAULT 'evidence_mapping_only' CHECK (assessment_state='evidence_mapping_only'),
  inspection_result text NOT NULL DEFAULT 'not_inferred' CHECK (inspection_result='not_inferred'),
  care_completion text NOT NULL DEFAULT 'not_inferred' CHECK (care_completion='not_inferred'),
  history_mode text NOT NULL DEFAULT 'append_only' CHECK (history_mode='append_only'),
  request_fingerprint text NOT NULL CHECK (request_fingerprint~'^[0-9a-f]{32}$'),
  UNIQUE (tenant_id, client_request_id),
  UNIQUE (tenant_id, audit_id, id)
);

CREATE TABLE IF NOT EXISTS public.qm_quality_inspection_requirements (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  evidence_set_id uuid NOT NULL REFERENCES public.qm_quality_inspection_evidence_sets(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL CHECK (sort_order>=1),
  requirement_code text NOT NULL CHECK (requirement_code~'^([1-5]\.[0-9]+(\.[0-9]+)?|A\.[1-3])$'),
  requirement_title text NOT NULL CHECK (btrim(requirement_title)<>''),
  inspection_level text NOT NULL CHECK (inspection_level IN ('person','facility','billing')),
  client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,
  mapping_state text NOT NULL CHECK (mapping_state IN ('evidence_linked','gap_open','evidence_linked_with_gap')),
  CHECK ((inspection_level='person' AND client_id IS NOT NULL) OR (inspection_level<>'person' AND client_id IS NULL)),
  UNIQUE (evidence_set_id, sort_order)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_qm_quality_inspection_requirement_scope ON public.qm_quality_inspection_requirements
  (evidence_set_id, requirement_code, inspection_level, COALESCE(client_id,'00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS public.qm_quality_inspection_evidence_refs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requirement_mapping_id uuid NOT NULL REFERENCES public.qm_quality_inspection_requirements(id) ON DELETE RESTRICT,
  position_no integer NOT NULL CHECK (position_no>=1),
  source_type text NOT NULL CHECK (source_type IN ('care_record','qm_document_version','billing_record','staff_qualification','other')),
  source_entity_id uuid NOT NULL,
  source_version_id uuid,
  client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,
  record_locator text NOT NULL CHECK (btrim(record_locator)<>''),
  source_sha256 text NOT NULL CHECK (source_sha256~'^[0-9a-f]{64}$'),
  documented_at timestamptz NOT NULL,
  captured_at timestamptz NOT NULL,
  CHECK (captured_at>=documented_at),
  UNIQUE (requirement_mapping_id, position_no),
  UNIQUE (requirement_mapping_id, id)
);

CREATE TABLE IF NOT EXISTS public.qm_quality_inspection_gaps (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requirement_mapping_id uuid NOT NULL REFERENCES public.qm_quality_inspection_requirements(id) ON DELETE RESTRICT,
  position_no integer NOT NULL CHECK (position_no>=1),
  description text NOT NULL CHECK (length(btrim(description))>=5),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  identified_at timestamptz NOT NULL,
  responsible_role text NOT NULL CHECK (btrim(responsible_role)<>''),
  due_at timestamptz,
  gap_state text NOT NULL DEFAULT 'open' CHECK (gap_state='open'),
  CHECK (due_at IS NULL OR due_at>identified_at),
  UNIQUE (requirement_mapping_id, position_no),
  UNIQUE (requirement_mapping_id, id)
);

ALTER TABLE public.qm_quality_inspection_evidence_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_quality_inspection_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_quality_inspection_evidence_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qm_quality_inspection_gaps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.qm_quality_inspection_evidence_sets, public.qm_quality_inspection_requirements, public.qm_quality_inspection_evidence_refs, public.qm_quality_inspection_gaps FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.qm_quality_inspection_evidence_sets, public.qm_quality_inspection_requirements, public.qm_quality_inspection_evidence_refs, public.qm_quality_inspection_gaps TO authenticated;

DROP POLICY IF EXISTS qm_quality_inspection_evidence_sets_read ON public.qm_quality_inspection_evidence_sets;
CREATE POLICY qm_quality_inspection_evidence_sets_read ON public.qm_quality_inspection_evidence_sets FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('qm.view'));
DROP POLICY IF EXISTS qm_quality_inspection_requirements_read ON public.qm_quality_inspection_requirements;
CREATE POLICY qm_quality_inspection_requirements_read ON public.qm_quality_inspection_requirements FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('qm.view'));
DROP POLICY IF EXISTS qm_quality_inspection_evidence_refs_read ON public.qm_quality_inspection_evidence_refs;
CREATE POLICY qm_quality_inspection_evidence_refs_read ON public.qm_quality_inspection_evidence_refs FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('qm.view'));
DROP POLICY IF EXISTS qm_quality_inspection_gaps_read ON public.qm_quality_inspection_gaps;
CREATE POLICY qm_quality_inspection_gaps_read ON public.qm_quality_inspection_gaps FOR SELECT TO authenticated
  USING (tenant_id=public.current_tenant_id() AND public.has_permission('qm.view'));

CREATE OR REPLACE FUNCTION care_private.protect_qm_quality_inspection_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
  RAISE EXCEPTION 'QPR-Prüfzuordnungen, Aktenstellen und offene Lücken bleiben unverändert.' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS protect_qm_quality_inspection_evidence_sets ON public.qm_quality_inspection_evidence_sets;
CREATE TRIGGER protect_qm_quality_inspection_evidence_sets BEFORE UPDATE OR DELETE ON public.qm_quality_inspection_evidence_sets FOR EACH ROW EXECUTE FUNCTION care_private.protect_qm_quality_inspection_history();
DROP TRIGGER IF EXISTS protect_qm_quality_inspection_requirements ON public.qm_quality_inspection_requirements;
CREATE TRIGGER protect_qm_quality_inspection_requirements BEFORE UPDATE OR DELETE ON public.qm_quality_inspection_requirements FOR EACH ROW EXECUTE FUNCTION care_private.protect_qm_quality_inspection_history();
DROP TRIGGER IF EXISTS protect_qm_quality_inspection_evidence_refs ON public.qm_quality_inspection_evidence_refs;
CREATE TRIGGER protect_qm_quality_inspection_evidence_refs BEFORE UPDATE OR DELETE ON public.qm_quality_inspection_evidence_refs FOR EACH ROW EXECUTE FUNCTION care_private.protect_qm_quality_inspection_history();
DROP TRIGGER IF EXISTS protect_qm_quality_inspection_gaps ON public.qm_quality_inspection_gaps;
CREATE TRIGGER protect_qm_quality_inspection_gaps BEFORE UPDATE OR DELETE ON public.qm_quality_inspection_gaps FOR EACH ROW EXECUTE FUNCTION care_private.protect_qm_quality_inspection_history();

CREATE OR REPLACE FUNCTION public.record_qm_quality_inspection_evidence_set(
  p_audit_id uuid,
  p_payload jsonb,
  p_client_request_id uuid
) RETURNS public.qm_quality_inspection_evidence_sets
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  t uuid:=public.current_tenant_id(); actor uuid:=auth.uid(); actor_name text; actual_time timestamptz:=clock_timestamp();
  prior public.qm_quality_inspection_evidence_sets; result public.qm_quality_inspection_evidence_sets; audit_row public.qm_audits;
  request_fingerprint text; requirement_item record; evidence_item record; gap_item record;
  evidence_count integer; gap_count integer; mapping_state text; requirement_client uuid; supplied_recorded_at timestamptz;
BEGIN
  IF t IS NULL OR actor IS NULL OR NOT public.has_permission('qm.create_audit') THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
  IF p_audit_id IS NULL OR p_client_request_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload->'requirements')<>'array' OR jsonb_array_length(p_payload->'requirements')<1
    OR COALESCE(p_payload->>'evidenceSetId','')='' OR p_payload->>'clientRequestId' IS DISTINCT FROM p_client_request_id::text
    OR COALESCE(p_payload->>'qprSourceSha256','')!~'^[0-9a-f]{64}$'
    OR COALESCE(p_payload->>'recordedAt','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}(Z|\+00:00)$'
  THEN RAISE EXCEPTION 'Qualitätsprüfungsnachweis ist unvollständig.' USING ERRCODE='23514'; END IF;
  IF p_payload->>'qprProfileCode'<>'QPR-AMB-TEIL1A-2026-07-30' OR (p_payload->>'qprVersionDate')::date<>DATE '2026-07-30'
    OR (p_payload->>'qprEffectiveFrom')::date<>DATE '2026-07-30'
    OR p_payload->>'qprSourceUrl'<>'https://md-bund.de/fileadmin/dokumente/Publikationen/SPV/PV_Qualitaetspruefung/QPR_Teil1a_ambulante_Pflegedienste_2026_07_30.pdf'
  THEN RAISE EXCEPTION 'QPR-Fassung oder Primärquelle ist nicht die gebundene ambulante Teil-1a-Fassung.' USING ERRCODE='23514'; END IF;
  request_fingerprint:=md5(jsonb_build_object('auditId',p_audit_id,'payload',p_payload)::text);
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_client_request_id::text));
  SELECT * INTO prior FROM public.qm_quality_inspection_evidence_sets WHERE tenant_id=t AND client_request_id=p_client_request_id;
  IF FOUND THEN
    IF prior.request_fingerprint IS DISTINCT FROM request_fingerprint OR prior.audit_id IS DISTINCT FROM p_audit_id THEN RAISE EXCEPTION 'Anforderungs-ID wurde anders verwendet.' USING ERRCODE='40001'; END IF;
    RETURN prior;
  END IF;
  SELECT * INTO audit_row FROM public.qm_audits WHERE tenant_id=t AND id=p_audit_id AND audit_type='md_inspection' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zugeordnete MD-Prüfung fehlt oder gehört nicht zum Mandanten.' USING ERRCODE='23503'; END IF;
  actor_name:=public.clinical_actor_name(); supplied_recorded_at:=(p_payload->>'recordedAt')::timestamptz;
  IF (p_payload->>'tenantId')::uuid IS DISTINCT FROM t OR (p_payload->>'auditId')::uuid IS DISTINCT FROM p_audit_id
    OR (p_payload->>'recordedBy')::uuid IS DISTINCT FROM actor OR btrim(p_payload->>'recordedByName') IS DISTINCT FROM btrim(actor_name)
    OR supplied_recorded_at>actual_time THEN RAISE EXCEPTION 'Nachweissatz ist nicht der authentifizierten Person, Zeit oder Prüfung zugeordnet.' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(t::text),hashtext(p_audit_id::text));
  INSERT INTO public.qm_quality_inspection_evidence_sets(id,client_request_id,tenant_id,audit_id,qpr_profile_code,qpr_version_date,qpr_effective_from,qpr_source_url,qpr_source_sha256,recorded_by,recorded_by_name,recorded_at,assessment_state,inspection_result,care_completion,history_mode,request_fingerprint)
  VALUES((p_payload->>'evidenceSetId')::uuid,p_client_request_id,t,p_audit_id,p_payload->>'qprProfileCode',(p_payload->>'qprVersionDate')::date,(p_payload->>'qprEffectiveFrom')::date,p_payload->>'qprSourceUrl',p_payload->>'qprSourceSha256',actor,actor_name,actual_time,'evidence_mapping_only','not_inferred','not_inferred','append_only',request_fingerprint) RETURNING * INTO result;

  FOR requirement_item IN SELECT value,ordinality FROM jsonb_array_elements(p_payload->'requirements') WITH ORDINALITY LOOP
    IF COALESCE(requirement_item.value->>'requirementMappingId','')='' OR COALESCE(requirement_item.value->>'requirementCode','')!~'^([1-5]\.[0-9]+(\.[0-9]+)?|A\.[1-3])$'
      OR btrim(COALESCE(requirement_item.value->>'requirementTitle',''))='' OR COALESCE(requirement_item.value->>'inspectionLevel','') NOT IN ('person','facility','billing')
      OR jsonb_typeof(requirement_item.value->'evidence')<>'array' OR jsonb_typeof(requirement_item.value->'gaps')<>'array'
    THEN RAISE EXCEPTION 'QPR-Prüfzuordnung ist unvollständig.' USING ERRCODE='23514'; END IF;
    evidence_count:=jsonb_array_length(requirement_item.value->'evidence'); gap_count:=jsonb_array_length(requirement_item.value->'gaps');
    IF evidence_count+gap_count=0 THEN RAISE EXCEPTION 'Jede QPR-Anforderung benötigt eine konkrete Aktenstelle oder offene Lücke.' USING ERRCODE='23514'; END IF;
    requirement_client:=NULLIF(requirement_item.value->>'clientId','')::uuid;
    IF (requirement_item.value->>'inspectionLevel'='person' AND requirement_client IS NULL) OR (requirement_item.value->>'inspectionLevel'<>'person' AND requirement_client IS NOT NULL)
      OR (requirement_client IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE tenant_id=t AND id=requirement_client))
    THEN RAISE EXCEPTION 'Prüfebene und Pflegefallzuordnung sind widersprüchlich.' USING ERRCODE='23514'; END IF;
    mapping_state:=CASE WHEN evidence_count>0 AND gap_count>0 THEN 'evidence_linked_with_gap' WHEN evidence_count>0 THEN 'evidence_linked' ELSE 'gap_open' END;
    INSERT INTO public.qm_quality_inspection_requirements(id,tenant_id,evidence_set_id,sort_order,requirement_code,requirement_title,inspection_level,client_id,mapping_state)
    VALUES((requirement_item.value->>'requirementMappingId')::uuid,t,result.id,requirement_item.ordinality,requirement_item.value->>'requirementCode',btrim(requirement_item.value->>'requirementTitle'),requirement_item.value->>'inspectionLevel',requirement_client,mapping_state);
    FOR evidence_item IN SELECT value,ordinality FROM jsonb_array_elements(requirement_item.value->'evidence') WITH ORDINALITY LOOP
      IF COALESCE(evidence_item.value->>'evidenceRefId','')='' OR COALESCE(evidence_item.value->>'sourceEntityId','')='' OR btrim(COALESCE(evidence_item.value->>'recordLocator',''))=''
        OR COALESCE(evidence_item.value->>'sourceType','') NOT IN ('care_record','qm_document_version','billing_record','staff_qualification','other')
        OR COALESCE(evidence_item.value->>'sourceSha256','')!~'^[0-9a-f]{64}$'
        OR COALESCE(evidence_item.value->>'documentedAt','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}(Z|\+00:00)$'
        OR COALESCE(evidence_item.value->>'capturedAt','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}(Z|\+00:00)$'
        OR (evidence_item.value->>'capturedAt')::timestamptz<(evidence_item.value->>'documentedAt')::timestamptz
        OR (evidence_item.value->>'capturedAt')::timestamptz>actual_time OR NULLIF(evidence_item.value->>'clientId','')::uuid IS DISTINCT FROM requirement_client
      THEN RAISE EXCEPTION 'Konkrete Aktenstelle ist unvollständig oder widersprüchlich.' USING ERRCODE='23514'; END IF;
      INSERT INTO public.qm_quality_inspection_evidence_refs(id,tenant_id,requirement_mapping_id,position_no,source_type,source_entity_id,source_version_id,client_id,record_locator,source_sha256,documented_at,captured_at)
      VALUES((evidence_item.value->>'evidenceRefId')::uuid,t,(requirement_item.value->>'requirementMappingId')::uuid,evidence_item.ordinality,evidence_item.value->>'sourceType',(evidence_item.value->>'sourceEntityId')::uuid,NULLIF(evidence_item.value->>'sourceVersionId','')::uuid,requirement_client,btrim(evidence_item.value->>'recordLocator'),evidence_item.value->>'sourceSha256',(evidence_item.value->>'documentedAt')::timestamptz,(evidence_item.value->>'capturedAt')::timestamptz);
    END LOOP;
    FOR gap_item IN SELECT value,ordinality FROM jsonb_array_elements(requirement_item.value->'gaps') WITH ORDINALITY LOOP
      IF COALESCE(gap_item.value->>'gapId','')='' OR length(btrim(COALESCE(gap_item.value->>'description','')))<5 OR btrim(COALESCE(gap_item.value->>'responsibleRole',''))=''
        OR COALESCE(gap_item.value->>'severity','') NOT IN ('low','medium','high','critical')
        OR COALESCE(gap_item.value->>'identifiedAt','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}(Z|\+00:00)$'
        OR (NULLIF(gap_item.value->>'dueAt','') IS NOT NULL AND gap_item.value->>'dueAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}(Z|\+00:00)$')
        OR (gap_item.value->>'identifiedAt')::timestamptz>actual_time
        OR (NULLIF(gap_item.value->>'dueAt','') IS NOT NULL AND (gap_item.value->>'dueAt')::timestamptz<=(gap_item.value->>'identifiedAt')::timestamptz)
      THEN RAISE EXCEPTION 'Offene Lücke ist unvollständig oder widersprüchlich.' USING ERRCODE='23514'; END IF;
      INSERT INTO public.qm_quality_inspection_gaps(id,tenant_id,requirement_mapping_id,position_no,description,severity,identified_at,responsible_role,due_at,gap_state)
      VALUES((gap_item.value->>'gapId')::uuid,t,(requirement_item.value->>'requirementMappingId')::uuid,gap_item.ordinality,btrim(gap_item.value->>'description'),gap_item.value->>'severity',(gap_item.value->>'identifiedAt')::timestamptz,btrim(gap_item.value->>'responsibleRole'),NULLIF(gap_item.value->>'dueAt','')::timestamptz,'open');
    END LOOP;
  END LOOP;
  INSERT INTO public.care_audit_events(tenant_id,entity_type,entity_id,action,summary,after_data,actor_id,actor_name)
  VALUES(t,'qm_quality_inspection_evidence_set',result.id,'evidence_mapping_recorded','Konkrete QPR-Anforderungen mit Aktenstellen und offenen Lücken append-only zugeordnet; Prüfergebnis nicht abgeleitet.',to_jsonb(result),actor,actor_name);
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.record_qm_quality_inspection_evidence_set(uuid,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_qm_quality_inspection_evidence_set(uuid,jsonb,uuid) TO authenticated;
