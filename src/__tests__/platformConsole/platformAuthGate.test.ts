import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLoginRedirectForPath } from '@/lib/navigation/redirects';
import { buildPlatformLoginPath, resolvePlatformAuthRedirectPath } from '@/lib/platformConsole/platformLoginPath';
import {
  resetDemoPlatformStore,
  setDemoPlatformUser,
  signInPlatformConsole,
} from '@/lib/platformConsole/platformAuthService';
import type { PlatformUser } from '@/types/platformConsole';

const OWNER: PlatformUser = {
  id: 'pu-1',
  userId: '00000000-0000-4000-8000-000000000099',
  email: 'owner@caresuite.internal',
  fullName: 'Platform Owner',
  role: 'platform_owner',
  status: 'active',
  lastLoginAt: null,
};

describe('Platform login redirect helpers', () => {
  it('ausgeloggt /platform/dashboard → /platform/login', () => {
    expect(getLoginRedirectForPath('/platform/dashboard')).toBe('/platform/login');
  });

  it('buildPlatformLoginPath behält redirect Query', () => {
    expect(buildPlatformLoginPath('/platform/discounts')).toBe(
      '/platform/login?redirect=%2Fplatform%2Fdiscounts',
    );
  });

  it('resolvePlatformAuthRedirectPath nutzt window.location auf Web', () => {
    const original = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { pathname: '/platform/dashboard' },
    });
    expect(resolvePlatformAuthRedirectPath('/platform/audit')).toBe('/platform/dashboard');
    Object.defineProperty(globalThis, 'location', { configurable: true, value: original });
  });

  it('business login bleibt unverändert', () => {
    expect(getLoginRedirectForPath('/business/office')).toBe('/auth/business-login');
  });
});

describe('signInPlatformConsole (Demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    resetDemoPlatformStore();
    setDemoPlatformUser(OWNER);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDemoPlatformStore();
  });

  it('platform_owner ohne Mandantenprofil → Zugriff erlaubt', async () => {
    const result = await signInPlatformConsole('owner@caresuite.internal', 'any');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.role).toBe('platform_owner');
    }
  });

  it('unbekannter Demo-User → kein Platform-Zugriff', async () => {
    const result = await signInPlatformConsole('unknown@test.local', 'pw');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('no_platform_access');
    }
  });
});

describe('signInPlatformConsole validation', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    resetDemoPlatformStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDemoPlatformStore();
  });

  it('leere Zugangsdaten werden abgelehnt', async () => {
    const result = await signInPlatformConsole('', '');
    expect(result.ok).toBe(false);
  });
});

describe('disabled platform_user (Demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    resetDemoPlatformStore();
    setDemoPlatformUser({ ...OWNER, status: 'disabled' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDemoPlatformStore();
  });

  it('disabled platform_user → abgelehnt', async () => {
    const result = await signInPlatformConsole('owner@caresuite.internal', 'pw');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('no_platform_access');
    }
  });
});
