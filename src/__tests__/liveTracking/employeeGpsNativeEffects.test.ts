import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useEmployeeGpsTracking,
  type UseEmployeeGpsTrackingOptions,
} from '@/features/liveTracking/useEmployeeGpsTracking';

// Execute the actual hook's effects, including dependency changes and React's
// passive-effect disconnect/reconnect. Only React scheduling and device/network
// boundaries are substituted: no source-string assertions or live writes.
const harness = vi.hoisted(() => {
  type Effect = {
    run: () => void | (() => void);
    deps?: readonly unknown[];
    cleanup?: () => void;
    pending: boolean;
  };
  const slots: unknown[] = [];
  const effects = new Map<number, Effect>();
  let cursor = 0;
  let updates = 0;
  const sameDeps = (a?: readonly unknown[], b?: readonly unknown[]) =>
    Boolean(a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i])));
  return {
    platform: { OS: 'android' },
    connection: { isOffline: false, isInternetReachable: null as boolean | null },
    begin: () => { cursor = 0; },
    reset: () => { slots.length = 0; effects.clear(); cursor = 0; updates = 0; },
    updateCount: () => updates,
    mountEffects: () => {
      for (const effect of effects.values()) {
        if (!effect.pending) continue;
        effect.cleanup?.();
        effect.cleanup = effect.run() || undefined;
        effect.pending = false;
      }
    },
    disconnect: () => {
      for (const effect of effects.values()) {
        effect.cleanup?.();
        effect.cleanup = undefined;
        effect.pending = true;
      }
    },
    useRef: (initial: unknown) => {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next: unknown) => {
        slots[index] = typeof next === 'function' ? next(slots[index]) : next;
        updates += 1;
      }];
    },
    useCallback: (callback: unknown, deps: readonly unknown[]) => {
      const index = cursor++;
      const old = slots[index] as { callback: unknown; deps: readonly unknown[] } | undefined;
      if (!old || !sameDeps(old.deps, deps)) slots[index] = { callback, deps };
      return (slots[index] as { callback: unknown }).callback;
    },
    useEffect: (run: Effect['run'], deps?: readonly unknown[]) => {
      const index = cursor++;
      const old = effects.get(index);
      effects.set(index, {
        run, deps, cleanup: old?.cleanup,
        pending: !old || old.pending || !sameDeps(old.deps, deps),
      });
    },
  };
});

const mocks = vi.hoisted(() => ({
  flush: vi.fn(),
  capture: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  stopBackground: vi.fn(),
  append: vi.fn(), link: vi.fn(), resume: vi.fn(),
  enqueue: vi.fn(), retained: [] as unknown[],
}));

vi.mock('react', () => harness);
vi.mock('react-native', () => ({ Platform: harness.platform }));
vi.mock('@/hooks/useConnectivity', () => ({ useConnectivity: () => harness.connection }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => null }));
vi.mock('@/lib/assist/assistTrackingPersistenceService', () => ({ appendLocationPoint: mocks.append }));
vi.mock('@/features/liveTracking/assistLocationPointQueue', () => ({
  flushAssistLocationPointQueue: mocks.flush,
  getQueuedAssistLocationPointCount: async () => 0,
  enqueueAssistLocationPoint: mocks.enqueue,
}));
vi.mock('@/features/liveTracking/useSingleGeolocationWatch', () => ({
  acquireGeolocationWatch: mocks.acquire,
  captureGeolocationOnce: mocks.capture,
  EMPLOYEE_LIVE_LOCATION_INTERVAL_MS: 15_000,
  EMPLOYEE_ROUTE_LOCATION_INTERVAL_MS: 15_000,
}));
vi.mock('@/lib/employeeLogbook/employeeLogbookTracking', () => ({
  stopNativeAssistBackgroundTracking: mocks.stopBackground,
  linkActiveLogbookToAssistSession: mocks.link,
}));
vi.mock('@/lib/employeeLogbook/employeeLogbookAutomation', () => ({ resumeActiveEmployeeLogbookTracking: mocks.resume }));

const inactive = {
  tenantId: null,
  employeeId: null,
  assistVisitId: null,
  sessionId: null,
  enabled: false,
};

function GpsHookProbe(options: UseEmployeeGpsTrackingOptions = inactive) {
  harness.begin();
  const result = useEmployeeGpsTracking(options);
  harness.mountEffects();
  return result;
}

const render = GpsHookProbe;

async function settle() {
  // Native-module imports and queue callbacks may complete on different turns.
  await vi.dynamicImportSettled();
  await Promise.resolve();
}

describe('employee GPS native passive effects — EINSATZ-MTOUOP8Z-OHGH', () => {
  beforeEach(() => {
    harness.reset();
    harness.platform.OS = 'android';
    harness.connection.isOffline = false;
    harness.connection.isInternetReachable = null;
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('navigator', {});
    mocks.flush.mockResolvedValue({ sent: 0, remaining: 0 });
    mocks.capture.mockResolvedValue(null);
    mocks.acquire.mockReturnValue(mocks.release);
    mocks.stopBackground.mockResolvedValue(undefined);
    mocks.append.mockResolvedValue({ ok: true });
    mocks.link.mockResolvedValue(true);
    mocks.resume.mockResolvedValue(null);
    mocks.retained.length = 0;
    mocks.enqueue.mockImplementation(async (_tenant, point) => { mocks.retained.push(point); return mocks.retained.length; });
  });

  afterEach(async () => {
    harness.disconnect();
    await settle();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['android', 'ios'])('mounts and reconnects on %s without browser event functions', async (os) => {
    harness.platform.OS = os;
    expect(() => render()).not.toThrow();
    await settle();
    harness.disconnect();
    expect(() => harness.mountEffects()).not.toThrow();
    await settle();
    expect(mocks.flush).toHaveBeenCalledTimes(2);
  });

  it('does not treat a native document object as a browser document', () => {
    vi.stubGlobal('document', {});
    expect(() => render()).not.toThrow();
  });

  it('supports a server render without window or document', () => {
    harness.platform.OS = 'web';
    vi.stubGlobal('window', undefined);
    expect(() => render()).not.toThrow();
  });

  it('does not register browser visibility events without the matching cleanup API', () => {
    harness.platform.OS = 'web';
    const addEventListener = vi.fn();
    vi.stubGlobal('document', { addEventListener });
    expect(() => render()).not.toThrow();
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('flushes retained points on offline-to-online transition, without duplicate rerender requests', async () => {
    harness.connection.isOffline = true;
    render();
    await settle();
    expect(mocks.flush).not.toHaveBeenCalled();
    harness.connection.isOffline = false;
    mocks.flush.mockResolvedValue({ sent: 3, remaining: 2 });
    render();
    await settle();
    expect(render().state.queuedPointCount).toBe(2);
    expect(mocks.flush).toHaveBeenCalledTimes(1);
  });

  it('waits when the network is connected but internet access is known to be unavailable', async () => {
    harness.connection.isInternetReachable = false;
    render();
    await settle();
    expect(mocks.flush).not.toHaveBeenCalled();
    harness.connection.isInternetReachable = true;
    render();
    await settle();
    expect(mocks.flush).toHaveBeenCalledTimes(1);
  });

  it('does not update detached effects when a queue request finishes late', async () => {
    let finish!: (result: { sent: number; remaining: number }) => void;
    mocks.flush.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render();
    harness.disconnect();
    const updates = harness.updateCount();
    finish({ sent: 1, remaining: 4 });
    await settle();
    expect(harness.updateCount()).toBe(updates);
  });

  it('reports a failed queue retry without a crash and clears that error after recovery', async () => {
    mocks.flush.mockRejectedValueOnce(new Error('storage unavailable'));
    render();
    await settle();
    expect(render().state.errorCode).toBe('LIVE_LOCATION_INSERT_FAILED');
    harness.connection.isOffline = true;
    render();
    harness.connection.isOffline = false;
    render();
    await settle();
    expect(render().state.errorCode).toBeNull();
  });

  it('keeps browser visibility handling and removes its listener on disconnect', async () => {
    harness.platform.OS = 'web';
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener, removeEventListener });
    // This hook must use the shared connectivity hook for online events.
    render();
    await settle();
    const callback = addEventListener.mock.calls[0]?.[1];
    expect(addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    harness.disconnect();
    expect(removeEventListener).toHaveBeenCalledWith('visibilitychange', callback);
  });

  it('reattaches an active foreground watch after reconnect without ending native background tracking', async () => {
    const options = { ...inactive, enabled: true, sessionId: 'synthetic-session' };
    render(options);
    await settle();
    expect(mocks.acquire).toHaveBeenCalledTimes(1);
    harness.disconnect();
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.stopBackground).not.toHaveBeenCalled();
    harness.mountEffects();
    await settle();
    expect(mocks.acquire).toHaveBeenCalledTimes(2);
    expect(mocks.stopBackground).not.toHaveBeenCalled();
  });

  it('cancels a pending GPS startup when tracking is disabled before permission resolves', async () => {
    let finish!: (snapshot: unknown) => void;
    mocks.capture.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const options = { tenantId: 'tenant', employeeId: 'employee', assistVisitId: 'A', sessionId: 'session-A', enabled: true };
    render(options);
    render({ ...options, enabled: false });
    finish({ latitude: 52, longitude: 13, capturedAt: '2026-10-11T08:00:00Z' });
    await settle();
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.append).not.toHaveBeenCalled();
    expect(mocks.link).not.toHaveBeenCalled();
    expect(render({ ...options, enabled: false }).state.watching).toBe(false);
  });

  it('ignores a late GPS fix after the execution screen has unmounted', async () => {
    let finish!: (snapshot: unknown) => void;
    mocks.capture.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render({ ...inactive, sessionId: 'session-A', enabled: true });
    harness.disconnect();
    const updates = harness.updateCount();
    finish({ latitude: 52, longitude: 13, capturedAt: '2026-10-11T08:00:00Z' });
    await settle();
    expect(harness.updateCount()).toBe(updates);
    expect(mocks.acquire).not.toHaveBeenCalled();
  });

  it('replaces the foreground watch when its session changes and rejects old callbacks', async () => {
    const options = { ...inactive, sessionId: 'session-A', enabled: true };
    render(options); await settle();
    const oldWatch = mocks.acquire.mock.calls[0][0];
    render({ ...options, sessionId: 'session-B' }); await settle();
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.acquire).toHaveBeenCalledTimes(2);
    const updates = harness.updateCount();
    oldWatch.onSnapshot({ latitude: 52, longitude: 13, capturedAt: '2026-10-11T08:00:00Z' });
    oldWatch.onError(1);
    await settle();
    expect(harness.updateCount()).toBe(updates);
    expect(mocks.stopBackground).not.toHaveBeenCalled();
  });

  it('retains a watch point when the provider write rejects and allows subsequent writes', async () => {
    const options = { tenantId: 'tenant', employeeId: 'employee', assistVisitId: 'A', sessionId: 'session-A', enabled: true };
    render(options); await settle();
    const watch = mocks.acquire.mock.calls[0][0];
    mocks.append.mockRejectedValueOnce(new Error('offline'));
    watch.onSnapshot({ latitude: 52, longitude: 13, capturedAt: '2026-10-11T08:00:00Z' }); await settle();
    expect(mocks.retained).toHaveLength(1);
    expect(render(options).state.errorCode).toBe('LIVE_LOCATION_INSERT_FAILED');
    expect(render(options).state.queuedPointCount).toBe(1);
    watch.onSnapshot({ latitude: 53, longitude: 14, capturedAt: '2026-10-11T08:01:00Z' }); await settle();
    expect(render(options).state.writeCount).toBe(1);
    expect(mocks.retained).toHaveLength(1);
  });

  it('reports a failed local watch-point enqueue without an unhandled rejection', async () => {
    const options = { tenantId: 'tenant', employeeId: 'employee', assistVisitId: 'A', sessionId: 'session-A', enabled: true };
    render(options); await settle();
    mocks.append.mockResolvedValueOnce({ ok: false, error: 'offline' });
    mocks.enqueue.mockRejectedValueOnce(new Error('storage full'));
    mocks.acquire.mock.calls[0][0].onSnapshot({ latitude: 52, longitude: 13, capturedAt: '2026-10-11T08:00:00Z' }); await settle();
    expect(render(options).state.errorCode).toBe('LIVE_LOCATION_INSERT_FAILED');
    expect(render(options).state.errorMessage).toContain('Bereits gesicherte Punkte bleiben erhalten');
  });

  it('reports a rejected heartbeat queue flush and releases busy state for the next timer retry', async () => {
    const options = { ...inactive, sessionId: 'session-A', enabled: true };
    render(options); await settle();
    mocks.flush.mockRejectedValueOnce(new Error('queue storage unavailable'));
    await vi.advanceTimersByTimeAsync(15_000); await settle();
    expect(render(options).state.errorCode).toBe('LIVE_LOCATION_INSERT_FAILED');
    const attempts = mocks.flush.mock.calls.length;
    await vi.advanceTimersByTimeAsync(15_000); await settle();
    expect(mocks.flush).toHaveBeenCalledTimes(attempts + 1);
  });

  it('reports a rejected web route sample and continues timer sampling', async () => {
    harness.platform.OS = 'web';
    const options = { ...inactive, sessionId: 'session-A', enabled: true };
    mocks.capture.mockResolvedValueOnce({ latitude: 52, longitude: 13, capturedAt: new Date().toISOString() });
    render(options); await settle();
    mocks.capture.mockRejectedValueOnce(new Error('provider unavailable'));
    await vi.advanceTimersByTimeAsync(15_000); await settle();
    expect(render(options).state.errorCode).toBe('LIVE_LOCATION_INSERT_FAILED');
    const attempts = mocks.capture.mock.calls.length;
    await vi.advanceTimersByTimeAsync(15_000); await settle();
    expect(mocks.capture.mock.calls.length).toBeGreaterThan(attempts);
  });

  it('does not report an old watch enqueue failure to a replacement session', async () => {
    let reject!: (error: Error) => void;
    const options = { tenantId: 'tenant', employeeId: 'employee', assistVisitId: 'A', sessionId: 'session-A', enabled: true };
    render(options); await settle();
    mocks.append.mockResolvedValueOnce({ ok: false, error: 'offline' });
    mocks.enqueue.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    mocks.acquire.mock.calls[0][0].onSnapshot({ latitude: 52, longitude: 13, capturedAt: '2026-10-11T08:00:00Z' }); await settle();
    const replacement = { ...options, assistVisitId: 'B', sessionId: 'session-B' };
    render(replacement); await settle();
    const updates = harness.updateCount();
    reject(new Error('old storage failure')); await settle();
    expect(harness.updateCount()).toBe(updates);
  });

  it('passes a cancellable identity guard to the native Assist link', async () => {
    const options = { tenantId: 'tenant', employeeId: 'employee', assistVisitId: 'A', sessionId: 'session-A', enabled: true };
    render(options); await settle();
    const [scope, guard] = mocks.link.mock.calls[0];
    expect(scope).toEqual({ tenantId: 'tenant', employeeId: 'employee', assistVisitId: 'A', assistSessionId: 'session-A' });
    expect(guard.shouldContinue()).toBe(true);
    render({ ...options, assistVisitId: 'B', sessionId: 'session-B' }); await settle();
    expect(guard.shouldContinue()).toBe(false);
  });

  it('scopes a delayed native stop to the visit that requested it', async () => {
    const old = { tenantId: 'tenant', employeeId: 'employee', assistVisitId: 'A', sessionId: 'session-A', enabled: false };
    render(old);
    render({ ...old, assistVisitId: 'B', sessionId: 'session-B', enabled: true }); await settle();
    expect(mocks.stopBackground).toHaveBeenCalledWith({ tenantId: 'tenant', employeeId: 'employee', assistVisitId: 'A', assistSessionId: 'session-A' });
    expect(mocks.stopBackground).toHaveBeenCalledTimes(1);
  });

  it('does not announce successful tracking when native linking returns false', async () => {
    mocks.link.mockResolvedValueOnce(false);
    const options = { tenantId: 'tenant', employeeId: 'employee', assistVisitId: 'A', sessionId: 'session-A', enabled: true };
    render(options); await settle();
    expect(mocks.acquire).not.toHaveBeenCalled();
    const state = render(options).state;
    expect(state.watching).toBe(false);
    expect(state.errorCode).toBe('LIVE_SESSION_CREATE_FAILED');
    expect(mocks.resume).not.toHaveBeenCalled();
  });
});
