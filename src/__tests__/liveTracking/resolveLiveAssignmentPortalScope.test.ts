import { describe, expect, it, vi, beforeEach } from 'vitest';

const getById = vi.fn();

vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/assist/repositories/assignmentRepository.supabase', () => ({
  assignmentSupabaseRepository: { getById: (...args: unknown[]) => getById(...args) },
}));
vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({
  visitSupabaseRepository: {
    getById: vi.fn(),
    resolveVisitId: vi.fn(),
  },
}));

describe('resolveLiveAssignment portal employee scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks visit fallback when assignment filtered by portalEmployeeId', async () => {
    getById.mockResolvedValue({ ok: true, data: null });
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
});
