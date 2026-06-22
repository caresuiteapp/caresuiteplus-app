import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  archiveInboxDocument,
  classifyInboxDocument,
  fetchInboxItems,
  getInboxAuditTrail,
  getInboxEntityLinks,
  getInboxReviewTasks,
  linkInboxDocument,
  prepareInboxOcr,
  resetDocumentInboxStore,
  setInboxDocumentCategory,
  uploadInboxDocument,
} from '@/lib/documents/documentInbox';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import type { DocumentInboxExecutionContext } from '@/types/documents/documentInbox';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const ROLE = 'business_admin' as const;

function baseOcrContext(
  overrides: Partial<DocumentInboxExecutionContext> = {},
): DocumentInboxExecutionContext {
  return {
    tenantId: TENANT,
    ocrProviderKey: null,
    ocrProviderActive: false,
    ocrExternalApproved: false,
    healthDataOcrApproved: false,
    environment: 'demo',
    demoMode: true,
    ...overrides,
  };
}

describe('Dokumenteneingang (Document Inbox)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetDocumentInboxStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDocumentInboxStore();
  });

  it('1. lädt Datei mit tenant_id hoch und erzeugt Audit-Eintrag', async () => {
    const result = await uploadInboxDocument(
      {
        tenantId: TENANT,
        fileName: 'rechnung.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 42_000,
        source: 'upload',
      },
      ROLE,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.tenantId).toBe(TENANT);
    expect(result.data.status).toBe('uploaded');

    const audit = await getInboxAuditTrail(TENANT, result.data.id, ROLE);
    expect(audit.ok).toBe(true);
    if (audit.ok) {
      expect(audit.data.some((e) => e.eventType === 'item_uploaded')).toBe(true);
    }
  });

  it('2. blockiert Upload ohne tenant_id', async () => {
    const result = await uploadInboxDocument(
      {
        tenantId: '',
        fileName: 'ohne-mandant.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1000,
        source: 'upload',
      },
      ROLE,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Mandant/i);
    }
  });

  it('3. blockiert externe OCR ohne Anbieter/Freigabe', async () => {
    const upload = await uploadInboxDocument(
      {
        tenantId: TENANT,
        fileName: 'scan.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 8000,
        source: 'scan_prepared',
      },
      ROLE,
    );
    expect(upload.ok).toBe(true);
    if (!upload.ok) return;

    const ocr = await prepareInboxOcr(
      {
        tenantId: TENANT,
        inboxItemId: upload.data.id,
        providerKey: 'google_vision',
        context: baseOcrContext(),
      },
      ROLE,
    );

    expect(ocr.ok).toBe(false);
    if (!ocr.ok) {
      expect(ocr.error).toMatch(/OCR-Anbieter|OCR blockiert/i);
    }

    const audit = await getInboxAuditTrail(TENANT, upload.data.id, ROLE);
    expect(audit.ok).toBe(true);
    if (audit.ok) {
      expect(audit.data.some((e) => e.eventType === 'ocr_blocked')).toBe(true);
    }
  });

  it('4. blockiert Gesundheitsdaten-OCR ohne Freigabe', async () => {
    const upload = await uploadInboxDocument(
      {
        tenantId: TENANT,
        fileName: 'pflegedokument.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 12_000,
        source: 'employee_portal',
        containsHealthData: true,
      },
      ROLE,
    );
    expect(upload.ok).toBe(true);
    if (!upload.ok) return;

    const ocr = await prepareInboxOcr(
      {
        tenantId: TENANT,
        inboxItemId: upload.data.id,
        providerKey: 'google_vision',
        context: baseOcrContext({
          ocrProviderKey: 'google_vision',
          ocrProviderActive: true,
          ocrExternalApproved: true,
          healthDataOcrApproved: false,
        }),
      },
      ROLE,
    );

    expect(ocr.ok).toBe(false);
    if (!ocr.ok) {
      expect(ocr.error).toMatch(/Gesundheitsdaten/i);
    }
  });

  it('5. erstellt Prüfauftrag statt Auto-Zuordnung bei unsicherer Klassifizierung', async () => {
    const upload = await uploadInboxDocument(
      {
        tenantId: TENANT,
        fileName: 'unklar.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 5000,
        source: 'email_kim_prepared',
      },
      ROLE,
    );
    expect(upload.ok).toBe(true);
    if (!upload.ok) return;

    const classified = await classifyInboxDocument(
      {
        tenantId: TENANT,
        inboxItemId: upload.data.id,
        suggestedCategory: 'invoice',
        suggestedEntityType: 'client',
        suggestedEntityId: 'client-ambiguous',
        confidence: 'low',
      },
      ROLE,
    );

    expect(classified.ok).toBe(true);
    if (!classified.ok) return;

    expect(classified.data.item.status).toBe('review_required');
    expect(classified.data.classification.requiresReview).toBe(true);
    expect(classified.data.reviewTask).toBeDefined();

    const links = getInboxEntityLinks(upload.data.id);
    expect(links).toHaveLength(0);

    const tasks = getInboxReviewTasks(upload.data.id);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('6. verknüpft Dokument manuell mit Klient/Einsatz nach Kategorie', async () => {
    const upload = await uploadInboxDocument(
      {
        tenantId: TENANT,
        fileName: 'vertrag.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 9000,
        source: 'admin_upload',
      },
      ROLE,
    );
    expect(upload.ok).toBe(true);
    if (!upload.ok) return;

    const category = await setInboxDocumentCategory(
      TENANT,
      upload.data.id,
      'contract',
      ROLE,
    );
    expect(category.ok).toBe(true);

    const linked = await linkInboxDocument(
      {
        tenantId: TENANT,
        inboxItemId: upload.data.id,
        entityType: 'client',
        entityId: 'client-001',
        isConfirmed: true,
      },
      ROLE,
    );

    expect(linked.ok).toBe(true);
    if (!linked.ok) return;

    expect(linked.data.item.status).toBe('linked');
    expect(getInboxEntityLinks(upload.data.id)).toHaveLength(1);
  });

  it('7. archiviert mit Audit und blockiert Live-Modus ohne Supabase-Anbindung', async () => {
    const upload = await uploadInboxDocument(
      {
        tenantId: TENANT,
        fileName: 'archiv.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 3000,
        source: 'connect_prepared',
      },
      ROLE,
    );
    expect(upload.ok).toBe(true);
    if (!upload.ok) return;

    const archived = await archiveInboxDocument(TENANT, upload.data.id, ROLE);
    expect(archived.ok).toBe(true);
    if (archived.ok) {
      expect(archived.data.status).toBe('archived');
    }

    const audit = await getInboxAuditTrail(TENANT, upload.data.id, ROLE);
    expect(audit.ok).toBe(true);
    if (audit.ok) {
      expect(audit.data.some((e) => e.eventType === 'archived')).toBe(true);
    }

    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const liveBlock = guardLiveDemoFeature(TENANT, 'Dokumenteneingang');
    expect(liveBlock?.ok).toBe(false);
    if (liveBlock && !liveBlock.ok) {
      expect(liveBlock.error).toMatch(/Live-Modus|Dokumenteneingang/i);
    }

    const crossTenant = await fetchInboxItems(OTHER_TENANT, ROLE);
    expect(crossTenant.ok).toBe(false);
  });
});
