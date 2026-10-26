import { describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ request: vi.fn(), liveDetail: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/portal/assist/portalRequestService', () => ({ createPortalRequest: f.request }));
vi.mock('@/lib/portal/portalAppointmentsLiveService', () => ({ fetchLivePortalClientAppointmentDetail: f.liveDetail, fetchLivePortalAppointmentsForClient: vi.fn(), fetchLivePortalAppointmentsForEmployee: vi.fn() }));
import { requestPortalAppointmentChange } from '@/lib/portal/appointmentService';
describe('family appointment change writer contract', () => {
  it('refuses the family role before appointment reads or portal request writes despite broad static role permission', async () => {
    const result = await requestPortalAppointmentChange('visit-a', 'account-a', 'family_portal', 'Bitte später planen.', { tenantId: 'tenant-a', clientId: 'client-a' });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('nicht freigegeben') });
    expect(f.liveDetail).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });
});
