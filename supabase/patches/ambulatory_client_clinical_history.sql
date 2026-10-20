-- Prepared Web/Desktop contract for immutable structured diagnoses, allergies,
-- intolerances and unresolved hints. This patch is not applied automatically.
BEGIN;

CREATE SCHEMA IF NOT EXISTS client_clinical_private;
REVOKE ALL ON SCHEMA client_clinical_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA client_clinical_private TO authenticated;

CREATE TABLE IF NOT EXISTS public.client_clinical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('diagnosis','allergy','intolerance','unresolved_hint')),
  clinical_code TEXT,
  clinical_text TEXT NOT NULL CHECK (length(btrim(clinical_text)) BETWEEN 3 AND 4000),
  source_type TEXT NOT NULL CHECK (length(btrim(source_type)) BETWEEN 3 AND 200),
  source_reference TEXT NOT NULL CHECK (length(btrim(source_reference)) BETWEEN 3 AND 2000),
  clinical_date DATE,
  date_meaning TEXT NOT NULL CHECK (date_meaning IN ('diagnosed_on','onset_on','reported_on','unknown')),
  verification TEXT NOT NULL CHECK (verification IN ('unconfirmed','provisional','confirmed','refuted')),
  record_state TEXT NOT NULL CHECK (record_state IN ('active','resolved','entered_in_error')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  supersedes_id UUID REFERENCES public.client_clinical_records(id) ON DELETE RESTRICT,
  recorded_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recorded_by_name TEXT NOT NULL CHECK (length(btrim(recorded_by_name)) BETWEEN 2 AND 200),
  legacy_origin JSONB CHECK (legacy_origin IS NULL OR jsonb_typeof(legacy_origin) = 'object'),
  original_payload JSONB NOT NULL CHECK (jsonb_typeof(original_payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK ((date_meaning = 'unknown' AND clinical_date IS NULL) OR (date_meaning <> 'unknown' AND clinical_date IS NOT NULL)),
  CHECK ((revision = 1 AND supersedes_id IS NULL) OR (revision > 1 AND supersedes_id IS NOT NULL))
);
ALTER TABLE public.client_clinical_records ADD COLUMN IF NOT EXISTS legacy_origin JSONB;
DO $$ BEGIN
  ALTER TABLE public.client_clinical_records ADD CONSTRAINT client_clinical_records_legacy_origin_object
    CHECK (legacy_origin IS NULL OR jsonb_typeof(legacy_origin)='object');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_clinical_records_one_successor
  ON public.client_clinical_records(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_clinical_records_history
  ON public.client_clinical_records(tenant_id, client_id, created_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_clinical_records_legacy_origin
  ON public.client_clinical_records(tenant_id,client_id,(legacy_origin->>'origin_kind'),(legacy_origin->>'origin_id'),(legacy_origin->>'origin_updated_at'))
  WHERE legacy_origin IS NOT NULL;
ALTER TABLE public.client_clinical_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_clinical_records FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION client_clinical_private.authorize(
  p_tenant_id UUID, p_client_id UUID, p_actor_profile_id UUID, p_write BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_session UUID;
BEGIN
  v_session := nullif(auth.jwt()->>'session_id','')::UUID;
  IF auth.uid() IS NULL OR v_session IS NULL
     OR coalesce((auth.jwt()->>'exp')::BIGINT,0) <= extract(epoch FROM clock_timestamp())
     OR NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id=v_session AND s.user_id=auth.uid())
     OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
     OR p_actor_profile_id IS DISTINCT FROM auth.uid()
     OR NOT public.has_permission('office.clients.view')
     OR NOT public.has_permission('office.clients.view_sensitive')
     OR NOT public.has_permission('pflege.diagnoses.view')
     OR (p_write AND NOT public.has_permission('pflege.diagnoses.manage'))
     OR NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id=p_client_id AND c.tenant_id=p_tenant_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Die aktuelle Berechtigung für den klinischen Originalverlauf ist nicht bestätigt.';
  END IF;
END;
$$;

ALTER TABLE public.care_diagnoses
  ADD COLUMN IF NOT EXISTS clinical_request_id UUID,
  ADD COLUMN IF NOT EXISTS clinical_record_id UUID REFERENCES public.client_clinical_records(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_care_diagnoses_clinical_request
  ON public.care_diagnoses(clinical_request_id) WHERE clinical_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_care_diagnoses_clinical_record
  ON public.care_diagnoses(clinical_record_id) WHERE clinical_record_id IS NOT NULL;

CREATE OR REPLACE FUNCTION client_clinical_private.read_history(
  p_tenant_id UUID, p_client_id UUID, p_actor_profile_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_client public.clients%ROWTYPE; v_history JSONB; v_current JSONB; v_legacy JSONB;
BEGIN
  PERFORM client_clinical_private.authorize(p_tenant_id,p_client_id,p_actor_profile_id,FALSE);
  SELECT * INTO STRICT v_client FROM public.clients c WHERE c.tenant_id=p_tenant_id AND c.id=p_client_id;
  SELECT coalesce(jsonb_agg(to_jsonb(r)-'original_payload' ORDER BY r.created_at,r.id),'[]'::JSONB)
    INTO v_history FROM public.client_clinical_records r
    WHERE r.tenant_id=p_tenant_id AND r.client_id=p_client_id;
  SELECT coalesce(jsonb_agg(to_jsonb(r)-'original_payload' ORDER BY r.kind,r.created_at,r.id),'[]'::JSONB)
    INTO v_current FROM public.client_clinical_records r
    WHERE r.tenant_id=p_tenant_id AND r.client_id=p_client_id
      AND NOT EXISTS (SELECT 1 FROM public.client_clinical_records successor
        WHERE successor.tenant_id=r.tenant_id AND successor.client_id=r.client_id AND successor.supersedes_id=r.id);
  WITH candidates AS (
    SELECT 1 AS sort_group,'client_diagnoses'::TEXT AS origin_kind,v_client.id AS origin_id,v_client.updated_at AS origin_updated_at,
      'Älteres Diagnosenfeld der Klientenakte'::TEXT AS display_label,(to_jsonb(v_client)->'diagnoses')::TEXT AS display_text,
      jsonb_build_object('field','diagnoses','value',to_jsonb(v_client)->'diagnoses','client_updated_at',v_client.updated_at) AS original,
      NULL::UUID AS native_linked_entry_id
      WHERE jsonb_typeof(to_jsonb(v_client)->'diagnoses')='array' AND jsonb_array_length(to_jsonb(v_client)->'diagnoses')>0
    UNION ALL
    SELECT 2,'client_diagnoses_notes',v_client.id,v_client.updated_at,'Älterer Diagnosehinweis der Klientenakte',to_jsonb(v_client)->>'diagnoses_notes',
      jsonb_build_object('field','diagnoses_notes','value',to_jsonb(v_client)->'diagnoses_notes','client_updated_at',v_client.updated_at),NULL::UUID
      WHERE length(btrim(coalesce(to_jsonb(v_client)->>'diagnoses_notes','')))>0
    UNION ALL
    SELECT 3,'client_allergies',v_client.id,v_client.updated_at,'Älterer Allergie-/Unverträglichkeitshinweis der Klientenakte',to_jsonb(v_client)->>'allergies',
      jsonb_build_object('field','allergies','value',to_jsonb(v_client)->'allergies','client_updated_at',v_client.updated_at),NULL::UUID
      WHERE length(btrim(coalesce(to_jsonb(v_client)->>'allergies','')))>0
    UNION ALL
    SELECT 4,'care_diagnosis',d.id,d.updated_at,'Älterer Pflegediagnose-Datensatz',
      concat_ws(' · ',nullif(d.icd_code,''),d.icd_title,nullif(d.physician_statement,'')),to_jsonb(d),d.clinical_record_id
      FROM public.care_diagnoses d WHERE d.tenant_id=p_tenant_id AND d.client_id=p_client_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('origin_kind',c.origin_kind,'origin_id',c.origin_id,'origin_updated_at',c.origin_updated_at,
      'display_label',c.display_label,'display_text',c.display_text,'original',c.original,'linked_entry_id',coalesce(c.native_linked_entry_id,(
        SELECT r.id FROM public.client_clinical_records r WHERE r.tenant_id=p_tenant_id AND r.client_id=p_client_id
          AND r.legacy_origin->>'origin_kind'=c.origin_kind AND r.legacy_origin->>'origin_id'=c.origin_id::TEXT
          AND r.legacy_origin->'origin_updated_at'=to_jsonb(c.origin_updated_at) LIMIT 1
      ))) ORDER BY c.sort_group,c.origin_updated_at,c.origin_id),'[]'::JSONB) INTO v_legacy FROM candidates c;
  RETURN jsonb_build_object('client_name',btrim(coalesce(v_client.first_name,'')||' '||coalesce(v_client.last_name,'')),
    'client_updated_at',v_client.updated_at,'current',v_current,'history',v_history,'legacy_candidates',v_legacy);
END;
$$;

CREATE OR REPLACE FUNCTION client_clinical_private.record_history(
  p_tenant_id UUID, p_client_id UUID, p_actor_profile_id UUID, p_request_id UUID,
  p_expected_client_updated_at TIMESTAMPTZ, p_supersedes_id UUID,
  p_expected_superseded_updated_at TIMESTAMPTZ, p_payload JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_client public.clients%ROWTYPE; v_prior public.client_clinical_records%ROWTYPE; v_care public.care_diagnoses%ROWTYPE;
  v_saved public.client_clinical_records%ROWTYPE; v_existing public.client_clinical_records%ROWTYPE; v_unknown TEXT[]; v_date DATE;
  v_legacy JSONB; v_legacy_kind TEXT; v_legacy_id UUID; v_legacy_updated_at TIMESTAMPTZ; v_expected_original JSONB;
BEGIN
  PERFORM client_clinical_private.authorize(p_tenant_id,p_client_id,p_actor_profile_id,TRUE);
  IF p_request_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Der klinische Schreibvorgang ist unvollständig.';
  END IF;
  SELECT array_agg(key ORDER BY key) INTO v_unknown FROM jsonb_object_keys(p_payload) key
    WHERE key <> ALL(ARRAY['kind','clinical_code','clinical_text','source_type','source_reference','clinical_date','date_meaning','verification','record_state','recorded_by_name','legacy_origin']);
  IF v_unknown IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Der klinische Schreibvorgang enthält nicht erlaubte Felder.'; END IF;
  IF coalesce(p_payload->>'kind','') NOT IN ('diagnosis','allergy','intolerance','unresolved_hint')
     OR coalesce(p_payload->>'date_meaning','') NOT IN ('diagnosed_on','onset_on','reported_on','unknown')
     OR coalesce(p_payload->>'verification','') NOT IN ('unconfirmed','provisional','confirmed','refuted')
     OR coalesce(p_payload->>'record_state','') NOT IN ('active','resolved','entered_in_error')
     OR length(btrim(coalesce(p_payload->>'clinical_text',''))) NOT BETWEEN 3 AND 4000
     OR length(btrim(coalesce(p_payload->>'source_type',''))) NOT BETWEEN 3 AND 200
     OR length(btrim(coalesce(p_payload->>'source_reference',''))) NOT BETWEEN 3 AND 2000
     OR length(btrim(coalesce(p_payload->>'recorded_by_name',''))) NOT BETWEEN 2 AND 200 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Art, Originaltext, Quelle, Status und Autorenschaft sind unvollständig.';
  END IF;
  BEGIN v_date:=nullif(p_payload->>'clinical_date','')::DATE;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Das klinische Datum ist ungültig.';
  END;
  IF ((p_payload->>'date_meaning')='unknown') IS DISTINCT FROM (v_date IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Datum und Datumsbedeutung widersprechen sich.';
  END IF;
  v_legacy:=nullif(p_payload->'legacy_origin','null'::JSONB);
  IF v_legacy IS NOT NULL THEN
    IF jsonb_typeof(v_legacy) IS DISTINCT FROM 'object' OR p_supersedes_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Ein Altoriginal darf nur einer neuen unveränderlichen Fassung zugeordnet werden.';
    END IF;
    SELECT array_agg(key ORDER BY key) INTO v_unknown FROM jsonb_object_keys(v_legacy) key
      WHERE key <> ALL(ARRAY['origin_kind','origin_id','origin_updated_at','original']);
    IF v_unknown IS NOT NULL OR jsonb_typeof(v_legacy->'original') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Der Bezug zum Altoriginal ist unvollständig.';
    END IF;
    BEGIN
      v_legacy_kind:=v_legacy->>'origin_kind'; v_legacy_id:=(v_legacy->>'origin_id')::UUID;
      v_legacy_updated_at:=(v_legacy->>'origin_updated_at')::TIMESTAMPTZ;
    EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Der Bezug zum Altoriginal ist ungültig.';
    END;
    IF v_legacy_kind IS NULL OR v_legacy_id IS NULL OR v_legacy_updated_at IS NULL
       OR v_legacy_kind NOT IN ('client_diagnoses','client_diagnoses_notes','client_allergies','care_diagnosis') THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Die Art des Altoriginals ist nicht zulässig.';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('client-clinical:'||p_tenant_id::TEXT||':'||p_client_id::TEXT,0));
  SELECT * INTO v_existing FROM public.client_clinical_records r WHERE r.request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id OR v_existing.client_id IS DISTINCT FROM p_client_id
      OR v_existing.recorded_by_profile_id IS DISTINCT FROM p_actor_profile_id OR v_existing.original_payload IS DISTINCT FROM p_payload
      OR v_existing.supersedes_id IS DISTINCT FROM p_supersedes_id THEN
      RAISE EXCEPTION USING ERRCODE='P0C03', MESSAGE='Die klinische Anfrage gehört zu einem anderen Original.';
    END IF;
    RETURN to_jsonb(v_existing)-'original_payload';
  END IF;
  SELECT * INTO STRICT v_client FROM public.clients c WHERE c.tenant_id=p_tenant_id AND c.id=p_client_id FOR SHARE;
  IF v_client.updated_at IS DISTINCT FROM p_expected_client_updated_at THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Die Klientenakte wurde parallel geändert.';
  END IF;
  IF v_legacy IS NOT NULL THEN
    IF v_legacy_kind='client_diagnoses' THEN
      v_expected_original:=jsonb_build_object('field','diagnoses','value',to_jsonb(v_client)->'diagnoses','client_updated_at',v_client.updated_at);
      IF jsonb_typeof(to_jsonb(v_client)->'diagnoses') IS DISTINCT FROM 'array' OR jsonb_array_length(to_jsonb(v_client)->'diagnoses')=0 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Ein leeres Diagnosenfeld ist kein übernehmbarer klinischer Beleg.';
      END IF;
    ELSIF v_legacy_kind='client_diagnoses_notes' THEN
      v_expected_original:=jsonb_build_object('field','diagnoses_notes','value',to_jsonb(v_client)->'diagnoses_notes','client_updated_at',v_client.updated_at);
      IF length(btrim(coalesce(to_jsonb(v_client)->>'diagnoses_notes','')))=0 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Ein leerer Diagnosehinweis ist kein übernehmbarer klinischer Beleg.';
      END IF;
    ELSIF v_legacy_kind='client_allergies' THEN
      v_expected_original:=jsonb_build_object('field','allergies','value',to_jsonb(v_client)->'allergies','client_updated_at',v_client.updated_at);
      IF length(btrim(coalesce(to_jsonb(v_client)->>'allergies','')))=0 THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Ein leerer Allergiehinweis ist kein übernehmbarer klinischer Beleg.';
      END IF;
    ELSE
      SELECT * INTO STRICT v_care FROM public.care_diagnoses d
        WHERE d.id=v_legacy_id AND d.tenant_id=p_tenant_id AND d.client_id=p_client_id FOR SHARE;
      v_expected_original:=to_jsonb(v_care);
    END IF;
    IF (v_legacy_kind<>'care_diagnosis' AND v_legacy_id IS DISTINCT FROM p_client_id)
       OR v_legacy_updated_at IS DISTINCT FROM CASE WHEN v_legacy_kind='care_diagnosis' THEN v_care.updated_at ELSE v_client.updated_at END
       OR v_legacy->'original' IS DISTINCT FROM v_expected_original THEN
      RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Das vollständige Altoriginal hat sich geändert oder gehört nicht zu dieser Akte.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.client_clinical_records r WHERE r.tenant_id=p_tenant_id AND r.client_id=p_client_id
      AND r.legacy_origin->>'origin_kind'=v_legacy_kind AND r.legacy_origin->>'origin_id'=v_legacy_id::TEXT
      AND r.legacy_origin->'origin_updated_at'=to_jsonb(v_legacy_updated_at)) THEN
      RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Dieses Altoriginal wurde bereits ausdrücklich zugeordnet.';
    END IF;
  END IF;
  IF p_supersedes_id IS NULL THEN
    IF p_expected_superseded_updated_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Der Vorgängerbezug ist widersprüchlich.'; END IF;
    v_prior.revision:=0;
  ELSE
    SELECT * INTO STRICT v_prior FROM public.client_clinical_records r
      WHERE r.id=p_supersedes_id AND r.tenant_id=p_tenant_id AND r.client_id=p_client_id FOR SHARE;
    IF v_prior.updated_at IS DISTINCT FROM p_expected_superseded_updated_at
       OR EXISTS (SELECT 1 FROM public.client_clinical_records successor WHERE successor.supersedes_id=v_prior.id) THEN
      RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Die klinische Fassung wurde bereits fortgeschrieben.';
    END IF;
  END IF;
  INSERT INTO public.client_clinical_records(request_id,tenant_id,client_id,kind,clinical_code,clinical_text,
    source_type,source_reference,clinical_date,date_meaning,verification,record_state,revision,supersedes_id,
    recorded_by_profile_id,recorded_by_name,legacy_origin,original_payload)
  VALUES(p_request_id,p_tenant_id,p_client_id,p_payload->>'kind',nullif(btrim(p_payload->>'clinical_code'),''),
    btrim(p_payload->>'clinical_text'),btrim(p_payload->>'source_type'),btrim(p_payload->>'source_reference'),v_date,
    p_payload->>'date_meaning',p_payload->>'verification',p_payload->>'record_state',v_prior.revision+1,p_supersedes_id,
    p_actor_profile_id,btrim(p_payload->>'recorded_by_name'),v_legacy,p_payload)
  RETURNING * INTO v_saved;
  RETURN to_jsonb(v_saved)-'original_payload';
END;
$$;

CREATE OR REPLACE FUNCTION client_clinical_private.confirm_write(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_saved public.client_clinical_records%ROWTYPE;
BEGIN
  PERFORM client_clinical_private.authorize(p_tenant_id,p_client_id,p_actor_profile_id,TRUE);
  SELECT * INTO STRICT v_saved FROM public.client_clinical_records r
    WHERE r.request_id=p_request_id AND r.tenant_id=p_tenant_id AND r.client_id=p_client_id
      AND r.recorded_by_profile_id=p_actor_profile_id;
  RETURN to_jsonb(v_saved)-'original_payload';
END;
$$;

CREATE OR REPLACE FUNCTION public.web_read_client_clinical_history(UUID,UUID,UUID)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_clinical_private.read_history($1,$2,$3); $$;
CREATE OR REPLACE FUNCTION public.web_record_client_clinical_history(UUID,UUID,UUID,UUID,TIMESTAMPTZ,UUID,TIMESTAMPTZ,JSONB)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_clinical_private.record_history($1,$2,$3,$4,$5,$6,$7,$8); $$;
CREATE OR REPLACE FUNCTION public.web_confirm_client_clinical_history_write(UUID,UUID,UUID,UUID)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_clinical_private.confirm_write($1,$2,$3,$4); $$;

CREATE OR REPLACE FUNCTION client_clinical_private.reject_direct_care_diagnosis_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF current_setting('client_clinical_private.atomic_write',TRUE) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Pflegediagnosen müssen zusammen mit ihrer unveränderlichen klinischen Fassung gespeichert werden.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reject_direct_care_diagnosis_write ON public.care_diagnoses;
CREATE TRIGGER reject_direct_care_diagnosis_write
  BEFORE INSERT OR UPDATE ON public.care_diagnoses
  FOR EACH ROW EXECUTE FUNCTION client_clinical_private.reject_direct_care_diagnosis_write();

CREATE OR REPLACE FUNCTION client_clinical_private.record_care_diagnosis_with_history(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,p_payload JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_unknown TEXT[]; v_date DATE; v_existing public.care_diagnoses%ROWTYPE;
  v_care public.care_diagnoses%ROWTYPE; v_record public.client_clinical_records%ROWTYPE; v_original JSONB;
BEGIN
  PERFORM client_clinical_private.authorize(p_tenant_id,p_client_id,p_actor_profile_id,TRUE);
  IF p_request_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Die atomare Diagnoseanfrage ist unvollständig.';
  END IF;
  SELECT array_agg(key ORDER BY key) INTO v_unknown FROM jsonb_object_keys(p_payload) key
    WHERE key <> ALL(ARRAY['icd_code','icd_title','physician_statement','diagnosed_at','diagnosed_by',
      'source_document','relevance_for_care','precautions','recorded_by_name']);
  IF v_unknown IS NOT NULL OR length(btrim(coalesce(p_payload->>'icd_title',''))) NOT BETWEEN 1 AND 500
     OR length(btrim(coalesce(p_payload->>'physician_statement',''))) NOT BETWEEN 3 AND 4000
     OR length(btrim(coalesce(p_payload->>'diagnosed_by',''))) NOT BETWEEN 2 AND 300
     OR length(btrim(coalesce(p_payload->>'recorded_by_name',''))) NOT BETWEEN 2 AND 200
     OR length(coalesce(p_payload->>'source_document','')) > 2000
     OR length(coalesce(p_payload->>'relevance_for_care','')) > 4000
     OR length(coalesce(p_payload->>'precautions','')) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Die ärztliche Angabe, Quelle oder Autorenschaft ist unvollständig.';
  END IF;
  BEGIN v_date:=nullif(p_payload->>'diagnosed_at','')::DATE;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Das Diagnosedatum ist ungültig.';
  END;
  PERFORM pg_advisory_xact_lock(hashtextextended('client-clinical:'||p_tenant_id::TEXT||':'||p_client_id::TEXT,0));
  SELECT * INTO v_existing FROM public.care_diagnoses d WHERE d.clinical_request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO STRICT v_record FROM public.client_clinical_records r WHERE r.id=v_existing.clinical_record_id FOR SHARE;
    v_original:=jsonb_build_object('icd_code',nullif(btrim(p_payload->>'icd_code'),''),
      'icd_title',btrim(p_payload->>'icd_title'),'physician_statement',btrim(p_payload->>'physician_statement'),
      'diagnosed_at',v_date,'diagnosed_by',btrim(p_payload->>'diagnosed_by'),'source_document',btrim(coalesce(p_payload->>'source_document','')),
      'relevance_for_care',btrim(coalesce(p_payload->>'relevance_for_care','')),'precautions',btrim(coalesce(p_payload->>'precautions','')),
      'recorded_by_name',btrim(p_payload->>'recorded_by_name'));
    IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id OR v_existing.client_id IS DISTINCT FROM p_client_id
       OR v_record.recorded_by_profile_id IS DISTINCT FROM p_actor_profile_id
       OR v_record.original_payload->'care_diagnosis' IS DISTINCT FROM v_original THEN
      RAISE EXCEPTION USING ERRCODE='P0C03', MESSAGE='Die Diagnoseanfrage gehört zu einem anderen Original.';
    END IF;
    RETURN jsonb_build_object('request_id',p_request_id,'care_diagnosis',to_jsonb(v_existing),'clinical_record',to_jsonb(v_record)-'original_payload');
  END IF;
  PERFORM 1 FROM public.clients c WHERE c.id=p_client_id AND c.tenant_id=p_tenant_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Die gebundene Klientenakte ist nicht verfügbar.'; END IF;
  v_original:=jsonb_build_object('icd_code',nullif(btrim(p_payload->>'icd_code'),''),
    'icd_title',btrim(p_payload->>'icd_title'),'physician_statement',btrim(p_payload->>'physician_statement'),
    'diagnosed_at',v_date,'diagnosed_by',btrim(p_payload->>'diagnosed_by'),'source_document',btrim(coalesce(p_payload->>'source_document','')),
    'relevance_for_care',btrim(coalesce(p_payload->>'relevance_for_care','')),'precautions',btrim(coalesce(p_payload->>'precautions','')),
    'recorded_by_name',btrim(p_payload->>'recorded_by_name'));
  PERFORM set_config('client_clinical_private.atomic_write','on',TRUE);
  INSERT INTO public.care_diagnoses(tenant_id,client_id,diagnosis_type,icd_code,icd_title,physician_statement,
    diagnosed_at,diagnosed_by,source_document,relevance_for_care,precautions,recorded_by,recorded_by_name,clinical_request_id)
  VALUES(p_tenant_id,p_client_id,'physician_statement',v_original->>'icd_code',v_original->>'icd_title',
    v_original->>'physician_statement',v_date,v_original->>'diagnosed_by',v_original->>'source_document',
    v_original->>'relevance_for_care',v_original->>'precautions',p_actor_profile_id,v_original->>'recorded_by_name',p_request_id)
  RETURNING * INTO v_care;
  INSERT INTO public.client_clinical_records(request_id,tenant_id,client_id,kind,clinical_code,clinical_text,
    source_type,source_reference,clinical_date,date_meaning,verification,record_state,revision,supersedes_id,
    recorded_by_profile_id,recorded_by_name,legacy_origin,original_payload)
  VALUES(p_request_id,p_tenant_id,p_client_id,'diagnosis',v_original->>'icd_code',v_original->>'physician_statement',
    'Ärztlich übermittelte Angabe',coalesce(nullif(v_original->>'source_document',''),v_original->>'diagnosed_by'),v_date,
    CASE WHEN v_date IS NULL THEN 'unknown' ELSE 'diagnosed_on' END,'unconfirmed','active',1,NULL,
    p_actor_profile_id,v_original->>'recorded_by_name',NULL,
    jsonb_build_object('care_diagnosis',v_original,'care_diagnosis_id',v_care.id,'request_id',p_request_id))
  RETURNING * INTO v_record;
  UPDATE public.care_diagnoses SET clinical_record_id=v_record.id WHERE id=v_care.id RETURNING * INTO v_care;
  PERFORM set_config('client_clinical_private.atomic_write','off',TRUE);
  RETURN jsonb_build_object('request_id',p_request_id,'care_diagnosis',to_jsonb(v_care),'clinical_record',to_jsonb(v_record)-'original_payload');
END;
$$;

CREATE OR REPLACE FUNCTION client_clinical_private.confirm_care_diagnosis_with_history(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_care public.care_diagnoses%ROWTYPE; v_record public.client_clinical_records%ROWTYPE;
BEGIN
  PERFORM client_clinical_private.authorize(p_tenant_id,p_client_id,p_actor_profile_id,TRUE);
  SELECT * INTO STRICT v_care FROM public.care_diagnoses d WHERE d.clinical_request_id=p_request_id
    AND d.tenant_id=p_tenant_id AND d.client_id=p_client_id;
  SELECT * INTO STRICT v_record FROM public.client_clinical_records r WHERE r.id=v_care.clinical_record_id
    AND r.request_id=p_request_id AND r.recorded_by_profile_id=p_actor_profile_id;
  RETURN jsonb_build_object('request_id',p_request_id,'care_diagnosis',to_jsonb(v_care),'clinical_record',to_jsonb(v_record)-'original_payload');
END;
$$;

CREATE OR REPLACE FUNCTION public.web_record_care_diagnosis_with_history(UUID,UUID,UUID,UUID,JSONB)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_clinical_private.record_care_diagnosis_with_history($1,$2,$3,$4,$5); $$;
CREATE OR REPLACE FUNCTION public.web_confirm_care_diagnosis_with_history(UUID,UUID,UUID,UUID)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_clinical_private.confirm_care_diagnosis_with_history($1,$2,$3,$4); $$;

REVOKE INSERT, UPDATE, DELETE ON public.care_diagnoses FROM authenticated;
REVOKE ALL ON FUNCTION client_clinical_private.reject_direct_care_diagnosis_write(),
  client_clinical_private.record_care_diagnosis_with_history(UUID,UUID,UUID,UUID,JSONB),
  client_clinical_private.confirm_care_diagnosis_with_history(UUID,UUID,UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION client_clinical_private.record_care_diagnosis_with_history(UUID,UUID,UUID,UUID,JSONB),
  client_clinical_private.confirm_care_diagnosis_with_history(UUID,UUID,UUID,UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.web_record_care_diagnosis_with_history(UUID,UUID,UUID,UUID,JSONB),
  public.web_confirm_care_diagnosis_with_history(UUID,UUID,UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.web_record_care_diagnosis_with_history(UUID,UUID,UUID,UUID,JSONB),
  public.web_confirm_care_diagnosis_with_history(UUID,UUID,UUID,UUID) TO authenticated;

REVOKE ALL ON FUNCTION client_clinical_private.authorize(UUID,UUID,UUID,BOOLEAN),
  client_clinical_private.read_history(UUID,UUID,UUID),
  client_clinical_private.record_history(UUID,UUID,UUID,UUID,TIMESTAMPTZ,UUID,TIMESTAMPTZ,JSONB),
  client_clinical_private.confirm_write(UUID,UUID,UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION client_clinical_private.authorize(UUID,UUID,UUID,BOOLEAN),
  client_clinical_private.read_history(UUID,UUID,UUID),
  client_clinical_private.record_history(UUID,UUID,UUID,UUID,TIMESTAMPTZ,UUID,TIMESTAMPTZ,JSONB),
  client_clinical_private.confirm_write(UUID,UUID,UUID,UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.web_read_client_clinical_history(UUID,UUID,UUID),
  public.web_record_client_clinical_history(UUID,UUID,UUID,UUID,TIMESTAMPTZ,UUID,TIMESTAMPTZ,JSONB),
  public.web_confirm_client_clinical_history_write(UUID,UUID,UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.web_read_client_clinical_history(UUID,UUID,UUID),
  public.web_record_client_clinical_history(UUID,UUID,UUID,UUID,TIMESTAMPTZ,UUID,TIMESTAMPTZ,JSONB),
  public.web_confirm_client_clinical_history_write(UUID,UUID,UUID,UUID) TO authenticated;

COMMIT;
