import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assignmentUpdateStatus: vi.fn(),
  visitUpdateStatus: vi.fn(),
  mapVisitDetail: vi.fn(),
}));

vi.mock('@/lib/assist/repositories/assignmentRepository.supabase', () => ({
  assignmentSupabaseRepository: { updateStatus: mocks.assignmentUpdateStatus },
}));

vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({
  visitSupabaseRepository: { updateAssignmentStatus: mocks.visitUpdateStatus },
}));

vi.mock('@/lib/portal/employeePortalAssignmentBridge', () => ({
  mapVisitDetailToAssignmentDetail: mocks.mapVisitDetail,
}));

import { persistResolvedAssignmentStatus } from '@/features/liveTracking/persistResolvedAssignmentStatus';

const detail = {
  id: 'assignment-1',
  tenantId: 'tenant-1',
  employeeId: 'employee-1',
  assignmentStatus: 'geplant',
};

describe('persistResolvedAssignmentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes assist_visits-only routes to the visit repository', async () => {
    const visitDetail = { id: 'visit-1', assignmentStatus: 'unterwegs' };
    const mapped = { ...detail, id: 'visit-1', assignmentStatus: 'unterwegs' };
    mocks.visitUpdateStatus.mockResolvedValue({ ok: true, data: visitDetail });
    mocks.mapVisitDetail.mockReturnValue(mapped);

    const result = await persistResolvedAssignmentStatus({
      tenantId: 'tenant-1',
      employeeId: 'employee-1',
      profileId: 'profile-1',
      resolution: {
        assignmentId: 'visit-1',
        visitId: 'visit-1',
        clientId: 'client-1',
        employeeId: 'employee-1',
        detail: detail as never,
        source: 'assist_visits',
        persistenceSource: 'assist_visits',
      },
      toStatus: 'unterwegs',
      fastWorkflow: true,
    });

    expect(result).toEqual({ ok: true, data: mapped });
    expect(mocks.visitUpdateStatus).toHaveBeenCalledWith(
      'tenant-1',
      'visit-1',
      'unterwegs',
      'profile-1',
      undefined,
    );
    expect(mocks.assignmentUpdateStatus).not.toHaveBeenCalled();
  });

  it('writes assignment-backed routes to the assignment repository', async () => {
    mocks.assignmentUpdateStatus.mockResolvedValue({ ok: true, data: detail });

    const result = await persistResolvedAssignmentStatus({
      tenantId: 'tenant-1',
      employeeId: 'employee-1',
      resolution: {
        assignmentId: 'assignment-1',
        visitId: 'visit-1',
        clientId: 'client-1',
        employeeId: 'employee-1',
        detail: detail as never,
        source: 'legacy_bridge',
        persistenceSource: 'assignments',
      },
      toStatus: 'angekommen',
      fastWorkflow: true,
    });

    expect(result.ok).toBe(true);
    expect(mocks.assignmentUpdateStatus).toHaveBeenCalledWith(
      'tenant-1',
      'assignment-1',
      'angekommen',
      expect.objectContaining({
        actorEmployeeId: 'employee-1',
        fastWorkflow: false,
      }),
      undefined,
    );
    expect(mocks.visitUpdateStatus).not.toHaveBeenCalled();
  });
});
