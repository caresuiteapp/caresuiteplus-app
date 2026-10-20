-- Isolated fixture shape for the existing signed-source contract. The real
-- office_invoice_assert_source function runs unchanged against these tables.
-- Synthetic attestations are not evidence of hosted signature production.
ALTER TABLE public.documentation_entries
  ADD COLUMN tenant_id uuid, ADD COLUMN assignment_id uuid, ADD COLUMN client_id uuid,
  ADD COLUMN employee_id uuid, ADD COLUMN status text, ADD COLUMN free_text text,
  ADD COLUMN updated_at timestamptz;
ALTER TABLE public.signatures
  ADD COLUMN tenant_id uuid, ADD COLUMN assignment_id uuid, ADD COLUMN documentation_entry_id uuid,
  ADD COLUMN client_id uuid, ADD COLUMN employee_id uuid, ADD COLUMN status text,
  ADD COLUMN signature_data text, ADD COLUMN signer_name text, ADD COLUMN signed_at timestamptz;
ALTER TABLE public.workflow_proof_attestations
  ADD COLUMN tenant_id uuid, ADD COLUMN assignment_id uuid, ADD COLUMN proof_id uuid,
  ADD COLUMN legacy_documentation_id uuid, ADD COLUMN legacy_signature_id uuid,
  ADD COLUMN documentation_updated_at timestamptz, ADD COLUMN signed_at timestamptz,
  ADD COLUMN proof_payload_hash text, ADD COLUMN signature_hash text,
  ADD COLUMN service_started_at timestamptz, ADD COLUMN service_ended_at timestamptz,
  ADD COLUMN actual_minutes integer, ADD COLUMN pdf_storage_path text, ADD COLUMN pdf_sha256 text,
  ADD COLUMN verified_at timestamptz, ADD COLUMN producer_contract text;
CREATE TABLE public.time_entries(id uuid PRIMARY KEY, tenant_id uuid, assignment_id uuid, entry_type text, event_at timestamptz);
GRANT ALL ON public.time_entries TO authenticated,service_role;
