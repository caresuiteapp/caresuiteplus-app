-- §105 workspace. Review/apply through the existing database release process.
-- Does not enable transmission, change invoices, certify software or install test data.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('care_security.office_actor(uuid,text)') IS NULL
   OR to_regprocedure('public.current_portal_type()') IS NULL THEN
   RAISE EXCEPTION 'GKV workspace requires the existing Office authorization migrations';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND column_name='invoice_number') THEN
   RAISE EXCEPTION 'GKV workspace requires the current Office invoice schema';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.gkv_exchange_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), draft jsonb NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','checked','exported_test','blocked','queued','sending','delivery_unknown','sent','delivered','rejected','accepted','cancelled')),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(draft)='object'), CHECK(octet_length(draft::text)<=2000000),
 UNIQUE(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS gkv_exchange_batches_scope ON public.gkv_exchange_batches(tenant_id,updated_at DESC,id);
CREATE TABLE IF NOT EXISTS public.gkv_exchange_settings (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id), profile jsonb NOT NULL DEFAULT '{}',
 revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(profile)='object'), CHECK(octet_length(profile::text)<=8000)
);
CREATE TABLE IF NOT EXISTS public.gkv_exchange_directories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 180), source_text text NOT NULL CHECK(octet_length(source_text)<=8000000),
 source_sha256 text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now(), imported_by uuid NOT NULL,
 UNIQUE(tenant_id,source_sha256)
);
CREATE INDEX IF NOT EXISTS gkv_exchange_directories_scope ON public.gkv_exchange_directories(tenant_id,imported_at DESC);
CREATE TABLE IF NOT EXISTS public.gkv_exchange_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 batch_id uuid, actor_id uuid NOT NULL, event_type text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,batch_id) REFERENCES public.gkv_exchange_batches(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS gkv_exchange_events_scope ON public.gkv_exchange_events(tenant_id,batch_id,created_at DESC,id);
CREATE TABLE IF NOT EXISTS care_security.gkv_exchange_requests (
 tenant_id uuid NOT NULL, request_id uuid NOT NULL, actor_id uuid NOT NULL, request_hash text NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,request_id)
);
ALTER TABLE public.gkv_exchange_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_exchange_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_exchange_directories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gkv_exchange_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_security.gkv_exchange_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gkv_exchange_batches,public.gkv_exchange_settings,public.gkv_exchange_directories,public.gkv_exchange_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON care_security.gkv_exchange_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.gkv_exchange_batches,public.gkv_exchange_settings,public.gkv_exchange_directories,public.gkv_exchange_events TO authenticated;

CREATE OR REPLACE FUNCTION care_security.gkv_exchange_actor(p_tenant uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(auth.uid() IS NOT NULL AND p_tenant=public.current_tenant_id()
   AND (public.current_portal_type() IS NULL OR public.current_portal_type()='business')
   AND care_security.office_actor(p_tenant,p_permission),false)
$$;
REVOKE ALL ON FUNCTION care_security.gkv_exchange_actor(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.gkv_exchange_actor(uuid,text) TO authenticated;
DROP POLICY IF EXISTS gkv_exchange_read ON public.gkv_exchange_batches;
CREATE POLICY gkv_exchange_read ON public.gkv_exchange_batches FOR SELECT TO authenticated USING(care_security.gkv_exchange_actor(tenant_id,'office.invoices.view'));
DROP POLICY IF EXISTS gkv_exchange_read ON public.gkv_exchange_settings;
CREATE POLICY gkv_exchange_read ON public.gkv_exchange_settings FOR SELECT TO authenticated USING(care_security.gkv_exchange_actor(tenant_id,'office.invoices.view'));
DROP POLICY IF EXISTS gkv_exchange_read ON public.gkv_exchange_directories;
CREATE POLICY gkv_exchange_read ON public.gkv_exchange_directories FOR SELECT TO authenticated USING(care_security.gkv_exchange_actor(tenant_id,'office.invoices.view'));
DROP POLICY IF EXISTS gkv_exchange_read ON public.gkv_exchange_events;
CREATE POLICY gkv_exchange_read ON public.gkv_exchange_events FOR SELECT TO authenticated USING(care_security.gkv_exchange_actor(tenant_id,'office.invoices.view'));

CREATE OR REPLACE FUNCTION care_security.gkv_exchange_command(p_tenant_id uuid,p_request_id uuid,p_action text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_id uuid; v_batch public.gkv_exchange_batches; v_revision integer; v_result jsonb;
 v_hash text; v_existing care_security.gkv_exchange_requests; v_draft jsonb; v_profile jsonb;
BEGIN
 IF care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.view') IS NOT TRUE
    OR care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.create') IS NOT TRUE THEN RAISE EXCEPTION 'Abrechnungszugriff erforderlich' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_action IS NULL OR p_action NOT IN('save','cancel','profile','directory','export_note','feedback_note')
    OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>9000000 THEN RAISE EXCEPTION 'Ungültiger Auftrag'; END IF;
 v_hash:=encode(sha256(convert_to(p_action||':'||p_input::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_request_id::text,0));
 SELECT * INTO v_existing FROM care_security.gkv_exchange_requests WHERE tenant_id=p_tenant_id AND request_id=p_request_id;
 IF FOUND THEN
   IF v_existing.actor_id<>auth.uid() OR v_existing.request_hash<>v_hash THEN RAISE EXCEPTION 'Auftragskennung bereits anders verwendet'; END IF;
   RETURN v_existing.result;
 END IF;
 IF p_action='profile' THEN
   v_profile:=p_input->'profile';
   IF jsonb_typeof(v_profile) IS DISTINCT FROM 'object' OR octet_length(v_profile::text)>8000 THEN RAISE EXCEPTION 'Ungültiges Abrechnungsprofil'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':gkv-profile',0));
   SELECT revision INTO v_revision FROM public.gkv_exchange_settings WHERE tenant_id=p_tenant_id FOR UPDATE;
   IF coalesce(v_revision,0) IS DISTINCT FROM (p_input->>'revision')::integer THEN RAISE EXCEPTION 'Profil wurde geändert. Bitte neu laden' USING ERRCODE='40001'; END IF;
   INSERT INTO public.gkv_exchange_settings(tenant_id,profile,revision) VALUES(p_tenant_id,v_profile,1)
   ON CONFLICT(tenant_id) DO UPDATE SET profile=EXCLUDED.profile,revision=public.gkv_exchange_settings.revision+1,updated_at=now()
   RETURNING to_jsonb(gkv_exchange_settings.*) INTO v_result;
 ELSIF p_action='directory' THEN
   IF coalesce(p_input->>'filename','') !~* '^(AO|BK|BN|EK|IK|LK|SE)' OR length(p_input->>'filename')>180
      OR coalesce(length(p_input->>'source'),0)<10 OR octet_length(p_input->>'source')>8000000 THEN RAISE EXCEPTION 'Ungültige Kostenträgerdatei'; END IF;
   INSERT INTO public.gkv_exchange_directories(tenant_id,filename,source_text,source_sha256,imported_by)
   VALUES(p_tenant_id,p_input->>'filename',p_input->>'source',encode(sha256(convert_to(p_input->>'source','UTF8')),'hex'),auth.uid())
   ON CONFLICT(tenant_id,source_sha256) DO UPDATE SET source_sha256=EXCLUDED.source_sha256
   RETURNING jsonb_build_object('id',id,'filename',filename,'imported_at',imported_at) INTO v_result;
 ELSE
   IF nullif(p_input->>'id','') IS NOT NULL THEN
     v_id:=(p_input->>'id')::uuid;
     SELECT * INTO v_batch FROM public.gkv_exchange_batches WHERE tenant_id=p_tenant_id AND id=v_id FOR UPDATE;
     IF NOT FOUND OR v_batch.revision IS DISTINCT FROM (p_input->>'revision')::integer THEN RAISE EXCEPTION 'Abrechnung wurde geändert. Bitte neu laden' USING ERRCODE='40001'; END IF;
   ELSIF p_action<>'save' THEN RAISE EXCEPTION 'Abrechnung fehlt';
   ELSE
     v_id:=(p_input->>'new_id')::uuid;
     IF v_id IS NULL THEN RAISE EXCEPTION 'Stabile Entwurfskennung fehlt'; END IF;
     PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':gkv-batch:'||v_id::text,0));
     IF EXISTS(SELECT 1 FROM public.gkv_exchange_batches WHERE id=v_id) THEN RAISE EXCEPTION 'Entwurf bereits gespeichert. Bitte neu laden' USING ERRCODE='40001'; END IF;
   END IF;
   IF p_action='save' THEN
     IF v_batch.id IS NOT NULL AND v_batch.status NOT IN('draft','checked','blocked','exported_test') THEN RAISE EXCEPTION 'Dieser Stand darf nicht überschrieben werden'; END IF;
     v_draft:=p_input->'draft';
     IF jsonb_typeof(v_draft) IS DISTINCT FROM 'object' OR jsonb_typeof(v_draft->'profile') IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_draft->'cases') IS DISTINCT FROM 'array' OR jsonb_array_length(v_draft->'cases')>500
       OR octet_length(v_draft::text)>2000000 THEN RAISE EXCEPTION 'Ungültiger Abrechnungsentwurf'; END IF;
     -- References may only point to this tenant; snapshots remain drafts, never attestations.
     IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_draft->'cases') c WHERE nullif(c->>'sourceInvoiceId','') IS NOT NULL
       AND NOT EXISTS(SELECT 1 FROM public.invoices i WHERE i.tenant_id=p_tenant_id AND i.id::text=c->>'sourceInvoiceId')) THEN RAISE EXCEPTION 'Fremde Rechnungsreferenz' USING ERRCODE='42501'; END IF;
     IF v_batch.id IS NULL THEN
       INSERT INTO public.gkv_exchange_batches(id,tenant_id,draft,created_by) VALUES(v_id,p_tenant_id,v_draft,auth.uid()) RETURNING * INTO v_batch;
     ELSE
       UPDATE public.gkv_exchange_batches SET draft=v_draft,revision=revision+1,status='draft',updated_at=now()
       WHERE tenant_id=p_tenant_id AND id=v_id RETURNING * INTO v_batch;
     END IF;
     v_id:=v_batch.id; v_result:=to_jsonb(v_batch);
   ELSIF p_action='cancel' THEN
     IF v_batch.status NOT IN('draft','checked','blocked','exported_test') THEN RAISE EXCEPTION 'Übermittelte Pakete dürfen nicht verworfen werden'; END IF;
     UPDATE public.gkv_exchange_batches SET status='cancelled',revision=revision+1,updated_at=now()
       WHERE tenant_id=p_tenant_id AND id=v_id RETURNING to_jsonb(gkv_exchange_batches.*) INTO v_result;
   ELSIF p_action='export_note' THEN
     -- A download acknowledgement is not a validated export or a submission.
     IF v_batch.status NOT IN('draft','exported_test') OR coalesce(v_batch.draft->>'mode','') NOT IN('test','trial')
       OR coalesce(v_batch.draft->>'channel','')<>'classic'
       OR coalesce(p_input->>'sha256','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Ungültiger Prüfdateivermerk'; END IF;
     UPDATE public.gkv_exchange_batches SET status='exported_test',revision=revision+1,updated_at=now()
       WHERE tenant_id=p_tenant_id AND id=v_id RETURNING to_jsonb(gkv_exchange_batches.*) INTO v_result;
   ELSE
     IF coalesce(length(btrim(p_input->>'text')),0)<3 OR length(p_input->>'text')>4000 THEN RAISE EXCEPTION 'Rückmeldung fehlt oder ist zu lang'; END IF;
     -- Manual notes cannot set delivered/accepted/paid or impersonate a provider receipt.
     v_result:=jsonb_build_object('id',v_id,'revision',v_batch.revision,'status',v_batch.status);
   END IF;
 END IF;
 INSERT INTO public.gkv_exchange_events(tenant_id,batch_id,actor_id,event_type,details)
 VALUES(p_tenant_id,v_id,auth.uid(),p_action,
   CASE WHEN p_action='feedback_note' THEN jsonb_build_object('text',p_input->>'text','verified',false)
   WHEN p_action='export_note' THEN jsonb_build_object('sha256',p_input->>'sha256','kind','test_download','verified',false)
   ELSE jsonb_build_object('revision',v_result->'revision') END);
 INSERT INTO care_security.gkv_exchange_requests(tenant_id,request_id,actor_id,request_hash,result)
 VALUES(p_tenant_id,p_request_id,auth.uid(),v_hash,v_result);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION care_security.gkv_exchange_command(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION care_security.gkv_exchange_command(uuid,uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.gkv_exchange_command(p_tenant_id uuid,p_request_id uuid,p_action text,p_input jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT care_security.gkv_exchange_command(p_tenant_id,p_request_id,p_action,p_input)
$$;
REVOKE ALL ON FUNCTION public.gkv_exchange_command(uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gkv_exchange_command(uuid,uuid,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.gkv_exchange_export_allowed(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.view')
    AND care_security.gkv_exchange_actor(p_tenant_id,'office.invoices.create')
$$;
REVOKE ALL ON FUNCTION public.gkv_exchange_export_allowed(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gkv_exchange_export_allowed(uuid) TO authenticated;
COMMIT;
