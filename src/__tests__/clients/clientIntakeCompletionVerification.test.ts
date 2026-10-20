import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM, type ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { INTAKE_DOCUMENT_SYSTEM_TEMPLATES } from '@/features/intakeDocuments/intakeDocumentSystemTemplates';
import { listApplicableIntakeTemplates, type IntakeTenantDisplay } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { applyDocumentSignature, finalizeDocument, openDocumentPreview, updateIntakeDocumentInForm } from '@/features/intakeDocuments/intakeDocumentService';
import { mapSystemRow, mapTenantRow, type SystemTemplateRow, type TenantTemplateRow } from '@/features/intakeDocuments/intakeTemplateMapping';
import { requireCompleteIntakeForm, requireIntakePng, verifyIntakeCompletionDocuments, type IntakeTemplateRow } from '@/features/intakeDocuments/intakeCompletionVerification';
import type { IntakeDocumentTemplate } from '@/features/intakeDocuments/intakeDocumentTypes';
import { prepareIntakeDocumentPackage, signIntakeDocumentPackage } from '@/features/intakeDocuments/intakeDocumentPackage';

const NOW = '2026-10-14T12:30:00.000Z';
const UPDATED_AT = '2026-10-13T09:00:00.000Z';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const TENANT: IntakeTenantDisplay = { name: 'Pflegedienst Lindenhof GmbH', street: 'Lindenstraße 14', zip: '10115', city: 'Berlin', defaultHourlyRate: '42,50' };
const CONTRACT = 'client_contract_assist';

type StoredSystemRow = SystemTemplateRow & IntakeTemplateRow & { updated_at: string };
type StoredTenantRow = TenantTemplateRow & IntakeTemplateRow & { updated_at: string };

function systemRows(): StoredSystemRow[] {
  return INTAKE_DOCUMENT_SYSTEM_TEMPLATES.map((template) => ({
    id: template.id, template_key: template.templateKey, title: template.title,
    document_type: template.documentType, service_type: template.serviceType,
    version: template.version, is_required: template.isRequired, is_active: template.isActive,
    requires_client_signature: template.requiresClientSignature,
    requires_employee_signature: template.requiresEmployeeSignature,
    requires_representative_signature: template.requiresRepresentativeSignature,
    allows_custom_template: template.allowsCustomTemplate, html_content: template.htmlContent,
    plain_text_content: template.plainTextContent, placeholder_schema: structuredClone(template.placeholderSchema),
    signature_slots: structuredClone(template.signatureSlots), updated_at: UPDATED_AT,
  }));
}

function completeForm(overrides: Partial<ClientIntakeFormData> = {}): ClientIntakeFormData {
  return {
    ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), firstName: 'Helga', lastName: 'Schneider', salutation: 'frau',
    dateOfBirth: '1945-03-12', street: 'Musterweg', houseNumber: '5', zip: '10115', city: 'Berlin',
    phone: '030123456', serviceStart: '2026-10-15', admissionDate: '2026-10-14',
    careContexts: ['daily_assistance'], careLevel: 'pg2', supportWishes: ['haushalt'],
    fundingSources: ['entlastungsleistung', 'selbstzahler'], selfPay: true,
    billingType: 'kombi', billingTypes: ['kombi'], costBearerTypes: ['pflegekasse'],
    costBearerType: 'pflegekasse', activeCostBearerType: 'pflegekasse',
    careFundName: 'Test Pflegekasse', insuranceNumber: 'A123456789', costBearerIk: '123456789',
    intakeContractType: 'assist', hourlyRate: '42,50',
    ...overrides,
  };
}

function tenantRow(system: StoredSystemRow): StoredTenantRow {
  return {
    id: '22222222-2222-4222-8222-222222222222', tenant_id: '11111111-1111-4111-8111-111111111111',
    system_template_id: system.id, template_key: system.template_key, title: 'Lindenhof Aufnahmevertrag',
    document_type: system.document_type, service_type: system.service_type,
    html_content: system.html_content + '<p>Eigene Vereinbarung des Lindenhofs.</p>',
    is_default: true, is_active: true, updated_at: '2026-10-14T08:00:00.000Z',
  };
}

function signedForm(form: ClientIntakeFormData, systems: StoredSystemRow[], tenants: StoredTenantRow[] = [], signaturePng = PNG): ClientIntakeFormData {
  const templates: IntakeDocumentTemplate[] = systems.map((row) => {
    const system = mapSystemRow(row);
    const tenant = tenants.find((entry) => entry.template_key === row.template_key && entry.is_active);
    return tenant ? mapTenantRow(tenant, system)! : system;
  });
  let result = { ...form, intakeDocuments: [] as ClientIntakeFormData['intakeDocuments'] };
  for (const template of listApplicableIntakeTemplates(result, templates)) {
    let document = openDocumentPreview(result, template, TENANT);
    for (const slot of template.signatureSlots.filter((entry) => entry.required)) {
      document = applyDocumentSignature(document, template, result, slot.role, {
        role: slot.role, dataUrl: signaturePng, signedAt: NOW, signerName: slot.role === 'client' ? 'Helga Schneider' : 'Maria Pflege',
      }, TENANT);
    }
    const finalized = finalizeDocument(document, template, result, TENANT);
    if (!finalized.ok) throw new Error(`Fixture ${template.templateKey}: ${finalized.error}`);
    result = updateIntakeDocumentInForm(result, finalized.document);
  }
  return result;
}

function fixture(options: { form?: Partial<ClientIntakeFormData>; ownTemplate?: boolean } = {}) {
  const systems = systemRows();
  const tenants = options.ownTemplate ? [tenantRow(systems.find((row) => row.template_key === CONTRACT)!)] : [];
  return {
    form: signedForm(completeForm(options.form), systems, tenants), systemTemplates: systems,
    tenantTemplates: tenants, tenantDisplay: { ...TENANT }, now: Date.parse(NOW),
  };
}

function pngUrl(bytes: Uint8Array): string { return 'data:image/png;base64,' + Buffer.from(bytes).toString('base64'); }

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { vi.useRealTimers(); });

describe('server intake completion verification', () => {
  it('accepts the new jointly signed package with both roles through the unchanged server verifier', async () => {
    const form = completeForm({ intakeAssignmentEnabled: true, intakeOptionalConsents: ['communication_consent_default'] });
    const systems = systemRows(), templates = systems.map(mapSystemRow);
    const prepared = prepareIntakeDocumentPackage(form, templates, TENANT);
    expect(prepared.issues).toEqual([]);
    const signed = signIntakeDocumentPackage(prepared.form, templates, prepared.documents, {
      client: { role: 'client', dataUrl: PNG, signedAt: NOW }, employee: { role: 'employee', dataUrl: PNG, signedAt: NOW },
    }, TENANT);
    expect(signed.ok).toBe(true); if (!signed.ok) return;
    const verified = await verifyIntakeCompletionDocuments({ form: signed.form, systemTemplates: systems, tenantTemplates: [], tenantDisplay: TENANT, now: Date.parse(NOW) });
    expect(verified).toHaveLength(4);
    expect(verified.map(document => document.finalizedHtml)).toEqual(signed.form.intakeDocuments.map(document => document.finalizedHtml));
  });
  it('accepts exact originals from complete form, mapped database templates and real PNGs without rewriting them', async () => {
    const input = fixture({ form: { intakeAssignmentEnabled: true, intakeOptionalConsents: ['communication_consent_default'] } });
    const before = structuredClone(input);
    const documents = await verifyIntakeCompletionDocuments(input);
    expect(documents).toHaveLength(4);
    for (const document of documents) {
      const original = input.form.intakeDocuments.find((entry) => entry.templateKey === document.templateKey)!;
      expect(document.previewHtml).toBe(original.previewHtml);
      expect(document.finalizedHtml).toBe(original.finalizedHtml);
      expect(document.signatures).toBe(original.signatures);
      expect(document.renderedAt).toBe(NOW);
      expect(document.finalizedAt).toBe(NOW);
      expect(document.contentHash).toBe('sha256:' + createHash('sha256').update(original.finalizedHtml!).digest('hex'));
      expect(document.systemTemplateSnapshot).toBe(input.systemTemplates.find((row) => row.template_key === document.templateKey));
      expect(document.templateUpdatedAt).toBe(UPDATED_AT);
      expect(document.tenantTemplateSnapshot).toBeNull();
    }
    expect(input).toEqual(before);
  });

  it('accepts a self-pay intake without a statutory insurance number', async () => {
    const input = fixture({ form: {
      fundingSources: ['selbstzahler'], selfPay: true, billingType: 'selbstzahler', billingTypes: ['selbstzahler'],
      costBearerTypes: ['selbstzahler'], costBearerType: 'selbstzahler', activeCostBearerType: 'selbstzahler',
      selbstzahlerName: 'Helga Schneider', insuranceNumber: '', careFundName: '', costBearerIk: '',
    } });
    await expect(verifyIntakeCompletionDocuments(input)).resolves.toHaveLength(2);
  });

  it.each([
    ['person', { firstName: 'Geändert' }], ['address', { street: 'Andere Straße' }], ['rate', { hourlyRate: '89,00' }],
  ])('rejects changed %s data after signing', async (_label, change) => {
    const input = fixture(); Object.assign(input.form, change);
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow('Original stimmt nicht mehr');
  });

  it.each(['name', 'street', 'city'] as const)('rejects changed tenant %s used in the signed document', async (key) => {
    const input = fixture(); input.tenantDisplay[key] = 'Geändert';
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow('Original stimmt nicht mehr');
  });

  it.each(['preview', 'final', 'both'] as const)('rejects altered %s HTML even when both stored bodies are made equal', async (target) => {
    const input = fixture(), document = input.form.intakeDocuments[0];
    if (target !== 'final') document.previewHtml += '<p>Änderung</p>';
    if (target !== 'preview') document.finalizedHtml += '<p>Änderung</p>';
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow(target === 'both' ? 'Original stimmt nicht mehr' : 'Originalfassung fehlt');
  });

  it.each(['html_content', 'version', 'title'] as const)('rejects changed current system template %s', async (field) => {
    const input = fixture(), system = input.systemTemplates.find((row) => row.template_key === CONTRACT)!;
    if (field === 'version') system.version += 1;
    else system[field] += ' Geändert';
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow(field === 'html_content' ? 'Original stimmt nicht mehr' : 'Vorlage hat sich geändert');
  });

  it('rejects a previously signed document without the deterministic render binding, preserving its original', async () => {
    const input = fixture(), document = input.form.intakeDocuments[0];
    delete document.renderVersion; delete document.renderedAt;
    const original = structuredClone(document);
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow('keine verifizierbare Bindung');
    expect(document).toEqual(original);
  });

  it('requires each mandatory signature even if forged finalized HTML still contains its picture', async () => {
    const input = fixture(), document = input.form.intakeDocuments.find((entry) => entry.templateKey === CONTRACT)!;
    delete document.signatures.employee;
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow('erforderliche Unterschrift fehlt');
  });

  it('rejects signature role substitution and undeclared representative signatures', async () => {
    const swapped = fixture(); swapped.form.intakeDocuments[0].signatures.client!.role = 'employee';
    await expect(verifyIntakeCompletionDocuments(swapped)).rejects.toThrow('Unterschriftsrolle');
    const added = fixture(); added.form.intakeDocuments[0].signatures.legal_representative = { role: 'legal_representative', dataUrl: PNG, signedAt: NOW };
    await expect(verifyIntakeCompletionDocuments(added)).rejects.toThrow('Unterschriftsrolle');
  });

  it('uses an active tenant override and retains both current template snapshots', async () => {
    const input = fixture({ ownTemplate: true });
    const documents = await verifyIntakeCompletionDocuments(input);
    const contract = documents.find((document) => document.templateKey === CONTRACT)!;
    expect(contract.source).toBe('tenant');
    expect(contract.tenantTemplateId).toBe(input.tenantTemplates[0].id);
    expect(contract.finalizedHtml).toContain('Eigene Vereinbarung des Lindenhofs.');
    expect(contract.templateUpdatedAt).toBe(input.tenantTemplates[0].updated_at);
    expect(contract.systemTemplateUpdatedAt).toBe(UPDATED_AT);
    expect(contract.tenantTemplateSnapshot).toBe(input.tenantTemplates[0]);
  });

  it('rejects a system original if an active tenant override now takes precedence', async () => {
    const input = fixture(); input.tenantTemplates.push(tenantRow(input.systemTemplates.find((row) => row.template_key === CONTRACT)!));
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow('verwendete Dokumentvorlage ist nicht verfügbar');
  });

  it.each(['missing', 'id', 'html'] as const)('rejects %s tenant override changes without substituting the system original', async (change) => {
    const input = fixture({ ownTemplate: true });
    if (change === 'missing') input.tenantTemplates = [];
    else if (change === 'id') input.tenantTemplates[0].id = '33333333-3333-4333-8333-333333333333';
    else input.tenantTemplates[0].html_content += '<p>Nachträgliche Klausel</p>';
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow(change === 'html' ? 'Original stimmt nicht mehr' : 'verwendete Dokumentvorlage ist nicht verfügbar');
  });

  it('rejects missing, duplicated or newly selected mandatory documents', async () => {
    const removed = fixture(); removed.form.intakeDocuments.pop();
    await expect(verifyIntakeCompletionDocuments(removed)).rejects.toThrow('Dokumentauswahl');
    const duplicated = fixture(); duplicated.form.intakeDocuments[1] = structuredClone(duplicated.form.intakeDocuments[0]);
    await expect(verifyIntakeCompletionDocuments(duplicated)).rejects.toThrow('fehlt oder ist doppelt');
    const selected = fixture(); selected.form.intakeAssignmentEnabled = true;
    await expect(verifyIntakeCompletionDocuments(selected)).rejects.toThrow('Dokumentauswahl');
  });

  it('rejects inconsistent funding flags and incomplete real intake fields', () => {
    expect(() => requireCompleteIntakeForm(completeForm({ selfPay: false }))).toThrow('Finanzierungsarten');
    expect(() => requireCompleteIntakeForm(completeForm({ billingType: 'pflegekasse' }))).toThrow('Finanzierungsarten');
    expect(() => requireCompleteIntakeForm(completeForm({ billingTypes: ['kombi', 'selbstzahler'] }))).toThrow('Finanzierungsarten');
    expect(() => requireCompleteIntakeForm(completeForm({ supportWishes: [] }))).toThrow('Gewünschte Unterstützung');
    expect(() => requireCompleteIntakeForm(completeForm({ phone: '' }))).toThrow('Telefon, Mobil oder E-Mail');
    expect(() => requireCompleteIntakeForm(completeForm({ zip: 'ABC' }))).toThrow('fünfstellige PLZ');
  });

  it.each([
    ['before preview', '2026-10-14T12:28:59.000Z'],
    ['after completion', '2026-10-14T12:30:02.000Z'],
    ['future', '2026-10-15T12:30:00.000Z'],
    ['without timezone', '2026-10-14T12:30:00'],
  ])('rejects signature time %s', async (_label, signedAt) => {
    const input = fixture(); input.form.intakeDocuments[0].signatures.client!.signedAt = signedAt;
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow(/zeitpunkt|zeitlich/i);
  });
});

describe('intake PNG original verification', () => {
  it('returns the exact bytes of a valid PNG', () => {
    expect(requireIntakePng(PNG)).toEqual(new Uint8Array(Buffer.from(PNG.slice(22), 'base64')));
  });

  it.each([
    'data:image/svg+xml;base64,PHN2Zz4=', 'https://example.org/signature.png',
    'data:image/png;base64,abc" onerror="alert(1)', PNG + '\n', 'data:image/png;base64,abc',
  ])('rejects injected, remote, malformed or incomplete signature input %#', async (dataUrl) => {
    expect(() => requireIntakePng(dataUrl)).toThrow();
    const input = fixture(); input.form.intakeDocuments[0].signatures.client!.dataUrl = dataUrl;
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow();
  });

  it('rejects truncation, CRC corruption, missing image data and appended bytes', () => {
    const original = requireIntakePng(PNG);
    expect(() => requireIntakePng(pngUrl(original.slice(0, -1)))).toThrow();
    const corrupt = original.slice(); corrupt[45] ^= 1;
    expect(() => requireIntakePng(pngUrl(corrupt))).toThrow('beschädigt');
    const noImage = new Uint8Array([...original.slice(0, 33), ...original.slice(-12)]);
    expect(() => requireIntakePng(pngUrl(noImage))).toThrow();
    expect(() => requireIntakePng(pngUrl(new Uint8Array([...original, 0])))).toThrow('Signaturbildstruktur');
  });

  it.each([
    ['broken deflate stream', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQAAGNk+A8AAQUBASvKT1AAAAAASUVORK5CYII='],
    ['short scanline', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg=='],
    ['invalid scanline filter', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNl+A8AAREBBWRUW6oAAAAASUVORK5CYII='],
    ['long scanline', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAADElEQVR4nGNg+M8AAAICAQB7CYF4AAAAAElFTkSuQmCC'],
  ])('rejects CRC-correct PNG with %s even when its stored HTML exactly matches', async (_label, base64) => {
    // These 1x1 grayscale/alpha PNGs have valid chunk CRCs, but invalid pixel streams.
    const dataUrl = 'data:image/png;base64,' + base64;
    expect(() => requireIntakePng(dataUrl)).not.toThrow();
    const input = fixture();
    input.form = signedForm(completeForm(), input.systemTemplates, [], dataUrl);
    await expect(verifyIntakeCompletionDocuments(input)).rejects.toThrow(/Unterschrift|Bild|Signatur/i);
  });
});
