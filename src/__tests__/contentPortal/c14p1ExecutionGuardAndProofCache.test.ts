import { describe, expect, it, beforeEach, vi } from 'vitest';

const INTERNAL_TEST_TENANT = 'a4ba83bd-65db-46cf-8cf7-61492cc78315';
const PRODUCTION_TENANT = '56180c22-b894-4fab-b55e-a563c94dd6e7';

describe('C.14P.1 Fix 1 — internal_test execution allowed, production guarded', () => {
  beforeEach(async () => {
    const { resetTenantEnvironmentSettingsStore } = await import(
      '@/lib/environment/tenantEnvironmentSettingsService'
    );
    resetTenantEnvironmentSettingsStore();
  });

  it('guardLiveDemoFeature returns null for internal_test tenant', async () => {
    const { guardLiveDemoFeature } = await import('@/lib/services/liveServiceGuard');
    const result = guardLiveDemoFeature(INTERNAL_TEST_TENANT, 'Mitarbeiterportal-Einsatzdetail');
    expect(result).toBeNull();
  });

  it('guardLiveDemoFeature blocks production tenant', async () => {
    const { guardLiveDemoFeature } = await import('@/lib/services/liveServiceGuard');
    const result = guardLiveDemoFeature(PRODUCTION_TENANT, 'Mitarbeiterportal-Einsatzdetail');
    expect(result).not.toBeNull();
    expect(result?.ok).toBe(false);
    expect(result?.error).toContain('Live-Modus');
  });

  it('isInternalTest returns true for Test Pflege GmbH tenant', async () => {
    const { isInternalTest } = await import('@/lib/environment');
    expect(isInternalTest(INTERNAL_TEST_TENANT)).toBe(true);
  });

  it('isInternalTest returns false for production tenant', async () => {
    const { isInternalTest } = await import('@/lib/environment');
    expect(isInternalTest(PRODUCTION_TENANT)).toBe(false);
  });

  it('guardServiceTenant passes for internal_test tenant', async () => {
    const { guardServiceTenant } = await import('@/lib/services/liveServiceGuard');
    const result = guardServiceTenant(INTERNAL_TEST_TENANT);
    expect(result).toBeNull();
  });

  it('blockDemoOnlyInLiveMode still blocks generically (supabase mode)', async () => {
    const { blockDemoOnlyInLiveMode } = await import('@/lib/services/liveServiceGuard');
    const result = blockDemoOnlyInLiveMode('TestFeature');
    expect(result).not.toBeNull();
    expect(result?.ok).toBe(false);
  });
});

describe('C.14P.1 Fix 2 — proof revoke invalidates client portal cache', () => {
  beforeEach(async () => {
    const { resetPortalProofCacheSignal } = await import(
      '@/lib/portal/portalProofCacheSignal'
    );
    resetPortalProofCacheSignal();
  });

  it('invalidatePortalProofCache increments version', async () => {
    const {
      getPortalProofCacheVersion,
      invalidatePortalProofCache,
    } = await import('@/lib/portal/portalProofCacheSignal');

    expect(getPortalProofCacheVersion()).toBe(0);
    invalidatePortalProofCache();
    expect(getPortalProofCacheVersion()).toBe(1);
    invalidatePortalProofCache();
    expect(getPortalProofCacheVersion()).toBe(2);
  });

  it('subscribePortalProofCache fires on invalidation', async () => {
    const {
      subscribePortalProofCache,
      invalidatePortalProofCache,
    } = await import('@/lib/portal/portalProofCacheSignal');

    const listener = vi.fn();
    const unsubscribe = subscribePortalProofCache(listener);

    invalidatePortalProofCache();
    expect(listener).toHaveBeenCalledTimes(1);

    invalidatePortalProofCache();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    invalidatePortalProofCache();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('listener errors do not break other listeners', async () => {
    const {
      subscribePortalProofCache,
      invalidatePortalProofCache,
    } = await import('@/lib/portal/portalProofCacheSignal');

    const badListener = vi.fn(() => {
      throw new Error('boom');
    });
    const goodListener = vi.fn();

    subscribePortalProofCache(badListener);
    subscribePortalProofCache(goodListener);

    invalidatePortalProofCache();
    expect(badListener).toHaveBeenCalledTimes(1);
    expect(goodListener).toHaveBeenCalledTimes(1);
  });

  it('assistProofApprovalService imports invalidatePortalProofCache', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(__dirname, '..', '..', '..');
    const source = readFileSync(
      join(root, 'src/lib/assist/assistProofApprovalService.ts'),
      'utf8',
    );
    expect(source).toContain("import { invalidatePortalProofCache }");
    expect(source).toContain('invalidatePortalProofCache()');
  });

  it('revokeAssistProofPortalRelease calls invalidatePortalProofCache', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(__dirname, '..', '..', '..');
    const source = readFileSync(
      join(root, 'src/lib/assist/assistProofApprovalService.ts'),
      'utf8',
    );
    const revokeBlock = source.slice(
      source.indexOf('export async function revokeAssistProofPortalRelease'),
    );
    expect(revokeBlock).toContain('invalidatePortalProofCache()');
  });

  it('releaseAssistProofToPortal calls invalidatePortalProofCache', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(__dirname, '..', '..', '..');
    const source = readFileSync(
      join(root, 'src/lib/assist/assistProofApprovalService.ts'),
      'utf8',
    );
    const releaseBlock = source.slice(
      source.indexOf('export async function releaseAssistProofToPortal'),
      source.indexOf('export async function revokeAssistProofPortalRelease'),
    );
    expect(releaseBlock).toContain('invalidatePortalProofCache()');
  });

  it('PortalServiceProofsModal subscribes to cache signal', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(__dirname, '..', '..', '..');
    const source = readFileSync(
      join(root, 'src/components/portal/assist/PortalServiceProofsModal.tsx'),
      'utf8',
    );
    expect(source).toContain('subscribePortalProofCache');
    expect(source).toContain('loadProofs');
  });
});
