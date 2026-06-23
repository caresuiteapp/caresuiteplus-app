import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { listPendingPortalApprovals } from '@/lib/portal/officePortalApprovalService';
import { listVisitProofs } from '@/lib/assist/assistVisitProofPersistenceService';
import { listPendingPortalUploads } from '@/lib/portal/assist/portalDocumentUploadService';

vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({
  listVisitProofs: vi.fn(),
}));

vi.mock('@/lib/portal/assist/portalDocumentUploadService', () => ({
  listPendingPortalUploads: vi.fn(),
}));

vi.mock('@/lib/client/clientPortalSettingsService', () => ({
  listClientPortalAccessRequests: vi.fn(async () => ({ ok: true, data: [] })),
}));

vi.mock('@/lib/services/liveServiceGuard', () => ({
  guardServiceTenant: vi.fn(() => null),
}));

const root = path.join(__dirname, '..', '..', '..');

describe('content portal approval inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers office.portal.approvals modal key', () => {
    const modals = readFileSync(path.join(root, 'src/lib/navigation/modulenav/modalscreens.ts'), 'utf8');
    expect(modals).toContain("'office.portal.approvals'");
    expect(modals).toContain('PortalApprovalModalPrepScreen');
  });

  it('ClientPortalCorePanel mounts approvals inbox and sync chain', () => {
    const panel = readFileSync(path.join(root, 'src/components/office/ClientPortalCorePanel.tsx'), 'utf8');
    expect(panel).toContain('OfficePortalApprovalsInbox');
    expect(panel).toContain('listPortalSyncRowsForClient');
    expect(panel).toContain('upsertClientPortalSettings');
  });

  it('aggregates pending proofs and uploads', async () => {
    vi.mocked(listVisitProofs).mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'proof-1',
          tenantId: 'tenant-1',
          visitId: 'visit-1',
          signatureId: null,
          proofNumber: 'LN-001',
          status: 'pending_review',
          storagePath: null,
          payloadSnapshot: {},
          payloadHash: null,
          generatedAt: null,
          generatedBy: null,
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
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-20T10:00:00.000Z',
        },
      ],
    });

    vi.mocked(listPendingPortalUploads).mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'upload-1',
          tenantId: 'tenant-1',
          clientId: 'client-1',
          portalUserId: null,
          portalRequestId: null,
          storagePath: 'path/doc.pdf',
          fileName: 'doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          category: null,
          message: null,
          status: 'hochgeladen',
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
          clientDocumentId: null,
          createdAt: '2026-06-21T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
    });

    const result = await listPendingPortalApprovals('tenant-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.some((item) => item.kind === 'proof')).toBe(true);
      expect(result.data.some((item) => item.kind === 'upload')).toBe(true);
    }
  });
});
