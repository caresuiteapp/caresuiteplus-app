-- REVIEW ONLY, fifth monthly draft. No live migration or automatic authorization.
-- A named responsible reviewer records an actually reviewed authority (including
-- paper evidence). This is a human review record, not proof of document authenticity.
BEGIN;
-- Same character/length contract as the browser; malformed review text must not
-- poison later list reads. Format controls are not meaningful in these labels.
CREATE FUNCTION care_security.gkv_monthly_authority_text(p text,minimum integer,maximum integer) RETURNS boolean
 LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT p IS NOT NULL AND length(btrim(p))>=minimum AND length(p)<=maximum AND p !~ '[[:cntrl:]]'
  AND p !~ U&'[\00AD\0600-\0605\061C\06DD\070F\0890-\0891\08E2\180E\200B-\200F\202A-\202E\2060-\2064\2066-\206F\FEFF\FFF9-\FFFB\+0110BD\+0110CD\+013430-\+01343F\+01BCA0-\+01BCA3\+01D173-\+01D17A\+0E0001\+0E0020-\+0E007F]'
$$;
CREATE TABLE care_security.gkv_monthly_authorities (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 client_id uuid NOT NULL REFERENCES public.clients(id), service_type text NOT NULL CHECK(service_type ~ '^(0[1-9]|1[0-5])$'),
 signer_name text NOT NULL CHECK(care_security.gkv_monthly_authority_text(signer_name,2,300)),
 basis text NOT NULL CHECK(basis IN ('vollmacht','gesetzliche_vertretung','angehoerige')),
 evidence_reference text NOT NULL CHECK(care_security.gkv_monthly_authority_text(evidence_reference,3,500)),
 review_note text NOT NULL CHECK(care_security.gkv_monthly_authority_text(review_note,10,1000)),
 valid_from timestamptz NOT NULL CHECK(isfinite(valid_from)), valid_until timestamptz NOT NULL CHECK(isfinite(valid_until)),
 reviewed_by uuid NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_by uuid, revoked_at timestamptz, revocation_reason text,
 CHECK(valid_until>valid_from),
 CHECK((revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL) OR
  (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND care_security.gkv_monthly_authority_text(revocation_reason,3,1000)))
);
CREATE INDEX gkv_monthly_authorities_scope ON care_security.gkv_monthly_authorities(tenant_id,client_id,service_type,reviewed_at,id);
ALTER TABLE care_security.gkv_monthly_authorities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.gkv_monthly_authorities FROM PUBLIC,anon,authenticated,service_role;

-- Identity, evidence and review are immutable. Correct a review by revoking and
-- registering a new ID. Previously captured originals retain their full snapshot.
CREATE FUNCTION care_security.gkv_monthly_authority_immutable() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Vertretungsprüfung darf nicht gelöscht werden'; END IF;
 IF (to_jsonb(OLD)-ARRAY['revoked_by','revoked_at','revocation_reason']) IS DISTINCT FROM
    (to_jsonb(NEW)-ARRAY['revoked_by','revoked_at','revocation_reason'])
  OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
  RAISE EXCEPTION 'Vertretungsprüfung ist unveränderlich' USING ERRCODE='40001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gkv_monthly_authority_immutable BEFORE UPDATE OR DELETE ON care_security.gkv_monthly_authorities
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_monthly_authority_immutable();

CREATE FUNCTION care_security.gkv_monthly_resolve_authority(p_tenant uuid,p_proof uuid,p_authority uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a care_security.gkv_monthly_authorities; s public.gkv_monthly_proof_series;
BEGIN
 IF auth.uid() IS NULL OR care_security.gkv_monthly_writer(p_tenant) IS NOT TRUE THEN
  RAISE EXCEPTION 'Aktive persönliche Beauftragung erforderlich' USING ERRCODE='42501'; END IF;
 IF p_authority IS NULL THEN RETURN NULL; END IF;
 SELECT series.* INTO s FROM public.gkv_monthly_proof_series series JOIN public.gkv_monthly_proofs proof
  ON proof.tenant_id=series.tenant_id AND proof.series_id=series.id WHERE proof.tenant_id=p_tenant AND proof.id=p_proof;
 -- A concurrent revocation must serialize with both receipt issue and consumption.
 SELECT * INTO a FROM care_security.gkv_monthly_authorities WHERE id=p_authority FOR SHARE;
 IF NOT FOUND OR a.tenant_id IS DISTINCT FROM p_tenant OR a.client_id IS DISTINCT FROM s.client_id
  OR a.service_type IS DISTINCT FROM s.service_type OR a.revoked_at IS NOT NULL
  OR a.valid_from>clock_timestamp() OR a.valid_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'Vertretungsberechtigung ist nicht mehr gültig' USING ERRCODE='40001'; END IF;
 RETURN to_jsonb(a);
END $$;
CREATE FUNCTION care_security.gkv_monthly_consume_authority() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a jsonb;
BEGIN
 IF OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL THEN
  IF NEW.signer_role='representative' THEN
   a:=care_security.gkv_monthly_resolve_authority(NEW.tenant_id,NEW.proof_id,NEW.authority_reference::uuid);
   IF a IS NULL OR a->>'signer_name' IS DISTINCT FROM NEW.signer_name
    OR NEW.captured_at<(a->>'reviewed_at')::timestamptz OR NEW.captured_at<(a->>'valid_from')::timestamptz OR NEW.captured_at>=(a->>'valid_until')::timestamptz THEN
    RAISE EXCEPTION 'Vertretungsprüfung gehört nicht zur Unterschrift' USING ERRCODE='40001'; END IF;
  ELSIF NEW.authority_reference IS NOT NULL THEN RAISE EXCEPTION 'Unerwartete Vertretungsprüfung'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gkv_monthly_consume_authority BEFORE UPDATE OF consumed_at ON care_security.gkv_monthly_confirmation_receipts
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_monthly_consume_authority();

CREATE FUNCTION care_security.gkv_monthly_authority_command(p_tenant uuid,p_action text,p_input jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.gkv_monthly_proofs; s public.gkv_monthly_proof_series; a care_security.gkv_monthly_authorities;
 can_manage boolean; allowed text[]; result jsonb; moment timestamptz;
BEGIN
 PERFORM care_security.gkv_monthly_live_session();
 IF care_security.gkv_monthly_writer(p_tenant) IS NOT TRUE THEN
  RAISE EXCEPTION 'Aktive persönliche Beauftragung erforderlich' USING ERRCODE='42501'; END IF;
 can_manage:=care_security.gkv_exchange_actor(p_tenant,'office.clients.edit') IS TRUE;
 allowed:=CASE p_action WHEN 'list' THEN ARRAY['proofId'] WHEN 'register' THEN
  ARRAY['proofId','id','signerName','basis','evidenceReference','reviewNote','validFrom','validUntil','reviewed']
  WHEN 'revoke' THEN ARRAY['proofId','id','reason'] END;
 IF allowed IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>5000
  OR NOT p_input ?& allowed OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) k WHERE NOT k=ANY(allowed)) THEN
  RAISE EXCEPTION 'Unvollständige Vertretungsprüfung'; END IF;
 SELECT * INTO p FROM public.gkv_monthly_proofs WHERE tenant_id=p_tenant AND id=(p_input->>'proofId')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Monatsnachweis nicht verfügbar' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.gkv_monthly_proof_series WHERE tenant_id=p_tenant AND id=p.series_id;
 IF p_action<>'list' AND NOT can_manage THEN RAISE EXCEPTION 'Berechtigung zur Klientenverwaltung fehlt' USING ERRCODE='42501'; END IF;
 IF p_action='register' THEN
  IF p_input->'reviewed' IS DISTINCT FROM 'true'::jsonb
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['id','signerName','basis','evidenceReference','reviewNote','validFrom','validUntil']) k
     WHERE jsonb_typeof(p_input->k) IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'Persönliche Prüfung erforderlich'; END IF;
  INSERT INTO care_security.gkv_monthly_authorities(id,tenant_id,client_id,service_type,signer_name,basis,evidence_reference,review_note,valid_from,valid_until,reviewed_by)
   VALUES((p_input->>'id')::uuid,p_tenant,s.client_id,s.service_type,p_input->>'signerName',p_input->>'basis',p_input->>'evidenceReference',
    p_input->>'reviewNote',(p_input->>'validFrom')::timestamptz,(p_input->>'validUntil')::timestamptz,auth.uid()) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO a FROM care_security.gkv_monthly_authorities WHERE id=(p_input->>'id')::uuid;
  IF a.tenant_id IS DISTINCT FROM p_tenant OR a.client_id IS DISTINCT FROM s.client_id OR a.service_type IS DISTINCT FROM s.service_type
   OR a.reviewed_by IS DISTINCT FROM auth.uid() OR a.signer_name IS DISTINCT FROM p_input->>'signerName'
   OR a.basis IS DISTINCT FROM p_input->>'basis' OR a.evidence_reference IS DISTINCT FROM p_input->>'evidenceReference'
   OR a.review_note IS DISTINCT FROM p_input->>'reviewNote' OR a.valid_from IS DISTINCT FROM (p_input->>'validFrom')::timestamptz
   OR a.valid_until IS DISTINCT FROM (p_input->>'validUntil')::timestamptz THEN
   RAISE EXCEPTION 'Prüfkennung wurde bereits anders verwendet' USING ERRCODE='40001'; END IF;
 ELSIF p_action='revoke' THEN
  IF jsonb_typeof(p_input->'reason') IS DISTINCT FROM 'string' OR care_security.gkv_monthly_authority_text(p_input->>'reason',3,1000) IS NOT TRUE THEN
   RAISE EXCEPTION 'Widerrufsgrund erforderlich'; END IF;
  SELECT * INTO a FROM care_security.gkv_monthly_authorities WHERE id=(p_input->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR a.tenant_id IS DISTINCT FROM p_tenant OR a.client_id IS DISTINCT FROM s.client_id OR a.service_type IS DISTINCT FROM s.service_type THEN
   RAISE EXCEPTION 'Vertretungsprüfung nicht verfügbar' USING ERRCODE='42501'; END IF;
  IF a.revoked_at IS NULL THEN UPDATE care_security.gkv_monthly_authorities SET revoked_by=auth.uid(),revoked_at=clock_timestamp(),
   revocation_reason=p_input->>'reason' WHERE id=a.id;
  ELSIF a.revoked_by IS DISTINCT FROM auth.uid() OR a.revocation_reason IS DISTINCT FROM p_input->>'reason' THEN
   RAISE EXCEPTION 'Vertretungsprüfung wurde bereits widerrufen' USING ERRCODE='40001'; END IF;
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(entry) ORDER BY entry.reviewed_at DESC,entry.id),'[]'::jsonb) INTO result
  FROM care_security.gkv_monthly_authorities entry WHERE entry.tenant_id=p_tenant AND entry.client_id=s.client_id AND entry.service_type=s.service_type;
 IF octet_length(result::text)>2000000 THEN RAISE EXCEPTION 'Vertretungsübersicht zu umfangreich'; END IF;
 moment:=clock_timestamp();
 RETURN jsonb_build_object('tenantId',p_tenant,'proofId',p.id,'clientId',s.client_id,'serviceType',s.service_type,
  'canManage',can_manage,'checkedAt',moment,'authorities',result);
END $$;
CREATE FUNCTION public.gkv_monthly_authority_command(p_tenant uuid,p_action text,p_input jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT care_security.gkv_monthly_authority_command(p_tenant,p_action,p_input)
$$;
REVOKE ALL ON FUNCTION care_security.gkv_monthly_authority_text(text,integer,integer),care_security.gkv_monthly_authority_immutable(),care_security.gkv_monthly_resolve_authority(uuid,uuid,uuid),
 care_security.gkv_monthly_consume_authority(),care_security.gkv_monthly_authority_command(uuid,text,jsonb),
 public.gkv_monthly_authority_command(uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION care_security.gkv_monthly_authority_command(uuid,text,jsonb),public.gkv_monthly_authority_command(uuid,text,jsonb) TO authenticated;
COMMIT;
