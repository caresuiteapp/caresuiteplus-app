import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

describe('devicePerformance (pure)', () => {
  it('returns mobileBalanced for narrow viewports', async () => {
    const { getDevicePerformanceProfile } = await import('@/lib/performance/devicePerformance');
    const snap = getDevicePerformanceProfile({ viewportWidth: 390 });
    expect(snap.isMobile).toBe(true);
    expect(['mobileBalanced', 'mobileBatterySaver', 'activeTrackingSaver']).toContain(snap.profile);
  });

  it('extends poll intervals on battery saver profile', async () => {
    const { livePollIntervalMs } = await import('@/lib/performance/devicePerformance');
    expect(livePollIntervalMs('mobileBatterySaver', 15_000)).toBeGreaterThanOrEqual(60_000);
    expect(livePollIntervalMs('desktopHigh', 15_000)).toBe(15_000);
  });

  it('enables heavy effects on mobileBalanced (non-Safari)', async () => {
    const { getDevicePerformanceProfile, shouldUseHeavyEffects } = await import(
      '@/lib/performance/devicePerformance'
    );
    const snap = getDevicePerformanceProfile({ viewportWidth: 390 });
    expect(shouldUseHeavyEffects(snap)).toBe(true);
  });

  it('disables heavy effects on mobile safari snapshot', async () => {
    const { getDevicePerformanceProfile, shouldUseHeavyEffects } = await import(
      '@/lib/performance/devicePerformance'
    );
    const snap = getDevicePerformanceProfile({ viewportWidth: 390 });
    const iosSafari = { ...snap, isIOS: true, isSafari: true, isMobile: true };
    expect(shouldUseHeavyEffects(iosSafari)).toBe(false);
  });

  it('uses longer GPS write interval on active tracking saver', async () => {
    const { gpsMinWriteIntervalMs } = await import('@/lib/performance/devicePerformance');
    expect(gpsMinWriteIntervalMs('activeTrackingSaver')).toBe(30_000);
  });
});

describe('useSingleGeolocationWatch singleton', () => {
  const geo = {
    watchPosition: vi.fn((_success: PositionCallback, _error: PositionErrorCallback, _opts?: PositionOptions) => 42),
    clearWatch: vi.fn(),
    getCurrentPosition: vi.fn(),
  };

  beforeEach(async () => {
    const { resetGeolocationWatchesForTests } = await import(
      '@/features/liveTracking/useSingleGeolocationWatch'
    );
    resetGeolocationWatchesForTests();
    vi.stubGlobal('navigator', { geolocation: geo });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { resetGeolocationWatchesForTests } = await import(
      '@/features/liveTracking/useSingleGeolocationWatch'
    );
    resetGeolocationWatchesForTests();
    vi.unstubAllGlobals();
  });

  it('shares one watch across two subscribers with same session key', async () => {
    const { acquireGeolocationWatch, getActiveGeolocationWatchCount } = await import(
      '@/features/liveTracking/useSingleGeolocationWatch'
    );
    const onA = vi.fn();
    const onB = vi.fn();
    const releaseA = acquireGeolocationWatch({
      sessionKey: 'tenant:session-1',
      enabled: true,
      onSnapshot: onA,
    });
    const releaseB = acquireGeolocationWatch({
      sessionKey: 'tenant:session-1',
      enabled: true,
      onSnapshot: onB,
    });

    expect(getActiveGeolocationWatchCount()).toBe(1);
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);

    releaseA();
    expect(getActiveGeolocationWatchCount()).toBe(1);

    releaseB();
    expect(getActiveGeolocationWatchCount()).toBe(0);
    expect(geo.clearWatch).toHaveBeenCalled();
  });
});

describe('useLiveRefresh constants', () => {
  it('uses 15s live tracking poll after PERF.1', async () => {
    const mod = await import('@/hooks/core/useLiveRefresh');
    expect(mod.LIVE_TRACKING_POLL_MS).toBe(15_000);
  });
});

describe('performanceCss', () => {
  it('defines required body classes', async () => {
    const { PERFORMANCE_BODY_CLASSES } = await import('@/lib/performance/performanceCss');
    expect(PERFORMANCE_BODY_CLASSES.mobile).toBe('performance-mobile');
    expect(PERFORMANCE_BODY_CLASSES.heavyEffectsOff).toBe('disable-heavy-effects');
  });

  it('disables heavy effects only when shouldUseHeavyEffects is false', async () => {
    const toggle = vi.fn();
    vi.stubGlobal('document', {
      documentElement: { classList: { toggle } },
      getElementById: vi.fn(() => ({ id: 'caresuite-perf-1-css' })),
      createElement: vi.fn(() => ({ id: '', textContent: '' })),
      head: { appendChild: vi.fn() },
    });
    const { syncPerformanceBodyClasses, PERFORMANCE_BODY_CLASSES } = await import(
      '@/lib/performance/performanceCss'
    );
    syncPerformanceBodyClasses({
      isMobile: true,
      isIOS: false,
      isSafari: false,
      prefersReducedMotion: false,
      batterySaver: false,
      activeTracking: false,
      profile: 'mobileBalanced',
      lowMemory: false,
    });
    expect(toggle).toHaveBeenCalledWith(PERFORMANCE_BODY_CLASSES.heavyEffectsOff, false);
    vi.unstubAllGlobals();
  });
});

describe('lightLiquidGlassWebFx mobile thermal guard', () => {
  it('keeps backdrop-filter on narrow/coarse viewports', async () => {
    vi.stubGlobal('window', {
      innerWidth: 390,
      matchMedia: () => ({ matches: true }),
    });
    const { lightLiquidGlassWebFx } = await import('@/design/tokens/auroraGlass');
    const fx = lightLiquidGlassWebFx(24, 1.4) as Record<string, unknown>;
    expect(fx.backdropFilter).toContain('blur');
    expect(fx.WebkitBackdropFilter).toContain('blur');
    expect(fx.boxShadow).toBeDefined();
    vi.unstubAllGlobals();
  });
});
