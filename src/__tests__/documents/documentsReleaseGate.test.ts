import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type { ContractRecord } from '@/types/documents/contract';
import type { DocumentationRecord } from '@/types/documents/documentation';
import type { ServiceProofRecord } from '@/types/documents/serviceProof';
import {
  assertDocumentActionAllowed,
  buildDocumentActionGateContext,
  buildDocumentActionGateContextForRole,
  isServiceProofLocked,
} from '@/lib/documents/documentActionGate';
import {
  activateDocumentTemplateVersion,
  archiveDocumentTemplate,
  attemptDirectDocumentEdit,
  confirmDocumentPreview,
  createDocumentCorrection,
  createDocumentTemplateVersion,
  createInvoiceDraft,
  createLifecycleDocument,
  finalizeLifecycleDocument,
  getLifecycleAuditTrail,
  getLifecycleDocument,
  listDocumentTemplates,
  resetDocumentTemplateStore,
  resetInvoiceDocumentStore,
  resetLifecycleDocumentStore,
  resetPdfRenderJobs,
  runLivePreview,
  seedDocumentTemplateForTest,
  updateDocumentTemplateVersion,
  validateInvoiceForFinalization,
} from '@/lib/documents';

const TENANT = DEMO_TENANT_ID;
const TENANT_B = '00000000-0000-4000-8000-000000000099';
const ADMIN = 'business_admin' as const;

const VALID_HTML = `<h1>Rechnung {{invoice.number}}</h1>
<p>{{recipient.full_name}} — {{recipient.address}}</p>
<p>Zeitraum: {{invoice.service_period}}</p>
<p>Netto: {{invoice.net_total}} · Brutto: {{invoice.gross_total}} · Steuer: {{invoice.tax_total}}</p>
<p>Fällig: {{invoice.due_date}}</p>
<p>{{invoice.tax_notice}}</p>
<p>{{company.legal_name}} · {{company.iban}} · {{company.bank_name}} · {{company.tax_id}}</p>`;

const FINALIZE_BASE = {
  tenantId: TENANT,
  templateVersionId: 'dtplv-test',
  htmlTemplate: VALID_HTML,
  documentType: 'invoice' as const,
  sampleEntityType: 'invoice' as const,
  sampleEntityId: 'inv-demo-1',
};

function baseContract(overrides: Partial<ContractRecord> = {}): ContractRecord {
  return {
    id: 'ctr-1',
    tenantId: TENANT,
    contractType: 'kundenvertrag',
    contractNumber: 'V-2026-0001',
    status: 'draft',
    contractDate: '2026-06-15',
    logoUrl: null,
    partyA: { name: 'CareSuite GmbH', street: 'Muster 1', zip: '10115', city: 'Berlin' },
    partyB: { name: 'Helga Schneider', street: 'Weg 5', zip: '10115', city: 'Berlin' },
    companyData: {
      legalName: 'CareSuite GmbH',
      name: 'CareSuite GmbH',
      street: 'Muster 1',
      zip: '10115',
      city: 'Berlin',
      taxId: '27/123/45678',
      ikNumber: '123456789',
    },
    clientData: {
      name: 'Helga Schneider',
      street: 'Weg 5',
      zip: '10115',
      city: 'Berlin',
      customerNumber: 'K-10042',
      careLevel: 'PG 2',
    },
    legalRepresentative: null,
    serviceDescription: 'Alltagsbegleitung',
    compensation: '323,11 €',
    hourlyRate: '35,00 €',
    billingType: 'Pflegekasse',
    paymentTerms: '14 Tage',
    termStart: '2026-01-01',
    termEnd: '2026-12-31',
    noticePeriod: '4 Wochen',
    privacySection: 'DSGVO-Hinweis',
    confidentialityConsents: 'Schweigepflicht',
    liabilityClause: 'Haftungsbeschränkung',
    finalProvisions: 'Schlussbestimmungen',
    placeAndDate: 'Berlin, 15.06.2026',
    signatures: {
      companySigned: false,
      clientSigned: false,
      legalRepSigned: false,
      employeeSigned: false,
      companySignedAt: null,
      clientSignedAt: null,
      legalRepSignedAt: null,
      employeeSignedAt: null,
    },
    lockedAt: null,
    correctedFromContractId: null,
    cancelledFromContractId: null,
    lifecycleDocumentId: null,
    previewConfirmed: true,
    contentHash: null,
    version: 1,
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...overrides,
  };
}

function baseServiceProof(overrides: Partial<ServiceProofRecord> = {}): ServiceProofRecord {
  return {
    id: 'sp-1',
    tenantId: TENANT,
    proofType: 'einzel_einsatznachweis',
    proofNumber: 'LN-2026-0001',
    status: 'draft',
    logoUrl: null,
    companyName: 'CareSuite GmbH',
    serviceMonth: '06/2026',
    clientName: 'Helga Schneider',
    clientId: 'client-001',
    careLevel: 'PG 2',
    costBearer: 'AOK',
    employeeName: 'Maria Pfleger',
    deploymentDate: '2026-06-15',
    startTime: '09:00',
    endTime: '11:00',
    durationMinutes: 120,
    serviceType: 'Grundpflege',
    tasks: 'Körperpflege',
    shortDescription: 'Routineeinsatz',
    documentation: 'Verlauf unauffällig',
    deployments: [],
    totalHours: 2,
    billingAmountCents: 7000,
    budgetAllocation: 'SGB XI',
    footerText: 'Pflichtangaben Demo',
    signatures: {
      clientSigned: false,
      employeeSigned: false,
      clientSignedAt: null,
      employeeSignedAt: null,
    },
    lockedAt: null,
    contentHash: null,
    pdfPath: null,
    lifecycleDocumentId: null,
    previewConfirmed: true,
    version: 1,
    correctedFromProofId: null,
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...overrides,
  };
}

function baseDocumentation(overrides: Partial<DocumentationRecord> = {}): DocumentationRecord {
  return {
    id: 'doc-1',
    tenantId: TENANT,
    documentationType: 'notfallprotokoll',
    documentNumber: 'NP-2026-0001',
    status: 'draft',
    documentDate: '2026-06-15',
    documentTime: '14:30',
    clientName: 'Helga Schneider',
    clientId: 'client-001',
    employeeName: 'Maria Pfleger',
    occasion: 'Sturz',
    observation: 'Klientin gestürzt, keine sichtbaren Verletzungen',
    measure: 'Erste Hilfe, Arzt informiert',
    result: 'Stabil',
    specialNotes: '',
    risks: 'Sturzrisiko',
    referralRequired: false,
    referralRecipient: '',
    contentText: 'Notfall dokumentiert',
    digitalSignature: null,
    signedAt: null,
    auditStatus: 'pending',
    lockedAt: null,
    contentHash: null,
    lifecycleDocumentId: null,
    previewConfirmed: true,
    version: 1,
    correctedFromDocumentationId: null,
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
    ...overrides,
  };
}

describe('Documents Release Gate & Acceptance', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetDocumentTemplateStore();
    resetLifecycleDocumentStore();
    resetInvoiceDocumentStore();
    resetPdfRenderJobs();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDocumentTemplateStore();
    resetLifecycleDocumentStore();
    resetInvoiceDocumentStore();
    resetPdfRenderJobs();
  });

  it('1. Vorlage anlegen', async () => {
    const { template } = seedDocumentTemplateForTest(TENANT, { title: 'Neue Rechnungsvorlage' });
    const list = await listDocumentTemplates(TENANT, ADMIN);
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.data.some((t) => t.id === template.id)).toBe(true);
    }
  });

  it('2. Vorlage versionieren', async () => {
    const { template } = seedDocumentTemplateForTest(TENANT);
    const version = await createDocumentTemplateVersion(TENANT, template.id, ADMIN);
    expect(version.ok).toBe(true);
    if (version.ok) expect(version.data.versionNumber).toBeGreaterThan(1);
  });

  it('3. Vorlage aktiv setzen', async () => {
    const { template, version } = seedDocumentTemplateForTest(TENANT, {
      htmlTemplate: '<p>{{company.name}} — {{invoice.number}}</p>',
    });

    await runLivePreview({ tenantId: TENANT, templateId: template.id, versionId: version.id, sampleId: 'sample-demo' }, ADMIN);

    const activated = await activateDocumentTemplateVersion(TENANT, version.id, ADMIN);
    expect(activated.ok).toBe(true);
    if (activated.ok) expect(activated.data.versionStatus).toBe('active');
  });

  it('4. Vorlage archivieren', async () => {
    const { template } = seedDocumentTemplateForTest(TENANT);
    const archived = await archiveDocumentTemplate(TENANT, template.id, ADMIN);
    expect(archived.ok).toBe(true);
    if (archived.ok) expect(archived.data.templateStatus).toBe('archived');
  });

  it('5. Live-Vorschau mit echten Daten', async () => {
    const { template } = seedDocumentTemplateForTest(TENANT, {
      htmlTemplate: '<p>{{recipient.full_name}} · {{invoice.number}}</p>',
    });
    const preview = await runLivePreview(
      { tenantId: TENANT, templateId: template.id, sampleId: 'sample-demo' },
      ADMIN,
    );
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.data.html).toContain('Helga');
      expect(preview.data.source).toBeTruthy();
    }
  });

  it('6. Fehlende Pflichtfelder blockieren Finalisierung', async () => {
    const doc = createLifecycleDocument({ tenantId: TENANT, title: 'Test', documentType: 'invoice' });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);

    const result = await finalizeLifecycleDocument(
      {
        ...FINALIZE_BASE,
        documentId: doc.id,
        htmlTemplate: '<p>{{unknown.placeholder}}</p>',
      },
      ADMIN,
    );

    expect(result.ok).toBe(false);
  });

  it('7. Unbekannte Platzhalter blockieren Aktivierung', () => {
    const gate = assertDocumentActionAllowed(
      'activate_template',
      null,
      { htmlTemplate: '<p>{{unknown.field.xyz}}</p>', versionStatus: 'draft' },
      buildDocumentActionGateContext({
        tenantId: TENANT,
        role: ADMIN,
        userId: 'user-1',
        hasLivePreview: true,
        validation: { status: 'valid', issues: [] },
      }),
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe('unknown_placeholders');
  });

  it('8. Rechnungspflichtfelder blockieren', () => {
    const inv = createInvoiceDraft({ tenantId: TENANT, taxMode: 'ustg_4_16_exempt' });
    const check = validateInvoiceForFinalization(TENANT, inv.id);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.data.validation.status).toBe('error');

    const gate = assertDocumentActionAllowed(
      'finalize',
      { previewConfirmed: false },
      null,
      {
        ...buildDocumentActionGateContextForRole(TENANT, ADMIN),
        invoiceRecord: { ...inv, invoiceNumber: null, previewConfirmed: false },
      },
    );
    expect(gate.allowed).toBe(false);
  });

  it('9. Vertragspflichtfelder blockieren', () => {
    const gate = assertDocumentActionAllowed(
      'finalize',
      { previewConfirmed: true },
      null,
      {
        ...buildDocumentActionGateContextForRole(TENANT, ADMIN),
        contractRecord: baseContract({ partyB: { name: '', street: '', zip: '', city: '' } }),
      },
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe('contract_validation_failed');
  });

  it('10. Leistungsnachweis nach Signatur gesperrt', () => {
    const signed = baseServiceProof({
      status: 'signed',
      lockedAt: '2026-06-15T10:00:00.000Z',
      signatures: { clientSigned: true, employeeSigned: true, clientSignedAt: '2026-06-15T10:00:00.000Z', employeeSignedAt: null },
    });
    expect(isServiceProofLocked(signed)).toBe(true);

    const gate = assertDocumentActionAllowed(
      'edit_document',
      { status: 'signed', lockedAt: signed.lockedAt },
      null,
      { ...buildDocumentActionGateContextForRole(TENANT, ADMIN), serviceProofRecord: signed },
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe('service_proof_locked');
  });

  it('11. Finalisiertes Dokument nicht bearbeitbar', async () => {
    const doc = createLifecycleDocument({ tenantId: TENANT, title: 'Lock test', documentType: 'invoice' });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);
    await finalizeLifecycleDocument({ ...FINALIZE_BASE, documentId: doc.id }, ADMIN);

    const edit = await attemptDirectDocumentEdit(TENANT, doc.id, ADMIN);
    expect(edit.ok).toBe(false);
  });

  it('12. Korrektur erzeugt neue Version', async () => {
    const doc = createLifecycleDocument({ tenantId: TENANT, title: 'Correction', documentType: 'invoice' });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);
    await finalizeLifecycleDocument({ ...FINALIZE_BASE, documentId: doc.id }, ADMIN);

    const correction = await createDocumentCorrection(TENANT, doc.id, ADMIN);
    expect(correction.ok).toBe(true);
    if (correction.ok) {
      expect(correction.data.correctedFromDocumentId).toBe(doc.id);
      expect(correction.data.status).toBe('corrected');
      expect(correction.data.id).not.toBe(doc.id);
    }
  });

  it('13. Audit Event wird geschrieben', async () => {
    const doc = createLifecycleDocument({ tenantId: TENANT, title: 'Audit', documentType: 'invoice' });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);
    await finalizeLifecycleDocument({ ...FINALIZE_BASE, documentId: doc.id }, ADMIN);

    const trail = getLifecycleAuditTrail(TENANT, doc.id);
    expect(trail.some((e) => e.eventType === 'document_finalized')).toBe(true);
    expect(trail.some((e) => e.eventType === 'document_locked')).toBe(true);
  });

  it('14. Mandant A sieht nicht Dokumente von Mandant B', async () => {
    seedDocumentTemplateForTest(TENANT, { id: 'dtpl-tenant-a-only' });
    seedDocumentTemplateForTest(TENANT_B, { id: 'dtpl-tenant-b-only' });

    const listA = await listDocumentTemplates(TENANT, ADMIN);
    expect(listA.ok).toBe(true);
    if (listA.ok) {
      expect(listA.data.every((t) => t.tenantId === TENANT)).toBe(true);
      expect(listA.data.some((t) => t.id === 'dtpl-tenant-b-only')).toBe(false);
    }

    const gate = assertDocumentActionAllowed(
      'view',
      null,
      null,
      buildDocumentActionGateContext({ tenantId: TENANT, role: ADMIN, userId: 'u1', templateTenantId: TENANT_B }),
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe('tenant_mismatch');
  });

  it('15. Production Mode blockiert Demo-Daten', () => {
    const gate = assertDocumentActionAllowed(
      'finalize',
      { previewConfirmed: true },
      null,
      buildDocumentActionGateContext({
        tenantId: TENANT,
        role: ADMIN,
        userId: 'u1',
        environment: 'production',
        demoMode: true,
        usesDemoContext: true,
      }),
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe('production_demo_blocked');
  });

  it('16. PDF-Fehler blockiert Finalisierung', async () => {
    const doc = createLifecycleDocument({ tenantId: TENANT, title: 'PDF fail', documentType: 'invoice' });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);

    const result = await finalizeLifecycleDocument(
      { ...FINALIZE_BASE, documentId: doc.id, simulatePdfFailure: true },
      ADMIN,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('PDF');
  });

  it('Notfallprotokoll verlangt Anlass/Beschreibung', () => {
    const gate = assertDocumentActionAllowed(
      'finalize',
      { previewConfirmed: true },
      null,
      {
        ...buildDocumentActionGateContextForRole(TENANT, ADMIN),
        documentationRecord: baseDocumentation({ occasion: '', observation: '', contentText: '' }),
      },
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe('documentation_validation_failed');
  });

  it('Standardvorlagen existieren (Demo-Seed)', async () => {
    const list = await listDocumentTemplates(TENANT, ADMIN);
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.length).toBeGreaterThan(0);
  });

  it('Gate blockiert ohne Login', () => {
    const gate = assertDocumentActionAllowed(
      'edit_template',
      null,
      { versionStatus: 'draft' },
      buildDocumentActionGateContext({ tenantId: TENANT, role: ADMIN, userId: null }),
    );
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.code).toBe('missing_user');
  });

  it('Systemvorlage geschützt — Mandant bearbeitet Kopie', () => {
    const systemGate = assertDocumentActionAllowed(
      'edit_template',
      null,
      { versionStatus: 'active' },
      buildDocumentActionGateContext({
        tenantId: TENANT,
        role: ADMIN,
        userId: 'u1',
        isSystemTemplate: true,
        isSystemTemplateCopy: false,
      }),
    );
    expect(systemGate.allowed).toBe(false);

    const copyGate = assertDocumentActionAllowed(
      'edit_template',
      null,
      { versionStatus: 'draft' },
      buildDocumentActionGateContext({
        tenantId: TENANT,
        role: ADMIN,
        userId: 'u1',
        isSystemTemplate: true,
        isSystemTemplateCopy: true,
      }),
    );
    expect(copyGate.allowed).toBe(true);
  });

  it('Archivierte Vorlage nicht bearbeitbar', async () => {
    const { template, version } = seedDocumentTemplateForTest(TENANT);
    await archiveDocumentTemplate(TENANT, template.id, ADMIN);

    const edit = await updateDocumentTemplateVersion(
      TENANT,
      version.id,
      { htmlTemplate: '<p>Geändert</p>' },
      ADMIN,
    );
    expect(edit.ok).toBe(false);
  });
});
