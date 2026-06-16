-- Client record documents: link uploaded/archived docs to intake document rows

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS intake_document_id UUID REFERENCES public.client_intake_documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_documents_intake
  ON public.client_documents (tenant_id, client_id, intake_document_id)
  WHERE intake_document_id IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.client_care_contexts') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE ON
      public.client_care_contexts,
      public.client_ambulatory_details,
      public.client_stationary_details,
      public.client_support_preferences,
      public.client_insurance_profiles,
      public.client_medical_notes
    TO authenticated;
  END IF;
END $$;
