import { describe, expect, it, vi, beforeEach } from 'vitest';

const getById = vi.fn();
const getVisitById = vi.fn();
const fromUnknownTable = vi.fn();

vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/assist/repositories/assignmentRepository.supabase', () => ({
  assignmentSupabaseRepository: { getById: (...args: unknown[]) => getById(...args) },
}));
vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({
  visitSupabaseRepository: {
    getById: (...args: unknown[]) => getVisitById(...args),
    resolveVisitId: vi.fn(),
  },
}));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => fromUnknownTable(...args),
}));

describe('resolveLiveAssignment portal employee scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps blocking a visit assigned to a different employee', async () => {
    getById.mockResolvedValue({ ok: true, data: null });
    getVisitById.mockResolvedValue({
      ok: true,
      data: {
        id: '70f800b8-a04f-44ae-846f-dcc7f6f6497a',
        tenantId: '56180c22-b894-4fab-b55e-a563c94dd6e7',
        clientId: '142318fc-5a6b-48bc-a232-0484473428cc',
        employeeId: '4ff97994-3264-4837-a061-7a6b4c6aff42',
        tasks: [],
      },
    });
    const { resolveLiveAssignment } = await import('@/features/liveTracking/resolveLiveAssignment');
    const result = await resolveLiveAssignment({
      tenantId: '56180c22-b894-4fab-b55e-a563c94dd6e7',
      rawId: '70f800b8-a04f-44ae-846f-dcc7f6f6497a',
      employeeId: 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('nicht zugewiesen');
    }
  });

  it('bridges an own portal visit id to its legacy assignment id', async () => {
    const tenantId = '56180c22-b894-4fab-b55e-a563c94dd6e7';
    const visitId = '70f800b8-a04f-44ae-846f-dcc7f6f6497a';
    const assignmentId = '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab';
    const employeeId = 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2';
    const visit = {
      id: visitId,
      tenantId,
      clientId: '142318fc-5a6b-48bc-a232-0484473428cc',
      employeeId,
      title: 'Einsatz',
      serviceName: 'Alltagsbegleitung',
      scheduledStart: '2026-07-30T08:00:00.000Z',
      scheduledEnd: '2026-07-30T10:00:00.000Z',
      status: 'in_bearbeitung',
      assignmentStatus: 'beendet',
      planningStatus: 'scheduled',
      proofStatus: 'pending',
      billingStatus: 'none',
      location: 'Dortmund',
      clientName: 'Klient:in',
      employeeName: 'Mitarbeiter:in',
      isAtRisk: false,
      isIncomplete: true,
      tasks: [],
      notes: null,
      documentationNotes: null,
      actualStartAt: '2026-07-30T08:00:00.000Z',
      actualEndAt: '2026-07-30T10:00:00.000Z',
      onTheWayAt: null,
      arrivedAt: null,
      finishedAt: null,
      createdAt: '2026-07-30T07:00:00.000Z',
      updatedAt: '2026-07-30T10:00:00.000Z',
    };
    const assignment = {
      id: assignmentId,
      tenantId,
      clientId: visit.clientId,
      employeeId,
      assignmentStatus: 'beendet',
    };

    getById
      .mockResolvedValueOnce({ ok: true, data: null })
      .mockResolvedValueOnce({ ok: true, data: assignment });
    getVisitById.mockResolvedValue({ ok: true, data: visit });
    fromUnknownTable.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { legacy_assignment_id: assignmentId },
              error: null,
            }),
          }),
        }),
      }),
    });

    const { resolveLiveAssignment } = await import('@/features/liveTracking/resolveLiveAssignment');
    const result = await resolveLiveAssignment({ tenantId, rawId: visitId, employeeId });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.assignmentId).toBe(assignmentId);
      expect(result.data?.visitId).toBe(visitId);
      expect(result.data?.source).toBe('legacy_bridge');
    }
    expect(getById).toHaveBeenLastCalledWith(
      tenantId,
      assignmentId,
      { portalEmployeeId: employeeId },
    );
  });
});
