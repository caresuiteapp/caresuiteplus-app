import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeDocumentSignature, IntakeDocumentTemplate } from '@/features/intakeDocuments/intakeDocumentTypes';
import { buildIntakePlaceholderContext } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { finalizeIntakeDocumentHtml, renderIntakeDocumentHtml } from '@/features/intakeDocuments/renderIntakeDocumentPreview';
import { applyDocumentSignature, applySharedClientSignatureToDocuments, finalizeDocument, finalizeReadyIntakeDocuments, openDocumentPreview } from '@/features/intakeDocuments/intakeDocumentService';
import { formatIntakeDocumentDateTime, getIntakeRenderBindingError, hasIntakeRenderBinding, isIntakeRenderTimestamp, isSafeIntakeSignatureDataUrl } from '@/features/intakeDocuments/intakeDocumentRenderBinding';

const openedAt = '2026-10-14T22:30:00.000Z';
const signedAt = '2026-10-15T07:15:04.000Z';
const completedAt = '2026-10-17T09:21:33.000Z';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const signature: IntakeDocumentSignature = { role: 'client', dataUrl: png, signedAt };
const template: IntakeDocumentTemplate = {
  id: 'contract-test', templateKey: 'contract-test', title: 'Vertrag', documentType: 'client_contract', serviceType: 'assist',
  version: 2, isSystemTemplate: true, isRequired: true, isActive: true, source: 'system',
  requiresClientSignature: true, requiresEmployeeSignature: true, requiresRepresentativeSignature: false,
  allowsCustomTemplate: false, htmlContent: '<h1>{{client.full_name}}</h1><p>{{document.date}}</p><p>{{signature.client}}</p><p>{{signature.employee}}</p>',
  plainTextContent: 'Vertrag', placeholderSchema: { 'client.full_name': { label: 'Name', required: true } },
  signatureSlots: [{ role: 'client', placeholder: 'signature.client', required: true }, { role: 'employee', placeholder: 'signature.employee', required: true }],
};
const form = (overrides: Partial<ClientIntakeFormData> = {}): ClientIntakeFormData => ({ ...EMPTY_CLIENT_INTAKE_FORM, firstName: 'Anna', lastName: 'Muster', admissionDate: '', serviceStart: '', ...overrides });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(openedAt)); });
afterEach(() => { vi.useRealTimers(); });

describe('deterministic intake render binding', () => {
  it('freezes the first preview date across reopen, midnight and later days', () => {
    const original = openDocumentPreview(form(), template);
    expect(hasIntakeRenderBinding(original)).toBe(true);
    expect(original.renderedAt).toBe(openedAt);
    expect(original.previewHtml).toContain('15.10.2026');
    vi.setSystemTime(new Date(completedAt));
    const reopened = openDocumentPreview(form({ intakeDocuments: [original] }), template);
    expect(reopened.renderedAt).toBe(openedAt);
    expect(reopened.previewOpenedAt).toBe(openedAt);
    expect(reopened.previewHtml).toBe(original.previewHtml);
  });

  it('reproduces the exact final body with stored timestamps after a later second signature', () => {
    const values = form();
    let document = openDocumentPreview(values, template);
    vi.setSystemTime(new Date(signedAt));
    document = applyDocumentSignature(document, template, values, 'client', signature);
    expect(document.status).toBe('pending_signature');
    vi.setSystemTime(new Date(completedAt));
    document = applyDocumentSignature(document, template, values, 'employee', { ...signature, role: 'employee', signedAt: completedAt });
    expect(document.status).toBe('finalized');
    expect(document.finalizedAt).toBe(completedAt);
    expect(document.finalizedHtml).toBe(document.previewHtml);
    expect(document.previewHtml).toContain('15.10.2026, 09:15:04');
    expect(document.previewHtml).toContain('17.10.2026, 11:21:33');
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const reproduced = finalizeIntakeDocumentHtml(template, buildIntakePlaceholderContext(values, undefined, { renderedAt: document.renderedAt! }), document.signatures, document.finalizedAt!);
    expect(reproduced.html).toBe(document.finalizedHtml);
    expect(finalizeDocument(document, { ...template, htmlContent: 'changed' }, form({ firstName: 'Changed' }))).toEqual({ ok: true, document });
  });

  it('formats Berlin time explicitly and rejects ambiguous or impossible timestamps', () => {
    expect(formatIntakeDocumentDateTime('2026-01-01T23:01:02Z')).toBe('02.01.2026, 00:01:02');
    expect(formatIntakeDocumentDateTime('2026-07-01T23:01:02Z')).toBe('02.07.2026, 01:01:02');
    for (const value of ['2026-10-15T10:00:00', '2026-02-30T00:00:00Z', '2026-10-15T24:00:00Z', `${openedAt}\n`, 'invalid']) {
      expect(isIntakeRenderTimestamp(value)).toBe(false);
    }
    expect(() => finalizeIntakeDocumentHtml(template, {}, {}, 'invalid')).toThrow('Abschlusszeitpunkt');
    expect(() => buildIntakePlaceholderContext(form(), undefined, { renderedAt: 'invalid' })).toThrow('Zeitangabe');
  });

  it('escapes person, company and carrier inputs while retaining only generated clause markup', () => {
    const unsafe = '<svg onload="alert(1)"> & \'Name\'';
    const values = form({ firstName: unsafe, city: unsafe, careFundName: unsafe, costBearerIk: unsafe, costBearerTypes: ['pflegekasse'], familyDoctor: unsafe, billingTypes: [unsafe] });
    const context = buildIntakePlaceholderContext(values, { name: unsafe }, { renderedAt: openedAt });
    const htmlTemplate = { ...template, signatureSlots: [], htmlContent: '{{client.full_name}}|{{tenant.name}}|{{cost_carrier.primary_name}}|{{cost_carrier.recipients_list}}|{{cost_carrier.assignment_intro}}|{{cost_carrier.billing_clause}}|{{consulting.family_doctor_clause}}' };
    const result = renderIntakeDocumentHtml(htmlTemplate, context, {}, { wrapDocument: false });
    expect(result.html).not.toContain('<svg');
    expect(result.html).toContain('&lt;svg onload=&quot;alert(1)&quot;&gt; &amp; &#39;Name&#39;');
    expect(result.html).toContain('<strong>');
    expect(result.html).not.toContain('&amp;lt;svg');
    const unknown = renderIntakeDocumentHtml({ ...htmlTemplate, htmlContent: '{{arbitrary.html}}' }, { 'arbitrary.html': unsafe }, {}, { wrapDocument: false });
    expect(unknown.html).not.toContain('<svg');
    const missing = renderIntakeDocumentHtml({ ...htmlTemplate, htmlContent: '{{absent}}', placeholderSchema: { absent: { label: unsafe, required: true } } }, {}, {}, { markMissing: true, wrapDocument: false });
    expect(missing.html).not.toContain('<svg');
  });

  it('rejects unsafe signature URLs without storing or rendering them', () => {
    for (const dataUrl of ['https://example.org/sig.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,abc" onerror="alert(1)', 'data:image/png;base64,a-b', `${png}\n`]) {
      expect(isSafeIntakeSignatureDataUrl(dataUrl)).toBe(false);
      const original = openDocumentPreview(form(), template);
      const result = applyDocumentSignature(original, template, form(), 'client', { ...signature, dataUrl });
      expect(result.signatures.client).toBeUndefined();
      expect(result.previewHtml).toBe(original.previewHtml);
      const rendered = renderIntakeDocumentHtml(template, buildIntakePlaceholderContext(form(), undefined, { renderedAt: openedAt }), { client: { ...signature, dataUrl } });
      expect(rendered.html).not.toContain('<img class="sig-img"');
      expect(rendered.missingPlaceholders).toContain('Unterschrift Klient:in');
    }
  });

  it('requires a fresh review after changing an unsigned preview and never overwrites a signed slot', () => {
    const original = openDocumentPreview(form(), template);
    const changedForm = form({ firstName: 'Changed' });
    expect(applyDocumentSignature(original, template, changedForm, 'client', signature).signatures.client).toBeUndefined();
    const reviewed = openDocumentPreview({ ...changedForm, intakeDocuments: [original] }, template);
    const signed = applyDocumentSignature(reviewed, template, changedForm, 'client', signature);
    const overwritten = applyDocumentSignature(signed, template, changedForm, 'client', { ...signature, signedAt: completedAt });
    expect(overwritten.signatures.client).toBe(signature);
    expect(overwritten.previewHtml).toBe(signed.previewHtml);
    expect(overwritten.missingPlaceholders.join(' ')).toContain('Original');
  });

  it('preserves legacy signed bytes and refuses single, shared and automatic signing without binding', () => {
    const values = form();
    const signed = applyDocumentSignature(openDocumentPreview(values, template), template, values, 'client', signature);
    const legacy = { ...signed, renderVersion: undefined, renderedAt: undefined };
    const restoredForm = { ...values, intakeDocuments: [legacy] };
    expect(getIntakeRenderBindingError(legacy)).toContain('Bindung');
    const opened = openDocumentPreview(restoredForm, template);
    expect(opened.previewHtml).toBe(legacy.previewHtml);
    expect(opened.signatures).toBe(legacy.signatures);
    expect(opened.missingPlaceholders.join(' ')).toContain('Bindung');
    expect(applyDocumentSignature(legacy, template, values, 'employee', { ...signature, role: 'employee' }).signatures.employee).toBeUndefined();
    expect(finalizeDocument(legacy, template, values).ok).toBe(false);
    const repaired = finalizeReadyIntakeDocuments(restoredForm, [template]).intakeDocuments[0];
    expect(repaired.previewHtml).toBe(legacy.previewHtml);
    expect(repaired.signatures).toBe(legacy.signatures);
    const shared = applySharedClientSignatureToDocuments(restoredForm, [template], [template.templateKey], png, undefined, signedAt);
    expect(shared.signedTemplateKeys).toEqual([]);
    expect(shared.errors[0].error).toContain('Bindung');
    expect(shared.form.intakeDocuments[0].previewHtml).toBe(legacy.previewHtml);
  });

  it('does not reinterpret an unbound finalized original as a newly verified document', () => {
    const legacy = { ...openDocumentPreview(form(), template), renderVersion: undefined, renderedAt: undefined, status: 'finalized' as const, finalizedHtml: '<p>Altes Original</p>', finalizedAt: signedAt, signatures: { client: signature } };
    const opened = openDocumentPreview(form({ intakeDocuments: [legacy] }), template);
    expect(opened.finalizedHtml).toBe(legacy.finalizedHtml);
    expect(opened.previewHtml).toBe(legacy.finalizedHtml);
    expect(opened.missingPlaceholders.join(' ')).toContain('Bindung');
    expect(finalizeDocument(legacy, template, form()).ok).toBe(false);
  });
});
