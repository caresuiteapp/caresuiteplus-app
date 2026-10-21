import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM, type ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { INTAKE_DOCUMENT_TEMPLATES_2027 } from '@/features/intakeDocuments/intakeDocumentTemplates2027';
import { INTAKE_DOCUMENT_SYSTEM_TEMPLATES } from '@/features/intakeDocuments/intakeDocumentSystemTemplates';
import { getIntake2027Fields } from '@/features/intakeDocuments/intake2027Fields';
import { listApplicableIntakeTemplates } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { prepareIntakeDocumentPackage, signIntakeDocumentPackage } from '@/features/intakeDocuments/intakeDocumentPackage';
import { verifyIntakeCompletionDocuments } from '@/features/intakeDocuments/intakeCompletionVerification';
import { mergeIntakeFormWithDefaults } from '@/lib/clients/clientIntakeDraftStorage';
import { OPTIONAL_CONSENT_TEMPLATE_KEYS } from '@/features/intakeDocuments/intakeDocumentTypes';

const now = '2026-10-21T12:00:00.000Z';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const tenant = { name: 'Prüfdienst Beispiel', street: 'Testweg 2', zip: '10115', city: 'Berlin' };
const captures = { client: { role: 'client' as const, dataUrl: png, signedAt: now, signerName: 'Erika Muster' }, employee: { role: 'employee' as const, dataUrl: png, signedAt: now, signerName: 'Anna Beispiel' } };
function form(overrides: Partial<ClientIntakeFormData> = {}): ClientIntakeFormData {
  const value: ClientIntakeFormData = { ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), intakeWorkflowVersion: 2, intakeStage: 'full_intake', intakeTemplateEdition: '2027',
    firstName: 'Erika', lastName: 'Muster', salutation: 'frau', dateOfBirth: '1950-01-01', street: 'Teststraße', houseNumber: '4', zip: '10115', city: 'Berlin',
    facilityName: 'Beispiel Einrichtung', phone: '030123456', email: 'fixture@example.invalid', emergencyContactName: 'Alex Muster', emergencyContactPhone: '0307654321', serviceStart: '2027-01-04', admissionDate: '2027-01-04',
    careContexts: ['daily_assistance'], intakeContractType: 'assist', careLevel: 'pg2', supportWishes: ['haushalt'], fundingSources: ['entlastungsleistung', 'selbstzahler'], selfPay: true, billingType: 'kombi',
    billingTypes: ['kombi'], costBearerTypes: ['pflegekasse'], careFundName: 'Beispiel Pflegekasse', insuranceNumber: 'A123456789',
    intakeAssignmentEnabled: true, intakeOptionalConsents: [...OPTIONAL_CONSENT_TEMPLATE_KEYS], ...overrides };
  const details = Object.fromEntries(getIntake2027Fields(INTAKE_DOCUMENT_TEMPLATES_2027.map(t => t.templateKey), value).map(f => [f.key, f.choices?.[0] ?? `Konkrete Testangabe: ${f.label}`]));
  value.intakeLegalDetails = { ...details, 'signer.name': 'Erika Muster', 'employee.name': 'Anna Beispiel', 'communication.email': 'yes', 'media.photo': 'yes', ...overrides.intakeLegalDetails };
  return value;
}
function rows() { return INTAKE_DOCUMENT_TEMPLATES_2027.map(t => ({ id: t.id, template_key: t.templateKey, title: t.title, document_type: t.documentType, service_type: t.serviceType,
  version: t.version, is_active: t.isActive, is_required: t.isRequired, requires_client_signature: t.requiresClientSignature, requires_employee_signature: t.requiresEmployeeSignature,
  requires_representative_signature: t.requiresRepresentativeSignature, allows_custom_template: t.allowsCustomTemplate, html_content: t.htmlContent, plain_text_content: t.plainTextContent,
  placeholder_schema: t.placeholderSchema, signature_slots: t.signatureSlots, updated_at: now })); }
function sign(value = form()) {
  const templates = listApplicableIntakeTemplates(value), review = prepareIntakeDocumentPackage(value, templates, tenant);
  expect(review.issues).toEqual([]);
  const result = signIntakeDocumentPackage(review.form, templates, review.documents, captures, tenant);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.form;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => vi.useRealTimers());

describe('prepared 2027 edition and immutable originals', () => {
  it('preserves all concrete choices and edition across draft restore without changing legacy defaults', () => {
    const value = form(); const restored = mergeIntakeFormWithDefaults(value);
    expect(restored.intakeTemplateEdition).toBe('2027'); expect(restored.intakeLegalDetails).toEqual(value.intakeLegalDetails);
    expect(mergeIntakeFormWithDefaults({}).intakeTemplateEdition).toBeUndefined();
    expect(listApplicableIntakeTemplates({ ...value, intakeTemplateEdition: undefined }).every(t => t.version !== 4)).toBe(true);
    expect(INTAKE_DOCUMENT_SYSTEM_TEMPLATES.every(t => t.version === 2)).toBe(true);
  });
  it('places both identities only in required slots and verifies every exact original on the server', async () => {
    const signed = sign();
    expect(signed.intakeDocuments).toHaveLength(7);
    const privacy = signed.intakeDocuments.find(d => d.templateKey === 'privacy_consent_default')!;
    expect(Object.keys(privacy.signatures)).toEqual(['employee']);
    const contract = signed.intakeDocuments.find(d => d.templateKey === 'client_contract_assist')!;
    expect(Object.keys(contract.signatures).sort()).toEqual(['client', 'employee']);
    expect(contract.finalizedHtml).toContain('document-2027');
    const verified = await verifyIntakeCompletionDocuments({ form: signed, systemTemplates: rows(), tenantTemplates: [], tenantDisplay: tenant, now: Date.parse(now) });
    expect(verified.map(d => d.finalizedHtml)).toEqual(signed.intakeDocuments.map(d => d.finalizedHtml));
    expect(verified.every(d => d.contentHash.startsWith('sha256:'))).toBe(true);
  });
  it('blocks absent consent choices, recipients, prices and invalid identity or conclusion options', () => {
    const cases: Record<string, string>[] = [{ 'communication.email': '' }, { 'media.photo': '' }, { 'confidentiality.people': '' }, { 'assist.prices': '' }, { 'signer.name': 'Andere Person' }, { 'contract.conclusion': 'unbekannt' }];
    for (const changes of cases) {
      const value = form({ intakeLegalDetails: changes });
      const prepared = prepareIntakeDocumentPackage(value, listApplicableIntakeTemplates(value), tenant);
      expect(prepared.issues.length, JSON.stringify(changes)).toBeGreaterThan(0);
      expect(prepared.documents.some(d => d.previewHtml?.includes('Entwurf · Angaben unvollständig'))).toBe(true);
      expect(signIntakeDocumentPackage(prepared.form, listApplicableIntakeTemplates(value), prepared.documents, captures, tenant).ok).toBe(false);
    }
  });
  it('requires representation proof and contact details for the specifically selected channels', () => {
    for (const value of [form({ email: '' }), form({ intakeLegalDetails: { 'signer.capacity': 'Eine bevollmächtigte oder rechtliche Vertretung', 'signer.name': 'Alex Muster', 'signer.authority': '' } })]) {
      expect(prepareIntakeDocumentPackage(value, listApplicableIntakeTemplates(value), tenant).issues.length).toBeGreaterThan(0);
    }
  });
  it('rejects later changes to a legal detail, declared signature name, or edition', async () => {
    const signed = sign(), verify = (value: ClientIntakeFormData) => verifyIntakeCompletionDocuments({ form: value, systemTemplates: rows(), tenantTemplates: [], tenantDisplay: tenant, now: Date.parse(now) });
    await expect(verify({ ...signed, intakeLegalDetails: { ...signed.intakeLegalDetails, 'assist.prices': 'Andere Preise' } })).rejects.toThrow('Original');
    const changedName = structuredClone(signed); changedName.intakeDocuments.find(d => d.signatures.client)!.signatures.client!.signerName = 'Andere Person';
    await expect(verify(changedName)).rejects.toThrow('Name');
    await expect(verify({ ...signed, intakeTemplateEdition: undefined })).rejects.toThrow('Dokumentausgabe');
  });
  it('prepares the WBVG paper contract but refuses electronic package signing', () => {
    const value = form({ careContexts: ['stationary_care'], intakeContractType: 'stationary_care', intakeAssignmentEnabled: false, intakeOptionalConsents: [] });
    const templates = listApplicableIntakeTemplates(value), prepared = prepareIntakeDocumentPackage(value, templates, tenant);
    expect(prepared.issues).toHaveLength(1); expect(prepared.issues[0].kind).toBe('paper_required');
    expect(prepared.documents.find(d => d.templateKey === 'client_contract_stationary_care')!.previewHtml).toContain('Schriftlicher Abschluss erforderlich');
    expect(signIntakeDocumentPackage(prepared.form, templates, prepared.documents, captures, tenant).ok).toBe(false);
  });
});
