-- REVIEW ONLY. Apply after the three monthly drafts, only after a separate
-- rights/key/session review. No real keys, automatic provisioning or rollout.
-- Existing pgcrypto must be installed in extensions; auth is managed by Supabase.
BEGIN;
DO $$ BEGIN IF to_regprocedure('extensions.hmac(bytea,bytea,text)') IS NULL THEN
 RAISE EXCEPTION 'pgcrypto im Schema extensions erforderlich'; END IF; END $$;
CREATE TABLE care_security.gkv_monthly_worker_keys (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), key_id uuid NOT NULL,
 key_bytes bytea NOT NULL CHECK(octet_length(key_bytes)=32), valid_until timestamptz NOT NULL CHECK(isfinite(valid_until)),
 revoked_at timestamptz, PRIMARY KEY(tenant_id,key_id)
);
CREATE TABLE care_security.gkv_monthly_receipt_sessions (
 receipt_id uuid PRIMARY KEY REFERENCES care_security.gkv_monthly_confirmation_receipts(id),
 actor_id uuid NOT NULL, session_id uuid NOT NULL
);
ALTER TABLE care_security.gkv_monthly_worker_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_security.gkv_monthly_receipt_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON care_security.gkv_monthly_worker_keys,care_security.gkv_monthly_receipt_sessions FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION care_security.gkv_monthly_live_session() RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE j jsonb:=auth.jwt(); s uuid;
BEGIN
 IF auth.uid() IS NULL OR j->>'role' IS DISTINCT FROM 'authenticated' OR j->>'is_anonymous'='true'
  OR (j->>'session_id') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  OR j->>'session_id' IS NULL OR j->>'exp' IS NULL OR (j->>'exp')::numeric <= extract(epoch FROM clock_timestamp()) THEN
  RAISE EXCEPTION 'Persönliche Anmeldung erforderlich' USING ERRCODE='42501'; END IF;
 s:=(j->>'session_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=s AND user_id=auth.uid() AND (not_after IS NULL OR not_after>clock_timestamp())) THEN
  RAISE EXCEPTION 'Anmeldung nicht mehr aktiv' USING ERRCODE='42501'; END IF;
 RETURN s;
END $$;

CREATE FUNCTION care_security.gkv_monthly_consume_session() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM care_security.gkv_monthly_receipt_sessions WHERE receipt_id=NEW.id AND actor_id=auth.uid()
   AND session_id=care_security.gkv_monthly_live_session()) THEN
  RAISE EXCEPTION 'Bestätigung benötigt dieselbe aktive Anmeldung' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER gkv_monthly_consume_session BEFORE UPDATE OF consumed_at ON care_security.gkv_monthly_confirmation_receipts
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_monthly_consume_session();

CREATE FUNCTION care_security.gkv_monthly_worker_command(p_envelope text,p_mac text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e jsonb; args jsonb; worker care_security.gkv_monthly_worker_keys; v_session uuid;
 expected bytea; supplied bytea; difference integer:=0; i integer; result jsonb;
BEGIN
 v_session:=care_security.gkv_monthly_live_session();
 IF octet_length(p_envelope)>12000 OR p_envelope IS NULL OR p_mac IS NULL OR p_mac !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Ungültiger Hostauftrag' USING ERRCODE='42501'; END IF;
 e:=p_envelope::jsonb;
 IF jsonb_typeof(e) IS DISTINCT FROM 'object' OR e->'version' IS DISTINCT FROM '1'::jsonb
  OR e->>'actorId' IS DISTINCT FROM auth.uid()::text OR e->>'sessionId' IS DISTINCT FROM v_session::text
  OR NOT e ?& ARRAY['version','tenantId','actorId','sessionId','keyId','issuedAt','nonce','operation','args']
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(e) k WHERE NOT k=ANY(ARRAY['version','tenantId','actorId','sessionId','keyId','issuedAt','nonce','operation','args']))
  OR jsonb_typeof(e->'issuedAt') IS DISTINCT FROM 'number'
  OR (e->>'issuedAt')::numeric <> trunc((e->>'issuedAt')::numeric)
  OR abs(extract(epoch FROM clock_timestamp())*1000-(e->>'issuedAt')::numeric)>120000
  OR jsonb_typeof(e->'args') IS DISTINCT FROM 'object'
  OR jsonb_typeof(e->'nonce') IS DISTINCT FROM 'string'
  OR e->>'nonce' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN
  RAISE EXCEPTION 'Hostauftrag gehört nicht zur Anmeldung' USING ERRCODE='42501'; END IF;
 SELECT * INTO worker FROM care_security.gkv_monthly_worker_keys
  WHERE tenant_id=(e->>'tenantId')::uuid AND key_id=(e->>'keyId')::uuid AND revoked_at IS NULL AND valid_until>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'Host nicht freigegeben' USING ERRCODE='42501'; END IF;
 expected:=extensions.hmac(convert_to('gkv-monthly-worker-v1'||chr(10)||p_envelope,'UTF8'),worker.key_bytes,'sha256');
 supplied:=decode(p_mac,'hex');
 FOR i IN 0..31 LOOP difference:=difference | (get_byte(expected,i) # get_byte(supplied,i)); END LOOP;
 IF difference<>0 THEN RAISE EXCEPTION 'Hostbeleg ungültig' USING ERRCODE='42501'; END IF;
 args:=e->'args';
 IF e->>'operation' IN ('context','archive') THEN
  IF args->>'tenantId' IS DISTINCT FROM e->>'tenantId'
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(args) k WHERE NOT k=ANY(ARRAY['tenantId','proofId','revision','captureId','authorityId'])) THEN
   RAISE EXCEPTION 'Fremder Nachweisauftrag' USING ERRCODE='42501'; END IF;
  IF e->>'operation'='context' THEN
   result:=care_security.gkv_monthly_verifier_context(worker.tenant_id,(args->>'proofId')::uuid,(args->>'revision')::integer,(args->>'authorityId')::uuid);
  ELSE result:=care_security.gkv_monthly_original_read_context(worker.tenant_id,(args->>'proofId')::uuid); END IF;
  RETURN result||jsonb_build_object('sessionId',v_session);
 ELSIF e->>'operation' IN ('issue','receipt-status') THEN
  IF args->>'tenant_id' IS DISTINCT FROM worker.tenant_id::text OR args->>'actor_id' IS DISTINCT FROM auth.uid()::text THEN
   RAISE EXCEPTION 'Fremder Prüfbeleg' USING ERRCODE='42501'; END IF;
  IF e->>'operation'='issue' THEN
   result:=care_security.gkv_monthly_accept_verified_receipt(args);
   INSERT INTO care_security.gkv_monthly_receipt_sessions(receipt_id,actor_id,session_id)
    VALUES((args->>'id')::uuid,auth.uid(),v_session) ON CONFLICT(receipt_id) DO NOTHING;
  ELSE result:=care_security.gkv_monthly_verified_receipt_status(args); END IF;
  IF result IS NOT NULL AND NOT EXISTS(SELECT 1 FROM care_security.gkv_monthly_receipt_sessions r
   WHERE r.receipt_id=(args->>'id')::uuid AND r.actor_id=auth.uid() AND r.session_id=v_session) THEN
   RAISE EXCEPTION 'Prüfbeleg gehört zu einer anderen Anmeldung' USING ERRCODE='42501'; END IF;
  RETURN result;
 ELSE RAISE EXCEPTION 'Unbekannter Hostauftrag' USING ERRCODE='42501'; END IF;
END $$;
-- Only an invoker wrapper is exposed. The private capability requires BOTH a
-- current personal session AND a tenant-scoped MAC from the provisioned host.
CREATE FUNCTION public.gkv_monthly_worker_command(p_envelope text,p_mac text) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT care_security.gkv_monthly_worker_command(p_envelope,p_mac)
$$;
REVOKE ALL ON FUNCTION care_security.gkv_monthly_live_session(),care_security.gkv_monthly_consume_session(),
 care_security.gkv_monthly_worker_command(text,text),public.gkv_monthly_worker_command(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION care_security.gkv_monthly_worker_command(text,text),public.gkv_monthly_worker_command(text,text) TO authenticated;
COMMIT;
