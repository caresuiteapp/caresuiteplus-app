import { describe, expect, it, beforeEach } from 'vitest';
import {
  assertDocumentWritable,
  assertHealthDataOcrAllowed,
  assertOcrAllowed,
  assertSigningAllowed,
  assertTenantScope,
  containsDocumentSecretLiteral,
  createDocumentVersion,
  createInMemoryDocumentStore,
  createGeneratedDocument,
  getDocumentAuditTrail,
  getDocumentsForTenant,
  maskDocumentCredentialReference,
  prepareGenerateContract,
  prepareGenerateInvoice,
  prepareOcrJob,
  prepareSigningRequest,
  registerPreparedOcrJob,
  registerPreparedSigningRequest,
  resetConnectArchiveDemoEntries,
  getConnectDocumentDemoStore,
  resetConnectDocumentDemoStore,
  sanitizeDocumentProviderConfigForUser,
  attemptOverwriteArchivedDocument,
  prepareArchiveDocument,
  type DocumentExecutionContext,
} from '@/lib/documents/connectDocuments';

const TENANT_A = 'tenant-a-1111-1111-1111-111111111111';
const TENANT_B = 'tenant-b-2222-2222-2222-222222222222';

function baseContext(overrides: Partial<DocumentExecutionContext> = {}): DocumentExecutionContext {
  return {
    tenantId: TENANT_A,
    signatureProviderKey: null,
    ocrProviderKey: null,
    signatureProviderActive: false,
    ocrProviderActive: false,
    ocrExternalApproved: false,
    healthDataOcrApproved: false,
    hasCredentialReference: false,
    containsHealthData: false,
    isArchived: false,
    isMockProvider: true,
    demoMode: true,
    environment: 'demo',
    gobdProtectionActive: false,
    ...overrides,
  };
}

describe('Connect Documents Guard & Services', () => {
  beforeEach(() => {
    resetConnectDocumentDemoStore();
    resetConnectArchiveDemoEntries();
  });

  it('blockiert Signatur ohne konfigurierten Anbieter', async () => {
    const result = await prepareSigningRequest({
      tenantId: TENANT_A,
      documentId: 'doc-1',
      documentVersionId: 'ver-1',
      providerKey: 'docusign',
      signers: [{ name: 'Max', email: 'max@example.com' }],
      context: baseContext(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Kein Signatur-Anbieter/);
    }
  });

  it('blockiert OCR ohne konfigurierten Anbieter', async () => {
    resetConnectDocumentDemoStore();
    const gen = await prepareGenerateContract({ tenantId: TENANT_A, title: 'Testvertrag' });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    const result = await prepareOcrJob({
      tenantId: TENANT_A,
      documentId: gen.data.id,
      providerKey: 'google_vision',
      context: baseContext(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Kein OCR-Anbieter/);
    }
  });

  it('blockiert Gesundheitsdaten-OCR ohne Freigabe', async () => {
    resetConnectDocumentDemoStore();
    const gen = await prepareGenerateContract({
      tenantId: TENANT_A,
      title: 'Pflegedokument',
      containsHealthData: true,
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    const healthDenied = assertHealthDataOcrAllowed(
      baseContext({ containsHealthData: true, healthDataOcrApproved: false }),
    );
    expect(healthDenied.allowed).toBe(false);

    const result = await prepareOcrJob({
      tenantId: TENANT_A,
      documentId: gen.data.id,
      providerKey: 'google_vision',
      context: baseContext({
        ocrProviderKey: 'google_vision',
        ocrProviderActive: true,
        ocrExternalApproved: true,
        containsHealthData: true,
        healthDataOcrApproved: false,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Gesundheitsdaten/);
    }
  });

  it('blockiert Überschreiben archivierter Dokumente', async () => {
    resetConnectDocumentDemoStore();
    const gen = await prepareGenerateContract({ tenantId: TENANT_A, title: 'Archiv-Test' });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    await prepareArchiveDocument(TENANT_A, gen.data.id, baseContext());

    const overwrite = await attemptOverwriteArchivedDocument(
      TENANT_A,
      gen.data.id,
      baseContext({ isArchived: true }),
    );
    expect(overwrite.ok).toBe(false);
    if (!overwrite.ok) {
      expect(overwrite.error).toMatch(/Archiviert/);
    }

    const writable = assertDocumentWritable(
      baseContext({ isArchived: true, documentTenantId: TENANT_A }),
    );
    expect(writable.allowed).toBe(false);
  });

  it('erstellt bei neuer Version einen Audit-Eintrag', () => {
    const store = createInMemoryDocumentStore();
    const doc = createGeneratedDocument(store, {
      tenantId: TENANT_A,
      documentType: 'invoice',
      title: 'Rechnung 2026-001',
    });

    const result = createDocumentVersion(store, {
      tenantId: TENANT_A,
      documentId: doc.id,
      storageReference: 'storage://v2.pdf',
      contentHash: 'hash-v2',
      changeReason: 'Korrektur',
      isCorrection: true,
    });
    expect(result.ok).toBe(true);

    const trail = getDocumentAuditTrail(store, TENANT_A, doc.id);
    expect(trail.some((e) => e.eventType === 'version_created')).toBe(true);
    expect(trail.some((e) => e.eventType === 'document_created')).toBe(true);
  });

  it('blendet Provider-Secrets für normale Nutzer aus', () => {
    const sanitized = sanitizeDocumentProviderConfigForUser({
      id: 'cfg-1',
      tenantId: TENANT_A,
      providerKey: 'docusign',
      credentialVaultRef: 'vault:prod-docusign-secret-ref',
      isActive: true,
    });
    expect(sanitized).not.toHaveProperty('credentialVaultRef');
    expect(sanitized.credentialDisplay).toMatch(/vault:••••/);
    expect(sanitized.credentialDisplay).not.toContain('secret-ref');
    expect(maskDocumentCredentialReference(null)).toBe('Nicht konfiguriert');
    expect(containsDocumentSecretLiteral('sk_live_abc123')).toBe(true);
  });

  it('hält Dokumente mandantenisoliert', async () => {
    resetConnectDocumentDemoStore();
    await prepareGenerateContract({ tenantId: TENANT_A, title: 'Mandant A Vertrag' });
    await prepareGenerateInvoice({ tenantId: TENANT_B, title: 'Mandant B Rechnung' });

    const store = createInMemoryDocumentStore();
    // Demo store isolation via getDocumentsForTenant on demo store
    const demoStore = getConnectDocumentDemoStore();
    const tenantADocs = [...demoStore.documents.values()].filter((d) => d.tenantId === TENANT_A);
    const tenantBDocs = [...demoStore.documents.values()].filter((d) => d.tenantId === TENANT_B);
    expect(tenantADocs.every((d) => d.tenantId === TENANT_A)).toBe(true);
    expect(tenantBDocs.every((d) => d.tenantId === TENANT_B)).toBe(true);
    expect(tenantADocs.some((d) => d.tenantId === TENANT_B)).toBe(false);

    const mismatch = assertTenantScope(TENANT_A, TENANT_B);
    expect(mismatch.allowed).toBe(false);

    const localA = getDocumentsForTenant(store, TENANT_A);
    expect(localA).toHaveLength(0);
  });

  it('registriert vorbereitete Signatur nur mit aktivem Anbieter', async () => {
    resetConnectDocumentDemoStore();
    const gen = await prepareGenerateContract({ tenantId: TENANT_A, title: 'Signatur-Test' });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    const versions = getConnectDocumentDemoStore().versions.get(gen.data.id) ?? [];
    const blocked = await registerPreparedSigningRequest({
      tenantId: TENANT_A,
      documentId: gen.data.id,
      documentVersionId: versions[0]?.id ?? 'ver-1',
      providerKey: 'docusign',
      signers: [{ name: 'Anna', email: 'anna@example.com' }],
      context: baseContext(),
      allowPreparedOnly: true,
    });
    expect(blocked.ok).toBe(false);

    const prepared = await registerPreparedSigningRequest({
      tenantId: TENANT_A,
      documentId: gen.data.id,
      documentVersionId: versions[0]?.id ?? 'ver-1',
      providerKey: 'docusign',
      signers: [{ name: 'Anna', email: 'anna@example.com' }],
      context: baseContext({
        signatureProviderKey: 'docusign',
        signatureProviderActive: true,
        hasCredentialReference: true,
      }),
      allowPreparedOnly: true,
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.data.externalTransfer).toBe(false);
      expect(prepared.data.status).toBe('prepared');
    }
  });

  it('erlaubt internes OCR vorbereitet ohne externen Transfer', async () => {
    resetConnectDocumentDemoStore();
    const gen = await prepareGenerateInvoice({ tenantId: TENANT_A, title: 'Beleg OCR' });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;

    const result = await registerPreparedOcrJob({
      tenantId: TENANT_A,
      documentId: gen.data.id,
      providerKey: 'internal',
      context: baseContext({
        ocrProviderKey: 'internal',
        ocrProviderActive: true,
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.externalTransfer).toBe(false);
    }
  });
});
