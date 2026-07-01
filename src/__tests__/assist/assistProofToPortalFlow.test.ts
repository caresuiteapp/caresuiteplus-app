import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import {
  PORTAL_BLOCKED_SNAPSHOT_KEYS,
  stripPortalBlockedKeysFromSnapshot,
} from '@/lib/assist/assistProofPdfPayload';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function sampleProof(overrides: Partial<AssistVisitProofRow> = {}): AssistVisitProofRow {
  return {
    id: 'proof-1',
    tenantId: 'tenant-1',
    visitId: 'visit-1',
    signatureId: null,
    proofNumber: 'LN-001',
    status: 'draft',
    storagePath: 'tenant/t1/assist/visits/v1/proofs/proof-1.json',
    payloadSnapshot: {
      clientName: 'Max Mustermann',
      employeeName: 'Anna Pflege',
      serviceName: 'Grundpflege',
      documentationNote: 'Alles in Ordnung',
      signerName: 'Max Mustermann',
      signedAt: '2026-06-20T10:00:00.000Z',
      latitude: 52.5,
      longitude: 13.4,
      locationPoints: [{ lat: 1, lng: 2 }],
      internalNotes: 'Intern: Schlüssel beim Nachbarn',
      drivingLog: [{ km: 12, from: 'Büro' }],
      fahrtenbuch: '12 km',
    },
    payloadHash: 'sha256:abc',
    generatedAt: '2026-06-20T11:00:00.000Z',
    generatedBy: 'user-1',
    approvedAt: null,
    approvedBy: null,
    billingReleased: false,
    portalVisible: false,
    releasedToPortalAt: null,
    portalReleaseStatus: 'none',
    approvalNote: null,
    rejectionReason: null,
    pdfStoragePath: null,
    pdfHash: null,
    createdAt: '2026-06-20T11:00:00.000Z',
    updatedAt: '2026-06-20T11:00:00.000Z',
    ...overrides,
  };
}

const mockFetchProof = vi.fn();
const mockUpdateProof = vi.fn();
const mockGeneratePdf = vi.fn();
const mockUpsertDocument = vi.fn();
const mockRevokeDocument = vi.fn();

vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({
  fetchVisitProofById: (...args: unknown[]) => mockFetchProof(...args),
  updateVisitProofRow: (...args: unknown[]) => mockUpdateProof(...args),
}));

vi.mock('@/lib/assist/assistProofPdfService', () => ({
  generateAssistProofPdf: (...args: unknown[]) => mockGeneratePdf(...args),
}));

vi.mock('@/lib/assist/assistProofPortalDocumentService', () => ({
  upsertAssistProofClientPortalDocument: (...args: unknown[]) => mockUpsertDocument(...args),
  revokeAssistProofClientPortalDocument: (...args: unknown[]) => mockRevokeDocument(...args),
}));

vi.mock('@/lib/assist/visitProofSnapshotPreviewService', () => ({
  enrichVisitProofForPreview: vi.fn(async () => ({ ok: true, data: {} })),
}));

const mockFromUnknown = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => mockFromUnknown(...args),
}));

import {
  approveAssistProof,
  releaseAssistProofToPortal,
  revokeAssistProofPortalRelease,
  submitProofForReview,
} from '@/lib/assist/assistProofApprovalService';
import {
  getReleasedProofForClientPortal,
  listReleasedProofsForClientPortal,
} from '@/lib/portal/assist/portalAssistVisitProofService';

type ProofStore = Map<string, AssistVisitProofRow>;

function installProofStore(store: ProofStore) {
  mockFetchProof.mockImplementation(async (_tenantId: string, proofId: string) => {
    const row = store.get(proofId);
    if (!row) return { ok: true, data: null };
    return { ok: true, data: { ...row } };
  });

  mockUpdateProof.mockImplementation(
    async (_tenantId: string, proofId: string, patch: Record<string, unknown>) => {
      const current = store.get(proofId);
      if (!current) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };

      const next: AssistVisitProofRow = {
        ...current,
        status: (patch.status as AssistVisitProofRow['status']) ?? current.status,
        approvedAt:
          patch.approved_at !== undefined
            ? (patch.approved_at as string | null)
            : current.approvedAt,
        approvedBy:
          patch.approved_by !== undefined
            ? (patch.approved_by as string | null)
            : current.approvedBy,
        approvalNote:
          patch.approval_note !== undefined
            ? (patch.approval_note as string | null)
            : current.approvalNote,
        rejectionReason:
          patch.rejection_reason !== undefined
            ? (patch.rejection_reason as string | null)
            : current.rejectionReason,
        portalVisible:
          patch.portal_visible !== undefined
            ? Boolean(patch.portal_visible)
            : current.portalVisible,
        releasedToPortalAt:
          patch.released_to_portal_at !== undefined
            ? (patch.released_to_portal_at as string | null)
            : current.releasedToPortalAt,
        portalReleaseStatus:
          patch.portal_release_status !== undefined
            ? (patch.portal_release_status as AssistVisitProofRow['portalReleaseStatus'])
            : current.portalReleaseStatus,
        pdfStoragePath:
          patch.pdf_storage_path !== undefined
            ? (patch.pdf_storage_path as string | null)
            : current.pdfStoragePath,
        updatedAt: new Date().toISOString(),
      };

      store.set(proofId, next);
      return { ok: true, data: next };
    },
  );
}

function chainMock(resolver: () => unknown) {
  const chain: Record<string, unknown> = {};
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => void) => resolve(resolver());
      }
      if (typeof prop === 'symbol') return undefined;
      return (..._args: unknown[]) => new Proxy(chain, handler);
    },
  };
  return new Proxy(chain, handler);
}

function installPortalMocks(options: {
  tenantId: string;
  clientId: string;
  visitIds: string[];
  proofs: Array<{
    id: string;
    visit_id: string;
    portal_visible: boolean;
    portal_release_status: string;
    payload_snapshot: Record<string, unknown>;
    proof_number?: string | null;
    pdf_storage_path?: string | null;
    released_to_portal_at?: string | null;
  }>;
}) {
  mockFromUnknown.mockImplementation((_client: unknown, table: string) => {
    if (table === 'assist_visits') {
      return {
        select: (columns?: string) => ({
          eq: () => ({
            eq: () => {
              if (columns?.includes('client_id')) {
                return {
                  maybeSingle: async () => ({
                    data: {
                      id: options.visitIds[0] ?? 'visit-1',
                      client_id: options.clientId,
                      service_key: null,
                      service_name: 'Grundpflege',
                      planned_start_at: null,
                      planned_end_at: null,
                      duration_minutes: null,
                      budget_amount_cents: null,
                    },
                    error: null,
                  }),
                };
              }

              return Promise.resolve({
                data: options.visitIds.map((id) => ({ id })),
                error: null,
              });
            },
            in: async () => ({
              data: options.visitIds.map((id) => ({
                id,
                title: 'Hausbesuch',
                scheduled_start: '2026-06-20T09:00:00.000Z',
                scheduled_end: '2026-06-20T10:00:00.000Z',
              })),
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === 'assist_visit_proofs') {
      return chainMock(() => ({
        data: options.proofs.filter(
          (proof) =>
            proof.portal_visible &&
            ['released', 'pending_client_signature'].includes(proof.portal_release_status) &&
            options.visitIds.includes(proof.visit_id),
        ),
        error: null,
      }));
    }

    if (table === 'client_documents') {
      return chainMock(() => ({ data: null, error: null }));
    }

    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  });
}

describe('assist proof approval → portal release flow', () => {
  let store: ProofStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new Map([['proof-1', sampleProof()]]);
    installProofStore(store);
    mockUpsertDocument.mockResolvedValue({
      ok: true,
      data: { clientDocumentId: 'proof-1' },
    });
    mockRevokeDocument.mockResolvedValue({ ok: true, data: undefined });
    mockFromUnknown.mockImplementation((_client: unknown, table: string) => {
      if (table === 'assist_visits') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'visit-1',
                    client_id: 'client-1',
                    service_key: null,
                    service_name: 'Grundpflege',
                    planned_start_at: null,
                    planned_end_at: null,
                    duration_minutes: null,
                    budget_amount_cents: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'client_documents') {
        return chainMock(() => ({ data: null, error: null }));
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
    });
    mockGeneratePdf.mockResolvedValue({
      ok: true,
      data: sampleProof({
        status: 'approved',
        pdfStoragePath: 'tenant/t1/assist/visits/v1/proofs/proof-1.pdf',
      }),
    });
  });

  it('draft → pending_review → approved → exported/released', async () => {
    const submit = await submitProofForReview('tenant-1', 'proof-1', 'user-1', 'business_admin');
    expect(submit.ok).toBe(true);
    if (submit.ok) expect(submit.data.status).toBe('pending_review');

    const approve = await approveAssistProof(
      'tenant-1',
      'proof-1',
      'user-2',
      'business_admin',
      'Freigegeben',
    );
    expect(approve.ok).toBe(true);
    if (approve.ok) {
      expect(approve.data.status).toBe('approved');
      expect(approve.data.approvalNote).toBe('Freigegeben');
      expect(approve.data.portalVisible).toBe(false);
    }

    const release = await releaseAssistProofToPortal(
      'tenant-1',
      'proof-1',
      'user-2',
      'business_admin',
    );
    expect(release.ok).toBe(true);
    if (release.ok) {
      expect(release.data.status).toBe('exported');
      expect(release.data.portalVisible).toBe(true);
      expect(release.data.portalReleaseStatus).toBe('released');
      expect(release.data.releasedToPortalAt).toBeTruthy();
    }
  });

  it('blocks portal release before approval', async () => {
    const release = await releaseAssistProofToPortal(
      'tenant-1',
      'proof-1',
      'user-2',
      'business_admin',
    );
    expect(release.ok).toBe(false);
    if (!release.ok) {
      expect(release.error).toContain('freigegebene');
    }
  });

  it('revoke hides proof from portal flags', async () => {
    store.set(
      'proof-1',
      sampleProof({
        status: 'exported',
        portalVisible: true,
        portalReleaseStatus: 'released',
        releasedToPortalAt: '2026-06-20T13:00:00.000Z',
        pdfStoragePath: 'tenant/t1/assist/visits/v1/proofs/proof-1.pdf',
      }),
    );

    const revoke = await revokeAssistProofPortalRelease(
      'tenant-1',
      'proof-1',
      'user-2',
      'business_admin',
    );
    expect(revoke.ok).toBe(true);
    if (revoke.ok) {
      expect(revoke.data.portalVisible).toBe(false);
      expect(revoke.data.portalReleaseStatus).toBe('revoked');
    }
  });
});

describe('client portal released proof visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists only released proofs for matching client visits', async () => {
    installPortalMocks({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      visitIds: ['visit-1'],
      proofs: [
        {
          id: 'proof-released',
          visit_id: 'visit-1',
          portal_visible: true,
          portal_release_status: 'released',
          proof_number: 'LN-100',
          pdf_storage_path: 'tenant/t1/proof-released.pdf',
          released_to_portal_at: '2026-06-20T14:00:00.000Z',
          payload_snapshot: {
            clientName: 'Max Mustermann',
            serviceName: 'Grundpflege',
            documentationNote: 'Sichtbar',
            latitude: 52.5,
            internalNotes: 'Intern',
            drivingLog: [{ km: 5 }],
          },
        },
        {
          id: 'proof-draft',
          visit_id: 'visit-1',
          portal_visible: false,
          portal_release_status: 'none',
          payload_snapshot: { clientName: 'Max Mustermann' },
        },
        {
          id: 'proof-revoked',
          visit_id: 'visit-1',
          portal_visible: false,
          portal_release_status: 'revoked',
          payload_snapshot: { clientName: 'Max Mustermann' },
        },
      ],
    });

    const list = await listReleasedProofsForClientPortal('tenant-1', 'client-1');
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.data).toHaveLength(1);
      expect(list.data[0]?.id).toBe('proof-released');
      expect(list.data[0]?.proofNumber).toBe('LN-100');
    }
  });

  it('returns null for tenant/client mismatch', async () => {
    installPortalMocks({
      tenantId: 'tenant-1',
      clientId: 'client-other',
      visitIds: [],
      proofs: [
        {
          id: 'proof-released',
          visit_id: 'visit-1',
          portal_visible: true,
          portal_release_status: 'released',
          payload_snapshot: { clientName: 'Max Mustermann' },
        },
      ],
    });

    const list = await listReleasedProofsForClientPortal('tenant-1', 'client-other');
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data).toHaveLength(0);

    const single = await getReleasedProofForClientPortal(
      'tenant-1',
      'client-other',
      'proof-released',
    );
    expect(single.ok).toBe(true);
    if (single.ok) expect(single.data).toBeNull();
  });

  it('does not expose GPS, driving log or internal notes in portal view', async () => {
    installPortalMocks({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      visitIds: ['visit-1'],
      proofs: [
        {
          id: 'proof-released',
          visit_id: 'visit-1',
          portal_visible: true,
          portal_release_status: 'released',
          payload_snapshot: {
            clientName: 'Max Mustermann',
            serviceName: 'Grundpflege',
            documentationNote: 'Sichtbar',
            latitude: 52.5,
            longitude: 13.4,
            locationPoints: [{ lat: 1, lng: 2 }],
            internalNotes: 'Intern: Schlüssel',
            drivingLog: [{ km: 12 }],
            fahrtenbuch: '12 km',
          },
        },
      ],
    });

    const list = await listReleasedProofsForClientPortal('tenant-1', 'client-1');
    expect(list.ok).toBe(true);
    if (list.ok) {
      const proof = list.data[0];
      expect(proof?.clientName).toBe('Max Mustermann');
      expect(proof?.documentationNote).toBe('Sichtbar');
      expect(JSON.stringify(proof)).not.toContain('52.5');
      expect(JSON.stringify(proof)).not.toContain('locationPoints');
      expect(JSON.stringify(proof)).not.toContain('Intern');
      expect(JSON.stringify(proof)).not.toContain('drivingLog');
      expect(JSON.stringify(proof)).not.toContain('fahrtenbuch');
      expect(proof).not.toHaveProperty('approvalNote');
      expect(proof).not.toHaveProperty('rejectionReason');
      expect(proof).not.toHaveProperty('payloadSnapshot');
    }
  });
});

describe('portal snapshot privacy helpers', () => {
  it('stripPortalBlockedKeysFromSnapshot removes GPS and internal fields', () => {
    const clean = stripPortalBlockedKeysFromSnapshot(sampleProof().payloadSnapshot);
    for (const key of PORTAL_BLOCKED_SNAPSHOT_KEYS) {
      expect(clean).not.toHaveProperty(key);
    }
    expect(clean.clientName).toBe('Max Mustermann');
    expect(clean.documentationNote).toBe('Alles in Ordnung');
  });
});

describe('assist nachweise review wiring', () => {
  it('review route uses VisitProofReviewScreen', () => {
    const route = readSrc('app/assist/nachweise/review.tsx');
    expect(route).toContain('VisitProofReviewScreen');
  });

  it('review panel wires approval and portal release actions', () => {
    const panel = readSrc('src/components/assist/VisitProofReviewPanel.tsx');
    expect(panel).toContain('submitProofForReview');
    expect(panel).toContain('approveAssistProof');
    expect(panel).toContain('releaseAssistProofToPortal');
    expect(panel).toContain('revokeAssistProofPortalRelease');
  });

  it('portal service queries released-only proofs', () => {
    const service = readSrc('src/lib/portal/assist/portalAssistVisitProofService.ts');
    expect(service).toContain(".eq('portal_visible', true)");
    expect(service).toContain(".in('portal_release_status', ['released', 'pending_client_signature'])");
    expect(service).toContain('stripPortalBlockedKeysFromSnapshot');
  });
});
