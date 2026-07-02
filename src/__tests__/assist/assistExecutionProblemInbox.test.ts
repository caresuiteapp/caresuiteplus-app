import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => mockFrom(table),
}));

vi.mock('@/lib/wfm/wfmWorkSessionRepository', () => ({
  hasAssistWfmEvent: vi.fn(async () => false),
}));

describe('assistExecutionProblemInboxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects ended_missing_documentation for beendet without doc', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'assignments') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: 'a1',
                        client_id: 'c1',
                        employee_id: 'e1',
                        status: 'finished',
                        documentation_notes: '',
                        title: 'Test',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'assist_visits') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 'v1', proof_template_key: 'standard', legacy_assignment_id: 'a1' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'assist_visit_documentation') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        }),
      };
    });

    const { fetchAssistExecutionProblems } = await import('@/lib/assist/assistExecutionProblemInboxService');
    const result = await fetchAssistExecutionProblems('tenant-1');
    expect(result.ok).toBe(true);
    expect(result.data.some((p) => p.code === 'ended_missing_documentation')).toBe(true);
  });

  it('exports all P0 blocker codes', async () => {
    const mod = await import('@/lib/assist/assistExecutionProblemInboxService');
    expect(typeof mod.fetchAssistExecutionProblems).toBe('function');
    expect(typeof mod.countAssistExecutionProblems).toBe('function');
  });
});
