-- Checkpoint 223 / T-01: additive structured contract-basis fields.
-- Existing contracts remain unchanged and therefore visibly incomplete until reviewed.

ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS contract_partner text,
  ADD COLUMN IF NOT EXISTS service_basis text,
  ADD COLUMN IF NOT EXISTS contract_version integer;

ALTER TABLE public.client_contracts
  DROP CONSTRAINT IF EXISTS client_contracts_contract_version_positive;

ALTER TABLE public.client_contracts
  ADD CONSTRAINT client_contracts_contract_version_positive
  CHECK (contract_version IS NULL OR contract_version >= 1);

COMMENT ON COLUMN public.client_contracts.contract_partner IS
  'Vertragspartner laut strukturierter Vertragsgrundlage; kein Ersatz für das Originaldokument.';
COMMENT ON COLUMN public.client_contracts.service_basis IS
  'Dokumentierte Leistungsgrundlage; keine automatische rechtliche Wirksamkeitsprüfung.';
COMMENT ON COLUMN public.client_contracts.contract_version IS
  'Version der hinterlegten Vertragsgrundlage; Bestandszeilen bleiben bis zur Prüfung NULL.';
