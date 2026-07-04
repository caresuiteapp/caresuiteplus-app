import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  getTimeOfDayGreeting,
  HYDRATION_SAFE_GREETING,
} from '@/lib/dashboard/timeOfDayGreeting';
import {
  resolveHydrationSafeHeight,
  resolveHydrationSafeWidth,
  SSR_LAYOUT_HEIGHT,
  SSR_LAYOUT_WIDTH,
} from '@/lib/platform/ssrLayoutDefaults';
import { readInitialConnectivityState } from '@/hooks/useConnectivity';

describe('hydration SSR defaults', () => {
  it('uses stable layout width before hydration', () => {
    expect(resolveHydrationSafeWidth(390, false)).toBe(SSR_LAYOUT_WIDTH);
    expect(resolveHydrationSafeWidth(390, true)).toBe(390);
  });

  it('uses stable layout height before hydration', () => {
    expect(resolveHydrationSafeHeight(640, false)).toBe(SSR_LAYOUT_HEIGHT);
    expect(resolveHydrationSafeHeight(640, true)).toBe(640);
  });

  it('returns neutral greeting placeholder constant', () => {
    expect(HYDRATION_SAFE_GREETING).toBe('Guten Tag');
  });

  it('derives time-of-day greeting deterministically from clock input', () => {
    expect(getTimeOfDayGreeting(new Date('2026-07-04T08:00:00'))).toBe('Guten Morgen');
    expect(getTimeOfDayGreeting(new Date('2026-07-04T14:00:00'))).toBe('Guten Tag');
    expect(getTimeOfDayGreeting(new Date('2026-07-04T20:00:00'))).toBe('Guten Abend');
  });

  it('starts connectivity as online on web before effects', () => {
    const state = readInitialConnectivityState();
    expect(state.isConnected).toBe(true);
    expect(state.isOffline).toBe(false);
    expect(state.source).toBe('web');
  });
});
