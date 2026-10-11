-- Release candidate, NOT applied to production. Convert to a timestamped CLI
-- migration in the existing release environment; apply seed after this schema.
BEGIN;

CREATE TABLE IF NOT EXISTS public.central_document_catalog (
  template_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  category_key text NOT NULL,
  target text NOT NULL CHECK (target IN ('client','employee','company')),
  source_mode text NOT NULL CHECK (source_mode IN ('create','original')),
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','approved','withdrawn')),
  definition_json jsonb NOT NULL CHECK (jsonb_typeof(definition_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_key, version)
);
ALTER TABLE public.central_document_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.central_document_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.central_document_catalog TO authenticated;
GRANT ALL ON public.central_document_catalog TO service_role;
CREATE POLICY central_catalog_read ON public.central_document_catalog FOR SELECT TO authenticated
  USING (public.current_tenant_id() IS NOT NULL AND public.has_permission('office.documents.view'));

CREATE TABLE IF NOT EXISTS public.central_document_records (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  template_key text NOT NULL,
  template_version integer NOT NULL,
  title text NOT NULL,
  target text NOT NULL CHECK (target IN ('client','employee','company')),
  entity_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','issued')),
  revision integer NOT NULL CHECK (revision > 0),
  parent_document_id uuid REFERENCES public.central_document_records(id),
  snapshot_json jsonb NOT NULL CHECK (jsonb_typeof(snapshot_json) = 'object'),
  pdf_path text NOT NULL UNIQUE,
  pdf_hash text NOT NULL CHECK (pdf_hash ~ '^[a-f0-9]{64}$'),
  snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[a-f0-9]{64}$'),
  original_path text,
  original_hash text CHECK (original_hash IS NULL OR original_hash ~ '^[a-f0-9]{64}$'),
  provenance_manifest jsonb,
  client_document_id uuid REFERENCES public.client_documents(id),
  employee_document_id uuid REFERENCES public.employee_documents(id),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (template_key, template_version) REFERENCES public.central_document_catalog(template_key, version),
  CHECK ((original_path IS NULL) = (original_hash IS NULL))
);
CREATE INDEX IF NOT EXISTS central_records_tenant_entity_created ON public.central_document_records(tenant_id,target,entity_id,created_at DESC);
ALTER TABLE public.central_document_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.central_document_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.central_document_records TO authenticated;
GRANT SELECT, INSERT ON public.central_document_records TO service_role;
CREATE POLICY central_records_read ON public.central_document_records FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_permission('office.documents.view')
    AND (NOT coalesce((snapshot_json #>> '{definition,clinicalReviewRequired}')::boolean,false) OR public.has_permission('office.clients.view_sensitive'))
    AND (target = 'company'
      OR (target = 'client' AND public.has_permission('office.clients.view') AND public.has_permission('office.clients.view_sensitive'))
      OR (target = 'employee' AND public.has_permission('office.employees.view')))
  );

CREATE OR REPLACE FUNCTION public.central_document_immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Gespeicherte Dokumentfassungen sind unveränderlich. Neue Fassung anlegen.' USING ERRCODE='55000';
END;
$$;
CREATE TRIGGER central_records_immutable BEFORE UPDATE OR DELETE ON public.central_document_records
FOR EACH ROW EXECUTE FUNCTION public.central_document_immutable();
CREATE TRIGGER central_generated_immutable BEFORE UPDATE OR DELETE ON public.generated_documents
FOR EACH ROW WHEN (OLD.document_type='central_catalog') EXECUTE FUNCTION public.central_document_immutable();

-- Legacy archive editors may still manage their own documents. Protect only
-- identity, title and file pointers belonging to this new append-only catalogue.
CREATE OR REPLACE FUNCTION public.central_archive_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.central_document_records r WHERE
      r.client_document_id=OLD.id OR r.employee_document_id=OLD.id OR r.original_path=OLD.storage_path) THEN
    RAISE EXCEPTION 'Katalogfassungen sind unveränderlich. Neue Fassung anlegen.' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.central_archive_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER central_client_archive_guard BEFORE UPDATE OF id,tenant_id,client_id,title,file_name,storage_path,status OR DELETE ON public.client_documents
FOR EACH ROW EXECUTE FUNCTION public.central_archive_guard();
CREATE TRIGGER central_employee_archive_guard BEFORE UPDATE OF id,tenant_id,employee_id,title,file_name,storage_path OR DELETE ON public.employee_documents
FOR EACH ROW EXECUTE FUNCTION public.central_archive_guard();

-- Only the authenticated Edge handler may call this transactional registration.
-- It validates JWT + live permissions with the caller's RLS client first, then
-- computes hashes from the bytes itself. No public INSERT/UPDATE RPC exists.
CREATE OR REPLACE FUNCTION public.register_central_document(
  p_snapshot jsonb, p_actor uuid, p_pdf_path text, p_pdf_hash text,
  p_snapshot_hash text, p_original_path text DEFAULT NULL, p_original_hash text DEFAULT NULL,
  p_manifest jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := (p_snapshot #>> '{context,tenantId}')::uuid;
  v_entity uuid := (p_snapshot #>> '{context,entityId}')::uuid;
  v_id uuid := (p_snapshot ->> 'documentId')::uuid;
  v_target text := p_snapshot #>> '{context,target}';
  v_key text := p_snapshot #>> '{definition,key}';
  v_version integer := (p_snapshot #>> '{definition,version}')::integer;
  v_revision integer := (p_snapshot ->> 'revision')::integer;
  v_parent uuid := nullif(p_snapshot ->> 'parentDocumentId','')::uuid;
  v_definition jsonb;
  v_title text;
  v_source text;
  v_client_document uuid;
  v_employee_document uuid;
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_actor AND tenant_id=v_tenant) THEN
    RAISE EXCEPTION 'Ungültiger Akteur oder Mandant.' USING ERRCODE='42501';
  END IF;
  SELECT title, source_mode, definition_json INTO v_title,v_source,v_definition
    FROM public.central_document_catalog WHERE template_key=v_key AND version=v_version AND review_status <> 'withdrawn' AND target=v_target;
  IF NOT FOUND OR p_snapshot -> 'definition' IS DISTINCT FROM v_definition THEN
    RAISE EXCEPTION 'Vorlagenfassung fehlt oder wurde verändert.' USING ERRCODE='22023';
  END IF;
  IF (v_target='client' AND NOT EXISTS (SELECT 1 FROM public.clients WHERE id=v_entity AND tenant_id=v_tenant))
    OR (v_target='employee' AND NOT EXISTS (SELECT 1 FROM public.employees WHERE id=v_entity AND tenant_id=v_tenant))
    OR (v_target='company' AND v_entity<>v_tenant) THEN
    RAISE EXCEPTION 'Die Akte gehört nicht zum Mandanten.' USING ERRCODE='42501';
  END IF;
  IF p_pdf_path <> 'tenant/'||v_tenant||'/central-documents/'||v_id||'/draft.pdf'
    OR (p_original_path IS NOT NULL AND p_original_path <> 'tenant/'||v_tenant||'/central-documents/'||v_id||'/original.pdf') THEN
    RAISE EXCEPTION 'Ungültiger Speicherpfad.' USING ERRCODE='22023';
  END IF;
  IF v_source='original' AND p_original_path IS NULL THEN RAISE EXCEPTION 'Originalunterlage fehlt.' USING ERRCODE='22023'; END IF;
  IF v_parent IS NULL THEN
    IF v_revision<>1 THEN RAISE EXCEPTION 'Ungültige erste Fassung.' USING ERRCODE='22023'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.central_document_records WHERE id=v_parent AND tenant_id=v_tenant AND target=v_target AND entity_id=v_entity AND template_key=v_key AND revision=v_revision-1) THEN
      RAISE EXCEPTION 'Ungültige Vorgängerfassung.' USING ERRCODE='22023';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_definition -> 'fields') f
    WHERE (f->>'required')::boolean AND nullif(btrim(p_snapshot #>> ARRAY['values',f->>'key']), '') IS NULL) THEN
    RAISE EXCEPTION 'Pflichtangaben fehlen.' USING ERRCODE='22023';
  END IF;
  -- Never advertise a draft as a signed/finalized clinical or legal document.
  INSERT INTO public.generated_documents (id,tenant_id,title,document_type,status,client_id,employee_id,
    template_version,document_number,file_name,generated_content_json,autofill_snapshot_json,pdf_path,created_by)
  VALUES (v_id,v_tenant,'Entwurf · '||v_title,'central_catalog','draft',
    CASE WHEN v_target='client' THEN v_entity END, CASE WHEN v_target='employee' THEN v_entity END,
    v_version,v_id::text,'draft.pdf',p_snapshot,p_snapshot->'context',p_pdf_path,p_actor);
  IF v_target='client' THEN
    INSERT INTO public.client_documents (tenant_id,client_id,title,file_name,mime_type,category,storage_path,status,sensitivity,uploaded_by)
    VALUES (v_tenant,v_entity,'Entwurf · '||v_title,'draft.pdf','application/pdf','sonstige',p_pdf_path,'entwurf','restricted',p_actor)
    RETURNING id INTO v_client_document;
    IF p_original_path IS NOT NULL THEN
      INSERT INTO public.client_documents (tenant_id,client_id,title,file_name,mime_type,category,storage_path,status,sensitivity,uploaded_by)
      VALUES (v_tenant,v_entity,'Original · '||v_title,'original.pdf','application/pdf','sonstige',p_original_path,'aktiv','restricted',p_actor);
    END IF;
  ELSIF v_target='employee' THEN
    INSERT INTO public.employee_documents (tenant_id,employee_id,title,file_name,category,storage_path,sensitive,released_to_portal)
    VALUES (v_tenant,v_entity,'Entwurf · '||v_title,'draft.pdf','central_catalog',p_pdf_path,true,false)
    RETURNING id INTO v_employee_document;
    IF p_original_path IS NOT NULL THEN
      INSERT INTO public.employee_documents (tenant_id,employee_id,title,file_name,category,storage_path,sensitive,released_to_portal)
      VALUES (v_tenant,v_entity,'Original · '||v_title,'original.pdf','central_catalog_original',p_original_path,true,false);
    END IF;
  END IF;
  INSERT INTO public.central_document_records (id,tenant_id,template_key,template_version,title,target,entity_id,state,revision,parent_document_id,
    snapshot_json,pdf_path,pdf_hash,snapshot_hash,original_path,original_hash,provenance_manifest,client_document_id,employee_document_id,created_by)
  VALUES (v_id,v_tenant,v_key,v_version,v_title,v_target,v_entity,'draft',v_revision,v_parent,p_snapshot,
    p_pdf_path,p_pdf_hash,p_snapshot_hash,p_original_path,p_original_hash,p_manifest,v_client_document,v_employee_document,p_actor)
  RETURNING to_jsonb(central_document_records.*) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.register_central_document(jsonb,uuid,text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_central_document(jsonb,uuid,text,text,text,text,text,jsonb) TO service_role;

-- Existing bucket, additive tenant read policy. Writes are server only.
CREATE POLICY central_document_files_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='office-documents' AND (storage.foldername(name))[1]='tenant'
  AND (storage.foldername(name))[2]=public.current_tenant_id()::text
  AND (storage.foldername(name))[3]='central-documents'
  AND EXISTS (SELECT 1 FROM public.central_document_records r WHERE r.tenant_id=public.current_tenant_id() AND (r.pdf_path=name OR r.original_path=name))
);
-- Restrictive policies also constrain older permissive bucket policies.
CREATE POLICY central_document_files_scope ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (
  bucket_id<>'office-documents' OR (storage.foldername(name))[3] IS DISTINCT FROM 'central-documents'
  OR EXISTS (SELECT 1 FROM public.central_document_records r WHERE r.tenant_id=public.current_tenant_id() AND (r.pdf_path=name OR r.original_path=name))
);
CREATE POLICY central_document_files_no_client_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  bucket_id<>'office-documents' OR (storage.foldername(name))[3] IS DISTINCT FROM 'central-documents'
);
CREATE POLICY central_document_files_no_client_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING (
  bucket_id<>'office-documents' OR (storage.foldername(name))[3] IS DISTINCT FROM 'central-documents'
) WITH CHECK (bucket_id<>'office-documents' OR (storage.foldername(name))[3] IS DISTINCT FROM 'central-documents');
CREATE POLICY central_document_files_no_client_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (
  bucket_id<>'office-documents' OR (storage.foldername(name))[3] IS DISTINCT FROM 'central-documents'
);
COMMIT;
