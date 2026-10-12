import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ eligibility: vi.fn(), load: vi.fn(), create: vi.fn(), append: vi.fn(), start: vi.fn(), permission: vi.fn(), point: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@/lib/employeeLogbook', () => ({
  appendLogbookPoints: h.append, createLogbookTrip: h.create, finishEmployeeLogbookRecording: vi.fn(),
  berlinDateKey: () => '2026-10-11', berlinToday: () => '2026-10-11',
  getCurrentLogbookPoint: h.point, loadEmployeeLogbook: h.load, loadLogbookTrip: vi.fn(),
  requestLogbookLocationPermission: h.permission, saveLogbookProfile: vi.fn(),
  startNativeBackgroundTracking: h.start, stopNativeAssistBackgroundTracking: vi.fn(),
}));
vi.mock('@/lib/employeeLogbook/employeeLogbookAutomation', () => ({ resolveEmployeeLogbookEligibility: h.eligibility, acquireEmployeeLogbookForegroundTracking: vi.fn(), createEmployeeLogbookTrackingGuard: () => () => true }));
import { startEmployeeReturnTrip } from '@/lib/portal/employeePortalReturnTrip';
const input = { tenantId: 'tenant', employeeId: 'employee', assignmentId: 'visit', clientId: 'client', clientName: 'Client', startAddress: 'Start', destination: 'home' as const };
beforeEach(() => {
  vi.clearAllMocks(); h.eligibility.mockResolvedValue({ eligible: true, vehicleId: 'car' });
  h.load.mockResolvedValue({ trips: [], profile: { gpsConsent: true } });
  h.create.mockResolvedValue({ id: 'trip', status: 'recording', assignmentId: 'visit', routeType: 'client_to_home' });
  h.point.mockResolvedValue({ latitude: 1, longitude: 2 }); h.append.mockResolvedValue(undefined); h.start.mockResolvedValue(undefined);
});
describe('employee return-trip start persistence', () => {
  it('shares a pending start so same-tick double taps write only one trip and first point', async () => {
    let resolve!: (value: unknown) => void;
    h.eligibility.mockReturnValue(new Promise(r => { resolve = r; }));
    const first = startEmployeeReturnTrip(input); const duplicate = startEmployeeReturnTrip(input);
    expect(first).toBe(duplicate);
    await Promise.resolve(); resolve({ eligible: true, vehicleId: 'car' });
    const [a, b] = await Promise.all([first, duplicate]);
    expect(a).toEqual(b); expect(a.resumed).toBe(false);
    expect(h.create).toHaveBeenCalledTimes(1); expect(h.append).toHaveBeenCalledTimes(1); expect(h.start).toHaveBeenCalledTimes(1);
  });
  it('does not start a default car trip after mobility eligibility failed and allows a real retry', async () => {
    h.eligibility.mockRejectedValueOnce(new Error('Mobilität konnte nicht geladen werden'));
    await expect(startEmployeeReturnTrip(input)).rejects.toThrow('Mobilität');
    expect(h.create).not.toHaveBeenCalled(); expect(h.permission).not.toHaveBeenCalled();
    await expect(startEmployeeReturnTrip(input)).resolves.toMatchObject({ resumed: false });
    expect(h.create).toHaveBeenCalledTimes(1);
  });
  it('resumes an existing return leg with its stored destination without writing another trip', async () => {
    h.load.mockResolvedValue({ trips: [{ id: 'existing', status: 'recording', assignmentId: 'visit', routeType: 'client_to_office' }], profile: { gpsConsent: true } });
    expect(await startEmployeeReturnTrip(input)).toMatchObject({ trip: { id: 'existing', routeType: 'client_to_office' }, resumed: true });
    expect(h.create).not.toHaveBeenCalled(); expect(h.start).toHaveBeenCalledWith({ tripId: 'existing', tenantId: 'tenant', employeeId: 'employee' }, expect.objectContaining({ shouldContinue: expect.any(Function) }));
  });
});
