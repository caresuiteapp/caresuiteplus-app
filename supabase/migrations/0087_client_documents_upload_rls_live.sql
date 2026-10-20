-- ==========================================================================
-- CareSuite+ — Migration 0087: Klienten-Dokument-Upload RLS auf Live
-- ClientRecord → Dokumente → „In Akte speichern“ → 42501 RLS
-- Ursache: storage.objects office_docs_insert verlangt office.documents.upload;
-- Owner hat legacy „documents“.can_create, aber kein Mapping für *.upload.
-- Zusätzlich: client_documents.category CHECK zu eng für Katalog (beratungsprotokoll).
-- Pattern: 0076_employees_create_rls_live.sql, 0083_owner_clients_permissions_live.sql
-- ==========================================================================

-- --------------------------------------------------------------------------
-- has_permission: *.upload + *.manage + business.tenant.manage (0078/0080 merge)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    WHERE pr.auth_user_id = auth.uid()
      AND (
        rp.permission_key = p_permission_key
        OR (
          rp.permission_key = split_part(p_permission_key, '.', 2)
          AND (
            (p_permission_key LIKE '%.view' AND COALESCE(rp.can_view, FALSE))
            OR (p_permission_key LIKE '%.create' AND COALESCE(rp.can_create, FALSE))
            OR (p_permission_key LIKE '%.upload' AND COALESCE(rp.can_create, FALSE))
            OR (
              (p_permission_key LIKE '%.edit' OR p_permission_key LIKE '%.update')
              AND COALESCE(rp.can_update, FALSE)
            )
            OR (p_permission_key LIKE '%.delete' AND COALESCE(rp.can_delete, FALSE))
            OR (
              p_permission_key LIKE '%.manage'
              AND COALESCE(rp.can_update, FALSE)
            )
          )
        )
      )
  )
  OR (
    p_permission_key = 'business.tenant.manage'
    AND public.is_tenant_admin()
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

-- --------------------------------------------------------------------------
-- Owner/Admin: explizite office.documents.* Keys (wie 0083 für clients)
-- --------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (
  VALUES
    ('office.documents.view'),
    ('office.documents.upload')
) AS p(key)
WHERE r.key IN ('owner', 'admin', 'management', 'geschaeftsfuehrung')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- Storage: office-documents — Upload für Akten-Dokumente (office.clients.edit)
-- Pfad: tenant/{tenantId}/clients/{clientId}/documents/{docId}/{fileName}
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "office_docs_insert" ON storage.objects;
CREATE POLICY "office_docs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'office-documents'
    AND (storage.foldername(name))[1] = 'tenant'
    AND (storage.foldername(name))[2] = public.current_tenant_id()::text
    AND (
      public.has_permission('office.documents.upload')
      OR (
        public.has_permission('office.clients.edit')
        AND (storage.foldername(name))[3] = 'clients'
        AND (storage.foldername(name))[5] = 'documents'
      )
    )
  );

-- --------------------------------------------------------------------------
-- client_documents: explizite INSERT-Policy (neben write_tenant FOR ALL)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_documents_insert_tenant" ON public.client_documents;
CREATE POLICY "client_documents_insert_tenant"
  ON public.client_documents FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      public.has_permission('office.clients.edit')
      OR public.has_permission('office.documents.upload')
    )
  );

-- --------------------------------------------------------------------------
-- Kategorie-Constraint: Katalog document_category + Legacy-Werte
-- --------------------------------------------------------------------------
ALTER TABLE public.client_documents DROP CONSTRAINT IF EXISTS client_documents_category_check;
ALTER TABLE public.client_documents ADD CONSTRAINT client_documents_category_check
  CHECK (category IN (
    'vertrag', 'pflegeplan', 'arztbrief', 'md_gutachten', 'einwilligung', 'sonstige',
    'datenschutz', 'vollmacht', 'betreuerausweis', 'pflegegradbescheid', 'kassenbescheid',
    'rezept', 'verordnung', 'ueberweisung', 'medikationsplan', 'leistungsnachweis',
    'rechnung', 'mahnung', 'beratungsprotokoll', 'pflegebericht', 'vitalwerte',
    'wunddokumentation', 'foto', 'scan', 'ausweis', 'schluesselprotokoll', 'sonstiges'
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_documents TO authenticated;
