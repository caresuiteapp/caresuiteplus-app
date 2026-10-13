import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ load: vi.fn(), finish: vi.fn(), start: vi.fn(), stop: vi.fn(), acquire: vi.fn(), release: vi.fn(), persist: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@/lib/employeeLogbook/employeeLogbookRepository.supabase', () => ({ loadEmployeeLogbook: h.load, finishLogbookTrip: h.finish, loadLogbookTrip: vi.fn(), createLogbookTrip: vi.fn(), saveLogbookProfile: vi.fn() }));
vi.mock('@/lib/employeeLogbook/employeeLogbookTracking', () => ({ startNativeBackgroundTracking: h.start, stopNativeBackgroundTracking: h.stop, requestLogbookLocationPermission: vi.fn(), getCurrentLogbookPoint: vi.fn() }));
vi.mock('@/features/liveTracking/useSingleGeolocationWatch', () => ({ acquireGeolocationWatch: h.acquire }));
vi.mock('@/lib/employeeLogbook/employeeLogbookPointQueue', () => ({ flushLogbookPointQueue: async () => ({ remaining: 0 }), persistLogbookPointDurably: h.persist }));
const trip = (id: string) => ({ id, status: 'recording', startedAt: new Date().toISOString() });
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); h.start.mockResolvedValue(true); h.stop.mockResolvedValue(undefined);
  h.acquire.mockReturnValue(h.release); h.load.mockImplementation(async (_tenant, employee) => ({ trips: [trip('trip-' + employee)] }));
  h.persist.mockResolvedValue(undefined);
});
describe('recovery cancellation from actor lifecycle', () => {
  it('does not start an old A trip after a delayed bundle resolves following scope cleanup', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation');
    let resolve!: (value: unknown) => void;
    h.load.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const old = api.resumeActiveEmployeeLogbookTracking('tenant', 'a');
    await api.stopEmployeeLogbookTrackingForScope('tenant', 'a');
    await api.resumeActiveEmployeeLogbookTracking('tenant', 'b'); resolve({ trips: [trip('trip-a')] });
    expect(await old).toBeNull(); expect(h.start).toHaveBeenCalledTimes(1);
    expect(h.start.mock.calls[0][0].employeeId).toBe('b'); expect(h.acquire).toHaveBeenCalledTimes(1); expect(h.finish).not.toHaveBeenCalled();
  });
  it('passes cancellation through a waiting native start and never creates a foreground watcher after unmount', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation');
    let mounted = true;
    h.start.mockImplementation(async (_context, options) => { mounted = false; expect(options.shouldContinue()).toBe(false); return false; });
    expect(await api.resumeActiveEmployeeLogbookTracking('tenant', 'a', { shouldContinue: () => mounted })).toBeNull();
    expect(h.acquire).not.toHaveBeenCalled(); expect(h.finish).not.toHaveBeenCalled();
  });
  it('removes only A producers and rejects their late points while B remains active', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation');
    const releaseA = vi.fn(), releaseB = vi.fn(); h.acquire.mockReturnValueOnce(releaseA).mockReturnValueOnce(releaseB);
    await api.resumeActiveEmployeeLogbookTracking('tenant', 'a'); await api.resumeActiveEmployeeLogbookTracking('tenant', 'b');
    await api.stopEmployeeLogbookTrackingForScope('tenant', 'a');
    const point = { latitude: 1, longitude: 2, accuracyMeters: 3, capturedAt: new Date().toISOString() };
    h.acquire.mock.calls[0][0].onSnapshot(point); h.acquire.mock.calls[1][0].onSnapshot(point);
    expect(releaseA).toHaveBeenCalledOnce(); expect(releaseB).not.toHaveBeenCalled();
    expect(h.persist).toHaveBeenCalledTimes(1); expect(h.persist.mock.calls[0][0].employeeId).toBe('b'); expect(h.finish).not.toHaveBeenCalled();
    expect(h.stop).toHaveBeenLastCalledWith({ tenantId: 'tenant', employeeId: 'a' });
  });
  it('does not revive a trip whose explicit stop completed while its old read was pending', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation');
    let resolve!: (value: unknown) => void; h.load.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const pending = api.resumeActiveEmployeeLogbookTracking('tenant', 'a'); await api.stopAutomaticLogbookTracking('trip-a'); resolve({ trips: [trip('trip-a')] });
    expect(await pending).toBeNull(); expect(h.start).not.toHaveBeenCalled(); expect(h.acquire).not.toHaveBeenCalled();
  });
  it('stops only the previous Berlin-day trip without resuming it or modifying its records', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation');
    h.load.mockResolvedValue({ trips: [{ ...trip('stale'), startedAt: '2025-01-01T10:00:00Z' }] });
    expect(await api.resumeActiveEmployeeLogbookTracking('tenant', 'a')).toBeNull();
    expect(h.stop).toHaveBeenCalledWith({ tripId: 'stale', tenantId: 'tenant', employeeId: 'a' });
    expect(h.start).not.toHaveBeenCalled(); expect(h.acquire).not.toHaveBeenCalled(); expect(h.finish).not.toHaveBeenCalled();
  });
  it('reports failed point durability through the active consumer without an unhandled rejection', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation'); const onError = vi.fn();
    await api.resumeActiveEmployeeLogbookTracking('tenant', 'a', { onError });
    h.persist.mockRejectedValue(new Error('Gerätespeicher nicht verfügbar'));
    h.acquire.mock.calls[0][0].onSnapshot({ latitude: 1, longitude: 2, accuracyMeters: 3, capturedAt: new Date().toISOString() });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Gerätespeicher nicht verfügbar' }));
  });
  it('reports recovery only after durable point fulfillment and uses callbacks refreshed by resume', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation');
    const onError = vi.fn(), previousRecovery = vi.fn(), currentRecovery = vi.fn();
    await api.resumeActiveEmployeeLogbookTracking('tenant', 'a', { onError, onPointPersisted: previousRecovery });
    const snapshot = { latitude: 1, longitude: 2, accuracyMeters: 3, capturedAt: new Date().toISOString() };
    h.persist.mockRejectedValueOnce(new Error('Gerätespeicher nicht verfügbar'));
    h.acquire.mock.calls[0][0].onSnapshot(snapshot);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(onError).toHaveBeenCalledOnce(); expect(previousRecovery).not.toHaveBeenCalled();
    await api.resumeActiveEmployeeLogbookTracking('tenant', 'a', { onError, onPointPersisted: currentRecovery });
    expect(currentRecovery).not.toHaveBeenCalled(); expect(h.acquire).toHaveBeenCalledOnce();
    let resolve!: (value: unknown) => void;
    h.persist.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    h.acquire.mock.calls[0][0].onSnapshot(snapshot);
    await Promise.resolve(); expect(currentRecovery).not.toHaveBeenCalled();
    resolve({ stored: false, queued: 1 });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(currentRecovery).toHaveBeenCalledOnce(); expect(previousRecovery).not.toHaveBeenCalled();
  });
  it('does not let an older delayed point success clear a newer point failure', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation');
    const onError = vi.fn(), onPointPersisted = vi.fn();
    await api.resumeActiveEmployeeLogbookTracking('tenant', 'a', { onError, onPointPersisted });
    let resolve!: (value: unknown) => void;
    h.persist.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockRejectedValueOnce(new Error('Neuer Speicherfehler'));
    const onSnapshot = h.acquire.mock.calls[0][0].onSnapshot;
    onSnapshot({ latitude: 1, longitude: 2, accuracyMeters: 3, capturedAt: '2026-10-11T12:00:00Z' });
    onSnapshot({ latitude: 1, longitude: 2, accuracyMeters: 3, capturedAt: '2026-10-11T12:00:01Z' });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Neuer Speicherfehler' }));
    resolve({ stored: true, queued: 0 });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(onPointPersisted).not.toHaveBeenCalled();
  });
  it('ignores a fulfilled pending point after its foreground consumer scope was stopped', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation'); const onPointPersisted = vi.fn();
    await api.resumeActiveEmployeeLogbookTracking('tenant', 'a', { onPointPersisted });
    let resolve!: (value: unknown) => void; h.persist.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    h.acquire.mock.calls[0][0].onSnapshot({ latitude: 1, longitude: 2, accuracyMeters: 3, capturedAt: new Date().toISOString() });
    await api.stopEmployeeLogbookTrackingForScope('tenant', 'a'); resolve({ stored: true, queued: 0 });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(onPointPersisted).not.toHaveBeenCalled();
  });
  it('does not issue a second late native stop after its scope cleanup during foreground acquisition', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookAutomation');
    h.acquire.mockImplementationOnce(() => { void api.stopEmployeeLogbookTrackingForScope('tenant', 'a'); return h.release; });
    expect(await api.resumeActiveEmployeeLogbookTracking('tenant', 'a')).toBeNull();
    expect(h.stop).toHaveBeenCalledOnce(); expect(h.release).toHaveBeenCalledOnce();
    await api.resumeActiveEmployeeLogbookTracking('tenant', 'a');
    expect(h.start).toHaveBeenCalledTimes(2); expect(h.stop).toHaveBeenCalledOnce();
  });
});
