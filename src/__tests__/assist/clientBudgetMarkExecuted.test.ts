import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const TENANT = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const VISIT = 'visit-budget-rpc-1';

function mockBudgetTables(options: {
  reservations: Array<Record<string, unknown>>;
  updateError?: { code: string; message: string } | null;
  rpcData?: number;
  rpcError?: { message: string } | null;
}) {
  const rpc = vi.fn(async () => ({
    data: options.rpcData ?? 1,
    error: options.rpcError ?? null,
  }));

  vi.doMock('@/lib/supabase/client', () => ({
    getSupabaseClient: () => ({ rpc }),
  }));
  vi.doMock('@/lib/supabase/untypedTable', () => ({
    fromUnknownTable: (_client: unknown, table: string) => {
      if (table === 'client_budget_transactions') {
        const chain = {
          eq: () => chain,
          or: () => Promise.resolve({ data: options.reservations, error: null }),
        };
        return {
          select: () => chain,
          update: () => ({
            eq: () => Promise.resolve({ error: options.updateError ?? null }),
          }),
        };
      }
      if (table === 'client_billing_audit_log') {
        return { insert: vi.fn(async () => ({ error: null })) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
    },
  }));
  vi.doMock('@/lib/services/liveServiceGuard', () => ({
    guardServiceTenant: () => null,
  }));
  vi.doMock('@/lib/services/serviceRunner', () => ({
    runService: (fn: () => Promise<unknown>) => fn(),
  }));

  return { rpc };
}

describe('markAssignmentExecuted — RPC path', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns ok when no reservations exist', async () => {
    mockBudgetTables({ reservations: [] });

    const { markAssignmentExecuted } = await import('@/lib/assist/clientBudgetTransactionService');
    const result = await markAssignmentExecuted(TENANT, VISIT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it('surfaces error when RPC updates zero rows and direct update fails', async () => {
    mockBudgetTables({
      reservations: [{ id: 'tx-1', client_id: 'client-1', lifecycle_status: 'geplant' }],
      rpcData: 0,
      updateError: { code: '42501', message: 'permission denied for table client_budget_transactions' },
    });

    const { markAssignmentExecuted } = await import('@/lib/assist/clientBudgetTransactionService');
    const result = await markAssignmentExecuted(TENANT, VISIT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/durchgeführt|Budget/i);
    }
  });
});
