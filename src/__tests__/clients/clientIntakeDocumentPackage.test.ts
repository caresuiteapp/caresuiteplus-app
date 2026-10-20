import { describe, expect, it } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM, type ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { listApplicableIntakeTemplates } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { changeIntakeDocumentSelection, prepareIntakeDocumentPackage, signIntakeDocumentPackage } from '@/features/intakeDocuments/intakeDocumentPackage';
import { applyDocumentSignature, updateIntakeDocumentInForm } from '@/features/intakeDocuments/intakeDocumentService';
import { OPTIONAL_CONSENT_TEMPLATE_KEYS, type IntakeDocumentSignature } from '@/features/intakeDocuments/intakeDocumentTypes';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const tenant = { name: 'Testdienst', street: 'Teststraße 1', zip: '10115', city: 'Berlin' };
export function packageForm(): ClientIntakeFormData {
  return { ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), firstName: 'Erika', lastName: 'Muster', dateOfBirth: '1950-01-01',
    street: 'Testweg', houseNumber: '4', zip: '10115', city: 'Berlin', phone: '030123456', emergencyContactName: 'Alex Muster', emergencyContactPhone: '0307654321',
    careContexts: ['daily_assistance'], intakeContractType: 'assist', serviceStart: '2026-11-01', careLevel: 'pg2',
    costBearerTypes: ['pflegekasse'], careFundName: 'Test Pflegekasse', insuranceNumber: 'A123456789',
    intakeAssignmentEnabled: true, intakeOptionalConsents: [...OPTIONAL_CONSENT_TEMPLATE_KEYS] };
}
function signatures() {
  const signedAt = new Date().toISOString();
  return { client: { role: 'client', dataUrl: png, signedAt, signerName: 'Erika Muster' } as IntakeDocumentSignature,
    employee: { role: 'employee', dataUrl: png, signedAt, signerName: 'Test Mitarbeiter' } as IntakeDocumentSignature };
}

describe('shared reviewed intake package', () => {
  it('requires both roles and freezes all seven selected documents without signing anything', () => {
    const form = packageForm(), templates = listApplicableIntakeTemplates(form);
    const result = prepareIntakeDocumentPackage(form, templates, tenant);
    expect(result.documents).toHaveLength(7); expect(result.roles).toEqual(['client', 'employee']); expect(result.issues).toEqual([]);
    expect(result.documents.every(document => document.previewHtml && !Object.keys(document.signatures).length)).toBe(true);
    expect(form.intakeDocuments).toEqual([]);
  });
  it('places each captured role only into its own template fields and locks every original', () => {
    const form = packageForm(), templates = listApplicableIntakeTemplates(form), prepared = prepareIntakeDocumentPackage(form, templates, tenant);
    const captured = signatures();
    const result = signIntakeDocumentPackage(prepared.form, templates, prepared.documents, captured, tenant);
    expect(result.ok).toBe(true); if (!result.ok) return;
    for (const document of result.form.intakeDocuments) {
      expect(document.status).toBe('finalized'); expect(document.finalizedHtml).toBe(document.previewHtml);
      expect(document.signatures.client).toEqual(captured.client);
      const expectedCount = document.documentType === 'client_contract' ? 2 : 1;
      expect(document.finalizedHtml?.match(/class="sig-img"/g)).toHaveLength(expectedCount);
      expect(Boolean(document.signatures.employee)).toBe(document.documentType === 'client_contract');
    }
    const reopened = prepareIntakeDocumentPackage(result.form, templates, tenant);
    expect(reopened.roles).toEqual([]); expect(reopened.issues).toEqual([]);
    expect(reopened.documents.map(document => document.finalizedHtml)).toEqual(result.form.intakeDocuments.map(document => document.finalizedHtml));
  });
  it('rejects a missing employee signature without partially signing client-only documents', () => {
    const form = packageForm(), templates = listApplicableIntakeTemplates(form), prepared = prepareIntakeDocumentPackage(form, templates, tenant);
    const result = signIntakeDocumentPackage(prepared.form, templates, prepared.documents, { client: signatures().client }, tenant);
    expect(result.ok).toBe(false); expect(prepared.form.intakeDocuments.every(document => !Object.keys(document.signatures).length)).toBe(true);
  });
  it('rejects changed master data, selection or template after the preview', () => {
    const form = packageForm(), templates = listApplicableIntakeTemplates(form), prepared = prepareIntakeDocumentPackage(form, templates, tenant);
    expect(signIntakeDocumentPackage({ ...prepared.form, firstName: 'Andere Person' }, templates, prepared.documents, signatures(), tenant).ok).toBe(false);
    const changed = changeIntakeDocumentSelection(prepared.form, { intakeOptionalConsents: [] });
    expect(signIntakeDocumentPackage(changed, templates, prepared.documents, signatures(), tenant).ok).toBe(false);
    expect(signIntakeDocumentPackage(prepared.form, templates.map(t => ({ ...t, htmlContent: t.htmlContent + '<p>Neue Klausel</p>' })), prepared.documents, signatures(), tenant).ok).toBe(false);
  });
  it('rejects missing required data and absent signature fields in a custom template', () => {
    const form = { ...packageForm(), serviceStart: '', admissionDate: '' }, templates = listApplicableIntakeTemplates(form);
    expect(prepareIntakeDocumentPackage(form, templates, tenant).issues.length).toBeGreaterThan(0);
    const valid = packageForm(), broken = listApplicableIntakeTemplates(valid).map(template => ({ ...template, htmlContent: template.htmlContent.replace('{{signature.employee}}', '') }));
    expect(prepareIntakeDocumentPackage(valid, broken, tenant).issues.some(issue => issue.message.includes('Unterschriftsfeld'))).toBe(true);
  });
  it('preserves an existing client signature while collecting only the remaining employee role', () => {
    const form = { ...packageForm(), intakeAssignmentEnabled: false, intakeOptionalConsents: [] }, templates = listApplicableIntakeTemplates(form);
    let next = prepareIntakeDocumentPackage(form, templates, tenant).form;
    const captured = signatures();
    for (const template of templates) next = updateIntakeDocumentInForm(next, applyDocumentSignature(next.intakeDocuments.find(d => d.templateKey === template.templateKey)!, template, next, 'client', captured.client, tenant));
    const prepared = prepareIntakeDocumentPackage(next, templates, tenant);
    expect(prepared.roles).toEqual(['employee']);
    const result = signIntakeDocumentPackage(prepared.form, templates, prepared.documents, { employee: captured.employee }, tenant);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.form.intakeDocuments.every(d => d.signatures.client === captured.client && d.status === 'finalized')).toBe(true);
  });
  it('archives a deselected signed original instead of deleting it and detects later content edits', () => {
    const form = packageForm(), templates = listApplicableIntakeTemplates(form), prepared = prepareIntakeDocumentPackage(form, templates, tenant);
    const result = signIntakeDocumentPackage(prepared.form, templates, prepared.documents, signatures(), tenant);
    expect(result.ok).toBe(true); if (!result.ok) return;
    const changed = changeIntakeDocumentSelection(result.form, { intakeOptionalConsents: [] });
    expect(changed.intakeDocuments).toHaveLength(3); expect(changed.intakeDocumentHistory).toHaveLength(4);
    expect(changed.intakeDocumentHistory?.every(d => Boolean(d.finalizedHtml && d.signatures.client))).toBe(true);
    expect(prepareIntakeDocumentPackage({ ...result.form, firstName: 'Geändert' }, templates, tenant).issues.length).toBeGreaterThan(0);
  });
});
