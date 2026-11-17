-- Protect the existing catalog versions and record version-specific reviews.
-- Reviews are evidence for a later release decision. They never issue documents.
BEGIN;

CREATE FUNCTION public.prevent_central_catalog_history_rewrite() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW IS NOT DISTINCT FROM OLD THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'Vorlagenfassungen und ihre Prüfvermerke bleiben unverändert.' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_central_catalog_history_rewrite() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER central_catalog_version_immutable
  BEFORE UPDATE OR DELETE ON public.central_document_catalog
  FOR EACH ROW EXECUTE FUNCTION public.prevent_central_catalog_history_rewrite();
CREATE TRIGGER central_catalog_no_truncate
  BEFORE TRUNCATE ON public.central_document_catalog
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_central_catalog_history_rewrite();

CREATE FUNCTION public.central_document_catalog_definition_hash(p_definition jsonb) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT encode(sha256(convert_to(p_definition::text, 'UTF8')), 'hex');
$$;
REVOKE ALL ON FUNCTION public.central_document_catalog_definition_hash(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.central_document_catalog_version_history (
  template_key text NOT NULL,
  template_version integer NOT NULL,
  prior_version integer,
  definition_hash text NOT NULL CHECK (definition_hash ~ '^[0-9a-f]{64}$'),
  recorded_actor uuid,
  database_publisher text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (template_key, template_version),
  FOREIGN KEY (template_key, template_version) REFERENCES public.central_document_catalog(template_key, version),
  FOREIGN KEY (template_key, prior_version) REFERENCES public.central_document_catalog(template_key, version),
  CHECK (prior_version < template_version)
);
ALTER TABLE public.central_document_catalog_version_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.central_document_catalog_version_history FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER central_catalog_version_history_immutable
  BEFORE UPDATE OR DELETE ON public.central_document_catalog_version_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_central_catalog_history_rewrite();
CREATE TRIGGER central_catalog_version_history_no_truncate
  BEFORE TRUNCATE ON public.central_document_catalog_version_history
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_central_catalog_history_rewrite();

CREATE FUNCTION public.record_central_catalog_new_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_database_publisher text := coalesce(nullif(current_setting('role', true), 'none'), session_user::text);
  v_prior_version integer;
BEGIN
  SELECT max(c.version) INTO v_prior_version FROM public.central_document_catalog c
  WHERE c.template_key = NEW.template_key AND c.version < NEW.version;

  INSERT INTO public.central_document_catalog_version_history (
    template_key, template_version, prior_version, definition_hash, recorded_actor, database_publisher
  ) VALUES (
    NEW.template_key, NEW.version, v_prior_version, public.central_document_catalog_definition_hash(NEW.definition_json),
    CASE WHEN v_database_publisher = 'authenticated' THEN auth.uid() END, v_database_publisher
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_central_catalog_new_version() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER central_catalog_record_new_version AFTER INSERT ON public.central_document_catalog
  FOR EACH ROW EXECUTE FUNCTION public.record_central_catalog_new_version();

CREATE TABLE public.central_document_catalog_reviews (
  id uuid PRIMARY KEY,
  template_key text NOT NULL,
  template_version integer NOT NULL,
  definition_hash text NOT NULL CHECK (definition_hash ~ '^[0-9a-f]{64}$'),
  review_scope text NOT NULL CHECK (review_scope IN ('design', 'functional', 'clinical', 'legal')),
  decision text NOT NULL CHECK (decision IN ('passed', 'changes_required', 'withdrawn')),
  applicability text NOT NULL CHECK (char_length(applicability) BETWEEN 1 AND 500),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 2000),
  evidence_references text[] NOT NULL CHECK (cardinality(evidence_references) <= 12),
  recorded_by uuid NOT NULL,
  recorder_platform_role text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (template_key, template_version) REFERENCES public.central_document_catalog(template_key, version),
  CHECK (decision <> 'passed' OR cardinality(evidence_references) > 0)
);
CREATE INDEX central_catalog_reviews_version_history ON public.central_document_catalog_reviews
  (template_key, template_version, recorded_at DESC, id DESC);
ALTER TABLE public.central_document_catalog_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.central_document_catalog_reviews FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER central_catalog_reviews_immutable
  BEFORE UPDATE OR DELETE ON public.central_document_catalog_reviews
  FOR EACH ROW EXECUTE FUNCTION public.prevent_central_catalog_history_rewrite();
CREATE TRIGGER central_catalog_reviews_no_truncate
  BEFORE TRUNCATE ON public.central_document_catalog_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_central_catalog_history_rewrite();

CREATE FUNCTION public.platform_get_central_document_catalog_reviews(
  p_template_key text, p_version integer, p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hash text;
  v_created_at timestamptz;
  v_version_event jsonb;
  v_reviews jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM public.platform_assert_capability('system.read');
  IF p_template_key IS NULL OR char_length(p_template_key) NOT BETWEEN 1 AND 160
    OR p_version IS NULL OR p_version < 1 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'Ungültige Vorlagenfassung oder Seitenposition.' USING ERRCODE = '22023';
  END IF;

  SELECT public.central_document_catalog_definition_hash(c.definition_json), c.created_at INTO v_hash, v_created_at
  FROM public.central_document_catalog c WHERE c.template_key = p_template_key AND c.version = p_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Die Vorlagenfassung ist nicht vorhanden.' USING ERRCODE = '22023';
  END IF;

  SELECT to_jsonb(h) INTO v_version_event FROM public.central_document_catalog_version_history h
  WHERE h.template_key = p_template_key AND h.template_version = p_version;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.recorded_at DESC, r.id DESC), '[]'::jsonb) INTO v_reviews
  FROM (
    SELECT * FROM public.central_document_catalog_reviews
    WHERE template_key = p_template_key AND template_version = p_version
    ORDER BY recorded_at DESC, id DESC LIMIT 50 OFFSET p_offset
  ) r;
  RETURN jsonb_build_object(
    'definition_hash', v_hash, 'created_at', v_created_at, 'version_event', v_version_event, 'reviews', v_reviews
  );
END;
$$;
REVOKE ALL ON FUNCTION public.platform_get_central_document_catalog_reviews(text, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_get_central_document_catalog_reviews(text, integer, integer) TO authenticated;

CREATE FUNCTION public.platform_record_central_document_catalog_review(
  p_request_id uuid, p_template_key text, p_version integer, p_definition_hash text,
  p_review_scope text, p_decision text, p_applicability text, p_reason text, p_evidence_references text[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_platform_role text;
  v_hash text;
  v_review public.central_document_catalog_reviews%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM public.platform_assert_capability('system.write');
  v_platform_role := public.platform_current_role();
  IF p_request_id IS NULL OR p_template_key IS NULL OR char_length(p_template_key) NOT BETWEEN 1 AND 160
    OR p_version IS NULL OR p_version < 1
    OR p_definition_hash IS NULL OR p_definition_hash !~ '^[0-9a-f]{64}$'
    OR p_review_scope IS NULL OR p_review_scope NOT IN ('design', 'functional', 'clinical', 'legal')
    OR p_decision IS NULL OR p_decision NOT IN ('passed', 'changes_required', 'withdrawn')
    OR p_applicability IS NULL OR char_length(btrim(p_applicability)) NOT BETWEEN 1 AND 500
    OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 5 AND 2000
    OR p_evidence_references IS NULL OR cardinality(p_evidence_references) > 12
    OR array_ndims(p_evidence_references) > 1
    OR (p_decision = 'passed' AND cardinality(p_evidence_references) = 0)
    OR EXISTS (
      SELECT 1 FROM unnest(p_evidence_references) AS evidence(reference)
      WHERE evidence.reference IS NULL OR char_length(btrim(evidence.reference)) NOT BETWEEN 1 AND 1000
    ) THEN
    RAISE EXCEPTION 'Der Prüfvermerk ist unvollständig oder ungültig.' USING ERRCODE = '22023';
  END IF;

  SELECT public.central_document_catalog_definition_hash(c.definition_json) INTO v_hash
  FROM public.central_document_catalog c WHERE c.template_key = p_template_key AND c.version = p_version;
  IF NOT FOUND OR v_hash IS DISTINCT FROM p_definition_hash THEN
    RAISE EXCEPTION 'Der Prüfvermerk gehört zu einem anderen Vorlagenstand.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.central_document_catalog_reviews (
    id, template_key, template_version, definition_hash, review_scope, decision,
    applicability, reason, evidence_references, recorded_by, recorder_platform_role
  ) VALUES (
    p_request_id, p_template_key, p_version, v_hash, p_review_scope, p_decision,
    btrim(p_applicability), btrim(p_reason), p_evidence_references, v_actor, v_platform_role
  ) ON CONFLICT (id) DO NOTHING RETURNING * INTO v_review;

  IF NOT FOUND THEN
    SELECT * INTO v_review FROM public.central_document_catalog_reviews WHERE id = p_request_id;
    IF NOT FOUND OR ROW(v_review.template_key, v_review.template_version, v_review.definition_hash,
      v_review.review_scope, v_review.decision, v_review.applicability, v_review.reason,
      v_review.evidence_references, v_review.recorded_by) IS DISTINCT FROM
      ROW(p_template_key, p_version, v_hash, p_review_scope, p_decision,
      btrim(p_applicability), btrim(p_reason), p_evidence_references, v_actor) THEN
      RAISE EXCEPTION 'Die Vorgangskennung wurde bereits für einen anderen Prüfvermerk verwendet.' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN to_jsonb(v_review);
END;
$$;
REVOKE ALL ON FUNCTION public.platform_record_central_document_catalog_review(uuid, text, integer, text, text, text, text, text, text[])
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_record_central_document_catalog_review(uuid, text, integer, text, text, text, text, text, text[])
  TO authenticated;

COMMENT ON TABLE public.central_document_catalog_reviews IS
  'Append-only evidence for a specific global template version. A review leaves document issuance and existing runtime gates unchanged.';
COMMENT ON TABLE public.central_document_catalog_version_history IS
  'Append-only evidence for future catalog inserts. Existing versions retain their original created_at without invented events.';

COMMIT;
