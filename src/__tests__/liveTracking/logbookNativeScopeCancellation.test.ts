import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ store: new Map<string, string>(), get: vi.fn(), set: vi.fn(), remove: vi.fn(), foreground: vi.fn(), requestForeground: vi.fn(), background: vi.fn(), requestBackground: vi.fn(), started: vi.fn(), start: vi.fn(), stop: vi.fn(), flush: vi.fn(), active: false }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: h.get, setItem: h.set, removeItem: h.remove } }));
vi.mock('expo-location', () => ({
  getForegroundPermissionsAsync: h.foreground, requestForegroundPermissionsAsync: h.requestForeground,
  getBackgroundPermissionsAsync: h.background, requestBackgroundPermissionsAsync: h.requestBackground,
  hasStartedLocationUpdatesAsync: h.started, startLocationUpdatesAsync: h.start, stopLocationUpdatesAsync: h.stop,
  Accuracy: { High: 4 }, ActivityType: { AutomotiveNavigation: 1 },
}));
vi.mock('expo-task-manager', () => ({ isTaskDefined: () => true, defineTask: vi.fn() }));
vi.mock('@/lib/employeeLogbook/employeeLogbookPointQueue', () => ({ flushLogbookPointQueue: h.flush, persistLogbookPointDurably: vi.fn() }));
vi.mock('@/features/liveTracking/assistLocationPointQueue', () => ({ persistAssistLocationPointDurably: vi.fn() }));
const contextKey = 'caresuite-employee-logbook-active-context';
const a = { tripId: 'trip-a', tenantId: 'tenant', employeeId: 'employee-a' };
const b = { tripId: 'trip-b', tenantId: 'tenant', employeeId: 'employee-b' };
const granted = { status: 'granted' };
const settle = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); h.store.clear(); h.active = false;
  h.get.mockImplementation(async key => h.store.get(key) ?? null);
  h.set.mockImplementation(async (key, value) => { h.store.set(key, value); });
  h.remove.mockImplementation(async key => { h.store.delete(key); });
  h.foreground.mockResolvedValue(granted); h.requestForeground.mockResolvedValue(granted);
  h.background.mockResolvedValue(granted); h.requestBackground.mockResolvedValue(granted);
  h.started.mockImplementation(async () => h.active); h.start.mockImplementation(async () => { h.active = true; });
  h.stop.mockImplementation(async () => { h.active = false; }); h.flush.mockResolvedValue({ remaining: 0 });
});
describe('native logbook start cancellation at async boundaries', () => {
  it.each(['foreground-read', 'foreground-prompt', 'background-read', 'background-prompt', 'flush', 'context-write', 'native-start'])('does not retain an old recording after cancellation during %s', async stage => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookTracking');
    let resolve!: (value?: unknown) => void;
    const waiting = new Promise(r => { resolve = r; });
    let reached = false;
    const suspend = () => { reached = true; return waiting; };
    if (stage === 'foreground-read') h.foreground.mockImplementationOnce(suspend);
    if (stage === 'foreground-prompt') { h.foreground.mockResolvedValueOnce({ status: 'denied' }); h.requestForeground.mockImplementationOnce(suspend); }
    if (stage === 'background-read') h.background.mockImplementationOnce(suspend);
    if (stage === 'background-prompt') { h.background.mockResolvedValueOnce({ status: 'denied' }); h.requestBackground.mockImplementationOnce(suspend); }
    if (stage === 'flush') h.flush.mockImplementationOnce(suspend);
    if (stage === 'context-write') h.set.mockImplementationOnce(async (key, value) => { await suspend(); h.store.set(key, value); });
    if (stage === 'native-start') h.start.mockImplementationOnce(async () => { await suspend(); h.active = true; });
    let permitted = true;
    const start = api.startNativeBackgroundTracking(a, { shouldContinue: () => permitted }); await settle();
    expect(reached).toBe(true); permitted = false;
    const stop = api.stopNativeBackgroundTracking({ tenantId: 'tenant', employeeId: 'employee-a' });
    resolve(stage.includes('read') || stage.includes('prompt') ? granted : stage === 'flush' ? { remaining: 0 } : undefined);
    expect(await start).toBe(false); await stop;
    expect(h.store.has(contextKey)).toBe(false); expect(h.active).toBe(false);
  });
  it('keeps B running when an older A permission request finishes after A was stopped', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookTracking');
    let resolve!: (value: unknown) => void;
    h.foreground.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const old = api.startNativeBackgroundTracking(a); await settle();
    await api.stopNativeBackgroundTracking(a);
    expect(await api.startNativeBackgroundTracking(b)).toBe(true);
    resolve(granted); expect(await old).toBe(false);
    expect(JSON.parse(h.store.get(contextKey)!)).toEqual(b); expect(h.active).toBe(true);
    expect(h.start).toHaveBeenCalledOnce();
  });
  it('cleans a late A native start before B writes and preserves B through a subsequent scoped A stop', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookTracking');
    let resolve!: () => void;
    h.start.mockImplementationOnce(async () => { await new Promise<void>(r => { resolve = r; }); h.active = true; });
    const old = api.startNativeBackgroundTracking(a); await settle();
    const stopA = api.stopNativeBackgroundTracking(a); const next = api.startNativeBackgroundTracking(b);
    resolve(); expect(await old).toBe(false); await stopA; expect(await next).toBe(true);
    await api.stopNativeBackgroundTracking(a);
    expect(JSON.parse(h.store.get(contextKey)!)).toEqual(b); expect(h.active).toBe(true);
    expect(h.stop).toHaveBeenCalledOnce(); expect(h.start).toHaveBeenCalledTimes(2);
  });
  it('keeps the new Assist consumer through late A permission and cleanup, with the logbook consumer intact', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookTracking');
    const assistA = { tenantId: 'tenant', employeeId: 'employee-a', assistSessionId: 'session-a', assistVisitId: 'visit-a' };
    const assistB = { tenantId: 'tenant', employeeId: 'employee-b', assistSessionId: 'session-b', assistVisitId: 'visit-b' };
    const assistKey = 'caresuite-assist-background-location-context';
    expect(await api.startNativeBackgroundTracking(b)).toBe(true);
    let resolve!: (value: unknown) => void; h.foreground.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const old = api.linkActiveLogbookToAssistSession(assistA); await settle();
    await api.stopNativeAssistBackgroundTracking(assistA);
    expect(await api.linkActiveLogbookToAssistSession(assistB)).toBe(true);
    resolve(granted); expect(await old).toBe(false); await api.stopNativeAssistBackgroundTracking(assistA);
    expect(JSON.parse(h.store.get(assistKey)!)).toEqual(assistB); expect(JSON.parse(h.store.get(contextKey)!)).toEqual(b);
    expect(h.active).toBe(true); expect(h.stop).not.toHaveBeenCalled();
  });
  it('removes a cancelled Assist context after its native start resolves without stopping a live logbook consumer', async () => {
    const api = await import('@/lib/employeeLogbook/employeeLogbookTracking');
    const assist = { tenantId: 'tenant', employeeId: 'employee-a', assistSessionId: 'session-a', assistVisitId: 'visit-a' };
    let permitted = true; let resolve!: () => void;
    h.start.mockImplementationOnce(async () => { await new Promise<void>(r => { resolve = r; }); h.active = true; });
    const old = api.linkActiveLogbookToAssistSession(assist, { shouldContinue: () => permitted }); await settle();
    permitted = false; const stop = api.stopNativeAssistBackgroundTracking(assist); const next = api.startNativeBackgroundTracking(b); resolve();
    expect(await old).toBe(false); await stop; expect(await next).toBe(true);
    expect(h.store.has('caresuite-assist-background-location-context')).toBe(false); expect(JSON.parse(h.store.get(contextKey)!)).toEqual(b); expect(h.active).toBe(true);
  });
});
