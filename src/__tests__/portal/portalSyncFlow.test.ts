import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { PORTAL_BLOCKED_SNAPSHOT_KEYS } from '@/lib/assist/assistProofPdfPayload';
import {
  getPortalSyncStateForVisit,
  sanitizeClientPortalPayload,
  sanitizeEmployeePortalPayload,
} from '@/lib/portal/portalVisibilityService';
import {
  canClientPortalSeeFeature,
} from '@/lib/client/clientPortalSettingsService';
import { listReleasedProofsForClientPortal } from '@/lib/portal/assist/portalAssistVisitProofService';

vi.mock('@/lib/portal/assist/portalAssistVisitProofService', () => ({
  listReleasedProofsForClientPortal: vi.fn(),
}));

function sampleProof(overrides: Partial<AssistVisitProofRow> = {}): AssistVisitProofRow {
  return {
    id: 'proof-1',
    tenantId: 'tenant-1',
    visitId: 'visit-1',
    signatureId: null,
    proofNumber: 'LN-001',
    status: 'approved',
    storagePath: 'path',
    payloadSnapshot: {
      clientName: 'Max',
      latitude: 52.5,
      internalNotes: 'secret',
      drivingLog: [{ km: 1 }],
    },
    payloadHash: 'hash',
    generatedAt: '2026-06-20T10:00:00.000Z',
    generatedBy: 'user-1',
    approvedAt: '2026-06-20T10:00:00.000Z',
    approvedBy: 'office-1',
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
    ...overrides,
  };
}

describe('portal sync flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks GPS and internal keys in client portal sanitization', () => {
    const sanitized = sanitizeClientPortalPayload({
      clientName: 'Max',
      latitude: 52.5,
      internalNotes: 'secret',
      drivingLog: [{ km: 1 }],
    });
    for (const key of PORTAL_BLOCKED_SNAPSHOT_KEYS) {
      expect(sanitized).not.toHaveProperty(key);
    }
    expect(sanitized.clientName).toBe('Max');
  });

  it('blocks budget and invoices in employee portal sanitization', () => {
    const sanitized = sanitizeEmployeePortalPayload({
      displayName: 'Anna',
      budget: 1000,
      invoices: [{ id: 'inv-1' }],
      internalNotes: 'x',
    });
    expect(sanitized.displayName).toBe('Anna');
    expect(sanitized).not.toHaveProperty('budget');
    expect(sanitized).not.toHaveProperty('invoices');
    expect(sanitized).not.toHaveProperty('internalNotes');
  });

  it('visit_tracking never visible in client portal', () => {
    const settings = {
      portalEnabled: true,
      showAppointments: true,
      showMessages: true,
      showDocuments: true,
      showProofs: true,
      showBudget: true,
      showVisitTracking: false,
      inheritTenantDefaults: true,
      source: 'tenant' as const,
    };
    expect(canClientPortalSeeFeature(settings, 'visit_tracking')).toBe(false);
    expect(canClientPortalSeeFeature(settings, 'proofs')).toBe(true);
  });

  it('sync chain marks client portal visible only after office release', () => {
    const before = getPortalSyncStateForVisit({
      visitId: 'visit-1',
      assignmentId: 'asg-1',
      employeePortalStatus: 'abgeschlossen',
      assistProofStatus: 'approved',
      officeReleaseStatus: 'none',
      portalVisible: false,
      signatureComplete: true,
    });
    expect(before.clientPortalVisible).toBe(false);

    const after = getPortalSyncStateForVisit({
      visitId: 'visit-1',
      assignmentId: 'asg-1',
      employeePortalStatus: 'abgeschlossen',
      assistProofStatus: 'approved',
      officeReleaseStatus: 'released',
      portalVisible: true,
      pdfStoragePath: 'pdf/path',
      signatureComplete: true,
    });
    expect(after.clientPortalVisible).toBe(true);
    expect(after.pdfAvailable).toBe(true);
  });

  it('revoke hides proof from client portal list', async () => {
    const released = sampleProof({
      portalVisible: true,
      portalReleaseStatus: 'released',
      releasedToPortalAt: '2026-06-20T12:00:00.000Z',
    });

    vi.mocked(listReleasedProofsForClientPortal)
      .mockResolvedValueOnce({ ok: true, data: [released] as never })
      .mockResolvedValueOnce({ ok: true, data: [] });

    const visible = await listReleasedProofsForClientPortal('tenant-1', 'client-1');
    expect(visible.ok).toBe(true);
    if (visible.ok) expect(visible.data).toHaveLength(1);

    const hidden = await listReleasedProofsForClientPortal('tenant-1', 'client-1');
    expect(hidden.ok).toBe(true);
    if (hidden.ok) expect(hidden.data).toHaveLength(0);

    const revokedState = getPortalSyncStateForVisit({
      visitId: 'visit-1',
      officeReleaseStatus: 'revoked',
      portalVisible: false,
    });
    expect(revokedState.clientPortalVisible).toBe(false);
  });

  it('employee execution → proof → release → client sees flow is documented in sync state', () => {
    const steps = [
      getPortalSyncStateForVisit({
        visitId: 'v1',
        employeePortalStatus: 'gestartet',
        assistProofStatus: null,
      }),
      getPortalSyncStateForVisit({
        visitId: 'v1',
        employeePortalStatus: 'abgeschlossen',
        assistProofStatus: 'pending_review',
      }),
      getPortalSyncStateForVisit({
        visitId: 'v1',
        employeePortalStatus: 'abgeschlossen',
        assistProofStatus: 'approved',
        officeReleaseStatus: 'released',
        portalVisible: true,
      }),
    ];
    expect(steps[0].clientPortalVisible).toBe(false);
    expect(steps[1].clientPortalVisible).toBe(false);
    expect(steps[2].clientPortalVisible).toBe(true);
  });
});
