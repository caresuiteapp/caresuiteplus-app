import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmEmployeeLogbookTrip } from '@/lib/employeeLogbook/employeeLogbookRepository.supabase';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';

const mocks = vi.hoisted(() => ({ response: vi.fn(), writes: [] as { table: string; payload: unknown }[], filters: [] as unknown[][] }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_db: unknown, table: string) => {
  let operation = 'read';
  const q = {
    update(payload: unknown) { operation = 'update'; mocks.writes.push({ table, payload }); return q; },
    eq(column: string, value: unknown) { mocks.filters.push([table, column, value]); return q; },
    is() { return q; }, select() { return q; },
    maybeSingle() { return Promise.resolve(mocks.response(table, operation)); },
    then(resolve: (result: unknown) => unknown, reject: (cause: unknown) => unknown) { return Promise.resolve(mocks.response(table, operation)).then(resolve, reject); },
  };
  return q;
} }));
const trip = { id: 'trip', tenantId: 'tenant', employeeId: 'employee', distanceFinalKm: 1.2, endedAt: '2026-09-06T08:00:00Z', status: 'confirmation_required', endAddress: 'Teststraße' } as LogbookTrip;
beforeEach(() => {
  mocks.writes.length = 0; mocks.filters.length = 0; vi.clearAllMocks();
  mocks.response.mockImplementation((table) => ({ data: table === 'employee_logbook_trips' ? { id: 'trip' } : null, error: null }));
});
describe('kilometre confirmation readback', () => {
  it('repairs unfinished segments and confirms only the correct tenant and employee', async () => {
    await confirmEmployeeLogbookTrip({ trip, distanceKm: 1.2 });
    expect(mocks.writes.map((w) => w.table)).toEqual(['employee_logbook_segments', 'employee_logbook_trips']);
    expect(mocks.filters).toContainEqual(['employee_logbook_trips', 'tenant_id', 'tenant']);
    expect(mocks.filters).toContainEqual(['employee_logbook_trips', 'employee_id', 'employee']);
    expect(mocks.filters).toContainEqual(['employee_logbook_trips', 'status', 'confirmation_required']);
  });
  it('rejects an apparently successful zero-row update hidden by RLS', async () => {
    mocks.response.mockReturnValue({ data: null, error: null });
    await expect(confirmEmployeeLogbookTrip({ trip, distanceKm: 1.2 })).rejects.toThrow('nicht gespeichert');
  });
  it('accepts a retry only when matching kilometres were already confirmed', async () => {
    mocks.response.mockImplementation((table, operation) => ({ data: table === 'employee_logbook_trips' && operation === 'read' ? { status: 'confirmed', distance_final_km: 1.2, employee_confirmed_at: trip.endedAt } : null, error: null }));
    await expect(confirmEmployeeLogbookTrip({ trip, distanceKm: 1.2 })).resolves.toBeUndefined();
    await expect(confirmEmployeeLogbookTrip({ trip, distanceKm: 2, reason: 'Umleitung' })).rejects.toThrow('nicht gespeichert');
  });
  it('does not confirm a trip if the segment repair failed', async () => {
    mocks.response.mockReturnValue({ data: null, error: { message: 'segment denied' } });
    await expect(confirmEmployeeLogbookTrip({ trip, distanceKm: 1.2 })).rejects.toThrow('segment denied');
    expect(mocks.writes).toHaveLength(1);
  });
  it('validates corrections and an ended trip before writing', async () => {
    await expect(confirmEmployeeLogbookTrip({ trip, distanceKm: NaN })).rejects.toThrow('gültige');
    await expect(confirmEmployeeLogbookTrip({ trip, distanceKm: 2, reason: '' })).rejects.toThrow('begründen');
    await expect(confirmEmployeeLogbookTrip({ trip: { ...trip, endedAt: null }, distanceKm: 1.2 })).rejects.toThrow('beendet');
    expect(mocks.writes).toHaveLength(0);
  });
});
