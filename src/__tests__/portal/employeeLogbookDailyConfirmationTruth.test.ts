import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: h.from }) }));
import { confirmLogbookDay } from '@/lib/employeeLogbook/employeeLogbookRepository.supabase';
import type { LogbookTrip } from '@/types/modules/employeeLogbook';
const trip = (patch = {}) => ({ id: 'trip-1', tenantId: 'tenant', employeeId: 'employee', startedAt: '2026-10-10T08:00:00Z', status: 'confirmed', distanceFinalKm: 5.5, ...patch }) as LogbookTrip;
const input = (trips = [trip()]) => ({ tenantId: 'tenant', employeeId: 'employee', workDate: '2026-10-10', signerName: 'Test Person', signatureData: 'data:image/png;base64,signature', trips });
beforeEach(() => { vi.clearAllMocks(); h.insert.mockResolvedValue({ error: null }); h.from.mockReturnValue({ insert: h.insert }); });
describe('individual mileage confirmation followed by daily signature', () => {
  it('signs a day whose individual trips are already confirmed', async () => {
    await confirmLogbookDay(input());
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ work_date: '2026-10-10', trip_count: 1, distance_km: 5.5, tenant_id: 'tenant', employee_id: 'employee' }));
  });
  it('includes legacy completed and corrected trips in the same daily total', async () => {
    await confirmLogbookDay(input([trip(), trip({ status: 'completed', distanceFinalKm: 2 }), trip({ status: 'corrected', distanceFinalKm: 3 })]));
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ trip_count: 3, distance_km: 10.5 }));
  });
  it.each(['recording', 'confirmation_required', 'review_required'])('requires resolving %s trips before binding the daily total', async (status) => {
    await expect(confirmLogbookDay(input([trip(), trip({ id: 'open', status })]))).rejects.toThrow('offenen Fahrten');
    expect(h.insert).not.toHaveBeenCalled();
  });
  it('excludes cancelled trips, another employee/tenant, and the next Berlin day', async () => {
    await confirmLogbookDay(input([trip(), trip({ status: 'cancelled' }), trip({ tenantId: 'other' }), trip({ employeeId: 'other' }), trip({ startedAt: '2026-10-10T22:30:00Z' })]));
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ trip_count: 1, distance_km: 5.5 }));
  });
  it('rejects missing signature/name before writing', async () => {
    await expect(confirmLogbookDay({ ...input(), signerName: 'A' })).rejects.toThrow('Namen');
    await expect(confirmLogbookDay({ ...input(), signatureData: '' })).rejects.toThrow('Unterschrift');
    expect(h.insert).not.toHaveBeenCalled();
  });
  it('surfaces a database failure without claiming the day was signed', async () => {
    h.insert.mockResolvedValue({ error: { message: 'Datenbank nicht erreichbar' } });
    await expect(confirmLogbookDay(input())).rejects.toThrow('Datenbank nicht erreichbar');
  });
});
