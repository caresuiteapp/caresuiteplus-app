import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchClientModuleAssignments,
  saveClientModuleAssignments,
} from '@/lib/portal/clientModuleAssignmentService';

const mockUnknownTable = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

function chain(resolver: () => Promise<{ data?: unknown; error: unknown }>) {
  const chainObj: Record<string, unknown> = {};
  const self = () => chainObj;
  for (const method of ['select', 'eq', 'order', 'in', 'insert', 'update', 'delete', 'upsert']) {
    chainObj[method] = vi.fn(self);
  }
  chainObj.then = (resolve: (value: { data?: unknown; error: unknown }) => void) =>
    resolver().then(resolve);
  return chainObj;
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: vi.fn() }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => mockUnknownTable(...args),
}));

const tenantId = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const clientId = 'b0241381-4933-4a89-8879-4ae31cc4340d';

describe('clientModuleAssignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUpsert.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                module_key: 'assist',
                is_primary: true,
                is_active: true,
                assigned_at: '2026-01-01T00:00:00.000Z',
              },
              {
                module_key: 'pflege',
                is_primary: false,
                is_active: false,
                status: 'inactive',
                assigned_at: '2026-01-02T00:00:00.000Z',
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    mockUnknownTable.mockImplementation((_client: unknown, table: string) => {
      if (table !== 'client_module_assignments') {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: mockSelect,
        upsert: mockUpsert,
        update: mockUpdate,
      };
    });
  });

  it('fetchClientModuleAssignments returns only active assignments', async () => {
    const result = await fetchClientModuleAssignments(tenantId, clientId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      {
        moduleKey: 'assist',
        isPrimary: true,
        isActive: true,
        assignedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('saveClientModuleAssignments upserts selected modules instead of inserting duplicates', async () => {
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ module_key: 'assist' }],
          error: null,
        }),
      }),
    });

    const result = await saveClientModuleAssignments(
      tenantId,
      clientId,
      ['assist', 'pflege'],
      'profile-1',
    );

    expect(result.ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tenant_id: tenantId,
          client_id: clientId,
          module_key: 'pflege',
          is_active: true,
          is_primary: true,
          assigned_by: 'profile-1',
          status: 'active',
        }),
        expect.objectContaining({
          module_key: 'assist',
          is_active: true,
          is_primary: false,
        }),
      ]),
      { onConflict: 'tenant_id,client_id,module_key' },
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('saveClientModuleAssignments reactivates an existing assignment via upsert', async () => {
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ module_key: 'pflege' }],
          error: null,
        }),
      }),
    });

    const result = await saveClientModuleAssignments(tenantId, clientId, ['pflege']);

    expect(result.ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          module_key: 'pflege',
          is_active: true,
          is_primary: true,
        }),
      ],
      { onConflict: 'tenant_id,client_id,module_key' },
    );
  });

  it('saveClientModuleAssignments soft-deactivates deselected modules', async () => {
    const inMock = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: inMock,
        }),
      }),
    });

    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ module_key: 'assist' }, { module_key: 'pflege' }],
          error: null,
        }),
      }),
    });

    const result = await saveClientModuleAssignments(tenantId, clientId, ['assist']);

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      is_active: false,
      is_primary: false,
      status: 'inactive',
    });
    expect(inMock).toHaveBeenCalledWith('module_key', ['pflege']);
  });

  it('saveClientModuleAssignments soft-deactivates all modules when selection is empty', async () => {
    const inMock = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: inMock,
        }),
      }),
    });

    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ module_key: 'assist' }],
          error: null,
        }),
      }),
    });

    const result = await saveClientModuleAssignments(tenantId, clientId, []);

    expect(result.ok).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(inMock).toHaveBeenCalledWith('module_key', ['assist']);
  });
});
