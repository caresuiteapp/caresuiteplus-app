import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  attemptDirectDocumentEdit,
  confirmDocumentPreview,
  createDocumentCancellation,
  createDocumentCorrection,
  createLifecycleDocument,
  finalizeLifecycleDocument,
  getLifecycleAuditTrail,
  getLifecycleDocument,
  resetLifecycleDocumentStore,
  resetPdfRenderJobs,
  validateLifecycleDocument,
} from '@/lib/documents';

const TENANT = DEMO_TENANT_ID;
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

describe('document lifecycle', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetLifecycleDocumentStore();
    resetPdfRenderJobs();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetLifecycleDocumentStore();
    resetPdfRenderJobs();
  });

  it('Finalisierung ohne Preview blockiert', async () => {
    const doc = createLifecycleDocument({
      tenantId: TENANT,
      title: 'Test',
      documentType: 'invoice',
    });

    const result = await finalizeLifecycleDocument(
      { ...FINALIZE_BASE, documentId: doc.id },
      ADMIN,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Live-Vorschau');
    }
  });

  it('Finalisierung ohne Pflichtfelder blockiert', async () => {
    const doc = createLifecycleDocument({
      tenantId: TENANT,
      title: 'Test',
      documentType: 'invoice',
    });
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

  it('Finalisierung erzeugt Hash', async () => {
    const doc = createLifecycleDocument({
      tenantId: TENANT,
      title: 'Rechnung Test',
      documentType: 'invoice',
    });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);

    const result = await finalizeLifecycleDocument(
      { ...FINALIZE_BASE, documentId: doc.id },
      ADMIN,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contentHash).toMatch(/^sha256:/);
      expect(result.data.documentNumber).toMatch(/^RE-/);
      expect(result.data.pdfPath).toBeTruthy();
    }
  });

  it('Finalisiertes Dokument ist gesperrt', async () => {
    const doc = createLifecycleDocument({
      tenantId: TENANT,
      title: 'Sperre Test',
      documentType: 'invoice',
    });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);
    const finalized = await finalizeLifecycleDocument(
      { ...FINALIZE_BASE, documentId: doc.id },
      ADMIN,
    );

    expect(finalized.ok).toBe(true);
    if (finalized.ok) {
      expect(finalized.data.lockedAt).toBeTruthy();
      expect(finalized.data.status).toBe('archived');
    }
  });

  it('Direkte Bearbeitung finalisierter Dokumente blockiert', async () => {
    const doc = createLifecycleDocument({
      tenantId: TENANT,
      title: 'Edit Block',
      documentType: 'invoice',
    });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);
    await finalizeLifecycleDocument({ ...FINALIZE_BASE, documentId: doc.id }, ADMIN);

    const edit = await attemptDirectDocumentEdit(TENANT, doc.id, ADMIN);
    expect(edit.ok).toBe(false);
    if (!edit.ok) {
      expect(edit.error).toContain('gesperrt');
    }
  });

  it('Korrektur erzeugt neues Dokument', async () => {
    const doc = createLifecycleDocument({
      tenantId: TENANT,
      title: 'Original',
      documentType: 'invoice',
    });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);
    await finalizeLifecycleDocument({ ...FINALIZE_BASE, documentId: doc.id }, ADMIN);

    const correction = await createDocumentCorrection(TENANT, doc.id, ADMIN);
    expect(correction.ok).toBe(true);
    if (correction.ok) {
      expect(correction.data.id).not.toBe(doc.id);
      expect(correction.data.correctedFromDocumentId).toBe(doc.id);
      expect(correction.data.status).toBe('corrected');
    }
  });

  it('Storno referenziert Ursprungsdokument', async () => {
    const doc = createLifecycleDocument({
      tenantId: TENANT,
      title: 'Zu stornieren',
      documentType: 'invoice',
    });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);
    await finalizeLifecycleDocument({ ...FINALIZE_BASE, documentId: doc.id }, ADMIN);

    const cancellation = await createDocumentCancellation(TENANT, doc.id, ADMIN);
    expect(cancellation.ok).toBe(true);
    if (cancellation.ok) {
      expect(cancellation.data.cancelledFromDocumentId).toBe(doc.id);
      expect(cancellation.data.status).toBe('cancelled');
    }
  });

  it('Audit Events werden geschrieben', async () => {
    const doc = createLifecycleDocument({
      tenantId: TENANT,
      title: 'Audit Test',
      documentType: 'invoice',
    });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);
    await validateLifecycleDocument(
      {
        tenantId: TENANT,
        documentId: doc.id,
        templateVersionId: 'dtplv-test',
        htmlTemplate: VALID_HTML,
        documentType: 'invoice',
        sampleEntityType: 'invoice',
        sampleEntityId: 'inv-demo-1',
      },
      ADMIN,
    );
    await finalizeLifecycleDocument({ ...FINALIZE_BASE, documentId: doc.id }, ADMIN);

    const trail = getLifecycleAuditTrail(TENANT, doc.id);
    const types = trail.map((e) => e.eventType);
    expect(types).toContain('document_created');
    expect(types).toContain('preview_confirmed');
    expect(types).toContain('document_finalized');
    expect(types).toContain('document_locked');
    expect(trail.length).toBeGreaterThanOrEqual(5);
  });

  it('PDF-Fehler erzeugt render_failed, nicht finalized', async () => {
    const doc = createLifecycleDocument({
      tenantId: TENANT,
      title: 'PDF Fail',
      documentType: 'invoice',
    });
    await confirmDocumentPreview(TENANT, doc.id, ADMIN);

    const result = await finalizeLifecycleDocument(
      { ...FINALIZE_BASE, documentId: doc.id, simulatePdfFailure: true },
      ADMIN,
    );

    expect(result.ok).toBe(false);
    const stored = getLifecycleDocument(TENANT, doc.id);
    expect(stored?.status).toBe('render_failed');
    expect(stored?.lockedAt).toBeNull();
    expect(stored?.contentHash).toBeNull();
  });

  it('Tenant-Isolation', () => {
    const tenantB = '00000000-0000-4000-8000-000000000099';
    const docA = createLifecycleDocument({
      tenantId: TENANT,
      title: 'Mandant A',
      documentType: 'invoice',
    });
    createLifecycleDocument({
      tenantId: tenantB,
      title: 'Mandant B',
      documentType: 'invoice',
    });

    expect(getLifecycleDocument(TENANT, docA.id)?.tenantId).toBe(TENANT);
    expect(getLifecycleDocument(tenantB, docA.id)).toBeUndefined();
  });
});
