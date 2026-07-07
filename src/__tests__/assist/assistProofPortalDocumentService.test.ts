import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { upsertAssistProofClientPortalDocument } from '@/lib/assist/assistProofPortalDocumentService';

const root = path.join(__dirname, '..', '..', '..');

const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdateEqId = vi.fn();
const mockUpdateEqTenant = vi.fn();
const mockUpdate = vi.fn();
const mockEqId = vi.fn();
const mockEqTenant = vi.fn();
const mockSelect = vi.fn();
const mockFromUnknown = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({}),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => mockFromUnknown(...args),
}));

vi.mock('@/lib/billing/clientProofBillingMapper', () => ({
  fetchVisitForBilling: vi.fn().mockResolvedValue({ client_id: 'client-1' }),
}));

function sampleProof(overrides: Partial<AssistVisitProofRow> = {}): AssistVisitProofRow {
  return {
    id: 'proof-1',
    tenantId: 'tenant-1',
    visitId: 'visit-1',
    signatureId: null,
    proofNumber: '1AE4CFFD',
    status: 'exported',
    storagePath: null,
    payloadSnapshot: {
      clientId: 'client-1',
      signedAt: '2026-06-15T09:05:00.000Z',
    },
    payloadHash: null,
    generatedAt: null,
    generatedBy: null,
    approvedAt: null,
    approvedBy: null,
    approvalNote: null,
    rejectionReason: null,
    pdfStoragePath: 'tenant/t1/assist/visits/v1/proofs/proof-1.pdf',
    portalVisible: true,
    portalReleaseStatus: 'released',
    releasedToPortalAt: '2026-06-15T10:00:00.000Z',
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-06-15T10:00:00.000Z',
    updatedBy: null,
    ...overrides,
  };
}

describe('assistProofPortalDocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockUpdateEqId.mockResolvedValue({ error: null });
    mockUpdateEqTenant.mockReturnValue({ eq: mockUpdateEqId });
    mockUpdate.mockReturnValue({ eq: mockUpdateEqTenant });
    mockEqId.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockEqTenant.mockReturnValue({ eq: mockEqId });
    mockSelect.mockReturnValue({ eq: mockEqTenant });
    mockFromUnknown.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    });
  });

  it('migration 0239 adds client_documents proof metadata columns', () => {
    const sql = readFileSync(
      path.join(root, 'supabase', 'migrations', '0239_client_documents_portal_proof_metadata.sql'),
      'utf8',
    );
    expect(sql).toContain('signed_at');
    expect(sql).toContain('signature_required');
    expect(sql).toContain('service_record_id');
    expect(sql).toContain('service_month');
  });

  it('inserts client_documents mirror with signed_at and signature_required', async () => {
    const result = await upsertAssistProofClientPortalDocument('tenant-1', sampleProof(), {
      actorProfileId: 'user-1',
      signatureRequired: true,
    });

    expect(result.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'proof-1',
        tenant_id: 'tenant-1',
        client_id: 'client-1',
        signed_at: '2026-06-15T09:05:00.000Z',
        signature_required: true,
        source: 'assist_visit_proof',
        portal_visible: true,
      }),
    );
  });

  it('updates existing client_documents mirror with proof metadata', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'proof-1' }, error: null });

    const result = await upsertAssistProofClientPortalDocument('tenant-1', sampleProof(), {
      signatureRequired: false,
    });

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        signed_at: '2026-06-15T09:05:00.000Z',
        signature_required: false,
        portal_visible: true,
      }),
    );
  });
});
