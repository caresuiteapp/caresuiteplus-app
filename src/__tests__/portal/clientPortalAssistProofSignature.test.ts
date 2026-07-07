import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

const TENANT = DEMO_TENANT_ID;
const CLIENT = 'client-1';
const PROOF = 'proof-deferred-1';

describe('saveClientPortalAssistProofSignature', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('blocks when proof is not pending client signature', async () => {
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/portal/assist/portalAssistVisitProofService', () => ({
      getReleasedProofForClientPortal: vi.fn(async () => ({
        ok: true,
        data: {
          id: PROOF,
          signatureRequired: false,
          portalReleaseStatus: 'released',
        },
      })),
    }));

    const { saveClientPortalAssistProofSignature } = await import(
      '@/lib/portal/clientPortalAssistProofSignatureService'
    );
    const result = await saveClientPortalAssistProofSignature({
      tenantId: TENANT,
      clientId: CLIENT,
      proofId: PROOF,
      signerName: 'Heinz-Peter',
      signatureDataUrl: 'data:image/png;base64,abc',
    });
    expect(result.ok).toBe(false);
  });

  it('completes signing flow for pending_client_signature proof', async () => {
    vi.doMock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
    vi.doMock('@/lib/portal/assist/portalAssistVisitProofService', () => ({
      getReleasedProofForClientPortal: vi.fn(async () => ({
        ok: true,
        data: {
          id: PROOF,
          visitId: 'visit-1',
          signatureRequired: true,
          portalReleaseStatus: 'pending_client_signature',
          title: 'Alltagsbegleitung',
        },
      })),
    }));
    vi.doMock('@/lib/assist/assistVisitProofPersistenceService', () => ({
      fetchVisitProofById: vi.fn(async () => ({
        ok: true,
        data: {
          id: PROOF,
          visitId: 'visit-1',
          payloadSnapshot: {
            assignmentId: 'assign-1',
            plannedStartAt: '2026-07-01T09:00:00.000Z',
            plannedEndAt: '2026-07-01T11:00:00.000Z',
            documentationNote: 'Erledigt',
            tasks: [],
          },
        },
      })),
      computeVisitProofPayloadHash: vi.fn(async () => 'hash-1'),
      updateVisitProofRow: vi.fn(async () => ({
        ok: true,
        data: {
          id: PROOF,
          visitId: 'visit-1',
          payloadSnapshot: { signedViaClientPortal: true },
        },
      })),
    }));
    vi.doMock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({
      computeVisitSignaturePayloadHash: vi.fn(async () => 'payload-hash'),
      computeSignatureDataHash: vi.fn(async () => 'sig-hash'),
      saveVisitSignaturePersistent: vi.fn(async () => ({
        ok: true,
        data: { id: 'sig-1', signedAt: '2026-07-01T12:00:00.000Z' },
      })),
      fetchValidVisitSignature: vi.fn(async () => ({ ok: true, data: null })),
    }));
    vi.doMock('@/lib/portal/portalProofCacheSignal', () => ({
      invalidatePortalProofCache: vi.fn(),
    }));
    vi.doMock('@/lib/assist/assistProofPdfService', () => ({
      buildEnrichedAssistProofPdfPayload: vi.fn(async () => ({ html: '<p/>' })),
    }));
    vi.doMock('@/lib/assist/assistProofPortalDocumentService', () => ({
      upsertAssistProofClientPortalDocument: vi.fn(async () => ({
        ok: true,
        data: { clientDocumentId: PROOF },
      })),
    }));
    vi.doMock('@/features/assistWorkflow/assistVisitExecutionStatePersistence', () => ({
      upsertAssistVisitExecutionState: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock('@/lib/supabase/client', () => ({
      getSupabaseClient: () => ({
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock('@/lib/supabase/untypedTable', () => ({
      fromUnknownTable: (_sb: unknown, table: string) => {
        if (table === 'client_documents') {
          return {
            update: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            }),
          };
        }
        return {};
      },
    }));

    const { saveClientPortalAssistProofSignature } = await import(
      '@/lib/portal/clientPortalAssistProofSignatureService'
    );
    const result = await saveClientPortalAssistProofSignature({
      tenantId: TENANT,
      clientId: CLIENT,
      proofId: PROOF,
      signerName: 'Heinz-Peter',
      signatureDataUrl: 'data:image/png;base64,abc',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.signatureId).toBe('sig-1');
      expect(result.data.proofPersisted).toBe(true);
    }
  });
});
