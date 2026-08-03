import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpcImpl: vi.fn(),
  visitStatusFallback: vi.fn(),
}));

const supabaseWithThisSensitiveRpc = {
  rest: {
    rpc: mocks.rpcImpl,
  },
  rpc(name: string, args: Record<string, unknown>) {
    if (!this.rest) {
      throw new TypeError("undefined is not an object (evaluating 'this.rest')");
    }
    return this.rest.rpc(name, args);
  },
};

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => supabaseWithThisSensitiveRpc,
}));

vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({
  visitSupabaseRepository: {
    updateAssignmentStatus: mocks.visitStatusFallback,
  },
}));

vi.mock('@/lib/assist/clientBudgetTransactionService', () => ({
  markAssignmentExecuted: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

import { mirrorAssistVisitStatusFromAssignment } from '@/lib/portal/employeePortalExecutionLiveService';

describe('employee portal RPC binding regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpcImpl.mockResolvedValue({ data: null, error: null });
    mocks.visitStatusFallback.mockResolvedValue({ ok: true, data: undefined });
  });

  it('keeps Supabase rpc bound while mirroring a persisted workflow status', async () => {
    const result = await mirrorAssistVisitStatusFromAssignment(
      'tenant-1',
      'assignment-1',
      'unterwegs',
      'profile-1',
    );

    expect(result).toEqual({ ok: true });
    expect(mocks.rpcImpl).toHaveBeenCalledWith(
      'repair_assist_visit_workflow_status',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_assignment_id: 'assignment-1',
        p_target_status: 'unterwegs',
      }),
    );
    expect(mocks.visitStatusFallback).not.toHaveBeenCalled();
  });

  it('forbids extracted unbound rpc functions in both employee and client portals', async () => {
    const { readFile } = await import('node:fs/promises');
    const employeeSource = await readFile(
      'src/lib/portal/employeePortalExecutionLiveService.ts',
      'utf8',
    );
    const signatureSource = await readFile(
      'src/lib/portal/deferredVisitClientSignatureService.ts',
      'utf8',
    );

    expect(employeeSource).not.toMatch(/const\s+\w+\s*=\s*supabase\.rpc/);
    expect(signatureSource).not.toMatch(/const\s+\w+\s*=\s*supabase\.rpc/);
  });
});
