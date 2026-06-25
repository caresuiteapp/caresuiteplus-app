import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildIntakePlaceholderContext,
  listApplicableIntakeTemplates,
  listAvailableContractTypes,
  resolveBillingHourlyRate,
  resolveContractTemplateKey,
  resolveIntakeContractType,
} from '@/features/intakeDocuments/buildIntakeDocumentContext';
import {
  applyDocumentSignature,
  finalizeDocument,
  openDocumentPreview,
  updateIntakeDocumentInForm,
} from '@/features/intakeDocuments/intakeDocumentService';
import { getSystemIntakeTemplateByKey, INTAKE_DOCUMENT_SYSTEM_TEMPLATES } from '@/features/intakeDocuments/intakeDocumentSystemTemplates';
import { renderIntakeDocumentHtml } from '@/features/intakeDocuments/renderIntakeDocumentPreview';
import {
  canProceedFromIntakeDocuments,
  validateIntakeDocumentsStep,
} from '@/features/intakeDocuments/validateIntakeDocuments';
import { validateIntakeStep } from '@/lib/clients/clientIntakeService';
import { getServiceMode } from '@/lib/services/mode';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';

const srcRoot = path.join(__dirname, '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

function baseForm(overrides: Partial<ClientIntakeFormData> = {}): ClientIntakeFormData {
  return {
    ...EMPTY_CLIENT_INTAKE_FORM,
    firstName: 'Helga',
    lastName: 'Schneider',
    dateOfBirth: '1945-03-12',
    street: 'Musterweg',
    houseNumber: '5',
    zip: '10115',
    city: 'Berlin',
    phone: '030123456',
    serviceStart: '2026-07-01',
    careContexts: ['ambulatory_care'],
    careLevel: 'pg2',
    billingTypes: ['sgb_xi'],
    costBearerTypes: ['pflegekasse'],
    healthInsurance: 'AOK',
    careFundName: 'Test Pflegekasse',
    insuranceNumber: '123456789',
    intakeContractType: 'ambulatory_care',
    ...overrides,
  };
}

function finalizeRequiredDocs(form: ClientIntakeFormData): ClientIntakeFormData {
  const templates = listApplicableIntakeTemplates(form);
  let next = { ...form, intakeDocuments: [] as ClientIntakeFormData['intakeDocuments'] };
  const sig = { role: 'client' as const, dataUrl: 'data:image/png;base64,abc', signedAt: new Date().toISOString() };
  const empSig = { role: 'employee' as const, dataUrl: 'data:image/png;base64,def', signedAt: new Date().toISOString() };

  for (const template of templates.filter((t) => t.isRequired || t.documentType === 'privacy_consent' || t.documentType === 'client_contract')) {
    let opened = openDocumentPreview(next, template);
    opened = applyDocumentSignature(opened, template, next, 'client', sig);
    if (template.requiresEmployeeSignature) {
      opened = applyDocumentSignature(opened, template, next, 'employee', empSig);
    }
    const fin = finalizeDocument(opened, template, next);
    if (fin.ok) {
      next = updateIntakeDocumentInForm(next, fin.document);
    }
  }
  return next;
}

describe('Client intake step 8 — Verträge & Einwilligungen', () => {
  it('1. ersetzt einfache Consent-Buttons durch Dokumenten-Panel', () => {
    const screen = readSrc('screens/business/office/ClientIntakeWizardScreen.tsx');
    expect(screen).toContain('CareIntakeDocumentsStepPanel');
    expect(screen).not.toContain('Datenschutz einwilligen');
    expect(screen).not.toContain('Kundenvertrag bestätigen');
  });

  it('2. enthält alle 12 Systemvorlagen-Schlüssel', () => {
    const keys = INTAKE_DOCUMENT_SYSTEM_TEMPLATES.map((t) => t.templateKey);
    expect(keys).toContain('privacy_consent_default');
    expect(keys).toContain('assignment_declaration_care_health_insurance');
    expect(keys).toContain('client_contract_assist');
    expect(keys).toContain('client_contract_ambulatory_care');
    expect(keys).toContain('client_contract_stationary_care');
    expect(keys).toContain('client_contract_care_consulting');
    expect(keys).toContain('client_contract_day_care');
    expect(keys).toContain('client_contract_relief_services');
    expect(keys).toContain('confidentiality_release_default');
    expect(keys).toContain('communication_consent_default');
    expect(keys).toContain('photo_media_consent_default');
    expect(keys).toContain('emergency_contact_consent_default');
    expect(keys).toHaveLength(12);
  });

  it('3. Systemvorlagen enthalten deutschen Rechtstext, kein Lorem ipsum', () => {
    for (const template of INTAKE_DOCUMENT_SYSTEM_TEMPLATES) {
      expect(template.htmlContent.toLowerCase()).not.toContain('lorem ipsum');
      expect(template.plainTextContent.length).toBeGreaterThan(10);
      expect(template.htmlContent).toContain('{{client.full_name}}');
      expect(template.htmlContent).toContain('document-section');
      expect(template.version).toBeGreaterThanOrEqual(3);
    }
  });

  it('4. mappt ambulante Pflege auf client_contract_ambulatory_care', () => {
    const form = baseForm({ careContexts: ['ambulatory_care'], intakeContractType: 'ambulatory_care' });
    expect(resolveContractTemplateKey(form)).toBe('client_contract_ambulatory_care');
  });

  it('5. mappt Alltagsbegleitung auf client_contract_assist', () => {
    const form = baseForm({ careContexts: ['daily_assistance'], intakeContractType: 'assist' });
    expect(resolveContractTemplateKey(form)).toBe('client_contract_assist');
  });

  it('6. mappt stationäre Pflege auf client_contract_stationary_care', () => {
    const form = baseForm({
      careContexts: ['stationary_care'],
      intakeContractType: 'stationary_care',
      facilityName: 'Seniorenheim',
      roomNumber: '12',
    });
    expect(resolveContractTemplateKey(form)).toBe('client_contract_stationary_care');
  });

  it('7. mappt Pflegeberatung auf client_contract_care_consulting', () => {
    const form = baseForm({
      careContexts: ['consulting'],
      intakeContractType: 'care_consulting',
      consultingReason: 'Erstberatung',
    });
    expect(resolveContractTemplateKey(form)).toBe('client_contract_care_consulting');
  });

  it('8. Live-Vorschau ersetzt Platzhalter aus Intake-Daten', () => {
    const form = baseForm();
    const template = getSystemIntakeTemplateByKey('privacy_consent_default')!;
    const context = buildIntakePlaceholderContext(form, { name: 'Demo Pflegedienst' });
    const preview = renderIntakeDocumentHtml(template, context);
    expect(preview.html).toContain('Helga Schneider');
    expect(preview.html).toContain('Demo Pflegedienst');
    expect(preview.html).not.toContain('{{client.full_name}}');
  });

  it('8b. Vorschau formatiert Pflegegrad als PG 3 und Anrede als Herr', () => {
    const form = baseForm({ careLevel: 'pg3', salutation: 'herr' });
    const template = getSystemIntakeTemplateByKey('assignment_declaration_care_health_insurance')!;
    const preview = renderIntakeDocumentHtml(template, buildIntakePlaceholderContext(form));
    expect(preview.html).toContain('PG3');
    expect(preview.html).not.toContain('pg3');
    expect(preview.html).toContain('Herr ');
    expect(preview.html).not.toMatch(/\bherr\b/);
  });

  it('9. meldet fehlende Pflicht-Platzhalter außerhalb des Dokuments', () => {
    const form = baseForm({ firstName: '', lastName: '' });
    const template = getSystemIntakeTemplateByKey('privacy_consent_default')!;
    const preview = renderIntakeDocumentHtml(template, buildIntakePlaceholderContext(form));
    expect(preview.missingPlaceholders.length).toBeGreaterThan(0);
    expect(preview.html).not.toContain('[fehlend:');
    expect(preview.html).not.toContain('class="missing"');
  });

  it('10. blockiert Abschluss bei fehlenden Pflichtdaten', () => {
    const form = baseForm({ firstName: '', lastName: '' });
    const template = getSystemIntakeTemplateByKey('privacy_consent_default')!;
    const opened = openDocumentPreview(form, template);
    const sig = { role: 'client' as const, dataUrl: 'data:image/png;base64,x', signedAt: new Date().toISOString() };
    const signed = applyDocumentSignature(opened, template, form, 'client', sig);
    const result = finalizeDocument(signed, template, form);
    expect(result.ok).toBe(false);
  });

  it('11. Datenschutz ist optional beim Speichern — Hinweis statt Blockade', () => {
    const form = baseForm();
    const validation = validateIntakeDocumentsStep(form, listApplicableIntakeTemplates(form));
    expect(validation.ok).toBe(true);
    expect(validation.errors.intakePrivacy).toBeUndefined();
    expect(validation.warnings.intakePrivacy).toBeTruthy();
    expect(validation.warnings.intakeContract).toBeTruthy();
  });

  it('12. Vertrag erfordert Klient:in- und Mitarbeitenden-Unterschrift', () => {
    const form = baseForm();
    const contractTemplate = getSystemIntakeTemplateByKey('client_contract_ambulatory_care')!;
    expect(contractTemplate.signatureSlots.filter((s) => s.required)).toHaveLength(2);
  });

  it('13. Abtretung optional — deaktiviert erlaubt Weiter nach Pflichtdokumenten', () => {
    const form = finalizeRequiredDocs(baseForm({ intakeAssignmentEnabled: false }));
    expect(canProceedFromIntakeDocuments(form, listApplicableIntakeTemplates(form))).toBe(true);
  });

  it('14. Abtretung aktiviert — muss abgeschlossen werden', () => {
    const form = finalizeRequiredDocs(baseForm({ intakeAssignmentEnabled: true }));
    const validation = validateIntakeDocumentsStep(form, listApplicableIntakeTemplates(form));
    expect(validation.ok).toBe(false);
    expect(validation.errors.intakeAssignment).toBeTruthy();
  });

  it('15. fehlende Unterschrift erscheint nicht im Dokumententext', () => {
    const template = getSystemIntakeTemplateByKey('privacy_consent_default')!;
    const preview = renderIntakeDocumentHtml(template, buildIntakePlaceholderContext(baseForm()));
    expect(preview.html).not.toContain('Unterschrift ausstehend');
    expect(preview.missingPlaceholders.some((m) => m.includes('Unterschrift'))).toBe(true);
  });

  it('16. Finalisierung sperrt Dokument und setzt Status finalized', () => {
    const form = baseForm();
    const template = getSystemIntakeTemplateByKey('privacy_consent_default')!;
    let doc = openDocumentPreview(form, template);
    doc = applyDocumentSignature(doc, template, form, 'client', {
      role: 'client',
      dataUrl: 'data:image/png;base64,sig',
      signedAt: new Date().toISOString(),
    });
    const result = finalizeDocument(doc, template, form);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.status).toBe('finalized');
      expect(result.document.finalizedHtml).toContain('abgeschlossen');
    }
  });

  it('17. validateIntakeStep blockiert Speichern nicht wegen Pflichtdokumenten', () => {
    const errors = validateIntakeStep('vertraege_einwilligungen', baseForm());
    expect(errors.intakePrivacy).toBeUndefined();
    expect(errors.intakeContract).toBeUndefined();
  });

  it('18. vollständige Pflichtdokumente erlauben Weiter', () => {
    const form = finalizeRequiredDocs(baseForm());
    expect(canProceedFromIntakeDocuments(form, listApplicableIntakeTemplates(form))).toBe(true);
  });

  it('19. UI zeigt Systemvorlage-Hinweis und Info-Banner für offene Pflichtdokumente', () => {
    const panel = readSrc('components/inputs/CareIntakeDocumentsStepPanel.tsx');
    expect(panel).toContain('Systemvorlage');
    expect(panel).toContain('vom Mandanten prüfbar');
    expect(panel).toContain('im Portal');
    expect(panel).not.toContain('rechtssicher garantiert');
    expect(panel).not.toContain('errors.intakePrivacy');
  });

  it('20. Signature Modal mit Löschen, Abbrechen und Bestätigen', () => {
    const modal = readSrc('components/inputs/CareSignatureModal.tsx');
    const canvas = readSrc('components/inputs/CareSignatureCanvas.tsx');
    const panel = readSrc('components/inputs/CareIntakeDocumentsStepPanel.tsx');
    expect(modal).toContain('CareSignatureModal');
    expect(canvas).toContain('Löschen');
    expect(canvas).toContain('Abbrechen');
    expect(canvas).toContain('Unterschrift bestätigen');
    expect(canvas).not.toContain('Demo');
    expect(panel).toContain('CareSignatureModal');
    expect(panel).toContain('signatureModalVisible');
  });

  it('21. kein Demo-Fallback in Production-Modus für Template-Laden', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');
    expect(getServiceMode()).toBe('supabase');
    const repo = readSrc('features/intakeDocuments/intakeDocumentRepository.ts');
    expect(repo).toContain('intake_document_system_templates');
    expect(repo).not.toContain('DEMO_TENANT');
    vi.unstubAllEnvs();
  });

  it('22. Mandantenvorlage bevorzugt Systemvorlage in listApplicableIntakeTemplates', () => {
    const form = baseForm();
    const tenantTemplate = {
      ...getSystemIntakeTemplateByKey('privacy_consent_default')!,
      id: 'tenant-1',
      source: 'tenant' as const,
      title: 'Mandanten-Datenschutz',
      tenantTemplateId: 'tenant-1',
    };
    const templates = listApplicableIntakeTemplates(form, [tenantTemplate]);
    const privacy = templates.find((t) => t.templateKey === 'privacy_consent_default');
    expect(privacy?.source).toBe('tenant');
    expect(privacy?.title).toBe('Mandanten-Datenschutz');
  });

  it('23. Vertragsart-Dropdown aus Leistungskontexten', () => {
    const types = listAvailableContractTypes(['ambulatory_care', 'consulting']);
    expect(types).toContain('ambulatory_care');
    expect(types).toContain('care_consulting');
  });

  it('25. listApplicableIntakeTemplates filtert nur passende Verträge', () => {
    const form = baseForm({ careContexts: ['ambulatory_care'], intakeContractType: 'ambulatory_care' });
    const allTemplates = INTAKE_DOCUMENT_SYSTEM_TEMPLATES;
    const applicable = listApplicableIntakeTemplates(form, allTemplates);
    const contractTemplates = applicable.filter((t) => t.documentType === 'client_contract');
    expect(contractTemplates).toHaveLength(1);
    expect(contractTemplates[0]?.templateKey).toBe('client_contract_ambulatory_care');
    expect(applicable.some((t) => t.templateKey === 'privacy_consent_default')).toBe(true);
    expect(applicable.some((t) => t.templateKey === 'client_contract_assist')).toBe(false);
    expect(applicable.some((t) => t.templateKey === 'client_contract_stationary_care')).toBe(false);
  });

  it('26. Vorschau liefert vollständiges HTML-Dokument für iframe', () => {
    const form = baseForm();
    const template = getSystemIntakeTemplateByKey('privacy_consent_default')!;
    const preview = renderIntakeDocumentHtml(template, buildIntakePlaceholderContext(form, { name: 'Demo Pflegedienst' }));
    expect(preview.html).toContain('<!DOCTYPE html>');
    expect(preview.html).toContain('document-legal');
    expect(preview.html).toContain('Times New Roman');
  });

  it('27. Migration legt Tabellen und RLS/GRANTs an', () => {
    const migration = readFileSync(
      path.join(srcRoot, '..', 'supabase', 'migrations', '0058_client_intake_documents.sql'),
      'utf8',
    );
    expect(migration).toContain('intake_document_system_templates');
    expect(migration).toContain('tenant_document_templates');
    expect(migration).toContain('client_intake_documents');
    expect(migration).toContain('client_document_signatures');
    expect(migration).toContain('client_document_events');
    expect(migration).toContain('client_contract_selection');
    expect(migration).toContain('client_consent_status');
    expect(migration).toContain('GRANT SELECT ON public.intake_document_system_templates');
  });

  it('28. Migration 0060 erlaubt Klient:innen-Anlage bei Intake-Abschluss', () => {
    const migration = readFileSync(
      path.join(srcRoot, '..', 'supabase', 'migrations', '0060_intake_completion_rls_grants.sql'),
      'utf8',
    );
    expect(migration).toContain('clients_insert_tenant');
    expect(migration).toContain("has_permission('office.clients.create')");
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated');
    expect(migration).toContain('client_intake_documents');
    expect(migration).toContain('client_cost_carrier_assignments');
  });

  it('29. Beihilfe-only: Abtretungstext ohne Pflegekasse', () => {
    const form = baseForm({
      costBearerTypes: ['beihilfe'],
      beihilfeName: 'Beihilfe Berlin',
      careFundName: '',
      healthInsurance: '',
    });
    const template = getSystemIntakeTemplateByKey('assignment_declaration_care_health_insurance')!;
    const preview = renderIntakeDocumentHtml(
      template,
      buildIntakePlaceholderContext(form, { name: 'Demo Pflegedienst' }),
    );
    expect(preview.html).toContain('Beihilfe Berlin');
    expect(preview.html).toContain('<strong>Beihilfe Berlin</strong>');
    expect(preview.html).toContain('zur Direktabrechnung mit der Beihilfe-Stelle');
    expect(preview.html).not.toContain('[fehlend: Pflegekasse]');
    expect(preview.html).not.toContain('[fehlend:');
  });

  it('30. Mandantenadresse aus Tenant-Merge-Kontext', () => {
    const form = baseForm();
    const template = getSystemIntakeTemplateByKey('privacy_consent_default')!;
    const preview = renderIntakeDocumentHtml(
      template,
      buildIntakePlaceholderContext(form, {
        name: 'Helferhasen+ Pflegedienst',
        street: 'Hasenweg 7',
        zip: '12345',
        city: 'Musterstadt',
      }),
    );
    expect(preview.html).toContain('Hasenweg 7');
    expect(preview.html).toContain('12345');
    expect(preview.html).toContain('Musterstadt');
    expect(preview.html).not.toContain('[fehlend: Mandantenstraße]');
  });

  it('31. Geburtsdatum im deutschen Format TT.MM.JJJJ', () => {
    const form = baseForm({ dateOfBirth: '1935-01-11' });
    const template = getSystemIntakeTemplateByKey('privacy_consent_default')!;
    const preview = renderIntakeDocumentHtml(template, buildIntakePlaceholderContext(form));
    expect(preview.html).toContain('11.01.1935');
    expect(preview.html).not.toContain('1935-01-11');
  });

  it('32. Schweigepflicht ohne Hausarzt nutzt Allgemeinwording', () => {
    const form = baseForm({ familyDoctor: '', intakeOptionalConsents: ['confidentiality_release_default'] });
    const template = getSystemIntakeTemplateByKey('confidentiality_release_default')!;
    const preview = renderIntakeDocumentHtml(template, buildIntakePlaceholderContext(form));
    expect(preview.html).toContain('meine behandelnden Ärzt:innen');
    expect(preview.html).not.toContain('[fehlend:');
    expect(preview.html).not.toContain('Hausarzt');
  });

  it('33. Mandanten-Stundensatz erscheint in Assist-Vertrag wenn Klientensatz fehlt', () => {
    const form = baseForm({
      careContexts: ['daily_assistance'],
      intakeContractType: 'assist',
      hourlyRate: '',
    });
    const template = getSystemIntakeTemplateByKey('client_contract_assist')!;
    const preview = renderIntakeDocumentHtml(
      template,
      buildIntakePlaceholderContext(form, {
        name: 'Demo Pflegedienst',
        defaultHourlyRate: '45,00',
      }),
    );
    expect(preview.html).toContain('45,00 EUR');
    expect(preview.html).not.toContain('— EUR');
    expect(preview.html).not.toContain('[fehlend:');
  });

  it('34. Klientenspezifischer Stundensatz hat Vorrang vor Mandanten-Default', () => {
    const form = baseForm({
      careContexts: ['daily_assistance'],
      intakeContractType: 'assist',
      hourlyRate: '52,50',
    });
    expect(resolveBillingHourlyRate(form, { name: 'Demo', defaultHourlyRate: '45,00' })).toBe('52,50');
  });

  it('35. fehlender Stundensatz bleibt leer — kein Gedankenstrich im Dokument', () => {
    const form = baseForm({
      careContexts: ['daily_assistance'],
      intakeContractType: 'assist',
      hourlyRate: '',
    });
    const template = getSystemIntakeTemplateByKey('client_contract_assist')!;
    const preview = renderIntakeDocumentHtml(template, buildIntakePlaceholderContext(form));
    expect(preview.html).not.toContain('— EUR');
    expect(preview.unresolvedKeys).toContain('billing.hourly_rate');
  });
});
