-- Intake document templates v3: dynamic cost-carrier merge blocks, GP fallback clause,
-- no inline missing-placeholder markers in rendered output (handled in app merge layer).

UPDATE public.intake_document_system_templates
SET
  html_content = REPLACE(
    html_content,
    '<tr><td class="label">Kostenträger:</td><td>{{cost_carrier.primary_name}} · Pflegekasse: {{cost_carrier.care_fund_name}}</td></tr>',
    '<tr><td class="label">Kostenträger:</td><td>{{cost_carrier.parties_line}}</td></tr>'
  ),
  version = 3,
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

UPDATE public.intake_document_system_templates
SET
  html_content = REPLACE(
    html_content,
    E'<li>Pflegekasse: {{cost_carrier.care_fund_name}} (IK: {{cost_carrier.care_fund_ik}});</li>\n<li>Krankenkasse: {{cost_carrier.health_insurance_name}};</li>\n',
    E'{{cost_carrier.recipients_list}}\n'
  ),
  updated_at = NOW()
WHERE template_key = 'privacy_consent_default';

UPDATE public.intake_document_system_templates
SET
  html_content = REPLACE(
    html_content,
    'Ich, {{client.full_name}}, entbinde hiermit meine behandelnden Ärzt:innen — insbesondere {{consulting.family_doctor}} — von der ärztlichen Schweigepflicht',
    'Ich, {{client.full_name}}, entbinde hiermit {{consulting.family_doctor_clause}} von der ärztlichen Schweigepflicht'
  ),
  updated_at = NOW()
WHERE template_key = 'confidentiality_release_default';
