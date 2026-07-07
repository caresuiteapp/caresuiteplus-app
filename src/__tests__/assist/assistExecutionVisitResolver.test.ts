import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveLiveAssignment = vi.hoisted(() => vi.fn());
const visitResolveVisitId = vi.hoisted(() => vi.fn());

vi.mock('@/features/liveTracking/resolveLiveAssignment', () => ({
  resolveLiveAssignment,
  resolveLiveVisitId: vi.fn(),
}));

vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({
  visitSupabaseRepository: {
    resolveVisitId: visitResolveVisitId,
  },
}));

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: () => 'supabase',
}));

const fromUnknownTable = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: fromUnknownTable,
  }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => fromUnknownTable(table),
}));

import { resolveVisitAndAssignmentIds } from '@/lib/assist/assistExecutionVisitResolver';

const TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const VISIT_ID = '11111111-1111-4111-8111-111111111111';
const ASSIGNMENT_ID = 'da96df00-a106-4b1c-9185-123790dea5d6';

describe('resolveVisitAndAssignmentIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveLiveAssignment.mockResolvedValue({ ok: true, data: null });
    visitResolveVisitId.mockResolvedValue(null);
    fromUnknownTable.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('uses resolveLiveAssignment when available', async () => {
    resolveLiveAssignment.mockResolvedValue({
      ok: true,
      data: {
        assignmentId: ASSIGNMENT_ID,
        visitId: VISIT_ID,
      },
    });

    const ids = await resolveVisitAndAssignmentIds(TENANT, VISIT_ID);
    expect(ids).toEqual({ visitId: VISIT_ID, assignmentId: ASSIGNMENT_ID });
  });

  it('falls back to legacy_assignment_id on assist_visits row', async () => {
    fromUnknownTable.mockImplementation((table: string) => {
      if (table !== 'assist_visits') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: VISIT_ID, legacy_assignment_id: ASSIGNMENT_ID },
          error: null,
        }),
      };
    });

    const ids = await resolveVisitAndAssignmentIds(TENANT, VISIT_ID);
    expect(ids).toEqual({ visitId: VISIT_ID, assignmentId: ASSIGNMENT_ID });
  });

  it('resolves visit id when route param is assignment id', async () => {
    visitResolveVisitId.mockResolvedValue(VISIT_ID);

    const ids = await resolveVisitAndAssignmentIds(TENANT, ASSIGNMENT_ID);
    expect(ids).toEqual({ visitId: VISIT_ID, assignmentId: ASSIGNMENT_ID });
  });
});
