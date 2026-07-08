import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  platformRoleCanWrite,
  platformRoleHasCapability,
  resetDemoPlatformStore,
  setDemoPlatformUser,
  validatePlatformReason,
} from '@/lib/platformConsole';
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

describe('Platform Console RBAC', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetDemoPlatformStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetDemoPlatformStore();
  });

  it('platform_owner darf alle Capabilities', () => {
    expect(platformRoleHasCapability('platform_owner', 'system.write')).toBe(true);
    expect(platformRoleHasCapability('platform_owner', 'payments.write')).toBe(true);
    expect(platformRoleCanWrite('platform_owner')).toBe(true);
  });

  it('Mandantenrolle business_admin hat keinen Plattformzugriff über Capabilities', () => {
    expect(platformRoleHasCapability(null, 'tenants.read')).toBe(false);
    expect(platformRoleHasCapability(undefined, 'tenants.read')).toBe(false);
  });

  it('platform_billing darf Billing, aber keine Systemflags schreiben', () => {
    expect(platformRoleHasCapability('platform_billing', 'billing.write')).toBe(true);
    expect(platformRoleHasCapability('platform_billing', 'payments.write')).toBe(true);
    expect(platformRoleHasCapability('platform_billing', 'system.write')).toBe(false);
    expect(platformRoleHasCapability('platform_billing', 'flags.write')).toBe(false);
  });

  it('platform_support darf Support, aber keine Zahlungen ändern', () => {
    expect(platformRoleHasCapability('platform_support', 'support.write')).toBe(true);
    expect(platformRoleHasCapability('platform_support', 'payments.write')).toBe(false);
    expect(platformRoleHasCapability('platform_support', 'billing.write')).toBe(false);
  });

  it('platform_readonly darf lesen, aber nicht schreiben', () => {
    expect(platformRoleHasCapability('platform_readonly', 'tenants.read')).toBe(true);
    expect(platformRoleHasCapability('platform_readonly', 'modules.write')).toBe(false);
    expect(platformRoleCanWrite('platform_readonly')).toBe(false);
  });

  it('platform_developer darf Feature Flags, aber keine Zahlungen', () => {
    expect(platformRoleHasCapability('platform_developer', 'flags.write')).toBe(true);
    expect(platformRoleHasCapability('platform_developer', 'payments.write')).toBe(false);
  });

  it('validatePlatformReason lehnt leeren Grund ab', () => {
    expect(validatePlatformReason('')).toMatch(/Grund/);
    expect(validatePlatformReason('ok')).toMatch(/Grund/);
    expect(validatePlatformReason('Smoke-Test Grund')).toBeNull();
  });
});

describe('Platform Auth Service (Demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    resetDemoPlatformStore();
  });

  afterEach(() => {
    resetDemoPlatformStore();
  });

  it('Demo: kein Platform-User ohne Seed', async () => {
    const { fetchPlatformCurrentUser } = await import('@/lib/platformConsole/platformAuthService');
    const result = await fetchPlatformCurrentUser();
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });

  it('Demo: gesetzter Platform-Owner wird erkannt', async () => {
    setDemoPlatformUser(OWNER);
    const { fetchPlatformCurrentUser } = await import('@/lib/platformConsole/platformAuthService');
    const result = await fetchPlatformCurrentUser();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.role).toBe('platform_owner');
    }
  });
});

describe('Platform Tenant Service (Demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  it('listPlatformTenants liefert Demo-Daten', async () => {
    const { listPlatformTenants } = await import('@/lib/platformConsole/platformTenantService');
    const result = await listPlatformTenants();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items.length).toBeGreaterThan(0);
    }
  });

  it('updatePlatformTenantStatus ohne Grund wird abgelehnt', async () => {
    const { updatePlatformTenantStatus } = await import('@/lib/platformConsole/platformTenantService');
    const result = await updatePlatformTenantStatus('t1', 'suspended', '');
    expect(result.ok).toBe(false);
  });

  it('setPlatformTenantModule schreibt in Demo-Modus', async () => {
    const { setPlatformTenantModule } = await import('@/lib/platformConsole/platformTenantService');
    const result = await setPlatformTenantModule(
      '00000000-0000-4000-8000-000000000001',
      'assist',
      'enabled',
      'Smoke-Test Freischaltung',
    );
    expect(result.ok).toBe(true);
  });

  it('recordPlatformManualPayment ohne Grund wird abgelehnt', async () => {
    const { recordPlatformManualPayment } = await import('@/lib/platformConsole/platformOpsService');
    const result = await recordPlatformManualPayment('t1', null, 1000, 'succeeded', '');
    expect(result.ok).toBe(false);
  });
});

describe('Platform Audit (Demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  it('listPlatformAuditLog liefert Demo-Einträge', async () => {
    const { listPlatformAuditLog } = await import('@/lib/platformConsole/platformOpsService');
    const result = await listPlatformAuditLog();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0]?.action).toBe('module.enabled');
    }
  });
});
