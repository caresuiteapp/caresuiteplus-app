import { describe, expect, it } from 'vitest';
import { resetGoogleMapsBrowserKeyCacheForTests } from '@/lib/maps/getGoogleMapsBrowserKey';

describe('getGoogleMapsBrowserKey', () => {
  it('returns EXPO_PUBLIC key when set', async () => {
    resetGoogleMapsBrowserKeyCacheForTests();
    const original = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-expo-key';
    const { getGoogleMapsBrowserKey } = await import('@/lib/maps/getGoogleMapsBrowserKey');
    const key = await getGoogleMapsBrowserKey();
    expect(key).toBe('test-expo-key');
    if (original === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    else process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = original;
    resetGoogleMapsBrowserKeyCacheForTests();
  });
});

describe('resolveLiveAssignment', () => {
  it('rejects non-uuid ids gracefully', async () => {
    const { resolveLiveAssignment } = await import('@/features/liveTracking/resolveLiveAssignment');
    const result = await resolveLiveAssignment({
      tenantId: '00000000-0000-0000-0000-000000000001',
      rawId: 'not-a-uuid',
    });
    expect(result.ok && result.data === null).toBe(true);
  });
});

describe('getAssistLiveStatus', () => {
  it('exports formatTimerSeconds', async () => {
    const { formatTimerSeconds } = await import('@/features/liveTracking/getAssistLiveStatus');
    expect(formatTimerSeconds(125)).toBe('2:05');
    expect(formatTimerSeconds(null)).toBe('—');
  });
});
