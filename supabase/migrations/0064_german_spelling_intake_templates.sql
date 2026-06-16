-- German spelling/capitalization: bump intake template version after app-side
-- placeholder formatting (formatCareLevel → "PG 3", formatSalutation → "Herr"/"Frau").
-- Static HTML in v2 templates already uses correct § labels and formal Sie/Ihnen.

UPDATE public.intake_document_system_templates
SET version = 3,
    updated_at = NOW()
WHERE template_key IN (
  'privacy_consent_default',
  'assignment_declaration_care_health_insurance',
  'client_contract_assist',
  'client_contract_ambulatory_care',
  'client_contract_stationary_care',
  'client_contract_care_consulting',
  'client_contract_day_care',
  'client_contract_relief_services',
  'confidentiality_release_default',
  'communication_consent_default',
  'photo_media_consent_default',
  'emergency_contact_consent_default'
);
