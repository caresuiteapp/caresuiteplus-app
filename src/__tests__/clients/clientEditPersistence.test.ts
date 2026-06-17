import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistClientEditData } from '@/lib/clients/clientEditPersistence';
import { EMPTY_CLIENT_EDIT_FORM } from '@/types/forms/clientEditForm';

const mockClientsUpdate = vi.fn();
const mockFrom = vi.fn();
const mockUnknownTable = vi.fn();

function chain(resolver: () => Promise<{ data?: unknown; error: unknown }>) {
  const chainObj: Record<string, unknown> = {};
  const self = () => chainObj;
  for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete']) {
    chainObj[method] = vi.fn(self);
  }
  chainObj.then = (resolve: (value: { data?: unknown; error: unknown }) => void) =>
    resolver().then(resolve);
  chainObj.single = vi.fn(() => resolver());
  return chainObj;
}

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => mockUnknownTable(...args),
}));

const tenantId = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const clientId = 'b0241381-4933-4a89-8879-4ae31cc4340d';

const baseForm = {
  ...EMPTY_CLIENT_EDIT_FORM,
  firstName: 'Heinz-Peter',
  lastName: 'Reinhardt',
  careLevel: 'pg3',
  careContexts: ['daily_assistance'] as const,
  street: 'Ringstraße',
  houseNumber: '3',
  zip: '44623',
  city: 'Herne',
  costCarrier: 'AOK',
  insuranceNumber: '123456',
};

describe('persistClientEditData', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockClientsUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'clients') {
        return { update: mockClientsUpdate };
      }
      return chain(async () => ({ error: null }));
    });

    mockUnknownTable.mockImplementation((_client: unknown, table: string) => {
      if (table === 'client_care_contexts') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'client_addresses') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === 'client_contacts') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'contact-1' }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === 'client_care_levels') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
    });
  });

  it('speichert clients, Adresse und Leistungsarten in Reihenfolge', async () => {
    const result = await persistClientEditData(tenantId, clientId, {
      ...baseForm,
      careContexts: ['daily_assistance'],
      emergencyContactName: 'Maria Reinhardt',
      emergencyContactPhone: '0170123456',
    });

    expect(result.ok).toBe(true);
    expect(mockClientsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Heinz-Peter',
        last_name: 'Reinhardt',
        care_level: 'pg3',
      }),
    );
    expect(mockUnknownTable).toHaveBeenCalledWith(expect.anything(), 'client_addresses');
    expect(mockUnknownTable).toHaveBeenCalledWith(expect.anything(), 'client_care_contexts');
  });

  it('überspringt Leistungsarten-Sync wenn client_care_contexts fehlt', async () => {
    mockUnknownTable.mockImplementation((_client: unknown, table: string) => {
      if (table === 'client_care_contexts') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: {
                  code: 'PGRST205',
                  message: "Could not find the table 'public.client_care_contexts' in the schema cache",
                  details: '',
                  hint: '',
                },
              }),
            }),
          }),
        };
      }
      if (table === 'client_addresses') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (table === 'client_contacts') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'client_care_levels') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    const result = await persistClientEditData(tenantId, clientId, {
      ...baseForm,
      careContexts: ['daily_assistance'],
    });

    expect(result.ok).toBe(true);
    expect(mockClientsUpdate).toHaveBeenCalled();
  });

  it('meldet RLS-Fehler beim clients-Update', async () => {
    mockClientsUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { code: '42501', message: 'permission denied', details: '', hint: '' },
        }),
      }),
    });

    const result = await persistClientEditData(tenantId, clientId, baseForm);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Kein Zugriff auf diesen Datensatz (RLS).');
    }
  });
});
