-- Saved packet history, independent of file certification or retention compliance.
-- No remote release, transmission or invoice mutation is performed by this migration.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('care_security.gkv_exchange_actor(uuid,text)') IS NULL THEN
   RAISE EXCEPTION 'GKV revision history requires the GKV workspace migration';
 END IF;
END $$;
LOCK TABLE public.gkv_exchange_batches IN ACCESS EXCLUSIVE MODE;

CREATE TABLE public.gkv_exchange_revisions (
 tenant_id uuid NOT NULL, batch_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
 draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object' AND octet_length(draft::text)<=2000000),
 status text NOT NULL, draft_sha256 text NOT NULL CHECK(draft_sha256 ~ '^[a-f0-9]{64}$'),
 recorded_by uuid, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 source_updated_at timestamptz NOT NULL, capture_kind text NOT NULL CHECK(capture_kind IN('change','backfill')),
 PRIMARY KEY(tenant_id,batch_id,revision),
 FOREIGN KEY(tenant_id,batch_id) REFERENCES public.gkv_exchange_batches(tenant_id,id)
);
ALTER TABLE public.gkv_exchange_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gkv_exchange_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.gkv_exchange_revisions TO authenticated;
CREATE POLICY gkv_exchange_read ON public.gkv_exchange_revisions FOR SELECT TO authenticated
 USING(care_security.gkv_exchange_actor(tenant_id,'office.invoices.view'));

-- Existing packets have only their current revision captured; missing past revisions
-- are not reconstructed or attributed to an invented actor.
INSERT INTO public.gkv_exchange_revisions(tenant_id,batch_id,revision,draft,status,draft_sha256,source_updated_at,capture_kind)
 SELECT tenant_id,id,revision,draft,status,encode(sha256(convert_to(draft::text,'UTF8')),'hex'),updated_at,'backfill'
 FROM public.gkv_exchange_batches;

ALTER TABLE public.gkv_exchange_batches ADD COLUMN origin_batch_id uuid, ADD COLUMN origin_revision integer;
ALTER TABLE public.gkv_exchange_batches ADD CONSTRAINT gkv_exchange_origin_pair
 CHECK((origin_batch_id IS NULL)=(origin_revision IS NULL));
ALTER TABLE public.gkv_exchange_batches ADD CONSTRAINT gkv_exchange_origin_scope
 FOREIGN KEY(tenant_id,origin_batch_id,origin_revision) REFERENCES public.gkv_exchange_revisions(tenant_id,batch_id,revision);

CREATE FUNCTION care_security.gkv_exchange_capture_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF care_security.gkv_exchange_actor(NEW.tenant_id,'office.invoices.view') IS NOT TRUE
   OR care_security.gkv_exchange_actor(NEW.tenant_id,'office.invoices.create') IS NOT TRUE THEN
   RAISE EXCEPTION 'Abrechnungszugriff erforderlich' USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' THEN
   IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.origin_batch_id IS DISTINCT FROM OLD.origin_batch_id OR NEW.origin_revision IS DISTINCT FROM OLD.origin_revision
     OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.revision IS DISTINCT FROM OLD.revision+1 THEN
     RAISE EXCEPTION 'Paketidentität und fortlaufender Bearbeitungsstand müssen erhalten bleiben';
   END IF;
 ELSIF NEW.revision<>1 THEN RAISE EXCEPTION 'Neue Pakete beginnen mit Revision 1'; END IF;
 INSERT INTO public.gkv_exchange_revisions(tenant_id,batch_id,revision,draft,status,draft_sha256,recorded_by,source_updated_at,capture_kind)
 VALUES(NEW.tenant_id,NEW.id,NEW.revision,NEW.draft,NEW.status,encode(sha256(convert_to(NEW.draft::text,'UTF8')),'hex'),auth.uid(),NEW.updated_at,'change');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_exchange_capture_revision() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gkv_exchange_capture_revision AFTER INSERT OR UPDATE ON public.gkv_exchange_batches
 FOR EACH ROW EXECUTE FUNCTION care_security.gkv_exchange_capture_revision();

CREATE FUNCTION care_security.gkv_exchange_copy_revision(p_tenant_id uuid,p_request_id uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_batch public.gkv_exchange_batches; v_source public.gkv_exchange_revisions;
 v_request care_security.gkv_exchange_requests; v_hash text; v_new_id uuid; v_draft jsonb; v_cases jsonb; v_result jsonb;
BEGIN
 IF care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.view') IS NOT TRUE
   OR care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.create') IS NOT TRUE THEN
   RAISE EXCEPTION 'Abrechnungszugriff erforderlich' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>8000
   OR coalesce(length(btrim(p_input->>'reason')),0)<5 OR length(p_input->>'reason')>500 THEN
   RAISE EXCEPTION 'Begründung für den neuen Prüfentwurf erforderlich (5 bis 500 Zeichen)';
 END IF;
 v_hash:=encode(sha256(convert_to('copy_revision:'||p_input::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_request_id::text,0));
 SELECT * INTO v_request FROM care_security.gkv_exchange_requests WHERE tenant_id=p_tenant_id AND request_id=p_request_id;
 IF FOUND THEN
   IF v_request.actor_id<>auth.uid() OR v_request.request_hash<>v_hash THEN RAISE EXCEPTION 'Auftragskennung bereits anders verwendet'; END IF;
   RETURN v_request.result;
 END IF;
 SELECT * INTO v_batch FROM public.gkv_exchange_batches
 WHERE tenant_id=p_tenant_id AND id=(p_input->>'batch_id')::uuid FOR UPDATE;
 IF NOT FOUND OR v_batch.revision IS DISTINCT FROM (p_input->>'expected_revision')::integer THEN
   RAISE EXCEPTION 'Paket wurde geändert. Bitte neu laden' USING ERRCODE='40001';
 END IF;
 SELECT * INTO v_source FROM public.gkv_exchange_revisions
 WHERE tenant_id=p_tenant_id AND batch_id=v_batch.id AND revision=(p_input->>'source_revision')::integer;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gespeicherter Stand nicht vorhanden' USING ERRCODE='40001'; END IF;
 IF v_batch.status NOT IN('draft','checked','blocked','exported_test','cancelled')
   OR v_source.status NOT IN('draft','checked','blocked','exported_test','cancelled')
   OR coalesce(v_source.draft->>'mode','') NOT IN('test','trial')
   OR coalesce(v_source.draft->>'channel','')<>'classic' THEN
   RAISE EXCEPTION 'Nur klassische Prüfstände dürfen als neuer Prüfentwurf übernommen werden';
 END IF;
 v_new_id:=(p_input->>'new_id')::uuid;
 IF v_new_id IS NULL THEN RAISE EXCEPTION 'Stabile Entwurfskennung fehlt'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':gkv-batch:'||v_new_id::text,0));
 IF EXISTS(SELECT 1 FROM public.gkv_exchange_batches WHERE id=v_new_id) THEN
   RAISE EXCEPTION 'Entwurf bereits vorhanden. Bitte neu laden' USING ERRCODE='40001';
 END IF;
 IF jsonb_typeof(v_source.draft->'cases') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Unlesbarer gespeicherter Stand'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_source.draft->'cases') c WHERE nullif(c->>'sourceInvoiceId','') IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.invoices i WHERE i.tenant_id=p_tenant_id AND i.id::text=c->>'sourceInvoiceId')) THEN
   RAISE EXCEPTION 'Rechnungsreferenz nicht mehr verfügbar' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(c.value||jsonb_build_object('proofConfirmed',false) ORDER BY c.ordinality),'[]'::jsonb)
 INTO v_cases FROM jsonb_array_elements(v_source.draft->'cases') WITH ORDINALITY c(value,ordinality);
 v_draft:=v_source.draft||jsonb_build_object('mode','test','createdAt',
   to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'cases',v_cases);
 INSERT INTO public.gkv_exchange_batches(id,tenant_id,draft,created_by,origin_batch_id,origin_revision)
 VALUES(v_new_id,p_tenant_id,v_draft,auth.uid(),v_batch.id,v_source.revision)
 RETURNING to_jsonb(gkv_exchange_batches.*) INTO v_result;
 INSERT INTO public.gkv_exchange_events(tenant_id,batch_id,actor_id,event_type,details)
 VALUES(p_tenant_id,v_new_id,auth.uid(),'revision_copy',jsonb_build_object('text',btrim(p_input->>'reason'),
   'source_batch_id',v_batch.id,'source_revision',v_source.revision,'source_sha256',v_source.draft_sha256)),
 (p_tenant_id,v_batch.id,auth.uid(),'revision_copy_source',jsonb_build_object('text',btrim(p_input->>'reason'),
   'target_batch_id',v_new_id,'source_revision',v_source.revision));
 INSERT INTO care_security.gkv_exchange_requests(tenant_id,request_id,actor_id,request_hash,result)
 VALUES(p_tenant_id,p_request_id,auth.uid(),v_hash,v_result);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_exchange_copy_revision(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.gkv_exchange_copy_revision(uuid,uuid,jsonb) TO authenticated;
CREATE FUNCTION public.gkv_exchange_copy_revision(p_tenant_id uuid,p_request_id uuid,p_input jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT care_security.gkv_exchange_copy_revision(p_tenant_id,p_request_id,p_input)
$$;
REVOKE ALL ON FUNCTION public.gkv_exchange_copy_revision(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gkv_exchange_copy_revision(uuid,uuid,jsonb) TO authenticated;
COMMIT;
