-- ==========================================================================
-- CareSuite+ — Migration 0170: Systemvorlagen-Katalog (179 Einträge)
-- Idempotent: überspringt bereits vorhandene template_key.
-- ==========================================================================

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_template_type_check;

ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_template_type_check
  CHECK (template_type IN (
    'contract', 'invoice', 'leistungsnachweis', 'generic',
    'business_letter', 'credit_note', 'cancellation_invoice', 'offer',
    'service_record', 'care_documentation', 'consultation_record',
    'employee_contract', 'termination_letter', 'warning_letter',
    'client_admission', 'power_of_attorney', 'data_protection_consent',
    'confidentiality_agreement', 'dunning_letter', 'payment_reminder',
    'internal_instruction', 'protocol', 'checklist', 'report',
    'employee_record', 'shift_plan', 'tour_plan', 'vehicle_log'
  ));

DO $$
DECLARE
  tpl RECORD;
  tid UUID;
  vid UUID;
  seed_tenant UUID;
BEGIN
  SELECT id INTO seed_tenant FROM public.tenants ORDER BY created_at NULLS LAST LIMIT 1;
  IF seed_tenant IS NULL THEN
    seed_tenant := '00000000-0000-4000-8000-000000000001'::uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'absaugprotokoll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'absaugprotokoll', 'care_documentation', 'Absaugprotokoll', 'Absaugprotokoll',
      'Absaugprotokoll', 'Absaugprotokoll — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 1,
      'klient', 'table', 'klient', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Absaugprotokoll</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Sekretmenge</td><td class="cs-field-manual">{{manual.sekretmenge}}</td></tr><tr><td>Maßnahme</td><td class="cs-field-manual">{{manual.massnahme}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"sekretmenge","label":"Sekretmenge"},{"fieldKey":"massnahme","label":"Maßnahme"}]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','absaugprotokoll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'abtretung_45b' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'abtretung_45b', 'contract', 'Abtretungserklärung §45b SGB XI', 'Abtretungserklärung §45b SGB XI',
      'Abtretung45b', 'Abtretungserklärung §45b SGB XI — CareSuite+ Systemvorlage', '{"assist","office","pflege","beratung"}'::text[], 2,
      'vertrag', 'din5008', 'vertrag', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'vertraege',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"contract"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Abtretungserklärung §45b SGB XI</h1>
  <p class="cs-doc-subtitle">Vertragsdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Vertragsgegenstand</h2>
<p class="cs-field-manual">{{manual.vertragsgegenstand}}</p>
<h2>Laufzeit & Kündigung</h2>
<p><strong>Beginn:</strong> <span class="cs-field-manual">{{manual.leistungsbeginn}}</span></p>
<p><strong>Ende:</strong> <span class="cs-field-manual">{{manual.leistungsende}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"leistungsbeginn","label":"Leistungsbeginn"}]'::jsonb, 'active',
      '{"layoutFamily":"contract"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','abtretung_45b','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'interessent_anfrage' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'interessent_anfrage', 'client_admission', 'Anfrage / Interessent', 'Anfrage / Interessent',
      'Interessent', 'Anfrage / Interessent — CareSuite+ Systemvorlage', '{"office","assist","beratung"}'::text[], 3,
      'klient', 'form', 'klient', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'prospect_record', 'interessenten',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"checklist"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Anfrage / Interessent</h1>
  <p class="cs-doc-subtitle">Checkliste</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table">
<thead><tr><th>Punkt</th><th>Status / Anmerkung</th></tr></thead>
<tbody><tr><td>☐ Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody>
</table>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"checklist"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','interessent_anfrage','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'personalstammdaten' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'personalstammdaten', 'employee_record', 'Personalstammdaten', 'Personalstammdaten',
      'Personalstamm', 'Personalstammdaten — CareSuite+ Systemvorlage', '{"office"}'::text[], 4,
      'mitarbeiter', 'premium', 'mitarbeiter', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'employee_record', 'personalakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"employee_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Personalstammdaten</h1>
  <p class="cs-doc-subtitle">Personalformular</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Mitarbeitende:r</dt><dd>{{employee.full_name}}</dd>
<dt>Personalnummer</dt><dd>{{employee.staff_number}}</dd>
<dt>Standort</dt><dd>{{employee.location}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Handzeichen:</strong> {{employee.handzeichen}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"employee_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','personalstammdaten','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'urlaubsantrag' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'urlaubsantrag', 'employee_record', 'Urlaubsantrag', 'Urlaubsantrag',
      'Urlaubsantrag', 'Urlaubsantrag — CareSuite+ Systemvorlage', '{"office"}'::text[], 5,
      'mitarbeiter', 'form', 'mitarbeiter', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'employee_record', 'personalakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"employee_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Urlaubsantrag</h1>
  <p class="cs-doc-subtitle">Personalformular</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Mitarbeitende:r</dt><dd>{{employee.full_name}}</dd>
<dt>Personalnummer</dt><dd>{{employee.staff_number}}</dd>
<dt>Standort</dt><dd>{{employee.location}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Handzeichen:</strong> {{employee.handzeichen}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"employee_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','urlaubsantrag','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'stundenzettel' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'stundenzettel', 'employee_record', 'Stundenzettel', 'Stundenzettel',
      'Stundenzettel', 'Stundenzettel — CareSuite+ Systemvorlage', '{"office"}'::text[], 6,
      'mitarbeiter', 'table', 'mitarbeiter', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'employee_record', 'personalakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"employee_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Stundenzettel</h1>
  <p class="cs-doc-subtitle">Personalformular</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Mitarbeitende:r</dt><dd>{{employee.full_name}}</dd>
<dt>Personalnummer</dt><dd>{{employee.staff_number}}</dd>
<dt>Standort</dt><dd>{{employee.location}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Handzeichen:</strong> {{employee.handzeichen}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"employee_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','stundenzettel','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'dienstplan_soll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'dienstplan_soll', 'shift_plan', 'Dienstplan Soll', 'Dienstplan Soll',
      'DienstplanSoll', 'Dienstplan Soll — CareSuite+ Systemvorlage', '{"office","pflege"}'::text[], 7,
      'dienstplan', 'table', 'dienstplan', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'shift_record', 'dienstplan',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"shift_plan"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Dienstplan Soll</h1>
  <p class="cs-doc-subtitle">Dienstplan</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><p><strong>Zeitraum:</strong> <span class="cs-field-manual">{{manual.zeitraum}}</span></p>
<table class="cs-block-table">
<thead><tr><th>Datum</th><th>Schicht</th><th>Mitarbeitende:r</th><th>Qualifikation</th></tr></thead>
<tbody><tr><td class="cs-field-manual">{{manual.datum}}</td><td class="cs-field-manual">{{manual.schicht}}</td><td>{{employee.full_name}}</td><td class="cs-field-manual">{{manual.qualifikation}}</td></tr></tbody>
</table>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"shift_plan"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','dienstplan_soll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'dienstplan_ist' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'dienstplan_ist', 'shift_plan', 'Dienstplan Ist', 'Dienstplan Ist',
      'DienstplanIst', 'Dienstplan Ist — CareSuite+ Systemvorlage', '{"office","pflege"}'::text[], 8,
      'dienstplan', 'table', 'dienstplan', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'shift_record', 'dienstplan',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"shift_plan"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Dienstplan Ist</h1>
  <p class="cs-doc-subtitle">Dienstplan</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><p><strong>Zeitraum:</strong> <span class="cs-field-manual">{{manual.zeitraum}}</span></p>
<table class="cs-block-table">
<thead><tr><th>Datum</th><th>Schicht</th><th>Mitarbeitende:r</th><th>Qualifikation</th></tr></thead>
<tbody><tr><td class="cs-field-manual">{{manual.datum}}</td><td class="cs-field-manual">{{manual.schicht}}</td><td>{{employee.full_name}}</td><td class="cs-field-manual">{{manual.qualifikation}}</td></tr></tbody>
</table>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"shift_plan"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','dienstplan_ist','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'tourenplan_woche' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'tourenplan_woche', 'tour_plan', 'Tourenplan Wochensicht', 'Tourenplan Wochensicht',
      'TourenWoche', 'Tourenplan Wochensicht — CareSuite+ Systemvorlage', '{"office","assist"}'::text[], 9,
      'tourenplan', 'table', 'tourenplan', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'tour_record', 'tourenplan',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"tour_plan"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Tourenplan Wochensicht</h1>
  <p class="cs-doc-subtitle">Tourenplan</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><p><strong>Tour:</strong> <span class="cs-field-manual">{{manual.tour_name}}</span> · <strong>Datum:</strong> {{assignment.date}}</p>
<table class="cs-block-table">
<thead><tr><th>Reihenfolge</th><th>Klient:in</th><th>Adresse</th><th>Zeitfenster</th></tr></thead>
<tbody><tr><td>1</td><td>{{client.full_name}}</td><td>{{client.street}}, {{client.zip}} {{client.city}}</td><td class="cs-field-manual">{{manual.zeitfenster}}</td></tr></tbody>
</table>
<p><strong>Fahrzeug:</strong> <span class="cs-field-manual">{{manual.fahrzeug}}</span></p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"tour_plan"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','tourenplan_woche','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'beratungsprotokoll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'beratungsprotokoll', 'consultation_record', 'Beratungsprotokoll', 'Beratungsprotokoll',
      'Beratungsprotokoll', 'Beratungsprotokoll — CareSuite+ Systemvorlage', '{"beratung"}'::text[], 10,
      'beratung', 'din5008', 'beratung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'consultation_record', 'beratungsakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"consultation"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Beratungsprotokoll</h1>
  <p class="cs-doc-subtitle">Beratungsgespräch</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Beratungsinhalt</h2>
<p class="cs-field-manual">{{manual.inhalt}}</p>
<h2>Empfehlungen</h2>
<p class="cs-field-manual">{{manual.empfehlungen}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"consultation"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','beratungsprotokoll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'beschwerdeprotokoll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'beschwerdeprotokoll', 'protocol', 'Beschwerdeprotokoll', 'Beschwerdeprotokoll',
      'Beschwerde', 'Beschwerdeprotokoll — CareSuite+ Systemvorlage', '{"office","assist","pflege","stationaer"}'::text[], 11,
      'qm', 'form', 'qm', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'qm',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"incident"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Beschwerdeprotokoll</h1>
  <p class="cs-doc-subtitle">Vorfall / Ereignisprotokoll</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Zeitpunkt:</strong> <span class="cs-field-manual">{{manual.zeitpunkt}}</span></p>
<p><strong>Ort:</strong> <span class="cs-field-manual">{{manual.ort}}</span></p>
<h2>Schilderung</h2>
<p class="cs-field-manual">{{manual.schilderung}}</p>
<h2>Maßnahmen</h2>
<p class="cs-field-manual">{{manual.massnahmen}}</p>
<p><strong>Protokollführende:r:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"incident"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','beschwerdeprotokoll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'tourenplan_tag' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'tourenplan_tag', 'tour_plan', 'Tourenplan Tagessicht', 'Tourenplan Tagessicht',
      'TourenTag', 'Tourenplan Tagessicht — CareSuite+ Systemvorlage', '{"office","assist"}'::text[], 12,
      'tourenplan', 'table', 'tourenplan', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'tour_record', 'tourenplan',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"tour_plan"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Tourenplan Tagessicht</h1>
  <p class="cs-doc-subtitle">Tourenplan</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><p><strong>Tour:</strong> <span class="cs-field-manual">{{manual.tour_name}}</span> · <strong>Datum:</strong> {{assignment.date}}</p>
<table class="cs-block-table">
<thead><tr><th>Reihenfolge</th><th>Klient:in</th><th>Adresse</th><th>Zeitfenster</th></tr></thead>
<tbody><tr><td>1</td><td>{{client.full_name}}</td><td>{{client.street}}, {{client.zip}} {{client.city}}</td><td class="cs-field-manual">{{manual.zeitfenster}}</td></tr></tbody>
</table>
<p><strong>Fahrzeug:</strong> <span class="cs-field-manual">{{manual.fahrzeug}}</span></p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"tour_plan"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','tourenplan_tag','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'fahrtenbuch' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'fahrtenbuch', 'vehicle_log', 'Fahrtenbuch', 'Fahrtenbuch',
      'Fahrtenbuch', 'Fahrtenbuch — CareSuite+ Systemvorlage', '{"office"}'::text[], 13,
      'fahrzeug', 'table', 'fahrzeug', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'vehicle_record', 'fahrzeugakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"vehicle_log"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Fahrtenbuch</h1>
  <p class="cs-doc-subtitle">Fahrzeugprotokoll</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Fahrzeug</dt><dd class="cs-field-manual">{{manual.fahrzeug}}</dd>
<dt>Kilometerstand</dt><dd class="cs-field-manual">{{manual.km_stand}}</dd>
<dt>Fahrer:in</dt><dd>{{employee.full_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Strecke / Zweck</td><td class="cs-field-manual">{{manual.strecke}}</td></tr></tbody></table>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"vehicle_log"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','fahrtenbuch','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'bewohnerstammblatt' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'bewohnerstammblatt', 'client_admission', 'Bewohnerstammblatt', 'Bewohnerstammblatt',
      'Bewohnerstamm', 'Bewohnerstammblatt — CareSuite+ Systemvorlage', '{"stationaer"}'::text[], 14,
      'stationaer', 'premium', 'stationaer', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'stationaerakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"client_master"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Stammblatt</h1>
  <p class="cs-doc-subtitle">Zentrale Klient:innen-Stammdaten</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Besonderheiten & Zugang</h2>
<p class="cs-field-manual">{{manual.besonderheiten}}</p>
<p><strong>Notfallkontakt:</strong> {{client.emergency_contact_name}} · {{client.emergency_contact_phone}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"client_master"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','bewohnerstammblatt','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_015' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_015', 'generic', 'CareSuite Dokumentvorlage 15', 'CareSuite Dokumentvorlage 15',
      'Doc15', 'CareSuite Dokumentvorlage 15 — CareSuite+ Systemvorlage', '{"office"}'::text[], 15,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 15</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_015','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_016' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_016', 'generic', 'CareSuite Dokumentvorlage 16', 'CareSuite Dokumentvorlage 16',
      'Doc16', 'CareSuite Dokumentvorlage 16 — CareSuite+ Systemvorlage', '{"office"}'::text[], 16,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 16</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_016','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_017' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_017', 'generic', 'CareSuite Dokumentvorlage 17', 'CareSuite Dokumentvorlage 17',
      'Doc17', 'CareSuite Dokumentvorlage 17 — CareSuite+ Systemvorlage', '{"office"}'::text[], 17,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 17</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_017','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_018' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_018', 'generic', 'CareSuite Dokumentvorlage 18', 'CareSuite Dokumentvorlage 18',
      'Doc18', 'CareSuite Dokumentvorlage 18 — CareSuite+ Systemvorlage', '{"office"}'::text[], 18,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 18</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_018','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_019' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_019', 'generic', 'CareSuite Dokumentvorlage 19', 'CareSuite Dokumentvorlage 19',
      'Doc19', 'CareSuite Dokumentvorlage 19 — CareSuite+ Systemvorlage', '{"office"}'::text[], 19,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 19</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_019','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_020' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_020', 'generic', 'CareSuite Dokumentvorlage 20', 'CareSuite Dokumentvorlage 20',
      'Doc20', 'CareSuite Dokumentvorlage 20 — CareSuite+ Systemvorlage', '{"office"}'::text[], 20,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 20</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_020','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_021' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_021', 'generic', 'CareSuite Dokumentvorlage 21', 'CareSuite Dokumentvorlage 21',
      'Doc21', 'CareSuite Dokumentvorlage 21 — CareSuite+ Systemvorlage', '{"office"}'::text[], 21,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 21</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_021','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_022' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_022', 'generic', 'CareSuite Dokumentvorlage 22', 'CareSuite Dokumentvorlage 22',
      'Doc22', 'CareSuite Dokumentvorlage 22 — CareSuite+ Systemvorlage', '{"office"}'::text[], 22,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 22</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_022','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_023' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_023', 'generic', 'CareSuite Dokumentvorlage 23', 'CareSuite Dokumentvorlage 23',
      'Doc23', 'CareSuite Dokumentvorlage 23 — CareSuite+ Systemvorlage', '{"office"}'::text[], 23,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 23</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_023','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_024' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_024', 'generic', 'CareSuite Dokumentvorlage 24', 'CareSuite Dokumentvorlage 24',
      'Doc24', 'CareSuite Dokumentvorlage 24 — CareSuite+ Systemvorlage', '{"office"}'::text[], 24,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 24</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_024','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_025' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_025', 'generic', 'CareSuite Dokumentvorlage 25', 'CareSuite Dokumentvorlage 25',
      'Doc25', 'CareSuite Dokumentvorlage 25 — CareSuite+ Systemvorlage', '{"office"}'::text[], 25,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 25</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_025','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_026' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_026', 'generic', 'CareSuite Dokumentvorlage 26', 'CareSuite Dokumentvorlage 26',
      'Doc26', 'CareSuite Dokumentvorlage 26 — CareSuite+ Systemvorlage', '{"office"}'::text[], 26,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 26</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_026','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_027' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_027', 'generic', 'CareSuite Dokumentvorlage 27', 'CareSuite Dokumentvorlage 27',
      'Doc27', 'CareSuite Dokumentvorlage 27 — CareSuite+ Systemvorlage', '{"office"}'::text[], 27,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 27</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_027','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_028' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_028', 'generic', 'CareSuite Dokumentvorlage 28', 'CareSuite Dokumentvorlage 28',
      'Doc28', 'CareSuite Dokumentvorlage 28 — CareSuite+ Systemvorlage', '{"office"}'::text[], 28,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 28</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_028','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_029' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_029', 'generic', 'CareSuite Dokumentvorlage 29', 'CareSuite Dokumentvorlage 29',
      'Doc29', 'CareSuite Dokumentvorlage 29 — CareSuite+ Systemvorlage', '{"office"}'::text[], 29,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 29</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_029','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_030' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_030', 'generic', 'CareSuite Dokumentvorlage 30', 'CareSuite Dokumentvorlage 30',
      'Doc30', 'CareSuite Dokumentvorlage 30 — CareSuite+ Systemvorlage', '{"office"}'::text[], 30,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 30</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_030','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_031' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_031', 'generic', 'CareSuite Dokumentvorlage 31', 'CareSuite Dokumentvorlage 31',
      'Doc31', 'CareSuite Dokumentvorlage 31 — CareSuite+ Systemvorlage', '{"office"}'::text[], 31,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 31</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_031','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_032' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_032', 'generic', 'CareSuite Dokumentvorlage 32', 'CareSuite Dokumentvorlage 32',
      'Doc32', 'CareSuite Dokumentvorlage 32 — CareSuite+ Systemvorlage', '{"office"}'::text[], 32,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 32</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_032','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_033' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_033', 'generic', 'CareSuite Dokumentvorlage 33', 'CareSuite Dokumentvorlage 33',
      'Doc33', 'CareSuite Dokumentvorlage 33 — CareSuite+ Systemvorlage', '{"office"}'::text[], 33,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 33</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_033','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_034' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_034', 'generic', 'CareSuite Dokumentvorlage 34', 'CareSuite Dokumentvorlage 34',
      'Doc34', 'CareSuite Dokumentvorlage 34 — CareSuite+ Systemvorlage', '{"office"}'::text[], 34,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 34</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_034','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_035' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_035', 'generic', 'CareSuite Dokumentvorlage 35', 'CareSuite Dokumentvorlage 35',
      'Doc35', 'CareSuite Dokumentvorlage 35 — CareSuite+ Systemvorlage', '{"office"}'::text[], 35,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 35</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_035','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_036' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_036', 'generic', 'CareSuite Dokumentvorlage 36', 'CareSuite Dokumentvorlage 36',
      'Doc36', 'CareSuite Dokumentvorlage 36 — CareSuite+ Systemvorlage', '{"office"}'::text[], 36,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 36</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_036','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_037' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_037', 'generic', 'CareSuite Dokumentvorlage 37', 'CareSuite Dokumentvorlage 37',
      'Doc37', 'CareSuite Dokumentvorlage 37 — CareSuite+ Systemvorlage', '{"office"}'::text[], 37,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 37</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_037','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_038' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_038', 'generic', 'CareSuite Dokumentvorlage 38', 'CareSuite Dokumentvorlage 38',
      'Doc38', 'CareSuite Dokumentvorlage 38 — CareSuite+ Systemvorlage', '{"office"}'::text[], 38,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 38</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_038','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'kommunikationsnachweis' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'kommunikationsnachweis', 'protocol', 'Kommunikationsnachweis', 'Kommunikationsnachweis',
      'Kommunikation', 'Kommunikationsnachweis — CareSuite+ Systemvorlage', '{"assist","office","pflege","beratung","stationaer"}'::text[], 39,
      'klient', 'form', 'klient', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'kommunikation',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"checklist"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Kommunikationsnachweis</h1>
  <p class="cs-doc-subtitle">Checkliste</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table">
<thead><tr><th>Punkt</th><th>Status / Anmerkung</th></tr></thead>
<tbody><tr><td>☐ Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody>
</table>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"checklist"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','kommunikationsnachweis','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_040' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_040', 'generic', 'CareSuite Dokumentvorlage 40', 'CareSuite Dokumentvorlage 40',
      'Doc40', 'CareSuite Dokumentvorlage 40 — CareSuite+ Systemvorlage', '{"office"}'::text[], 40,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 40</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_040','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_041' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_041', 'generic', 'CareSuite Dokumentvorlage 41', 'CareSuite Dokumentvorlage 41',
      'Doc41', 'CareSuite Dokumentvorlage 41 — CareSuite+ Systemvorlage', '{"office"}'::text[], 41,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 41</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_041','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_042' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_042', 'generic', 'CareSuite Dokumentvorlage 42', 'CareSuite Dokumentvorlage 42',
      'Doc42', 'CareSuite Dokumentvorlage 42 — CareSuite+ Systemvorlage', '{"office"}'::text[], 42,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 42</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_042','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_043' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_043', 'generic', 'CareSuite Dokumentvorlage 43', 'CareSuite Dokumentvorlage 43',
      'Doc43', 'CareSuite Dokumentvorlage 43 — CareSuite+ Systemvorlage', '{"office"}'::text[], 43,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 43</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_043','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_044' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_044', 'generic', 'CareSuite Dokumentvorlage 44', 'CareSuite Dokumentvorlage 44',
      'Doc44', 'CareSuite Dokumentvorlage 44 — CareSuite+ Systemvorlage', '{"office"}'::text[], 44,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 44</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_044','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_045' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_045', 'generic', 'CareSuite Dokumentvorlage 45', 'CareSuite Dokumentvorlage 45',
      'Doc45', 'CareSuite Dokumentvorlage 45 — CareSuite+ Systemvorlage', '{"office"}'::text[], 45,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 45</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_045','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_046' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_046', 'generic', 'CareSuite Dokumentvorlage 46', 'CareSuite Dokumentvorlage 46',
      'Doc46', 'CareSuite Dokumentvorlage 46 — CareSuite+ Systemvorlage', '{"office"}'::text[], 46,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 46</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_046','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_047' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_047', 'generic', 'CareSuite Dokumentvorlage 47', 'CareSuite Dokumentvorlage 47',
      'Doc47', 'CareSuite Dokumentvorlage 47 — CareSuite+ Systemvorlage', '{"office"}'::text[], 47,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 47</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_047','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'beratungsnachweis_37_3' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'beratungsnachweis_37_3', 'consultation_record', 'Nachweis Beratungsbesuch §37 Abs. 3 SGB XI', 'Nachweis Beratungsbesuch §37 Abs. 3 SGB XI',
      'Beratung37_3', 'Nachweis Beratungsbesuch §37 Abs. 3 SGB XI — CareSuite+ Systemvorlage', '{"beratung","pflege"}'::text[], 48,
      'beratung', 'din5008', 'beratung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'consultation_record', 'beratungsakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"consultation"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Beratungsprotokoll</h1>
  <p class="cs-doc-subtitle">Beratungsgespräch</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Beratungsinhalt</h2>
<p class="cs-field-manual">{{manual.inhalt}}</p>
<h2>Empfehlungen</h2>
<p class="cs-field-manual">{{manual.empfehlungen}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"consultation"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','beratungsnachweis_37_3','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_049' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_049', 'generic', 'CareSuite Dokumentvorlage 49', 'CareSuite Dokumentvorlage 49',
      'Doc49', 'CareSuite Dokumentvorlage 49 — CareSuite+ Systemvorlage', '{"office"}'::text[], 49,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 49</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_049','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_050' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_050', 'generic', 'CareSuite Dokumentvorlage 50', 'CareSuite Dokumentvorlage 50',
      'Doc50', 'CareSuite Dokumentvorlage 50 — CareSuite+ Systemvorlage', '{"office"}'::text[], 50,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 50</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_050','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'notfallblatt' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'notfallblatt', 'care_documentation', 'Notfallblatt', 'Notfallblatt',
      'Notfall', 'Notfallblatt — CareSuite+ Systemvorlage', '{"assist","pflege","stationaer","beratung"}'::text[], 51,
      'klient', 'premium', 'klient', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'notfall',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"client_master"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Stammblatt</h1>
  <p class="cs-doc-subtitle">Zentrale Klient:innen-Stammdaten</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Besonderheiten & Zugang</h2>
<p class="cs-field-manual">{{manual.besonderheiten}}</p>
<p><strong>Notfallkontakt:</strong> {{client.emergency_contact_name}} · {{client.emergency_contact_phone}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"client_master"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','notfallblatt','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_052' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_052', 'generic', 'CareSuite Dokumentvorlage 52', 'CareSuite Dokumentvorlage 52',
      'Doc52', 'CareSuite Dokumentvorlage 52 — CareSuite+ Systemvorlage', '{"office"}'::text[], 52,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 52</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_052','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_053' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_053', 'generic', 'CareSuite Dokumentvorlage 53', 'CareSuite Dokumentvorlage 53',
      'Doc53', 'CareSuite Dokumentvorlage 53 — CareSuite+ Systemvorlage', '{"office"}'::text[], 53,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 53</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_053','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_054' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_054', 'generic', 'CareSuite Dokumentvorlage 54', 'CareSuite Dokumentvorlage 54',
      'Doc54', 'CareSuite Dokumentvorlage 54 — CareSuite+ Systemvorlage', '{"office"}'::text[], 54,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 54</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_054','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_055' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_055', 'generic', 'CareSuite Dokumentvorlage 55', 'CareSuite Dokumentvorlage 55',
      'Doc55', 'CareSuite Dokumentvorlage 55 — CareSuite+ Systemvorlage', '{"office"}'::text[], 55,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 55</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_055','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_056' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_056', 'generic', 'CareSuite Dokumentvorlage 56', 'CareSuite Dokumentvorlage 56',
      'Doc56', 'CareSuite Dokumentvorlage 56 — CareSuite+ Systemvorlage', '{"office"}'::text[], 56,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 56</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_056','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_057' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_057', 'generic', 'CareSuite Dokumentvorlage 57', 'CareSuite Dokumentvorlage 57',
      'Doc57', 'CareSuite Dokumentvorlage 57 — CareSuite+ Systemvorlage', '{"office"}'::text[], 57,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 57</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_057','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_058' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_058', 'generic', 'CareSuite Dokumentvorlage 58', 'CareSuite Dokumentvorlage 58',
      'Doc58', 'CareSuite Dokumentvorlage 58 — CareSuite+ Systemvorlage', '{"office"}'::text[], 58,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 58</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_058','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_059' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_059', 'generic', 'CareSuite Dokumentvorlage 59', 'CareSuite Dokumentvorlage 59',
      'Doc59', 'CareSuite Dokumentvorlage 59 — CareSuite+ Systemvorlage', '{"office"}'::text[], 59,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 59</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_059','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_060' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_060', 'generic', 'CareSuite Dokumentvorlage 60', 'CareSuite Dokumentvorlage 60',
      'Doc60', 'CareSuite Dokumentvorlage 60 — CareSuite+ Systemvorlage', '{"office"}'::text[], 60,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 60</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_060','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_061' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_061', 'generic', 'CareSuite Dokumentvorlage 61', 'CareSuite Dokumentvorlage 61',
      'Doc61', 'CareSuite Dokumentvorlage 61 — CareSuite+ Systemvorlage', '{"office"}'::text[], 61,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 61</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_061','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_062' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_062', 'generic', 'CareSuite Dokumentvorlage 62', 'CareSuite Dokumentvorlage 62',
      'Doc62', 'CareSuite Dokumentvorlage 62 — CareSuite+ Systemvorlage', '{"office"}'::text[], 62,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 62</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_062','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'stammblatt' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'stammblatt', 'client_admission', 'Stammblatt', 'Stammblatt',
      'Stammblatt', 'Stammblatt — CareSuite+ Systemvorlage', '{"assist","office","pflege","beratung","stationaer"}'::text[], 63,
      'klient', 'premium', 'klient', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'stammdaten',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"client_master"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Stammblatt</h1>
  <p class="cs-doc-subtitle">Zentrale Klient:innen-Stammdaten</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Besonderheiten & Zugang</h2>
<p class="cs-field-manual">{{manual.besonderheiten}}</p>
<p><strong>Notfallkontakt:</strong> {{client.emergency_contact_name}} · {{client.emergency_contact_phone}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"client_master"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','stammblatt','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_064' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_064', 'generic', 'CareSuite Dokumentvorlage 64', 'CareSuite Dokumentvorlage 64',
      'Doc64', 'CareSuite Dokumentvorlage 64 — CareSuite+ Systemvorlage', '{"office"}'::text[], 64,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 64</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_064','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_065' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_065', 'generic', 'CareSuite Dokumentvorlage 65', 'CareSuite Dokumentvorlage 65',
      'Doc65', 'CareSuite Dokumentvorlage 65 — CareSuite+ Systemvorlage', '{"office"}'::text[], 65,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 65</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_065','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_066' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_066', 'generic', 'CareSuite Dokumentvorlage 66', 'CareSuite Dokumentvorlage 66',
      'Doc66', 'CareSuite Dokumentvorlage 66 — CareSuite+ Systemvorlage', '{"office"}'::text[], 66,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 66</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_066','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_067' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_067', 'generic', 'CareSuite Dokumentvorlage 67', 'CareSuite Dokumentvorlage 67',
      'Doc67', 'CareSuite Dokumentvorlage 67 — CareSuite+ Systemvorlage', '{"office"}'::text[], 67,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 67</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_067','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_068' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_068', 'generic', 'CareSuite Dokumentvorlage 68', 'CareSuite Dokumentvorlage 68',
      'Doc68', 'CareSuite Dokumentvorlage 68 — CareSuite+ Systemvorlage', '{"office"}'::text[], 68,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 68</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_068','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_069' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_069', 'generic', 'CareSuite Dokumentvorlage 69', 'CareSuite Dokumentvorlage 69',
      'Doc69', 'CareSuite Dokumentvorlage 69 — CareSuite+ Systemvorlage', '{"office"}'::text[], 69,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 69</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_069','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_070' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_070', 'generic', 'CareSuite Dokumentvorlage 70', 'CareSuite Dokumentvorlage 70',
      'Doc70', 'CareSuite Dokumentvorlage 70 — CareSuite+ Systemvorlage', '{"office"}'::text[], 70,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 70</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_070','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_071' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_071', 'generic', 'CareSuite Dokumentvorlage 71', 'CareSuite Dokumentvorlage 71',
      'Doc71', 'CareSuite Dokumentvorlage 71 — CareSuite+ Systemvorlage', '{"office"}'::text[], 71,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 71</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_071','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'zeitprotokoll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'zeitprotokoll', 'service_record', 'Zeitprotokoll', 'Zeitprotokoll',
      'Zeitprotokoll', 'Zeitprotokoll — CareSuite+ Systemvorlage', '{"assist","pflege","office","stationaer"}'::text[], 72,
      'leistungsnachweis', 'table', 'leistungsnachweis', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'einsaetze',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"service_proof"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Leistungsnachweis</h1>
  <p class="cs-doc-subtitle">Abrechnungsfähiger Einsatznachweis</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table">
<thead><tr><th>Datum</th><th>Leistung</th><th>Zeit</th><th>Mitarbeitende:r</th></tr></thead>
<tbody>
<tr><td>{{assignment.date}}</td><td>{{assignment.type}}</td><td>{{assignment.duration}}</td><td>{{employee.full_name}}</td></tr>
</tbody>
</table>
<p><strong>Bemerkung:</strong> <span class="cs-field-manual">{{manual.bemerkung}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"service_proof"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','zeitprotokoll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_073' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_073', 'generic', 'CareSuite Dokumentvorlage 73', 'CareSuite Dokumentvorlage 73',
      'Doc73', 'CareSuite Dokumentvorlage 73 — CareSuite+ Systemvorlage', '{"office"}'::text[], 73,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 73</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_073','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_074' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_074', 'generic', 'CareSuite Dokumentvorlage 74', 'CareSuite Dokumentvorlage 74',
      'Doc74', 'CareSuite Dokumentvorlage 74 — CareSuite+ Systemvorlage', '{"office"}'::text[], 74,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 74</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_074','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_075' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_075', 'generic', 'CareSuite Dokumentvorlage 75', 'CareSuite Dokumentvorlage 75',
      'Doc75', 'CareSuite Dokumentvorlage 75 — CareSuite+ Systemvorlage', '{"office"}'::text[], 75,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 75</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_075','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_076' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_076', 'generic', 'CareSuite Dokumentvorlage 76', 'CareSuite Dokumentvorlage 76',
      'Doc76', 'CareSuite Dokumentvorlage 76 — CareSuite+ Systemvorlage', '{"office"}'::text[], 76,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 76</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_076','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_077' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_077', 'generic', 'CareSuite Dokumentvorlage 77', 'CareSuite Dokumentvorlage 77',
      'Doc77', 'CareSuite Dokumentvorlage 77 — CareSuite+ Systemvorlage', '{"office"}'::text[], 77,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 77</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_077','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_078' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_078', 'generic', 'CareSuite Dokumentvorlage 78', 'CareSuite Dokumentvorlage 78',
      'Doc78', 'CareSuite Dokumentvorlage 78 — CareSuite+ Systemvorlage', '{"office"}'::text[], 78,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 78</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_078','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_079' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_079', 'generic', 'CareSuite Dokumentvorlage 79', 'CareSuite Dokumentvorlage 79',
      'Doc79', 'CareSuite Dokumentvorlage 79 — CareSuite+ Systemvorlage', '{"office"}'::text[], 79,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 79</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_079','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_080' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_080', 'generic', 'CareSuite Dokumentvorlage 80', 'CareSuite Dokumentvorlage 80',
      'Doc80', 'CareSuite Dokumentvorlage 80 — CareSuite+ Systemvorlage', '{"office"}'::text[], 80,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 80</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_080','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_081' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_081', 'generic', 'CareSuite Dokumentvorlage 81', 'CareSuite Dokumentvorlage 81',
      'Doc81', 'CareSuite Dokumentvorlage 81 — CareSuite+ Systemvorlage', '{"office"}'::text[], 81,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 81</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_081','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_082' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_082', 'generic', 'CareSuite Dokumentvorlage 82', 'CareSuite Dokumentvorlage 82',
      'Doc82', 'CareSuite Dokumentvorlage 82 — CareSuite+ Systemvorlage', '{"office"}'::text[], 82,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 82</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_082','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_083' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_083', 'generic', 'CareSuite Dokumentvorlage 83', 'CareSuite Dokumentvorlage 83',
      'Doc83', 'CareSuite Dokumentvorlage 83 — CareSuite+ Systemvorlage', '{"office"}'::text[], 83,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 83</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_083','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_084' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_084', 'generic', 'CareSuite Dokumentvorlage 84', 'CareSuite Dokumentvorlage 84',
      'Doc84', 'CareSuite Dokumentvorlage 84 — CareSuite+ Systemvorlage', '{"office"}'::text[], 84,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 84</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_084','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_085' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_085', 'generic', 'CareSuite Dokumentvorlage 85', 'CareSuite Dokumentvorlage 85',
      'Doc85', 'CareSuite Dokumentvorlage 85 — CareSuite+ Systemvorlage', '{"office"}'::text[], 85,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 85</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_085','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_086' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_086', 'generic', 'CareSuite Dokumentvorlage 86', 'CareSuite Dokumentvorlage 86',
      'Doc86', 'CareSuite Dokumentvorlage 86 — CareSuite+ Systemvorlage', '{"office"}'::text[], 86,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 86</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_086','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_087' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_087', 'generic', 'CareSuite Dokumentvorlage 87', 'CareSuite Dokumentvorlage 87',
      'Doc87', 'CareSuite Dokumentvorlage 87 — CareSuite+ Systemvorlage', '{"office"}'::text[], 87,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 87</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_087','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_088' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_088', 'generic', 'CareSuite Dokumentvorlage 88', 'CareSuite Dokumentvorlage 88',
      'Doc88', 'CareSuite Dokumentvorlage 88 — CareSuite+ Systemvorlage', '{"office"}'::text[], 88,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 88</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_088','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_089' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_089', 'generic', 'CareSuite Dokumentvorlage 89', 'CareSuite Dokumentvorlage 89',
      'Doc89', 'CareSuite Dokumentvorlage 89 — CareSuite+ Systemvorlage', '{"office"}'::text[], 89,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 89</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_089','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_090' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_090', 'generic', 'CareSuite Dokumentvorlage 90', 'CareSuite Dokumentvorlage 90',
      'Doc90', 'CareSuite Dokumentvorlage 90 — CareSuite+ Systemvorlage', '{"office"}'::text[], 90,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 90</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_090','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_091' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_091', 'generic', 'CareSuite Dokumentvorlage 91', 'CareSuite Dokumentvorlage 91',
      'Doc91', 'CareSuite Dokumentvorlage 91 — CareSuite+ Systemvorlage', '{"office"}'::text[], 91,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 91</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_091','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_092' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_092', 'generic', 'CareSuite Dokumentvorlage 92', 'CareSuite Dokumentvorlage 92',
      'Doc92', 'CareSuite Dokumentvorlage 92 — CareSuite+ Systemvorlage', '{"office"}'::text[], 92,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 92</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_092','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'pflegeanamnese' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'pflegeanamnese', 'care_documentation', 'Pflegeanamnese', 'Pflegeanamnese',
      'pflegeanamnese', 'Pflegeanamnese — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 93,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Pflegeanamnese</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','pflegeanamnese','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'sis' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'sis', 'care_documentation', 'Sis', 'Sis',
      'sis', 'Sis — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 94,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Sis</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','sis','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'massnahmenplanung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'massnahmenplanung', 'care_documentation', 'Massnahmenplanung', 'Massnahmenplanung',
      'massnahmenplanung', 'Massnahmenplanung — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 95,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Massnahmenplanung</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','massnahmenplanung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'pflegeplanung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'pflegeplanung', 'care_documentation', 'Pflegeplanung', 'Pflegeplanung',
      'pflegeplanung', 'Pflegeplanung — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 96,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Pflegeplanung</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','pflegeplanung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'pflegebericht' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'pflegebericht', 'care_documentation', 'Pflegebericht', 'Pflegebericht',
      'pflegebericht', 'Pflegebericht — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 97,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Pflegebericht</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','pflegebericht','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'pflegevisite' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'pflegevisite', 'care_documentation', 'Pflegevisite', 'Pflegevisite',
      'pflegevisite', 'Pflegevisite — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 98,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Pflegevisite</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','pflegevisite','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'medikationsplan' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'medikationsplan', 'care_documentation', 'Medikationsplan', 'Medikationsplan',
      'medikationsplan', 'Medikationsplan — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 99,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Medikationsplan</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','medikationsplan','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'wundbericht' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'wundbericht', 'care_documentation', 'Wundbericht', 'Wundbericht',
      'wundbericht', 'Wundbericht — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 100,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Wundbericht</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','wundbericht','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'schmerzprotokoll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'schmerzprotokoll', 'care_documentation', 'Schmerzprotokoll', 'Schmerzprotokoll',
      'schmerzprotokoll', 'Schmerzprotokoll — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 101,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Schmerzprotokoll</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','schmerzprotokoll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'trinkprotokoll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'trinkprotokoll', 'care_documentation', 'Trinkprotokoll', 'Trinkprotokoll',
      'trinkprotokoll', 'Trinkprotokoll — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 102,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Trinkprotokoll</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','trinkprotokoll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'lagerungsprotokoll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'lagerungsprotokoll', 'care_documentation', 'Lagerungsprotokoll', 'Lagerungsprotokoll',
      'lagerungsprotokoll', 'Lagerungsprotokoll — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 103,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Lagerungsprotokoll</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','lagerungsprotokoll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'btm_massnahmen' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'btm_massnahmen', 'care_documentation', 'Btm Massnahmen', 'Btm Massnahmen',
      'btm_massnahmen', 'Btm Massnahmen — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 104,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Btm Massnahmen</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','btm_massnahmen','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'beatmungsprotokoll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'beatmungsprotokoll', 'care_documentation', 'Beatmungsprotokoll', 'Beatmungsprotokoll',
      'beatmungsprotokoll', 'Beatmungsprotokoll — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 105,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Beatmungsprotokoll</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','beatmungsprotokoll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'kathetercheck' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'kathetercheck', 'care_documentation', 'Kathetercheck', 'Kathetercheck',
      'kathetercheck', 'Kathetercheck — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 106,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Kathetercheck</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','kathetercheck','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'diabetesueberwachung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'diabetesueberwachung', 'care_documentation', 'Diabetesueberwachung', 'Diabetesueberwachung',
      'diabetesueberwachung', 'Diabetesueberwachung — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 107,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Diabetesueberwachung</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','diabetesueberwachung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'braden_skala' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'braden_skala', 'care_documentation', 'Braden Skala', 'Braden Skala',
      'braden_skala', 'Braden Skala — CareSuite+ Systemvorlage', '{"pflege","stationaer"}'::text[], 108,
      'pflege', 'table', 'pflege', 'active',
      true, false, false, true, true, true, true, true, true,
      false, true,
      'client_record', 'pflegeakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"care_clinical"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Braden Skala</h1>
  <p class="cs-doc-subtitle">Pflegedokumentation</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Verlauf & Befund</h2>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.eintrag}}</td></tr></tbody></table>
<p><strong>Maßnahme:</strong> <span class="cs-field-manual">{{manual.massnahme}}</span></p>
<p><strong>Handzeichen:</strong> {{employee.full_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"care_clinical"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','braden_skala','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'rechnung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'rechnung', 'invoice', 'Rechnung', 'Rechnung',
      'Rechnung', 'Rechnung — CareSuite+ Systemvorlage', '{"office"}'::text[], 109,
      'rechnung', 'din5008', 'rechnung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'invoice_record', 'rechnungen',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"invoice"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Rechnung {{invoice.number}}</h1>
  <p class="cs-doc-subtitle">Abrechnungsbeleg</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><div class="cs-block-info">
<p>Rechnungsdatum: {{invoice.date}}</p>
<p>Fällig: {{invoice.due_date}}</p>
<p>Empfänger: {{recipient.full_name}}</p>
</div>
<table class="cs-block-table"><thead><tr><th>Position</th><th>Betrag</th></tr></thead>
<tbody><tr><td>Leistung</td><td>{{invoice.gross_total}}</td></tr></tbody></table>
<p>{{invoice.tax_notice}}</p>
<p>Bank: {{company.bank_name}} · IBAN: {{company.iban}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"invoice"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','rechnung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_110' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_110', 'generic', 'CareSuite Dokumentvorlage 110', 'CareSuite Dokumentvorlage 110',
      'Doc110', 'CareSuite Dokumentvorlage 110 — CareSuite+ Systemvorlage', '{"office"}'::text[], 110,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 110</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_110','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'mahnung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'mahnung', 'dunning_letter', 'Mahnung', 'Mahnung',
      'Mahnung', 'Mahnung — CareSuite+ Systemvorlage', '{"office"}'::text[], 111,
      'rechnung', 'din5008', 'rechnung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'invoice_record', 'mahnungen',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"dunning"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Mahnung</h1>
  <p class="cs-doc-subtitle">Zahlungserinnerung / Mahnung</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><div class="cs-block-info">
<p>Rechnung: {{invoice.number}} · Fällig seit: {{invoice.due_date}}</p>
<p>Offener Betrag: {{invoice.gross_total}}</p>
</div>
<p>Sehr geehrte Damen und Herren,</p>
<p class="cs-field-manual">{{manual.mahnungstext}}</p>
<p>Bitte begleichen Sie den offenen Betrag umgehend.</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"dunning"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','mahnung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_112' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_112', 'generic', 'CareSuite Dokumentvorlage 112', 'CareSuite Dokumentvorlage 112',
      'Doc112', 'CareSuite Dokumentvorlage 112 — CareSuite+ Systemvorlage', '{"office"}'::text[], 112,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 112</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_112','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_113' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_113', 'generic', 'CareSuite Dokumentvorlage 113', 'CareSuite Dokumentvorlage 113',
      'Doc113', 'CareSuite Dokumentvorlage 113 — CareSuite+ Systemvorlage', '{"office"}'::text[], 113,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 113</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_113','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_114' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_114', 'generic', 'CareSuite Dokumentvorlage 114', 'CareSuite Dokumentvorlage 114',
      'Doc114', 'CareSuite Dokumentvorlage 114 — CareSuite+ Systemvorlage', '{"office"}'::text[], 114,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 114</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_114','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_115' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_115', 'generic', 'CareSuite Dokumentvorlage 115', 'CareSuite Dokumentvorlage 115',
      'Doc115', 'CareSuite Dokumentvorlage 115 — CareSuite+ Systemvorlage', '{"office"}'::text[], 115,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 115</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_115','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_116' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_116', 'generic', 'CareSuite Dokumentvorlage 116', 'CareSuite Dokumentvorlage 116',
      'Doc116', 'CareSuite Dokumentvorlage 116 — CareSuite+ Systemvorlage', '{"office"}'::text[], 116,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 116</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_116','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_117' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_117', 'generic', 'CareSuite Dokumentvorlage 117', 'CareSuite Dokumentvorlage 117',
      'Doc117', 'CareSuite Dokumentvorlage 117 — CareSuite+ Systemvorlage', '{"office"}'::text[], 117,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 117</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_117','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_118' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_118', 'generic', 'CareSuite Dokumentvorlage 118', 'CareSuite Dokumentvorlage 118',
      'Doc118', 'CareSuite Dokumentvorlage 118 — CareSuite+ Systemvorlage', '{"office"}'::text[], 118,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 118</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_118','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_119' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_119', 'generic', 'CareSuite Dokumentvorlage 119', 'CareSuite Dokumentvorlage 119',
      'Doc119', 'CareSuite Dokumentvorlage 119 — CareSuite+ Systemvorlage', '{"office"}'::text[], 119,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 119</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_119','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_120' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_120', 'generic', 'CareSuite Dokumentvorlage 120', 'CareSuite Dokumentvorlage 120',
      'Doc120', 'CareSuite Dokumentvorlage 120 — CareSuite+ Systemvorlage', '{"office"}'::text[], 120,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 120</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_120','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_121' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_121', 'generic', 'CareSuite Dokumentvorlage 121', 'CareSuite Dokumentvorlage 121',
      'Doc121', 'CareSuite Dokumentvorlage 121 — CareSuite+ Systemvorlage', '{"office"}'::text[], 121,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 121</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_121','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_122' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_122', 'generic', 'CareSuite Dokumentvorlage 122', 'CareSuite Dokumentvorlage 122',
      'Doc122', 'CareSuite Dokumentvorlage 122 — CareSuite+ Systemvorlage', '{"office"}'::text[], 122,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 122</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_122','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_123' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_123', 'generic', 'CareSuite Dokumentvorlage 123', 'CareSuite Dokumentvorlage 123',
      'Doc123', 'CareSuite Dokumentvorlage 123 — CareSuite+ Systemvorlage', '{"office"}'::text[], 123,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 123</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_123','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_124' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_124', 'generic', 'CareSuite Dokumentvorlage 124', 'CareSuite Dokumentvorlage 124',
      'Doc124', 'CareSuite Dokumentvorlage 124 — CareSuite+ Systemvorlage', '{"office"}'::text[], 124,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 124</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_124','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_125' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_125', 'generic', 'CareSuite Dokumentvorlage 125', 'CareSuite Dokumentvorlage 125',
      'Doc125', 'CareSuite Dokumentvorlage 125 — CareSuite+ Systemvorlage', '{"office"}'::text[], 125,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 125</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_125','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_126' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_126', 'generic', 'CareSuite Dokumentvorlage 126', 'CareSuite Dokumentvorlage 126',
      'Doc126', 'CareSuite Dokumentvorlage 126 — CareSuite+ Systemvorlage', '{"office"}'::text[], 126,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 126</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_126','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_127' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_127', 'generic', 'CareSuite Dokumentvorlage 127', 'CareSuite Dokumentvorlage 127',
      'Doc127', 'CareSuite Dokumentvorlage 127 — CareSuite+ Systemvorlage', '{"office"}'::text[], 127,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 127</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_127','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_128' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_128', 'generic', 'CareSuite Dokumentvorlage 128', 'CareSuite Dokumentvorlage 128',
      'Doc128', 'CareSuite Dokumentvorlage 128 — CareSuite+ Systemvorlage', '{"office"}'::text[], 128,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 128</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_128','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_129' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_129', 'generic', 'CareSuite Dokumentvorlage 129', 'CareSuite Dokumentvorlage 129',
      'Doc129', 'CareSuite Dokumentvorlage 129 — CareSuite+ Systemvorlage', '{"office"}'::text[], 129,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 129</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_129','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_130' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_130', 'generic', 'CareSuite Dokumentvorlage 130', 'CareSuite Dokumentvorlage 130',
      'Doc130', 'CareSuite Dokumentvorlage 130 — CareSuite+ Systemvorlage', '{"office"}'::text[], 130,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 130</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_130','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_131' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_131', 'generic', 'CareSuite Dokumentvorlage 131', 'CareSuite Dokumentvorlage 131',
      'Doc131', 'CareSuite Dokumentvorlage 131 — CareSuite+ Systemvorlage', '{"office"}'::text[], 131,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 131</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_131','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_132' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_132', 'generic', 'CareSuite Dokumentvorlage 132', 'CareSuite Dokumentvorlage 132',
      'Doc132', 'CareSuite Dokumentvorlage 132 — CareSuite+ Systemvorlage', '{"office"}'::text[], 132,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 132</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_132','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_133' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_133', 'generic', 'CareSuite Dokumentvorlage 133', 'CareSuite Dokumentvorlage 133',
      'Doc133', 'CareSuite Dokumentvorlage 133 — CareSuite+ Systemvorlage', '{"office"}'::text[], 133,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 133</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_133','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_134' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_134', 'generic', 'CareSuite Dokumentvorlage 134', 'CareSuite Dokumentvorlage 134',
      'Doc134', 'CareSuite Dokumentvorlage 134 — CareSuite+ Systemvorlage', '{"office"}'::text[], 134,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 134</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_134','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_135' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_135', 'generic', 'CareSuite Dokumentvorlage 135', 'CareSuite Dokumentvorlage 135',
      'Doc135', 'CareSuite Dokumentvorlage 135 — CareSuite+ Systemvorlage', '{"office"}'::text[], 135,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 135</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_135','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_136' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_136', 'generic', 'CareSuite Dokumentvorlage 136', 'CareSuite Dokumentvorlage 136',
      'Doc136', 'CareSuite Dokumentvorlage 136 — CareSuite+ Systemvorlage', '{"office"}'::text[], 136,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 136</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_136','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_137' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_137', 'generic', 'CareSuite Dokumentvorlage 137', 'CareSuite Dokumentvorlage 137',
      'Doc137', 'CareSuite Dokumentvorlage 137 — CareSuite+ Systemvorlage', '{"office"}'::text[], 137,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 137</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_137','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_138' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_138', 'generic', 'CareSuite Dokumentvorlage 138', 'CareSuite Dokumentvorlage 138',
      'Doc138', 'CareSuite Dokumentvorlage 138 — CareSuite+ Systemvorlage', '{"office"}'::text[], 138,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 138</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_138','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_139' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_139', 'generic', 'CareSuite Dokumentvorlage 139', 'CareSuite Dokumentvorlage 139',
      'Doc139', 'CareSuite Dokumentvorlage 139 — CareSuite+ Systemvorlage', '{"office"}'::text[], 139,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 139</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_139','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_140' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_140', 'generic', 'CareSuite Dokumentvorlage 140', 'CareSuite Dokumentvorlage 140',
      'Doc140', 'CareSuite Dokumentvorlage 140 — CareSuite+ Systemvorlage', '{"office"}'::text[], 140,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 140</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_140','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_141' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_141', 'generic', 'CareSuite Dokumentvorlage 141', 'CareSuite Dokumentvorlage 141',
      'Doc141', 'CareSuite Dokumentvorlage 141 — CareSuite+ Systemvorlage', '{"office"}'::text[], 141,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 141</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_141','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_142' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_142', 'generic', 'CareSuite Dokumentvorlage 142', 'CareSuite Dokumentvorlage 142',
      'Doc142', 'CareSuite Dokumentvorlage 142 — CareSuite+ Systemvorlage', '{"office"}'::text[], 142,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 142</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_142','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_143' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_143', 'generic', 'CareSuite Dokumentvorlage 143', 'CareSuite Dokumentvorlage 143',
      'Doc143', 'CareSuite Dokumentvorlage 143 — CareSuite+ Systemvorlage', '{"office"}'::text[], 143,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 143</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_143','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_144' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_144', 'generic', 'CareSuite Dokumentvorlage 144', 'CareSuite Dokumentvorlage 144',
      'Doc144', 'CareSuite Dokumentvorlage 144 — CareSuite+ Systemvorlage', '{"office"}'::text[], 144,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 144</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_144','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_145' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_145', 'generic', 'CareSuite Dokumentvorlage 145', 'CareSuite Dokumentvorlage 145',
      'Doc145', 'CareSuite Dokumentvorlage 145 — CareSuite+ Systemvorlage', '{"office"}'::text[], 145,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 145</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_145','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_146' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_146', 'generic', 'CareSuite Dokumentvorlage 146', 'CareSuite Dokumentvorlage 146',
      'Doc146', 'CareSuite Dokumentvorlage 146 — CareSuite+ Systemvorlage', '{"office"}'::text[], 146,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 146</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_146','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'system_doc_147' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'system_doc_147', 'generic', 'CareSuite Dokumentvorlage 147', 'CareSuite Dokumentvorlage 147',
      'Doc147', 'CareSuite Dokumentvorlage 147 — CareSuite+ Systemvorlage', '{"office"}'::text[], 147,
      'system', 'premium', 'system', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">CareSuite Dokumentvorlage 147</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[{"fieldKey":"notiz","label":"Eintrag"}]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','system_doc_147','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'leistungsnachweis' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'leistungsnachweis', 'leistungsnachweis', 'Leistungsnachweis', 'Leistungsnachweis',
      'Leistungsnachweis', 'Leistungsnachweis — CareSuite+ Systemvorlage', '{"assist","pflege","office"}'::text[], 148,
      'leistungsnachweis', 'premium', 'leistungsnachweis', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'nachweise',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"service_proof"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Leistungsnachweis</h1>
  <p class="cs-doc-subtitle">Abrechnungsfähiger Einsatznachweis</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table">
<thead><tr><th>Datum</th><th>Leistung</th><th>Zeit</th><th>Mitarbeitende:r</th></tr></thead>
<tbody>
<tr><td>{{assignment.date}}</td><td>{{assignment.type}}</td><td>{{assignment.duration}}</td><td>{{employee.full_name}}</td></tr>
</tbody>
</table>
<p><strong>Bemerkung:</strong> <span class="cs-field-manual">{{manual.bemerkung}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"service_proof"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','leistungsnachweis','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'klient_nicht_angetroffen' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'klient_nicht_angetroffen', 'service_record', 'Klient:in nicht angetroffen', 'Klient:in nicht angetroffen',
      'NichtAngetroffen', 'Klient:in nicht angetroffen — CareSuite+ Systemvorlage', '{"assist"}'::text[], 149,
      'assist', 'form', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'einsaetze',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Klient:in nicht angetroffen</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','klient_nicht_angetroffen','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'einsatzabbruch' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'einsatzabbruch', 'service_record', 'Einsatzabbruchprotokoll', 'Einsatzabbruchprotokoll',
      'Einsatzabbruch', 'Einsatzabbruchprotokoll — CareSuite+ Systemvorlage', '{"assist"}'::text[], 150,
      'assist', 'form', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'einsaetze',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Einsatzabbruchprotokoll</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','einsatzabbruch','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'angehoerigeninformation' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'angehoerigeninformation', 'protocol', 'Angehörigeninformation', 'Angehörigeninformation',
      'Angehoerige', 'Angehörigeninformation — CareSuite+ Systemvorlage', '{"assist"}'::text[], 151,
      'assist', 'premium', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'kommunikation',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Angehörigeninformation</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','angehoerigeninformation','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'betreuungswunsch' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'betreuungswunsch', 'client_admission', 'Betreuungswunschbogen', 'Betreuungswunschbogen',
      'Betreuungswunsch', 'Betreuungswunschbogen — CareSuite+ Systemvorlage', '{"assist"}'::text[], 152,
      'assist', 'form', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'stammdaten',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Betreuungswunschbogen</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','betreuungswunsch','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'alltagsbegleitungsplan' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'alltagsbegleitungsplan', 'care_documentation', 'Alltagsbegleitungsplan', 'Alltagsbegleitungsplan',
      'Alltagsplan', 'Alltagsbegleitungsplan — CareSuite+ Systemvorlage', '{"assist"}'::text[], 153,
      'assist', 'premium', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'leistungsplanung',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Alltagsbegleitungsplan</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','alltagsbegleitungsplan','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'ersatztermin_vereinbarung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'ersatztermin_vereinbarung', 'protocol', 'Ersatztermin-Vereinbarung', 'Ersatztermin-Vereinbarung',
      'Ersatztermin', 'Ersatztermin-Vereinbarung — CareSuite+ Systemvorlage', '{"assist"}'::text[], 154,
      'assist', 'form', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'einsaetze',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Ersatztermin-Vereinbarung</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','ersatztermin_vereinbarung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'erstkontakt_assist' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'erstkontakt_assist', 'client_admission', 'Erstkontakt-Protokoll Assist', 'Erstkontakt-Protokoll Assist',
      'ErstkontaktAssist', 'Erstkontakt-Protokoll Assist — CareSuite+ Systemvorlage', '{"assist"}'::text[], 155,
      'assist', 'form', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'prospect_record', 'interessenten',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Erstkontakt-Protokoll Assist</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','erstkontakt_assist','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'hauswirtschaftsplan' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'hauswirtschaftsplan', 'care_documentation', 'Hauswirtschaftlicher Aufgabenplan', 'Hauswirtschaftlicher Aufgabenplan',
      'Hauswirtschaftsplan', 'Hauswirtschaftlicher Aufgabenplan — CareSuite+ Systemvorlage', '{"assist"}'::text[], 156,
      'assist', 'table', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'leistungsplanung',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Hauswirtschaftlicher Aufgabenplan</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','hauswirtschaftsplan','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'einsatzabschluss_assist' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'einsatzabschluss_assist', 'service_record', 'Einsatzabschlussbericht Assist', 'Einsatzabschlussbericht Assist',
      'Einsatzabschluss', 'Einsatzabschlussbericht Assist — CareSuite+ Systemvorlage', '{"assist"}'::text[], 157,
      'assist', 'form', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'einsaetze',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Einsatzabschlussbericht Assist</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','einsatzabschluss_assist','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'monatsuebersicht_45b' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'monatsuebersicht_45b', 'report', 'Monatsübersicht Assist §45b', 'Monatsübersicht Assist §45b',
      'Monat45b', 'Monatsübersicht Assist §45b — CareSuite+ Systemvorlage', '{"assist","office"}'::text[], 158,
      'assist', 'table', 'assist', 'active',
      true, false, false, true, true, true, true, true, true,
      true, false,
      'client_record', 'nachweise',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"assist_visit"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Monatsübersicht Assist §45b</h1>
  <p class="cs-doc-subtitle">Assist-Einsatzdokument</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<p><strong>Einsatz:</strong> {{assignment.subject}} · {{assignment.date}}</p>
<p><strong>Zeit:</strong> {{assignment.start_time}} – {{assignment.end_time}} ({{assignment.duration}})</p>
<h2>Dokumentation</h2>
<p class="cs-field-manual">{{manual.dokumentation}}</p>
<p><strong>Aufgaben:</strong> <span class="cs-field-manual">{{manual.aufgaben}}</span></p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"assist_visit"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','monatsuebersicht_45b','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'mandanten_stammdatenblatt' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'mandanten_stammdatenblatt', 'report', 'Mandanten-Stammdatenblatt', 'Mandanten-Stammdatenblatt',
      'MandantStamm', 'Mandanten-Stammdatenblatt — CareSuite+ Systemvorlage', '{"office"}'::text[], 159,
      'office', 'premium', 'office', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'tenant_record', 'office',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Mandanten-Stammdatenblatt</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','mandanten_stammdatenblatt','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'rollen_rechtefreigabe' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'rollen_rechtefreigabe', 'protocol', 'Rollen- und Rechtefreigabe', 'Rollen- und Rechtefreigabe',
      'Rechtefreigabe', 'Rollen- und Rechtefreigabe — CareSuite+ Systemvorlage', '{"office"}'::text[], 160,
      'office', 'form', 'office', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'tenant_record', 'office',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Rollen- und Rechtefreigabe</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','rollen_rechtefreigabe','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'software_nutzungsprotokoll' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'software_nutzungsprotokoll', 'protocol', 'Software-Nutzungsprotokoll', 'Software-Nutzungsprotokoll',
      'SoftwareProtokoll', 'Software-Nutzungsprotokoll — CareSuite+ Systemvorlage', '{"office"}'::text[], 161,
      'office', 'form', 'office', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'tenant_record', 'office',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Software-Nutzungsprotokoll</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','software_nutzungsprotokoll','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'datenschutz_freigabe' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'datenschutz_freigabe', 'data_protection_consent', 'Datenschutz-Freigabe Dokumente', 'Datenschutz-Freigabe Dokumente',
      'DatenschutzFreigabe', 'Datenschutz-Freigabe Dokumente — CareSuite+ Systemvorlage', '{"office"}'::text[], 162,
      'office', 'din5008', 'office', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'tenant_record', 'office',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Datenschutz-Freigabe Dokumente</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','datenschutz_freigabe','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'integrationsstatus' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'integrationsstatus', 'report', 'Integrationsstatus Microsoft / Google / Fax', 'Integrationsstatus Microsoft / Google / Fax',
      'IntegrationStatus', 'Integrationsstatus Microsoft / Google / Fax — CareSuite+ Systemvorlage', '{"office"}'::text[], 163,
      'office', 'table', 'office', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'tenant_record', 'office',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Integrationsstatus Microsoft / Google / Fax</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','integrationsstatus','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'abrechnungspruefliste' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'abrechnungspruefliste', 'report', 'Abrechnungsprüfliste', 'Abrechnungsprüfliste',
      'Abrechnungspruef', 'Abrechnungsprüfliste — CareSuite+ Systemvorlage', '{"office"}'::text[], 164,
      'office', 'table', 'office', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'invoice_record', 'rechnungen',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Abrechnungsprüfliste</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','abrechnungspruefliste','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'offene_dokumente_liste' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'offene_dokumente_liste', 'report', 'Offene-Dokumente-Liste', 'Offene-Dokumente-Liste',
      'OffeneDokumente', 'Offene-Dokumente-Liste — CareSuite+ Systemvorlage', '{"office"}'::text[], 165,
      'office', 'list', 'office', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'tenant_record', 'office',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Offene-Dokumente-Liste</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','offene_dokumente_liste','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'akten_vollstaendigkeit' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'akten_vollstaendigkeit', 'checklist', 'Aktenvollständigkeitsprüfung', 'Aktenvollständigkeitsprüfung',
      'AktenVollstaendig', 'Aktenvollständigkeitsprüfung — CareSuite+ Systemvorlage', '{"office"}'::text[], 166,
      'office', 'table', 'office', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'client_record', 'archiv',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Aktenvollständigkeitsprüfung</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','akten_vollstaendigkeit','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'pflegegrad_erstberatung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'pflegegrad_erstberatung', 'consultation_record', 'Pflegegrad-Erstberatung', 'Pflegegrad-Erstberatung',
      'PG_Erstberatung', 'Pflegegrad-Erstberatung — CareSuite+ Systemvorlage', '{"beratung"}'::text[], 167,
      'beratung', 'din5008', 'beratung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'consultation_record', 'beratungsakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"consultation"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Beratungsprotokoll</h1>
  <p class="cs-doc-subtitle">Beratungsgespräch</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Beratungsinhalt</h2>
<p class="cs-field-manual">{{manual.inhalt}}</p>
<h2>Empfehlungen</h2>
<p class="cs-field-manual">{{manual.empfehlungen}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"consultation"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','pflegegrad_erstberatung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'angehoerigenberatung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'angehoerigenberatung', 'consultation_record', 'Angehörigenberatung', 'Angehörigenberatung',
      'Angehoerigenberatung', 'Angehörigenberatung — CareSuite+ Systemvorlage', '{"beratung"}'::text[], 168,
      'beratung', 'din5008', 'beratung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'consultation_record', 'beratungsakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"consultation"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Beratungsprotokoll</h1>
  <p class="cs-doc-subtitle">Beratungsgespräch</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Beratungsinhalt</h2>
<p class="cs-field-manual">{{manual.inhalt}}</p>
<h2>Empfehlungen</h2>
<p class="cs-field-manual">{{manual.empfehlungen}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"consultation"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','angehoerigenberatung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'leistungsberatung_sgb_xi' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'leistungsberatung_sgb_xi', 'consultation_record', 'Leistungsberatung SGB XI', 'Leistungsberatung SGB XI',
      'Leistungsberatung', 'Leistungsberatung SGB XI — CareSuite+ Systemvorlage', '{"beratung"}'::text[], 169,
      'beratung', 'din5008', 'beratung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'consultation_record', 'beratungsakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"consultation"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Beratungsprotokoll</h1>
  <p class="cs-doc-subtitle">Beratungsgespräch</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Beratungsinhalt</h2>
<p class="cs-field-manual">{{manual.inhalt}}</p>
<h2>Empfehlungen</h2>
<p class="cs-field-manual">{{manual.empfehlungen}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"consultation"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','leistungsberatung_sgb_xi','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'budgetpruefung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'budgetpruefung', 'report', 'Budgetprüfung', 'Budgetprüfung',
      'Budgetpruefung', 'Budgetprüfung — CareSuite+ Systemvorlage', '{"beratung","office"}'::text[], 170,
      'beratung', 'table', 'beratung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'consultation_record', 'beratungsakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"generic_form"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Budgetprüfung</h1>
  
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<table class="cs-block-table"><thead><tr><th>Feld</th><th>Eintrag</th></tr></thead><tbody><tr><td>Eintrag</td><td class="cs-field-manual">{{manual.notiz}}</td></tr></tbody></table>

<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"generic_form"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','budgetpruefung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'massnahmenempfehlung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'massnahmenempfehlung', 'consultation_record', 'Maßnahmenempfehlung', 'Maßnahmenempfehlung',
      'Massnahmenempfehlung', 'Maßnahmenempfehlung — CareSuite+ Systemvorlage', '{"beratung"}'::text[], 171,
      'beratung', 'premium', 'beratung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'consultation_record', 'beratungsakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"consultation"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Beratungsprotokoll</h1>
  <p class="cs-doc-subtitle">Beratungsgespräch</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Beratungsinhalt</h2>
<p class="cs-field-manual">{{manual.inhalt}}</p>
<h2>Empfehlungen</h2>
<p class="cs-field-manual">{{manual.empfehlungen}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"consultation"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','massnahmenempfehlung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'beratungsabschluss' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'beratungsabschluss', 'consultation_record', 'Beratungsabschlussbericht', 'Beratungsabschlussbericht',
      'Beratungsabschluss', 'Beratungsabschlussbericht — CareSuite+ Systemvorlage', '{"beratung"}'::text[], 172,
      'beratung', 'din5008', 'beratung', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'consultation_record', 'beratungsakte',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"consultation"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Beratungsprotokoll</h1>
  <p class="cs-doc-subtitle">Beratungsgespräch</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-din5008-address">
<p>{{recipient.full_name}}</p>
<p>{{recipient.address}}</p>
</div>
<div class="cs-din5008-date">{{company.city}}, {{document.created_at}}</div><dl class="cs-doc-meta">
<dt>Klient:in</dt><dd>{{client.full_name}}</dd>
<dt>Geburtsdatum</dt><dd>{{client.birth_date}}</dd>
<dt>Pflegegrad</dt><dd>{{client.care_level}}</dd>
<dt>Adresse</dt><dd>{{client.street}}, {{client.zip}} {{client.city}}</dd>
<dt>Pflegekasse</dt><dd>{{client.insurance_name}}</dd>
</dl>
<h2>Beratungsinhalt</h2>
<p class="cs-field-manual">{{manual.inhalt}}</p>
<h2>Empfehlungen</h2>
<p class="cs-field-manual">{{manual.empfehlungen}}</p>
<div class="cs-signature-block">
<p>Ort, Datum: _________________________</p>
<p>Unterschrift Klient:in / Vertretung: _________________________</p>
<p>Unterschrift Mitarbeitende:r: {{employee.full_name}} · {{employee.handzeichen}}</p>
</div>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"consultation"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','beratungsabschluss','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'teilnehmerliste' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'teilnehmerliste', 'report', 'Teilnehmerliste', 'Teilnehmerliste',
      'Teilnehmerliste', 'Teilnehmerliste — CareSuite+ Systemvorlage', '{"akademie"}'::text[], 173,
      'akademie', 'list', 'akademie', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'course_record', 'akademie',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"academy_certificate"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Teilnehmerliste</h1>
  <p class="cs-doc-subtitle">Teilnahmebestätigung / Zertifikat</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-block-info" style="text-align:center;padding:24px;">
<h2 style="font-size:16pt;">{{manual.teilnehmer_name}}</h2>
<p>hat erfolgreich an folgender Qualifizierung teilgenommen:</p>
<p><strong>{{manual.kurs_name}}</strong></p>
<p>Datum: {{document.created_at}} · Dauer: <span class="cs-field-manual">{{manual.dauer}}</span></p>
</div>
<p style="text-align:center;">{{company.legal_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"academy_certificate"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','teilnehmerliste','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'anwesenheitsliste' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'anwesenheitsliste', 'report', 'Anwesenheitsliste', 'Anwesenheitsliste',
      'Anwesenheit', 'Anwesenheitsliste — CareSuite+ Systemvorlage', '{"akademie"}'::text[], 174,
      'akademie', 'list', 'akademie', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'course_record', 'akademie',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"academy_certificate"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Anwesenheitsliste</h1>
  <p class="cs-doc-subtitle">Teilnahmebestätigung / Zertifikat</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-block-info" style="text-align:center;padding:24px;">
<h2 style="font-size:16pt;">{{manual.teilnehmer_name}}</h2>
<p>hat erfolgreich an folgender Qualifizierung teilgenommen:</p>
<p><strong>{{manual.kurs_name}}</strong></p>
<p>Datum: {{document.created_at}} · Dauer: <span class="cs-field-manual">{{manual.dauer}}</span></p>
</div>
<p style="text-align:center;">{{company.legal_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"academy_certificate"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','anwesenheitsliste','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'teilnahmebescheinigung' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'teilnahmebescheinigung', 'report', 'Teilnahmebescheinigung', 'Teilnahmebescheinigung',
      'Teilnahme', 'Teilnahmebescheinigung — CareSuite+ Systemvorlage', '{"akademie"}'::text[], 175,
      'akademie', 'premium', 'akademie', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'course_record', 'akademie',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"academy_certificate"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Teilnahmebescheinigung</h1>
  <p class="cs-doc-subtitle">Teilnahmebestätigung / Zertifikat</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-block-info" style="text-align:center;padding:24px;">
<h2 style="font-size:16pt;">{{manual.teilnehmer_name}}</h2>
<p>hat erfolgreich an folgender Qualifizierung teilgenommen:</p>
<p><strong>{{manual.kurs_name}}</strong></p>
<p>Datum: {{document.created_at}} · Dauer: <span class="cs-field-manual">{{manual.dauer}}</span></p>
</div>
<p style="text-align:center;">{{company.legal_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"academy_certificate"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','teilnahmebescheinigung','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'zertifikat' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'zertifikat', 'report', 'Zertifikat', 'Zertifikat',
      'Zertifikat', 'Zertifikat — CareSuite+ Systemvorlage', '{"akademie"}'::text[], 176,
      'akademie', 'premium', 'akademie', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'course_record', 'akademie',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"academy_certificate"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Zertifikat</h1>
  <p class="cs-doc-subtitle">Teilnahmebestätigung / Zertifikat</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-block-info" style="text-align:center;padding:24px;">
<h2 style="font-size:16pt;">{{manual.teilnehmer_name}}</h2>
<p>hat erfolgreich an folgender Qualifizierung teilgenommen:</p>
<p><strong>{{manual.kurs_name}}</strong></p>
<p>Datum: {{document.created_at}} · Dauer: <span class="cs-field-manual">{{manual.dauer}}</span></p>
</div>
<p style="text-align:center;">{{company.legal_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"academy_certificate"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','zertifikat','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'pruefung_lernzielkontrolle' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'pruefung_lernzielkontrolle', 'checklist', 'Prüfung / Lernzielkontrolle', 'Prüfung / Lernzielkontrolle',
      'Lernzielkontrolle', 'Prüfung / Lernzielkontrolle — CareSuite+ Systemvorlage', '{"akademie"}'::text[], 177,
      'akademie', 'form', 'akademie', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'course_record', 'akademie',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"academy_certificate"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Prüfung / Lernzielkontrolle</h1>
  <p class="cs-doc-subtitle">Teilnahmebestätigung / Zertifikat</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-block-info" style="text-align:center;padding:24px;">
<h2 style="font-size:16pt;">{{manual.teilnehmer_name}}</h2>
<p>hat erfolgreich an folgender Qualifizierung teilgenommen:</p>
<p><strong>{{manual.kurs_name}}</strong></p>
<p>Datum: {{document.created_at}} · Dauer: <span class="cs-field-manual">{{manual.dauer}}</span></p>
</div>
<p style="text-align:center;">{{company.legal_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"academy_certificate"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','pruefung_lernzielkontrolle','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'feedbackbogen' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'feedbackbogen', 'checklist', 'Feedbackbogen', 'Feedbackbogen',
      'Feedback', 'Feedbackbogen — CareSuite+ Systemvorlage', '{"akademie"}'::text[], 178,
      'akademie', 'form', 'akademie', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'course_record', 'akademie',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"academy_certificate"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Feedbackbogen</h1>
  <p class="cs-doc-subtitle">Teilnahmebestätigung / Zertifikat</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-block-info" style="text-align:center;padding:24px;">
<h2 style="font-size:16pt;">{{manual.teilnehmer_name}}</h2>
<p>hat erfolgreich an folgender Qualifizierung teilgenommen:</p>
<p><strong>{{manual.kurs_name}}</strong></p>
<p>Datum: {{document.created_at}} · Dauer: <span class="cs-field-manual">{{manual.dauer}}</span></p>
</div>
<p style="text-align:center;">{{company.legal_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"academy_certificate"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','feedbackbogen','source','migration_0170'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.document_templates WHERE template_key = 'unterweisungsnachweis' AND tenant_id IS NULL) THEN
    INSERT INTO public.document_templates (
      tenant_id, template_key, template_type, label, template_name, short_name, description,
      module_scope, template_number, category, layout_kind, document_category, template_status,
      is_system_template, is_tenant_template, is_imported_template, is_active, is_fillable,
      is_pdf_enabled, is_email_enabled, is_fax_enabled, is_assist_allowed,
      is_medical_or_treatment_related, is_care_related, target_record_type, default_storage_area,
      default_file_name_pattern, content_json, mapping_schema_json, version
    ) VALUES (
      NULL, 'unterweisungsnachweis', 'report', 'Unterweisungsnachweis', 'Unterweisungsnachweis',
      'Unterweisung', 'Unterweisungsnachweis — CareSuite+ Systemvorlage', '{"akademie","office"}'::text[], 179,
      'akademie', 'form', 'akademie', 'active',
      true, false, false, true, true, true, true, true, true,
      false, false,
      'course_record', 'akademie',
      '{{date}}_{{template.short_name}}_{{client.last_name}}_{{client.first_name}}.pdf',
      '{"layoutFamily":"academy_certificate"}'::jsonb, '{"complete":true}'::jsonb, 1
    ) RETURNING id INTO tid;
    INSERT INTO public.document_template_versions (
      tenant_id, template_id, version_number, html_template, css_template, required_fields, version_status, layout_settings
    ) VALUES (
      seed_tenant, tid, 1, '
<div class="cs-doc-header">
  <div class="cs-block-logo">{{company.name}}</div>
  <h1 class="cs-doc-title">Unterweisungsnachweis</h1>
  <p class="cs-doc-subtitle">Teilnahmebestätigung / Zertifikat</p>
  <p class="cs-doc-subtitle">Aktenzeichen: {{client.customer_number}} · Datum: {{document.created_at}}</p>
</div><div class="cs-block-info" style="text-align:center;padding:24px;">
<h2 style="font-size:16pt;">{{manual.teilnehmer_name}}</h2>
<p>hat erfolgreich an folgender Qualifizierung teilgenommen:</p>
<p><strong>{{manual.kurs_name}}</strong></p>
<p>Datum: {{document.created_at}} · Dauer: <span class="cs-field-manual">{{manual.dauer}}</span></p>
</div>
<p style="text-align:center;">{{company.legal_name}}</p>
<div class="cs-block-footer">
  <p>{{company.legal_name}} · {{company.street}}, {{company.zip}} {{company.city}}</p>
  <p>Tel. {{company.phone}} · {{company.email}} · Seite {{page.number}}</p>
</div>', '.cs-document-root { font-family: ''Segoe UI'', system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 16pt; margin: 16px 0 8px; }
h2 { font-size: 13pt; margin: 12px 0 6px; }
.cs-block-info { background: #f5f5f5; padding: 8px 12px; margin: 12px 0; border-radius: 4px; }
.cs-sender-line { font-size: 9pt; color: #555; margin-bottom: 16px; }
table.cs-block-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
table.cs-block-table th, table.cs-block-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
.cs-signature-block { margin-top: 48px; }
.cs-legal-notice { font-size: 9pt; color: #666; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
.cs-doc-header { border-bottom: 2px solid var(--cs-accent, #1e40af); padding-bottom: 12px; margin-bottom: 20px; }
.cs-doc-title { font-size: 18pt; font-weight: 600; color: #111827; margin: 0 0 4px; }
.cs-doc-subtitle { font-size: 10pt; color: #6b7280; }
.cs-doc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
.cs-doc-meta dt { font-size: 9pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-doc-meta dd { margin: 0 0 8px; font-weight: 500; }
.cs-field-missing-required { background: #fee2e2; border-left: 3px solid #dc2626; padding: 2px 6px; }
.cs-field-missing-optional { background: #fef9c3; border-left: 3px solid #ca8a04; padding: 2px 6px; }
.cs-field-autofill { background: #dbeafe; border-left: 3px solid #2563eb; padding: 2px 6px; }
.cs-field-manual { background: #f3f4f6; border-left: 3px solid #9ca3af; padding: 2px 6px; }
.cs-din5008-address { margin-top: 32mm; margin-left: 0; min-height: 45mm; }
.cs-din5008-date { text-align: right; margin: 12mm 0 8mm; }', '[]'::jsonb, 'active',
      '{"layoutFamily":"academy_certificate"}'::jsonb
    ) RETURNING id INTO vid;
    UPDATE public.document_templates SET current_version_id = vid WHERE id = tid;
    INSERT INTO public.document_audit_log (tenant_id, action, entity_type, entity_id, new_value_json)
    VALUES (seed_tenant, 'template_created', 'document_template', tid, jsonb_build_object('templateKey','unterweisungsnachweis','source','migration_0170'));
  END IF;

END $$;
