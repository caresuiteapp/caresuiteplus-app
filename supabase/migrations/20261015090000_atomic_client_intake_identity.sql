-- Atomic, idempotent first Web intake write.
-- The browser still performs the complete candidate review for the operator;
-- this function guards cooperating Web RPC writers and records their receipt.
-- Other direct/native writers are not turned into participants by this lock.
BEGIN;

CREATE TABLE IF NOT EXISTS public.client_intake_request_receipts (
  request_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  proposed_client_id UUID NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT client_intake_request_receipt_identity
    CHECK (proposed_client_id = client_id)
);

ALTER TABLE public.client_intake_request_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_intake_request_receipts FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_client_intake_request_receipts_tenant_client
  ON public.client_intake_request_receipts (tenant_id, client_id);

CREATE OR REPLACE FUNCTION public.web_reserve_client_intake_draft(
  p_tenant_id UUID,
  p_request_id UUID,
  p_proposed_client_id UUID,
  p_actor_profile_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET lock_timeout = '5s'
AS $$
DECLARE
  v_receipt public.client_intake_request_receipts%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_first_name TEXT;
  v_last_name TEXT;
  v_birth_date DATE;
  v_insurance_number TEXT;
  v_unknown_keys TEXT[];
BEGIN
  IF auth.uid() IS NULL
     OR p_tenant_id IS NULL
     OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
     OR p_actor_profile_id IS DISTINCT FROM auth.uid()
     OR NOT public.has_permission('office.clients.create')
     OR NOT public.has_permission('office.clients.view')
     OR NOT public.has_permission('office.clients.view_sensitive') THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'Die aktuelle Berechtigung für die Aufnahme und Identitätsprüfung ist nicht bestätigt.';
  END IF;
  IF p_request_id IS NULL OR p_proposed_client_id IS NULL
     OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Die Aufnahme-Anfrage ist unvollständig.';
  END IF;

  SELECT array_agg(key ORDER BY key) INTO v_unknown_keys
  FROM jsonb_object_keys(p_payload) AS key
  WHERE key <> ALL (ARRAY[
    'first_name','last_name','date_of_birth','care_level','street','house_number',
    'postal_code','city','phone','mobile','email','internal_notes','insurance_number',
    'insurance_name','cost_bearer','admission_date','gender'
  ]);
  IF v_unknown_keys IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Die Aufnahme enthält nicht erlaubte Felder.';
  END IF;

  v_first_name := btrim(coalesce(p_payload->>'first_name', ''));
  v_last_name := btrim(coalesce(p_payload->>'last_name', ''));
  IF v_first_name = '' OR v_last_name = '' OR length(v_first_name) > 150 OR length(v_last_name) > 150 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Vor- und Nachname sind für die Aufnahme erforderlich.';
  END IF;
  BEGIN
    v_birth_date := nullif(p_payload->>'date_of_birth', '')::DATE;
    v_insurance_number := nullif(btrim(coalesce(p_payload->>'insurance_number', '')), '');
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Das Geburtsdatum der Aufnahme ist ungültig.';
  END;

  -- One tenant-scoped transaction lock serializes the small number of first
  -- intake inserts. It deliberately favors correctness over parallel inserts.
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:' || p_tenant_id::TEXT, 0));

  SELECT * INTO v_receipt
  FROM public.client_intake_request_receipts
  WHERE request_id = p_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_receipt.tenant_id IS DISTINCT FROM p_tenant_id
       OR v_receipt.actor_profile_id IS DISTINCT FROM p_actor_profile_id
       OR v_receipt.proposed_client_id IS DISTINCT FROM p_proposed_client_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0I03', MESSAGE = 'Die Aufnahme-Anfrage gehört zu einem anderen Vorgang.';
    END IF;
    SELECT * INTO v_client FROM public.clients
    WHERE tenant_id = p_tenant_id AND id = v_receipt.client_id
    FOR UPDATE;
    IF NOT FOUND OR v_client.status::TEXT <> 'lead'
       OR v_client.created_by IS DISTINCT FROM p_actor_profile_id
       OR v_client.first_name IS DISTINCT FROM v_first_name
       OR v_client.last_name IS DISTINCT FROM v_last_name
       OR v_client.date_of_birth IS DISTINCT FROM v_birth_date
       OR nullif(btrim(coalesce(v_client.insurance_number, '')), '') IS DISTINCT FROM v_insurance_number THEN
      RAISE EXCEPTION USING ERRCODE = 'P0I04', MESSAGE = 'Die gespeicherte Aufnahme stimmt nicht mit der Anfrage überein.';
    END IF;
    RETURN jsonb_build_object('id', v_client.id, 'created', FALSE,
      'updated_at', v_client.updated_at, 'row', to_jsonb(v_client));
  END IF;

  IF EXISTS (SELECT 1 FROM public.clients WHERE id = p_proposed_client_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I03', MESSAGE = 'Die reservierte Aktenkennung ist bereits anderweitig belegt.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.tenant_id = p_tenant_id
      AND (
        (lower(btrim(c.first_name)) = lower(v_first_name)
          AND lower(btrim(c.last_name)) = lower(v_last_name)
          AND c.date_of_birth IS NOT DISTINCT FROM v_birth_date)
        OR (v_insurance_number IS NOT NULL
          AND lower(btrim(coalesce(c.insurance_number, ''))) = lower(v_insurance_number))
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I01',
      MESSAGE = 'Eine Person mit übereinstimmenden Identitätsmerkmalen ist bereits vorhanden.';
  END IF;

  INSERT INTO public.clients (
    id, tenant_id, first_name, last_name, date_of_birth, care_level, status,
    street, house_number, postal_code, city, phone, mobile, email, internal_notes,
    insurance_number, insurance_name, cost_bearer, admission_date, gender,
    created_by, updated_by
  ) VALUES (
    p_proposed_client_id, p_tenant_id, v_first_name, v_last_name, v_birth_date,
    (jsonb_populate_record(
      NULL::public.clients,
      jsonb_build_object('care_level', nullif(p_payload->>'care_level', ''))
    )).care_level,
    'lead',
    nullif(btrim(coalesce(p_payload->>'street', '')), ''),
    nullif(btrim(coalesce(p_payload->>'house_number', '')), ''),
    nullif(btrim(coalesce(p_payload->>'postal_code', '')), ''),
    nullif(btrim(coalesce(p_payload->>'city', '')), ''),
    nullif(btrim(coalesce(p_payload->>'phone', '')), ''),
    nullif(btrim(coalesce(p_payload->>'mobile', '')), ''),
    nullif(btrim(coalesce(p_payload->>'email', '')), ''),
    nullif(btrim(coalesce(p_payload->>'internal_notes', '')), ''),
    v_insurance_number,
    nullif(btrim(coalesce(p_payload->>'insurance_name', '')), ''),
    nullif(btrim(coalesce(p_payload->>'cost_bearer', '')), ''),
    nullif(p_payload->>'admission_date', '')::DATE,
    nullif(p_payload->>'gender', ''),
    p_actor_profile_id, p_actor_profile_id
  ) RETURNING * INTO v_client;

  INSERT INTO public.client_intake_request_receipts (
    request_id, tenant_id, actor_profile_id, proposed_client_id, client_id
  ) VALUES (
    p_request_id, p_tenant_id, p_actor_profile_id, p_proposed_client_id, v_client.id
  );

  RETURN jsonb_build_object('id', v_client.id, 'created', TRUE,
    'updated_at', v_client.updated_at, 'row', to_jsonb(v_client));
END;
$$;

REVOKE ALL ON FUNCTION public.web_reserve_client_intake_draft(UUID,UUID,UUID,UUID,JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.web_reserve_client_intake_draft(UUID,UUID,UUID,UUID,JSONB)
  TO authenticated;

-- CP303 extends this not-yet-applied migration. The old first-write endpoint
-- becomes owner-only below; there is no authenticated fallback around review.
CREATE SCHEMA IF NOT EXISTS client_intake_private;
REVOKE ALL ON SCHEMA client_intake_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA client_intake_private TO authenticated;

CREATE TABLE IF NOT EXISTS public.client_intake_identity_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  prepared_session_id UUID NOT NULL,
  identity_input JSONB NOT NULL,
  candidate_originals JSONB NOT NULL,
  decision_reason TEXT NOT NULL CHECK (length(decision_reason) BETWEEN 1 AND 1000),
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_request_id UUID UNIQUE,
  decided_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (jsonb_typeof(identity_input) = 'object'),
  CHECK (jsonb_typeof(candidate_originals) = 'array'),
  CHECK (jsonb_array_length(candidate_originals) <= 5000),
  CHECK (expires_at > prepared_at AND expires_at <= prepared_at + interval '5 minutes'),
  CHECK ((consumed_request_id IS NULL AND decided_at IS NULL)
    OR (consumed_request_id = request_id AND decided_at IS NOT NULL)),
  CHECK (revoked_at IS NULL OR consumed_request_id IS NULL)
);
ALTER TABLE public.client_intake_identity_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_intake_identity_reviews FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_client_intake_identity_reviews_tenant_request
  ON public.client_intake_identity_reviews (tenant_id, request_id);

ALTER TABLE public.client_intake_request_receipts
  ADD COLUMN IF NOT EXISTS identity_review_id UUID REFERENCES public.client_intake_identity_reviews(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS initial_payload JSONB,
  ADD COLUMN IF NOT EXISTS initial_row JSONB;

CREATE OR REPLACE FUNCTION client_intake_private.authorize(p_tenant_id UUID, p_actor_profile_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session UUID;
BEGIN
  v_session := nullif(auth.jwt()->>'session_id', '')::UUID;
  IF auth.uid() IS NULL OR v_session IS NULL
     OR coalesce((auth.jwt()->>'exp')::BIGINT, 0) <= extract(epoch FROM clock_timestamp())
     OR NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = v_session AND s.user_id = auth.uid())
     OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_tenant_id()
     OR p_actor_profile_id IS DISTINCT FROM auth.uid()
     OR NOT public.has_permission('office.clients.create')
     OR NOT public.has_permission('office.clients.view')
     OR NOT public.has_permission('office.clients.view_sensitive') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Die aktuelle Aufnahmeberechtigung ist nicht bestätigt.';
  END IF;
  RETURN v_session;
END;
$$;

-- Owner-only helper. All caller-visible entry points authorize first. A result
-- cap never counts as an empty or complete pool. Originals are not normalized.
CREATE OR REPLACE FUNCTION client_intake_private.current_pool(p_tenant_id UUID, p_identity JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_pool JSONB;
BEGIN
  WITH originals AS MATERIALIZED (
    SELECT c.id, c.tenant_id, c.first_name, c.last_name, c.date_of_birth,
      c.insurance_number, c.status, c.updated_at
    FROM public.clients c
    WHERE c.tenant_id = p_tenant_id AND (
      position(lower(p_identity->>'last_name') IN lower(c.last_name)) > 0
      OR (p_identity->>'insurance_number' IS NOT NULL
        AND lower(c.insurance_number) = lower(p_identity->>'insurance_number'))
    )
    ORDER BY c.id LIMIT 5001 FOR SHARE
  ) SELECT coalesce(jsonb_agg(to_jsonb(originals) ORDER BY originals.id), '[]'::JSONB)
      INTO v_pool FROM originals;
  IF jsonb_array_length(v_pool) > 5000 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I02', MESSAGE = 'Der Personenbestand muss erneut eingegrenzt und geprüft werden.';
  END IF;
  RETURN v_pool;
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.prepare_review(
  p_tenant_id UUID, p_actor_profile_id UUID, p_request_id UUID,
  p_identity JSONB, p_candidates JSONB, p_reason TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE
  v_session UUID; v_pool JSONB; v_review public.client_intake_identity_reviews%ROWTYPE;
  v_first TEXT; v_last TEXT; v_birth DATE; v_insurance TEXT; v_identity JSONB; v_reason TEXT;
  v_at TIMESTAMPTZ;
BEGIN
  v_session := client_intake_private.authorize(p_tenant_id, p_actor_profile_id);
  IF p_request_id IS NULL OR jsonb_typeof(p_identity) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_candidates) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_candidates) > 5000
    OR (p_identity - ARRAY['first_name','last_name','date_of_birth','insurance_number']) <> '{}'::JSONB THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Die Personenentscheidung ist unvollständig.';
  END IF;
  v_first := btrim(coalesce(p_identity->>'first_name', ''));
  v_last := btrim(coalesce(p_identity->>'last_name', ''));
  v_insurance := nullif(btrim(coalesce(p_identity->>'insurance_number', '')), '');
  v_reason := btrim(coalesce(p_reason, ''));
  IF v_first = '' OR v_last = '' OR length(v_first) > 150 OR length(v_last) > 150
    OR length(coalesce(v_insurance, '')) > 150
    OR coalesce(p_identity->>'date_of_birth', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR length(v_reason) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Die Personenentscheidung enthält ungültige Angaben.';
  END IF;
  v_birth := (p_identity->>'date_of_birth')::DATE;
  IF v_birth IS NULL OR to_char(v_birth, 'YYYY-MM-DD') <> p_identity->>'date_of_birth' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Das Geburtsdatum ist ungültig.';
  END IF;
  v_identity := jsonb_build_object('first_name', v_first, 'last_name', v_last,
    'date_of_birth', v_birth, 'insurance_number', v_insurance);
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:' || p_tenant_id::TEXT, 0));
  PERFORM client_intake_private.authorize(p_tenant_id, p_actor_profile_id);
  IF EXISTS (SELECT 1 FROM public.clients WHERE id = p_request_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I03', MESSAGE = 'Die Anfrage gehört bereits zu einer Akte.';
  END IF;
  v_pool := client_intake_private.current_pool(p_tenant_id, v_identity);
  IF jsonb_array_length(v_pool) <> jsonb_array_length(p_candidates)
    OR (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(p_candidates) item) <> jsonb_array_length(p_candidates)
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_candidates) supplied
      LEFT JOIN jsonb_array_elements(v_pool) original ON original->>'id' = supplied->>'id'
      WHERE original IS NULL OR (supplied - 'updated_at') IS DISTINCT FROM (original - 'updated_at')
        OR (supplied->>'updated_at') IS NULL
        OR (supplied->>'updated_at')::TIMESTAMPTZ IS DISTINCT FROM (original->>'updated_at')::TIMESTAMPTZ
    ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I02', MESSAGE = 'Der geprüfte Personenbestand hat sich geändert.';
  END IF;
  IF jsonb_array_length(v_pool) > 0 AND length(v_reason) < 10 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Die getrennte Neuanlage muss begründet werden.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clients c WHERE c.tenant_id = p_tenant_id AND (
      (lower(btrim(c.first_name)) = lower(v_first) AND lower(btrim(c.last_name)) = lower(v_last)
        AND c.date_of_birth = v_birth)
      OR (v_insurance IS NOT NULL AND lower(btrim(coalesce(c.insurance_number, ''))) = lower(v_insurance))
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I01', MESSAGE = 'Eine Person mit übereinstimmenden Identitätsmerkmalen ist bereits vorhanden.';
  END IF;
  v_at := clock_timestamp();
  INSERT INTO public.client_intake_identity_reviews (
    request_id, tenant_id, actor_profile_id, prepared_session_id, identity_input,
    candidate_originals, decision_reason, prepared_at, expires_at
  ) VALUES (p_request_id, p_tenant_id, p_actor_profile_id, v_session, v_identity,
    v_pool, v_reason, v_at, v_at + interval '5 minutes')
  RETURNING * INTO v_review;
  RETURN jsonb_build_object('review_id', v_review.id, 'request_id', v_review.request_id,
    'tenant_id', v_review.tenant_id, 'actor_profile_id', v_review.actor_profile_id,
    'resolution', 'create_distinct', 'candidate_count', jsonb_array_length(v_pool),
    'prepared_at', v_review.prepared_at, 'expires_at', v_review.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.confirm_reservation(
  p_tenant_id UUID, p_request_id UUID, p_actor_profile_id UUID, p_review_id UUID, p_payload JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE v_receipt public.client_intake_request_receipts%ROWTYPE; v_client public.clients%ROWTYPE;
  v_review public.client_intake_identity_reviews%ROWTYPE;
BEGIN
  PERFORM client_intake_private.authorize(p_tenant_id, p_actor_profile_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:' || p_tenant_id::TEXT, 0));
  SELECT * INTO v_receipt FROM public.client_intake_request_receipts
    WHERE request_id = p_request_id;
  IF NOT FOUND THEN
    -- Absence alone never authorizes another insert. Under the same transaction
    -- lock, irrevocably close this exact prepared review before allowing the
    -- operator to review again with the SAME locally reserved request UUID.
    SELECT * INTO v_review FROM public.client_intake_identity_reviews WHERE id = p_review_id FOR UPDATE;
    IF NOT FOUND OR v_review.request_id IS DISTINCT FROM p_request_id
      OR v_review.tenant_id IS DISTINCT FROM p_tenant_id OR v_review.actor_profile_id IS DISTINCT FROM p_actor_profile_id
      OR v_review.consumed_request_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.clients WHERE id = p_request_id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0I04', MESSAGE = 'Der unklare Aufnahmevorgang ist nicht vollständig aufklärbar.';
    END IF;
    PERFORM client_intake_private.authorize(p_tenant_id, p_actor_profile_id);
    UPDATE public.client_intake_identity_reviews SET revoked_at = coalesce(revoked_at, clock_timestamp())
      WHERE id = p_review_id RETURNING * INTO v_review;
    RETURN jsonb_build_object('id', p_request_id, 'request_id', p_request_id,
      'identity_review_id', p_review_id, 'tenant_id', p_tenant_id, 'actor_profile_id', p_actor_profile_id,
      'created', FALSE, 'disposition', 'review_revoked', 'revoked_at', v_review.revoked_at);
  END IF;
  IF p_review_id IS NULL OR v_receipt.identity_review_id IS DISTINCT FROM p_review_id
    OR v_receipt.tenant_id IS DISTINCT FROM p_tenant_id OR v_receipt.actor_profile_id IS DISTINCT FROM p_actor_profile_id
    OR v_receipt.client_id IS DISTINCT FROM p_request_id OR v_receipt.initial_payload IS DISTINCT FROM p_payload THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I04', MESSAGE = 'Die Aufnahme und ihre Personenentscheidung sind nicht bestätigt.';
  END IF;
  SELECT * INTO v_client FROM public.clients
    WHERE id = p_request_id AND tenant_id = p_tenant_id FOR SHARE;
  IF NOT FOUND OR v_client.status::TEXT <> 'lead' OR v_client.created_by IS DISTINCT FROM p_actor_profile_id
    OR v_receipt.initial_row IS DISTINCT FROM to_jsonb(v_client)
    OR NOT EXISTS (SELECT 1 FROM public.client_intake_identity_reviews r
      WHERE r.id = p_review_id AND r.tenant_id = p_tenant_id AND r.actor_profile_id = p_actor_profile_id
        AND r.request_id = p_request_id AND r.consumed_request_id = p_request_id AND r.decided_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I04', MESSAGE = 'Die ursprüngliche Aufnahme ist nicht unverändert bestätigt.';
  END IF;
  PERFORM client_intake_private.authorize(p_tenant_id, p_actor_profile_id);
  RETURN jsonb_build_object('id', v_client.id, 'request_id', p_request_id,
    'identity_review_id', p_review_id, 'created', FALSE, 'disposition', 'confirmed',
    'updated_at', v_client.updated_at, 'row', to_jsonb(v_client));
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.reserve_reviewed(
  p_tenant_id UUID, p_request_id UUID, p_proposed_client_id UUID,
  p_actor_profile_id UUID, p_review_id UUID, p_payload JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE v_session UUID; v_review public.client_intake_identity_reviews%ROWTYPE;
  v_receipt public.client_intake_request_receipts%ROWTYPE; v_pool JSONB; v_result JSONB; v_identity JSONB;
BEGIN
  v_session := client_intake_private.authorize(p_tenant_id, p_actor_profile_id);
  IF p_request_id IS NULL OR p_request_id IS DISTINCT FROM p_proposed_client_id OR p_review_id IS NULL
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Die bestätigte Aufnahme-Anfrage fehlt.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:' || p_tenant_id::TEXT, 0));
  PERFORM client_intake_private.authorize(p_tenant_id, p_actor_profile_id);
  SELECT * INTO v_receipt FROM public.client_intake_request_receipts WHERE request_id = p_request_id FOR UPDATE;
  IF FOUND THEN
    RETURN client_intake_private.confirm_reservation(p_tenant_id, p_request_id, p_actor_profile_id, p_review_id, p_payload);
  END IF;
  SELECT * INTO v_review FROM public.client_intake_identity_reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND OR v_review.request_id IS DISTINCT FROM p_request_id
    OR v_review.tenant_id IS DISTINCT FROM p_tenant_id OR v_review.actor_profile_id IS DISTINCT FROM p_actor_profile_id
    OR v_review.prepared_session_id IS DISTINCT FROM v_session OR v_review.expires_at <= clock_timestamp()
    OR v_review.consumed_request_id IS NOT NULL OR v_review.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I02', MESSAGE = 'Die Personenentscheidung muss erneut geprüft werden.';
  END IF;
  v_identity := jsonb_build_object('first_name', btrim(coalesce(p_payload->>'first_name', '')),
    'last_name', btrim(coalesce(p_payload->>'last_name', '')),
    'date_of_birth', nullif(p_payload->>'date_of_birth', '')::DATE,
    'insurance_number', nullif(btrim(coalesce(p_payload->>'insurance_number', '')), ''));
  IF v_identity IS DISTINCT FROM v_review.identity_input THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I02', MESSAGE = 'Die Identitätsangaben haben sich seit der Entscheidung geändert.';
  END IF;
  v_pool := client_intake_private.current_pool(p_tenant_id, v_identity);
  IF v_pool IS DISTINCT FROM v_review.candidate_originals THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I02', MESSAGE = 'Der geprüfte Personenbestand hat sich geändert.';
  END IF;
  PERFORM client_intake_private.authorize(p_tenant_id, p_actor_profile_id);
  v_result := public.web_reserve_client_intake_draft(p_tenant_id, p_request_id, p_proposed_client_id, p_actor_profile_id, p_payload);
  IF v_result->>'id' IS DISTINCT FROM p_request_id::TEXT OR v_result->'created' IS DISTINCT FROM 'true'::JSONB THEN
    RAISE EXCEPTION USING ERRCODE = 'P0I04', MESSAGE = 'Die Erstanlage ist nicht vollständig bestätigt.';
  END IF;
  UPDATE public.client_intake_request_receipts SET identity_review_id = p_review_id,
    initial_payload = p_payload, initial_row = v_result->'row'
    WHERE request_id = p_request_id AND tenant_id = p_tenant_id AND actor_profile_id = p_actor_profile_id
      AND identity_review_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0I04', MESSAGE = 'Die Anfragequittung ist nicht bestätigt.'; END IF;
  UPDATE public.client_intake_identity_reviews SET consumed_request_id = p_request_id, decided_at = clock_timestamp()
    WHERE id = p_review_id AND consumed_request_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0I04', MESSAGE = 'Die Personenentscheidung ist nicht bestätigt.'; END IF;
  RETURN v_result || jsonb_build_object('request_id', p_request_id, 'identity_review_id', p_review_id);
END;
$$;

-- API wrappers run as the caller. Privileged implementations stay in a
-- non-exposed schema and check the native session/tenant/actor on every call.
CREATE OR REPLACE FUNCTION public.web_prepare_client_intake_identity_review(
  p_tenant_id UUID, p_actor_profile_id UUID, p_request_id UUID, p_identity JSONB, p_candidates JSONB, p_reason TEXT
) RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT client_intake_private.prepare_review(p_tenant_id, p_actor_profile_id, p_request_id, p_identity, p_candidates, p_reason);
$$;
CREATE OR REPLACE FUNCTION public.web_reserve_reviewed_client_intake_draft(
  p_tenant_id UUID, p_request_id UUID, p_proposed_client_id UUID, p_actor_profile_id UUID, p_review_id UUID, p_payload JSONB
) RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT client_intake_private.reserve_reviewed(p_tenant_id, p_request_id, p_proposed_client_id, p_actor_profile_id, p_review_id, p_payload);
$$;
CREATE OR REPLACE FUNCTION public.web_confirm_reviewed_client_intake_draft(
  p_tenant_id UUID, p_request_id UUID, p_actor_profile_id UUID, p_review_id UUID, p_payload JSONB
) RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT client_intake_private.confirm_reservation(p_tenant_id, p_request_id, p_actor_profile_id, p_review_id, p_payload);
$$;

REVOKE ALL ON FUNCTION public.web_reserve_client_intake_draft(UUID,UUID,UUID,UUID,JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA client_intake_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION client_intake_private.prepare_review(UUID,UUID,UUID,JSONB,JSONB,TEXT),
  client_intake_private.reserve_reviewed(UUID,UUID,UUID,UUID,UUID,JSONB),
  client_intake_private.confirm_reservation(UUID,UUID,UUID,UUID,JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.web_prepare_client_intake_identity_review(UUID,UUID,UUID,JSONB,JSONB,TEXT),
  public.web_reserve_reviewed_client_intake_draft(UUID,UUID,UUID,UUID,UUID,JSONB),
  public.web_confirm_reviewed_client_intake_draft(UUID,UUID,UUID,UUID,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.web_prepare_client_intake_identity_review(UUID,UUID,UUID,JSONB,JSONB,TEXT),
  public.web_reserve_reviewed_client_intake_draft(UUID,UUID,UUID,UUID,UUID,JSONB),
  public.web_confirm_reviewed_client_intake_draft(UUID,UUID,UUID,UUID,JSONB) TO authenticated;

-- Durable completion evidence. The receipt does not infer clinical need,
-- capacity, signatures or acceptance from the draft. It records and rechecks
-- the operator's explicit decision and the complete native document originals.
CREATE TABLE IF NOT EXISTS public.client_intake_completion_receipts (
  request_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  prepared_session_id UUID NOT NULL,
  identity_review_id UUID NOT NULL REFERENCES public.client_intake_identity_reviews(id) ON DELETE RESTRICT,
  decision_original JSONB NOT NULL,
  document_originals JSONB NOT NULL,
  lead_updated_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prepared','active')),
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  activated_at TIMESTAMPTZ,
  final_row JSONB,
  CONSTRAINT client_intake_completion_scope UNIQUE (tenant_id, client_id, request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_intake_completion_open
  ON public.client_intake_completion_receipts (tenant_id, client_id) WHERE status = 'prepared';
ALTER TABLE public.client_intake_completion_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_intake_completion_receipts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION client_intake_private.authorize_completion(p_tenant_id UUID, p_actor_profile_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session UUID;
BEGIN
  v_session := client_intake_private.authorize(p_tenant_id, p_actor_profile_id);
  IF NOT public.has_permission('office.clients.edit') OR NOT public.has_permission('office.clients.status_change') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Die aktuelle Berechtigung zum Aufnahmeabschluss fehlt.';
  END IF;
  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.verify_completion_documents(
  p_tenant_id UUID, p_client_id UUID, p_originals JSONB, p_decision JSONB
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_doc JSONB; v_native public.client_intake_documents%ROWTYPE; v_signature RECORD;
  v_role TEXT; v_expected_signature JSONB; v_expected_count INTEGER; v_actual_count INTEGER;
  v_privacy BOOLEAN := FALSE; v_contract BOOLEAN := FALSE; v_selection RECORD; v_consent RECORD;
BEGIN
  IF jsonb_typeof(p_originals) IS DISTINCT FROM 'array' OR jsonb_array_length(p_originals) = 0
    OR jsonb_array_length(p_originals) IS DISTINCT FROM (SELECT count(DISTINCT value->>'templateKey') FROM jsonb_array_elements(p_originals))
    THEN RETURN FALSE;
  END IF;
  FOR v_doc IN SELECT value FROM jsonb_array_elements(p_originals) LOOP
    IF jsonb_typeof(v_doc) IS DISTINCT FROM 'object' OR coalesce(v_doc->>'templateKey','') = '' THEN RETURN FALSE; END IF;
    SELECT * INTO v_native FROM public.client_intake_documents
      WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND template_key=v_doc->>'templateKey';
    IF NOT FOUND OR v_native.document_type IS DISTINCT FROM v_doc->>'documentType'
      OR v_native.title IS DISTINCT FROM v_doc->>'title' OR v_native.status IS DISTINCT FROM v_doc->>'status'
      OR v_native.is_required IS DISTINCT FROM coalesce((v_doc->>'isRequired')::BOOLEAN,FALSE)
      OR v_native.version IS DISTINCT FROM (v_doc->>'version')::INTEGER
      OR v_native.source IS DISTINCT FROM v_doc->>'source'
      OR v_native.tenant_template_id IS DISTINCT FROM nullif(v_doc->>'tenantTemplateId','')::UUID
      OR v_native.preview_html IS DISTINCT FROM (v_doc->>'previewHtml')
      OR v_native.finalized_html IS DISTINCT FROM (v_doc->>'finalizedHtml')
      OR v_native.rendered_pdf_path IS DISTINCT FROM (v_doc->>'renderedPdfPath')
      OR v_native.missing_placeholders IS DISTINCT FROM coalesce(v_doc->'missingPlaceholders','[]'::JSONB)
      OR v_native.preview_opened_at IS DISTINCT FROM nullif(v_doc->>'previewOpenedAt','')::TIMESTAMPTZ
      OR v_native.finalized_at IS DISTINCT FROM nullif(v_doc->>'finalizedAt','')::TIMESTAMPTZ THEN RETURN FALSE;
    END IF;
    IF jsonb_typeof(coalesce(v_doc->'signatures','{}'::JSONB)) IS DISTINCT FROM 'object' THEN RETURN FALSE; END IF;
    v_expected_count := (SELECT count(*) FROM jsonb_each(v_doc->'signatures') e WHERE coalesce(e.value->>'dataUrl','') <> '');
    SELECT count(*) INTO v_actual_count FROM public.client_document_signatures WHERE document_id=v_native.id;
    IF v_actual_count IS DISTINCT FROM v_expected_count THEN RETURN FALSE; END IF;
    FOR v_role,v_expected_signature IN SELECT key,value FROM jsonb_each(v_doc->'signatures') LOOP
      IF coalesce(v_expected_signature->>'dataUrl','') = '' THEN CONTINUE; END IF;
      SELECT * INTO v_signature FROM public.client_document_signatures
        WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND document_id=v_native.id AND signer_role=v_role;
      IF NOT FOUND OR v_signature.signature_data IS DISTINCT FROM v_expected_signature->>'dataUrl'
        OR v_signature.signed_at IS DISTINCT FROM (v_expected_signature->>'signedAt')::TIMESTAMPTZ
        OR v_signature.signer_name IS DISTINCT FROM nullif(v_expected_signature->>'signerName','') THEN RETURN FALSE;
      END IF;
    END LOOP;
    IF v_native.template_key='privacy_consent_default' AND v_native.status='finalized'
      AND EXISTS(SELECT 1 FROM public.client_document_signatures s WHERE s.document_id=v_native.id AND s.signer_role='client') THEN v_privacy:=TRUE; END IF;
    IF v_native.document_type='client_contract' AND v_native.status='finalized'
      AND EXISTS(SELECT 1 FROM public.client_document_signatures s WHERE s.document_id=v_native.id AND s.signer_role='client')
      AND EXISTS(SELECT 1 FROM public.client_document_signatures s WHERE s.document_id=v_native.id AND s.signer_role='employee') THEN v_contract:=TRUE; END IF;
  END LOOP;
  IF NOT v_privacy OR NOT v_contract THEN RETURN FALSE; END IF;
  SELECT * INTO v_selection FROM public.client_contract_selection WHERE tenant_id=p_tenant_id AND client_id=p_client_id;
  IF NOT FOUND OR v_selection.contract_type IS DISTINCT FROM p_decision->>'contract_type' THEN RETURN FALSE; END IF;
  SELECT * INTO v_consent FROM public.client_consent_status WHERE tenant_id=p_tenant_id AND client_id=p_client_id;
  IF NOT FOUND OR v_consent.privacy_status IS DISTINCT FROM 'finalized' OR v_consent.contract_status IS DISTINCT FROM 'finalized'
    OR v_consent.privacy_finalized_at IS NULL OR v_consent.contract_finalized_at IS NULL THEN RETURN FALSE; END IF;
  RETURN TRUE;
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.prepare_completion(
  p_tenant_id UUID, p_client_id UUID, p_actor_profile_id UUID, p_request_id UUID,
  p_identity_review_id UUID, p_expected_lead_updated_at TIMESTAMPTZ, p_decision JSONB, p_document_evidence JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE v_session UUID; v_client public.clients%ROWTYPE; v_receipt public.client_intake_completion_receipts%ROWTYPE;
BEGIN
  v_session := client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  IF p_request_id IS NULL OR p_client_id IS NULL OR p_identity_review_id IS NULL
    OR jsonb_typeof(p_decision) IS DISTINCT FROM 'object'
    OR length(btrim(coalesce(p_decision->>'care_need_summary',''))) < 10
    OR p_decision->>'capacity_status' IS DISTINCT FROM 'confirmed'
    OR length(btrim(coalesce(p_decision->>'capacity_reference',''))) < 3
    OR p_decision->>'admission_decision' IS DISTINCT FROM 'accepted'
    OR length(btrim(coalesce(p_decision->>'admission_reason',''))) < 10
    OR nullif(p_decision->>'service_start','')::DATE IS NULL
    OR length(btrim(coalesce(p_decision->>'contract_type',''))) = 0 THEN
    RAISE EXCEPTION USING ERRCODE='P0I10', MESSAGE='Die fachlichen Voraussetzungen des Aufnahmeabschlusses fehlen.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant_id::TEXT,0));
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_receipt FROM public.client_intake_completion_receipts WHERE request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_receipt.tenant_id IS DISTINCT FROM p_tenant_id OR v_receipt.client_id IS DISTINCT FROM p_client_id
      OR v_receipt.actor_profile_id IS DISTINCT FROM p_actor_profile_id OR v_receipt.identity_review_id IS DISTINCT FROM p_identity_review_id
      OR v_receipt.decision_original IS DISTINCT FROM p_decision OR v_receipt.document_originals IS DISTINCT FROM p_document_evidence
      OR v_receipt.lead_updated_at IS DISTINCT FROM p_expected_lead_updated_at OR v_receipt.status IS DISTINCT FROM 'prepared' THEN
      RAISE EXCEPTION USING ERRCODE='P0I11', MESSAGE='Die Abschlussanfrage weicht vom unveränderten Original ab.';
    END IF;
    RETURN jsonb_build_object('request_id',v_receipt.request_id,'client_id',v_receipt.client_id,'status',v_receipt.status,'lead_updated_at',v_receipt.lead_updated_at);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.client_intake_request_receipts q JOIN public.client_intake_identity_reviews r ON r.id=q.identity_review_id
    WHERE q.tenant_id=p_tenant_id AND q.client_id=p_client_id AND q.actor_profile_id=p_actor_profile_id
      AND q.identity_review_id=p_identity_review_id AND r.consumed_request_id=q.request_id AND r.decided_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='P0I11', MESSAGE='Die ursprüngliche Personenentscheidung ist nicht bestätigt.';
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id FOR SHARE;
  IF NOT FOUND OR v_client.status::TEXT <> 'lead' OR v_client.updated_at IS DISTINCT FROM p_expected_lead_updated_at
    OR v_client.service_start IS DISTINCT FROM (p_decision->>'service_start')::DATE THEN
    RAISE EXCEPTION USING ERRCODE='P0I11', MESSAGE='Die Aufnahmeakte ist nicht im bestätigten Ausgangsstand.';
  END IF;
  IF NOT client_intake_private.verify_completion_documents(p_tenant_id,p_client_id,p_document_evidence,p_decision) THEN
    RAISE EXCEPTION USING ERRCODE='P0I12', MESSAGE='Vertrag, Einwilligung oder serverseitige Unterschriften sind nicht vollständig bestätigt.';
  END IF;
  INSERT INTO public.client_intake_completion_receipts(request_id,tenant_id,client_id,actor_profile_id,prepared_session_id,
    identity_review_id,decision_original,document_originals,lead_updated_at,status)
  VALUES(p_request_id,p_tenant_id,p_client_id,p_actor_profile_id,v_session,p_identity_review_id,p_decision,p_document_evidence,p_expected_lead_updated_at,'prepared')
  RETURNING * INTO v_receipt;
  RETURN jsonb_build_object('request_id',v_receipt.request_id,'client_id',v_receipt.client_id,'status',v_receipt.status,'lead_updated_at',v_receipt.lead_updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.finalize_completion(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,p_expected_lead_updated_at TIMESTAMPTZ
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET lock_timeout = '5s' AS $$
DECLARE v_receipt public.client_intake_completion_receipts%ROWTYPE; v_client public.clients%ROWTYPE;
BEGIN
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant_id::TEXT,0));
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_receipt FROM public.client_intake_completion_receipts WHERE request_id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_receipt.tenant_id IS DISTINCT FROM p_tenant_id OR v_receipt.client_id IS DISTINCT FROM p_client_id
    OR v_receipt.actor_profile_id IS DISTINCT FROM p_actor_profile_id THEN
    RAISE EXCEPTION USING ERRCODE='P0I13', MESSAGE='Die Abschlussquittung fehlt oder gehört zu einem anderen Vorgang.';
  END IF;
  IF v_receipt.status='active' THEN
    SELECT * INTO v_client FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id;
    IF NOT FOUND OR to_jsonb(v_client) IS DISTINCT FROM v_receipt.final_row THEN RAISE EXCEPTION USING ERRCODE='P0I13',MESSAGE='Der aktivierte Originalstand weicht ab.'; END IF;
    RETURN jsonb_build_object('request_id',p_request_id,'client_id',p_client_id,'status','active','lead_updated_at',v_client.updated_at,'row',to_jsonb(v_client));
  END IF;
  IF p_expected_lead_updated_at IS DISTINCT FROM (SELECT updated_at FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id)
    OR NOT client_intake_private.verify_completion_documents(p_tenant_id,p_client_id,v_receipt.document_originals,v_receipt.decision_original) THEN
    RAISE EXCEPTION USING ERRCODE='P0I13',MESSAGE='Akte oder Abschlussbelege haben sich seit der Prüfung geändert.';
  END IF;
  UPDATE public.clients SET status='active',updated_by=p_actor_profile_id
    WHERE tenant_id=p_tenant_id AND id=p_client_id AND status::TEXT='lead' AND updated_at=p_expected_lead_updated_at
    RETURNING * INTO v_client;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0I13',MESSAGE='Die Akte konnte nicht aus dem bestätigten Stand aktiviert werden.'; END IF;
  UPDATE public.client_intake_completion_receipts SET status='active',activated_at=clock_timestamp(),final_row=to_jsonb(v_client)
    WHERE request_id=p_request_id AND status='prepared' RETURNING * INTO v_receipt;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0I13',MESSAGE='Die Abschlussquittung konnte nicht bestätigt werden.'; END IF;
  RETURN jsonb_build_object('request_id',p_request_id,'client_id',p_client_id,'status','active','lead_updated_at',v_client.updated_at,'row',to_jsonb(v_client));
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.confirm_completion(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_receipt public.client_intake_completion_receipts%ROWTYPE; v_client public.clients%ROWTYPE;
BEGIN
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_receipt FROM public.client_intake_completion_receipts WHERE request_id=p_request_id;
  IF NOT FOUND OR v_receipt.tenant_id IS DISTINCT FROM p_tenant_id OR v_receipt.client_id IS DISTINCT FROM p_client_id
    OR v_receipt.actor_profile_id IS DISTINCT FROM p_actor_profile_id THEN
    RAISE EXCEPTION USING ERRCODE='P0I13',MESSAGE='Die Abschlussquittung ist nicht bestätigt.';
  END IF;
  IF v_receipt.status <> 'active' OR v_receipt.final_row IS NULL THEN
    RETURN jsonb_build_object('request_id',p_request_id,'client_id',p_client_id,'status','prepared','lead_updated_at',v_receipt.lead_updated_at);
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id;
  IF NOT FOUND OR to_jsonb(v_client) IS DISTINCT FROM v_receipt.final_row THEN
    RAISE EXCEPTION USING ERRCODE='P0I13',MESSAGE='Der aktivierte Originalstand weicht von der Quittung ab.';
  END IF;
  RETURN jsonb_build_object('request_id',p_request_id,'client_id',p_client_id,'status','active','lead_updated_at',v_client.updated_at,'row',to_jsonb(v_client));
END;
$$;

CREATE OR REPLACE FUNCTION public.web_prepare_client_intake_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_intake_private.prepare_completion($1,$2,$3,$4,$5,$6,$7,$8); $$;
CREATE OR REPLACE FUNCTION public.web_finalize_client_intake_completion(p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,p_expected_lead_updated_at TIMESTAMPTZ)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_intake_private.finalize_completion($1,$2,$3,$4,$5); $$;
CREATE OR REPLACE FUNCTION public.web_confirm_client_intake_completion(p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_intake_private.confirm_completion($1,$2,$3,$4); $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA client_intake_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION client_intake_private.prepare_review(UUID,UUID,UUID,JSONB,JSONB,TEXT),
  client_intake_private.reserve_reviewed(UUID,UUID,UUID,UUID,UUID,JSONB),client_intake_private.confirm_reservation(UUID,UUID,UUID,UUID,JSONB),
  client_intake_private.prepare_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB),
  client_intake_private.finalize_completion(UUID,UUID,UUID,UUID,TIMESTAMPTZ),client_intake_private.confirm_completion(UUID,UUID,UUID,UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.web_prepare_client_intake_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB),
  public.web_finalize_client_intake_completion(UUID,UUID,UUID,UUID,TIMESTAMPTZ),public.web_confirm_client_intake_completion(UUID,UUID,UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.web_prepare_client_intake_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB),
  public.web_finalize_client_intake_completion(UUID,UUID,UUID,UUID,TIMESTAMPTZ),public.web_confirm_client_intake_completion(UUID,UUID,UUID,UUID) TO authenticated;

-- CP309: a complete Web document packet has one transaction and one durable receipt.
-- This remains a private, unexecuted proposal; existing native entry points are not replaced.
CREATE TABLE IF NOT EXISTS public.client_intake_document_packet_receipts (
  request_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  actor_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  prepared_session_id UUID NOT NULL,
  packet_original JSONB NOT NULL,
  native_original JSONB NOT NULL,
  committed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, client_id, request_id)
);
ALTER TABLE public.client_intake_document_packet_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_intake_document_packet_receipts FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS client_intake_private.document_packet_write_scopes (
  transaction_id BIGINT NOT NULL,
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  request_id UUID NOT NULL,
  PRIMARY KEY (transaction_id, tenant_id, client_id)
);
ALTER TABLE client_intake_private.document_packet_write_scopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON client_intake_private.document_packet_write_scopes FROM PUBLIC, anon, authenticated;
ALTER TABLE public.client_intake_completion_receipts
  ADD COLUMN IF NOT EXISTS document_request_id UUID REFERENCES public.client_intake_document_packet_receipts(request_id);

CREATE OR REPLACE FUNCTION client_intake_private.document_packet_snapshot(p_tenant_id UUID,p_client_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('tenant_id',p_tenant_id,'client_id',p_client_id,
    'documents',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM public.client_intake_documents d
      WHERE d.tenant_id=p_tenant_id AND d.client_id=p_client_id),'[]'::JSONB),
    'signatures',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.client_document_signatures s
      WHERE s.tenant_id=p_tenant_id AND s.client_id=p_client_id),'[]'::JSONB),
    'records',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.client_documents r
      WHERE r.tenant_id=p_tenant_id AND r.client_id=p_client_id AND r.intake_document_id IS NOT NULL),'[]'::JSONB),
    'events',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.client_document_events e
      WHERE e.tenant_id=p_tenant_id AND e.client_id=p_client_id AND e.event_type='web_intake_packet_committed'),'[]'::JSONB),
    'selection',(SELECT to_jsonb(c) FROM public.client_contract_selection c WHERE c.tenant_id=p_tenant_id AND c.client_id=p_client_id),
    'consent',(SELECT to_jsonb(c) FROM public.client_consent_status c WHERE c.tenant_id=p_tenant_id AND c.client_id=p_client_id));
$$;

CREATE OR REPLACE FUNCTION client_intake_private.document_packet_envelope(p_receipt public.client_intake_document_packet_receipts)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('request_id',p_receipt.request_id,'tenant_id',p_receipt.tenant_id,'client_id',p_receipt.client_id,
    'actor_profile_id',p_receipt.actor_profile_id,'status','committed','committed_at',p_receipt.committed_at,
    'packet_original',p_receipt.packet_original,'native_original',p_receipt.native_original);
$$;

CREATE OR REPLACE FUNCTION client_intake_private.read_document_packet(p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_client public.clients%ROWTYPE; v_original JSONB;
BEGIN
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant_id::TEXT,0));
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_client FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id FOR SHARE;
  IF NOT FOUND OR v_client.status::TEXT <> 'lead' THEN
    RAISE EXCEPTION USING ERRCODE='P0D01',MESSAGE='Die Aufnahmeakte ist nicht als offener Entwurf bestätigt.';
  END IF;
  v_original := client_intake_private.document_packet_snapshot(p_tenant_id,p_client_id);
  IF octet_length(v_original::TEXT)>16000000 OR jsonb_array_length(v_original->'documents')>50
    OR jsonb_array_length(v_original->'events')>5000 THEN
    RAISE EXCEPTION USING ERRCODE='P0D01',MESSAGE='Der Originalbestand kann nicht vollständig geprüft werden.';
  END IF;
  RETURN jsonb_build_object('lead_updated_at',v_client.updated_at,'original',v_original);
END;
$$;

-- Shared tables stay available to native callers for records that have never
-- been bound to a Web packet. For a bound packet, direct edits cannot silently
-- change the originals while the completion RPC is checking them.
CREATE OR REPLACE FUNCTION client_intake_private.guard_document_packet_originals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_old JSONB; v_new JSONB; v_tenant UUID; v_client UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old:=to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new:=to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME='client_documents' AND nullif(v_old->>'intake_document_id','') IS NULL
    AND nullif(v_new->>'intake_document_id','') IS NULL THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME='client_document_events' AND coalesce(v_old->>'event_type','') <> 'web_intake_packet_committed'
    AND coalesce(v_new->>'event_type','') <> 'web_intake_packet_committed' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  -- Check both sides: moving a protected row out of its original scope is also an edit.
  FOR v_tenant,v_client IN SELECT DISTINCT (value->>'tenant_id')::UUID,(value->>'client_id')::UUID
    FROM jsonb_array_elements(jsonb_build_array(v_old,v_new)) WHERE value IS NOT NULL AND value <> 'null'::JSONB LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||v_tenant::TEXT,0));
    IF EXISTS(SELECT 1 FROM public.client_intake_document_packet_receipts WHERE tenant_id=v_tenant AND client_id=v_client)
      AND NOT EXISTS(SELECT 1 FROM client_intake_private.document_packet_write_scopes
        WHERE transaction_id=txid_current() AND tenant_id=v_tenant AND client_id=v_client) THEN
      RAISE EXCEPTION USING ERRCODE='P0D03',MESSAGE='Die bestätigten Aufnahmeoriginale benötigen einen eigenen Korrekturvorgang.';
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['client_intake_documents','client_document_signatures','client_contract_selection',
    'client_consent_status','client_documents','client_document_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS web_intake_packet_original_guard ON public.%I',v_table);
    EXECUTE format('CREATE TRIGGER web_intake_packet_original_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_document_packet_originals()',v_table);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.commit_document_packet(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,
  p_expected_lead_updated_at TIMESTAMPTZ,p_expected_original JSONB,p_packet JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_session UUID; v_client public.clients%ROWTYPE; v_receipt public.client_intake_document_packet_receipts%ROWTYPE;
  v_doc JSONB; v_sig JSONB; v_role TEXT; v_native public.client_intake_documents%ROWTYPE; v_doc_id UUID;
  v_old_signature RECORD; v_old_doc JSONB; v_record public.client_documents%ROWTYPE; v_original JSONB;
  v_privacy JSONB; v_contract JSONB; v_assignment JSONB; v_contract_count INTEGER;
  v_template public.intake_document_system_templates%ROWTYPE; v_tenant_template public.tenant_document_templates%ROWTYPE;
BEGIN
  v_session:=client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  IF p_request_id IS NULL OR p_client_id IS NULL OR p_expected_lead_updated_at IS NULL
    OR jsonb_typeof(p_packet) IS DISTINCT FROM 'object' OR jsonb_typeof(p_packet->'documents') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_packet->'assignmentEnabled') IS DISTINCT FROM 'boolean'
    OR jsonb_array_length(p_packet->'documents') NOT BETWEEN 1 AND 50 OR octet_length(p_packet::TEXT)>12000000
    OR jsonb_array_length(p_packet->'documents') IS DISTINCT FROM
      (SELECT count(DISTINCT value->>'templateKey') FROM jsonb_array_elements(p_packet->'documents')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Das Aufnahmeunterlagenpaket ist nicht vollständig.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant_id::TEXT,0));
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_receipt FROM public.client_intake_document_packet_receipts WHERE request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_receipt.tenant_id IS DISTINCT FROM p_tenant_id OR v_receipt.client_id IS DISTINCT FROM p_client_id
      OR v_receipt.actor_profile_id IS DISTINCT FROM p_actor_profile_id OR v_receipt.packet_original IS DISTINCT FROM p_packet
      OR v_receipt.native_original IS DISTINCT FROM client_intake_private.document_packet_snapshot(p_tenant_id,p_client_id) THEN
      RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Die Unterlagenquittung gehört nicht zum unveränderten Original.';
    END IF;
    RETURN client_intake_private.document_packet_envelope(v_receipt);
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id FOR UPDATE;
  IF NOT FOUND OR v_client.status::TEXT <> 'lead' OR v_client.updated_at IS DISTINCT FROM p_expected_lead_updated_at
    OR p_expected_original IS DISTINCT FROM client_intake_private.document_packet_snapshot(p_tenant_id,p_client_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0D01',MESSAGE='Akte oder Aufnahmeunterlagen wurden zwischenzeitlich geändert.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.client_intake_completion_receipts WHERE tenant_id=p_tenant_id AND client_id=p_client_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0D03',MESSAGE='Ein bereits begonnener Aufnahmeabschluss sperrt neue Unterlagenwrites.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.client_intake_documents d WHERE d.tenant_id=p_tenant_id AND d.client_id=p_client_id
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_packet->'documents') p WHERE p->>'templateKey'=d.template_key)) THEN
    RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Vorhandene Originalunterlagen dürfen nicht stillschweigend entfernt werden.';
  END IF;
  INSERT INTO client_intake_private.document_packet_write_scopes VALUES(txid_current(),p_tenant_id,p_client_id,p_request_id);
  SELECT count(*) INTO v_contract_count FROM jsonb_array_elements(p_packet->'documents') WHERE value->>'documentType'='client_contract';
  IF v_contract_count>1 OR p_packet->>'contractType' IS NOT NULL AND p_packet->>'contractType' NOT IN
    ('assist','ambulatory_care','stationary_care','day_care','care_consulting','relief_services') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Die Vertragsgrundlage ist nicht eindeutig.';
  END IF;
  FOR v_doc IN SELECT value FROM jsonb_array_elements(p_packet->'documents') LOOP
    IF jsonb_typeof(v_doc) IS DISTINCT FROM 'object' OR coalesce(v_doc->>'templateKey','') !~ '^[a-zA-Z0-9_.-]{1,160}$'
      OR length(btrim(coalesce(v_doc->>'title','')))=0 OR (v_doc->>'version')::INTEGER<1
      OR v_doc->>'source' NOT IN ('system','tenant')
      OR v_doc->>'documentType' NOT IN ('privacy_consent','client_contract','assignment_declaration','additional_consent')
      OR v_doc->>'status' NOT IN ('not_started','preview_open','pending_signature','signed','declined','skipped_optional','finalized','revoked','replaced')
      OR jsonb_typeof(v_doc->'isRequired') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(v_doc->'missingPlaceholders') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_doc->'unresolvedKeys') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_doc->'signatures') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Eine Aufnahmeunterlage ist nicht vollständig beschrieben.';
    END IF;
    IF v_doc->>'status'='finalized' AND (coalesce(v_doc->>'finalizedHtml','')='' OR v_doc->>'finalizedAt' IS NULL
      OR jsonb_array_length(v_doc->'missingPlaceholders')<>0) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Eine abgeschlossene Unterlage besitzt keinen vollständigen Originalstand.';
    END IF;
    SELECT * INTO v_native FROM public.client_intake_documents WHERE tenant_id=p_tenant_id AND client_id=p_client_id
      AND template_key=v_doc->>'templateKey' FOR UPDATE;
    -- An existing frozen original keeps its historical version. New/open documents
    -- must refer to an actual currently applicable template of the same tenant.
    IF v_native.id IS NULL OR v_native.status NOT IN ('finalized','revoked','replaced') THEN
      SELECT * INTO v_template FROM public.intake_document_system_templates
        WHERE template_key=v_doc->>'templateKey' AND is_active;
      IF NOT FOUND OR v_template.version IS DISTINCT FROM (v_doc->>'version')::INTEGER
        OR v_template.document_type IS DISTINCT FROM v_doc->>'documentType'
        OR (v_template.is_required OR v_template.document_type IN ('privacy_consent','client_contract'))
          AND (v_doc->>'isRequired')::BOOLEAN IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Die ursprüngliche aktive Dokumentvorlage ist nicht bestätigt.';
      END IF;
      IF v_doc->>'source'='tenant' THEN
        SELECT * INTO v_tenant_template FROM public.tenant_document_templates WHERE id=(v_doc->>'tenantTemplateId')::UUID
          AND tenant_id=p_tenant_id AND template_key=v_doc->>'templateKey' AND is_active;
        IF NOT FOUND OR v_tenant_template.document_type IS DISTINCT FROM v_template.document_type
          OR v_tenant_template.system_template_id IS DISTINCT FROM v_template.id THEN
          RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Die mandanteneigene Quellvorlage ist nicht bestätigt.';
        END IF;
      ELSIF v_doc->>'tenantTemplateId' IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Eine Systemvorlage darf keine fremde Quellkennung übernehmen.';
      END IF;
      IF v_doc->>'status'='finalized' AND (
        v_template.requires_client_signature AND NOT (v_doc->'signatures' ? 'client')
        OR v_template.requires_employee_signature AND NOT (v_doc->'signatures' ? 'employee')
        OR v_template.requires_representative_signature AND NOT (v_doc->'signatures' ? 'legal_representative')
        OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_template.signature_slots) slot
          WHERE (slot->>'required')::BOOLEAN AND NOT (v_doc->'signatures' ? (slot->>'role')))) THEN
        RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Eine für diese Dokumentfassung erforderliche Unterschrift fehlt.';
      END IF;
    END IF;
    IF v_native.id IS NOT NULL THEN
      -- Existing signatures cannot be replaced, removed or retimed, including a one-microsecond change.
      FOR v_old_signature IN SELECT * FROM public.client_document_signatures WHERE document_id=v_native.id LOOP
        v_sig:=v_doc->'signatures'->v_old_signature.signer_role;
        IF v_old_signature.tenant_id IS DISTINCT FROM p_tenant_id OR v_old_signature.client_id IS DISTINCT FROM p_client_id
          OR v_sig IS NULL OR v_old_signature.signature_data IS DISTINCT FROM v_sig->>'dataUrl'
          OR v_old_signature.signer_name IS DISTINCT FROM v_sig->>'signerName'
          OR v_old_signature.signed_at IS DISTINCT FROM (v_sig->>'signedAt')::TIMESTAMPTZ THEN
          RAISE EXCEPTION USING ERRCODE='P0D03',MESSAGE='Eine vorhandene Unterschrift darf nicht überschrieben werden.';
        END IF;
      END LOOP;
      IF v_native.status IN ('finalized','revoked','replaced') THEN
        v_old_doc:=jsonb_build_object('templateKey',v_native.template_key,'documentType',v_native.document_type,
          'title',v_native.title,'status',v_native.status,'isRequired',v_native.is_required,'version',v_native.version,
          'source',v_native.source,'tenantTemplateId',v_native.tenant_template_id,'previewHtml',v_native.preview_html,
          'finalizedHtml',v_native.finalized_html,'renderedPdfPath',v_native.rendered_pdf_path,'missingPlaceholders',v_native.missing_placeholders);
        IF v_old_doc IS DISTINCT FROM (v_doc-'signatures'-'previewOpenedAt'-'finalizedAt'-'unresolvedKeys')
          OR v_native.preview_opened_at IS DISTINCT FROM (v_doc->>'previewOpenedAt')::TIMESTAMPTZ
          OR v_native.finalized_at IS DISTINCT FROM (v_doc->>'finalizedAt')::TIMESTAMPTZ
          OR (SELECT count(*) FROM public.client_document_signatures WHERE document_id=v_native.id)
            IS DISTINCT FROM (SELECT count(*) FROM jsonb_object_keys(v_doc->'signatures')) THEN
          RAISE EXCEPTION USING ERRCODE='P0D03',MESSAGE='Ein abgeschlossenes Dokument bleibt als vollständiges Original gesperrt.';
        END IF;
        v_doc_id:=v_native.id;
      ELSE
        UPDATE public.client_intake_documents SET document_type=v_doc->>'documentType',title=v_doc->>'title',status=v_doc->>'status',
          is_required=(v_doc->>'isRequired')::BOOLEAN,version=(v_doc->>'version')::INTEGER,source=v_doc->>'source',
          tenant_template_id=(v_doc->>'tenantTemplateId')::UUID,preview_html=v_doc->>'previewHtml',finalized_html=v_doc->>'finalizedHtml',
          rendered_pdf_path=v_doc->>'renderedPdfPath',missing_placeholders=v_doc->'missingPlaceholders',
          preview_opened_at=(v_doc->>'previewOpenedAt')::TIMESTAMPTZ,finalized_at=(v_doc->>'finalizedAt')::TIMESTAMPTZ,updated_by=p_actor_profile_id
          WHERE id=v_native.id RETURNING id INTO v_doc_id;
      END IF;
    ELSE
      INSERT INTO public.client_intake_documents(tenant_id,client_id,template_key,document_type,title,status,is_required,version,source,
        tenant_template_id,preview_html,finalized_html,rendered_pdf_path,missing_placeholders,preview_opened_at,finalized_at,updated_by)
      VALUES(p_tenant_id,p_client_id,v_doc->>'templateKey',v_doc->>'documentType',v_doc->>'title',v_doc->>'status',
        (v_doc->>'isRequired')::BOOLEAN,(v_doc->>'version')::INTEGER,v_doc->>'source',(v_doc->>'tenantTemplateId')::UUID,
        v_doc->>'previewHtml',v_doc->>'finalizedHtml',v_doc->>'renderedPdfPath',v_doc->'missingPlaceholders',
        (v_doc->>'previewOpenedAt')::TIMESTAMPTZ,(v_doc->>'finalizedAt')::TIMESTAMPTZ,p_actor_profile_id) RETURNING id INTO v_doc_id;
    END IF;
    FOR v_role,v_sig IN SELECT key,value FROM jsonb_each(v_doc->'signatures') LOOP
      IF v_role NOT IN ('client','employee','legal_representative') OR v_sig->>'role' IS DISTINCT FROM v_role
        OR coalesce(v_sig->>'dataUrl','') !~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$'
        OR octet_length(v_sig->>'dataUrl')>2000000 OR v_sig->>'signedAt' IS NULL THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Ein Signaturoriginal ist nicht vollständig.';
      END IF;
      INSERT INTO public.client_document_signatures(tenant_id,client_id,document_id,signer_role,signature_data,signed_at,signer_name)
        VALUES(p_tenant_id,p_client_id,v_doc_id,v_role,v_sig->>'dataUrl',(v_sig->>'signedAt')::TIMESTAMPTZ,v_sig->>'signerName')
        ON CONFLICT(document_id,signer_role) DO NOTHING;
    END LOOP;
    IF v_doc->>'status'='finalized' THEN
      IF (SELECT count(*) FROM public.client_documents WHERE tenant_id=p_tenant_id AND client_id=p_client_id
        AND intake_document_id=v_doc_id)>1 THEN
        RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Der Originalbeleg ist mehrfach mit der Akte verknüpft.';
      END IF;
      SELECT * INTO v_record FROM public.client_documents WHERE tenant_id=p_tenant_id AND client_id=p_client_id
        AND intake_document_id=v_doc_id;
      IF NOT FOUND THEN
        -- Never relabel an independently uploaded file merely because its name matches.
        IF EXISTS(SELECT 1 FROM public.client_documents WHERE tenant_id=p_tenant_id AND client_id=p_client_id
          AND file_name=(v_doc->>'templateKey')||'.html') THEN
          RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Ein gleichnamiger Aktenbeleg ist bereits anderweitig belegt.';
        END IF;
        INSERT INTO public.client_documents(tenant_id,client_id,title,file_name,mime_type,category,status,sensitivity,source,intake_document_id,portal_visible,uploaded_by)
        VALUES(p_tenant_id,p_client_id,v_doc->>'title',(v_doc->>'templateKey')||'.html','text/html',
          CASE WHEN v_doc->>'documentType' IN ('client_contract','assignment_declaration') THEN 'vertrag' ELSE 'einwilligung' END,
          'abgeschlossen','care','intake',v_doc_id,TRUE,p_actor_profile_id);
      ELSIF v_record.source IS DISTINCT FROM 'intake' OR v_record.mime_type IS DISTINCT FROM 'text/html'
        OR v_record.status IS DISTINCT FROM 'abgeschlossen' OR v_record.portal_visible IS DISTINCT FROM TRUE
        OR v_record.file_name IS DISTINCT FROM (v_doc->>'templateKey')||'.html' THEN
        RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Der verknüpfte Aktenbeleg weicht vom Original ab.';
      END IF;
    END IF;
    INSERT INTO public.client_document_events(tenant_id,client_id,document_id,event_type,summary,metadata_json,actor_profile_id)
    VALUES(p_tenant_id,p_client_id,v_doc_id,'web_intake_packet_committed','Aufnahmeunterlagen gemeinsam gesichert',
      jsonb_build_object('request_id',p_request_id),p_actor_profile_id);
    IF v_doc->>'templateKey'='privacy_consent_default' THEN v_privacy:=v_doc; END IF;
    IF v_doc->>'documentType'='client_contract' THEN v_contract:=v_doc; END IF;
    IF v_doc->>'templateKey'='assignment_declaration_care_health_insurance' THEN v_assignment:=v_doc; END IF;
  END LOOP;
  IF p_packet->>'contractType' IS NOT NULL THEN
    INSERT INTO public.client_contract_selection(tenant_id,client_id,contract_type,selected_template_key,updated_by)
    VALUES(p_tenant_id,p_client_id,p_packet->>'contractType',v_contract->>'templateKey',p_actor_profile_id)
    ON CONFLICT(tenant_id,client_id) DO UPDATE SET contract_type=excluded.contract_type,selected_template_key=excluded.selected_template_key,updated_by=excluded.updated_by;
  ELSIF EXISTS(SELECT 1 FROM public.client_contract_selection WHERE tenant_id=p_tenant_id AND client_id=p_client_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Eine vorhandene Vertragsauswahl darf nicht stillschweigend entfallen.';
  END IF;
  INSERT INTO public.client_consent_status(tenant_id,client_id,privacy_status,contract_status,assignment_status,privacy_finalized_at,contract_finalized_at,updated_by)
  VALUES(p_tenant_id,p_client_id,coalesce(v_privacy->>'status','not_started'),coalesce(v_contract->>'status','not_started'),
    CASE WHEN (p_packet->>'assignmentEnabled')::BOOLEAN THEN coalesce(v_assignment->>'status','not_started') ELSE 'skipped_optional' END,
    (v_privacy->>'finalizedAt')::TIMESTAMPTZ,(v_contract->>'finalizedAt')::TIMESTAMPTZ,p_actor_profile_id)
  ON CONFLICT(tenant_id,client_id) DO UPDATE SET privacy_status=excluded.privacy_status,contract_status=excluded.contract_status,
    assignment_status=excluded.assignment_status,privacy_finalized_at=excluded.privacy_finalized_at,contract_finalized_at=excluded.contract_finalized_at,updated_by=excluded.updated_by;
  v_original:=client_intake_private.document_packet_snapshot(p_tenant_id,p_client_id);
  INSERT INTO public.client_intake_document_packet_receipts(request_id,tenant_id,client_id,actor_profile_id,prepared_session_id,packet_original,native_original)
  VALUES(p_request_id,p_tenant_id,p_client_id,p_actor_profile_id,v_session,p_packet,v_original) RETURNING * INTO v_receipt;
  DELETE FROM client_intake_private.document_packet_write_scopes WHERE transaction_id=txid_current() AND tenant_id=p_tenant_id AND client_id=p_client_id;
  RETURN client_intake_private.document_packet_envelope(v_receipt);
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.confirm_document_packet(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,p_packet JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_receipt public.client_intake_document_packet_receipts%ROWTYPE;
BEGIN
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant_id::TEXT,0));
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  SELECT * INTO v_receipt FROM public.client_intake_document_packet_receipts WHERE request_id=p_request_id;
  IF NOT FOUND OR v_receipt.tenant_id IS DISTINCT FROM p_tenant_id OR v_receipt.client_id IS DISTINCT FROM p_client_id
    OR v_receipt.actor_profile_id IS DISTINCT FROM p_actor_profile_id OR v_receipt.packet_original IS DISTINCT FROM p_packet
    OR v_receipt.native_original IS DISTINCT FROM client_intake_private.document_packet_snapshot(p_tenant_id,p_client_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Das versandte Unterlagenpaket ist nicht unverändert bestätigt.';
  END IF;
  RETURN client_intake_private.document_packet_envelope(v_receipt);
END;
$$;

CREATE OR REPLACE FUNCTION client_intake_private.prepare_packet_completion(
  p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,p_identity_review_id UUID,
  p_expected_lead_updated_at TIMESTAMPTZ,p_decision JSONB,p_document_evidence JSONB,p_document_request_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_packet public.client_intake_document_packet_receipts%ROWTYPE; v_result JSONB;
BEGIN
  PERFORM client_intake_private.authorize_completion(p_tenant_id,p_actor_profile_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('client-intake:'||p_tenant_id::TEXT,0));
  SELECT * INTO v_packet FROM public.client_intake_document_packet_receipts WHERE request_id=p_document_request_id;
  IF NOT FOUND OR v_packet.tenant_id IS DISTINCT FROM p_tenant_id OR v_packet.client_id IS DISTINCT FROM p_client_id
    OR v_packet.actor_profile_id IS DISTINCT FROM p_actor_profile_id OR v_packet.packet_original->'documents' IS DISTINCT FROM p_document_evidence
    OR v_packet.packet_original->>'contractType' IS DISTINCT FROM p_decision->>'contract_type'
    OR v_packet.native_original IS DISTINCT FROM client_intake_private.document_packet_snapshot(p_tenant_id,p_client_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Die Aufnahme benötigt die vollständige ursprüngliche Unterlagenquittung.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.client_intake_completion_receipts WHERE request_id=p_request_id
    AND document_request_id IS DISTINCT FROM p_document_request_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Die Abschlussanfrage ist an ein anderes Unterlagenpaket gebunden.';
  END IF;
  v_result:=client_intake_private.prepare_completion(p_tenant_id,p_client_id,p_actor_profile_id,p_request_id,p_identity_review_id,
    p_expected_lead_updated_at,p_decision,p_document_evidence);
  UPDATE public.client_intake_completion_receipts SET document_request_id=p_document_request_id WHERE request_id=p_request_id;
  RETURN v_result;
END;
$$;

-- This check also fences activation against direct changes in the shared source tables.
CREATE OR REPLACE FUNCTION client_intake_private.guard_completion_packet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_packet public.client_intake_document_packet_receipts%ROWTYPE;
BEGIN
  IF NEW.status='active' AND OLD.status='prepared' THEN
    SELECT * INTO v_packet FROM public.client_intake_document_packet_receipts WHERE request_id=NEW.document_request_id;
    IF NOT FOUND OR v_packet.tenant_id IS DISTINCT FROM NEW.tenant_id OR v_packet.client_id IS DISTINCT FROM NEW.client_id
      OR v_packet.actor_profile_id IS DISTINCT FROM NEW.actor_profile_id
      OR v_packet.packet_original->'documents' IS DISTINCT FROM NEW.document_originals
      OR v_packet.native_original IS DISTINCT FROM client_intake_private.document_packet_snapshot(NEW.tenant_id,NEW.client_id) THEN
      RAISE EXCEPTION USING ERRCODE='P0D02',MESSAGE='Die vollständigen Aufnahmeoriginale sind vor Aktivierung nicht bestätigt.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS web_intake_completion_packet_guard ON public.client_intake_completion_receipts;
CREATE TRIGGER web_intake_completion_packet_guard BEFORE UPDATE ON public.client_intake_completion_receipts
  FOR EACH ROW EXECUTE FUNCTION client_intake_private.guard_completion_packet();

CREATE OR REPLACE FUNCTION public.web_read_client_intake_document_packet(p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_intake_private.read_document_packet($1,$2,$3); $$;
CREATE OR REPLACE FUNCTION public.web_commit_client_intake_document_packet(p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,p_expected_lead_updated_at TIMESTAMPTZ,p_expected_original JSONB,p_packet JSONB)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_intake_private.commit_document_packet($1,$2,$3,$4,$5,$6,$7); $$;
CREATE OR REPLACE FUNCTION public.web_confirm_client_intake_document_packet(p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,p_packet JSONB)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_intake_private.confirm_document_packet($1,$2,$3,$4,$5); $$;
CREATE OR REPLACE FUNCTION public.web_prepare_packet_client_intake_completion(p_tenant_id UUID,p_client_id UUID,p_actor_profile_id UUID,p_request_id UUID,p_identity_review_id UUID,p_expected_lead_updated_at TIMESTAMPTZ,p_decision JSONB,p_document_evidence JSONB,p_document_request_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT client_intake_private.prepare_packet_completion($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;
REVOKE ALL ON FUNCTION client_intake_private.prepare_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB),
  public.web_prepare_client_intake_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION client_intake_private.document_packet_snapshot(UUID,UUID),
  client_intake_private.document_packet_envelope(public.client_intake_document_packet_receipts),
  client_intake_private.guard_document_packet_originals(),client_intake_private.guard_completion_packet(),
  client_intake_private.read_document_packet(UUID,UUID,UUID),
  client_intake_private.commit_document_packet(UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB),
  client_intake_private.confirm_document_packet(UUID,UUID,UUID,UUID,JSONB),
  client_intake_private.prepare_packet_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,UUID),
  public.web_read_client_intake_document_packet(UUID,UUID,UUID),
  public.web_commit_client_intake_document_packet(UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB),
  public.web_confirm_client_intake_document_packet(UUID,UUID,UUID,UUID,JSONB),
  public.web_prepare_packet_client_intake_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION client_intake_private.read_document_packet(UUID,UUID,UUID),
  client_intake_private.commit_document_packet(UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB),
  client_intake_private.confirm_document_packet(UUID,UUID,UUID,UUID,JSONB),
  client_intake_private.prepare_packet_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,UUID),
  public.web_read_client_intake_document_packet(UUID,UUID,UUID),
  public.web_commit_client_intake_document_packet(UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB),
  public.web_confirm_client_intake_document_packet(UUID,UUID,UUID,UUID,JSONB),
  public.web_prepare_packet_client_intake_completion(UUID,UUID,UUID,UUID,UUID,TIMESTAMPTZ,JSONB,JSONB,UUID) TO authenticated;

COMMIT;
