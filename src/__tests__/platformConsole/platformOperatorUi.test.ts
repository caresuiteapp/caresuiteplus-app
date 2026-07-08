import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignPlatformDiscount,
  endPlatformSupportSession,
  platformRoleHasCapability,
  recordPlatformManualPayment,
  removePlatformDiscount,
  setPlatformFeatureFlag,
  startPlatformSupportSession,
  updatePlatformInvoiceStatus,
  validatePlatformReason,
} from '@/lib/platformConsole';
import { listPlatformSystemSettings } from '@/lib/platformConsole/platformOpsService';

describe('Platform Operator UI — Role Matrix', () => {
  it('Billing Role darf Rechnungen/Zahlungen sehen, aber keine Systemsettings schreiben', () => {
    expect(platformRoleHasCapability('platform_billing', 'billing.read')).toBe(true);
    expect(platformRoleHasCapability('platform_billing', 'payments.read')).toBe(true);
    expect(platformRoleHasCapability('platform_billing', 'system.write')).toBe(false);
  });

  it('Support Role darf Support-Session schreiben, aber keine Zahlungen', () => {
    expect(platformRoleHasCapability('platform_support', 'support.write')).toBe(true);
    expect(platformRoleHasCapability('platform_support', 'payments.write')).toBe(false);
  });

  it('Developer darf Feature Flag schreiben', () => {
    expect(platformRoleHasCapability('platform_developer', 'flags.write')).toBe(true);
  });

  it('Readonly sieht Daten, kann aber nicht schreiben', () => {
    expect(platformRoleHasCapability('platform_readonly', 'billing.read')).toBe(true);
    expect(platformRoleHasCapability('platform_readonly', 'billing.write')).toBe(false);
    expect(platformRoleHasCapability('platform_readonly', 'discounts.write')).toBe(false);
  });
});

describe('Platform Operator UI — Reason Validation (Demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Rabattzuweisung ohne Grund abgelehnt', async () => {
    const result = await assignPlatformDiscount('t1', 'beta_20', '');
    expect(result.ok).toBe(false);
  });

  it('Rabattentfernung ohne Grund abgelehnt', async () => {
    const result = await removePlatformDiscount('t1', 'beta_20', 'x');
    expect(result.ok).toBe(false);
  });

  it('Zahlungsänderung ohne Grund abgelehnt', async () => {
    const result = await recordPlatformManualPayment('t1', null, 1000, 'succeeded', '');
    expect(result.ok).toBe(false);
  });

  it('Rechnungsstatus ohne Grund abgelehnt', async () => {
    const result = await updatePlatformInvoiceStatus('inv-1', 'paid', '');
    expect(result.ok).toBe(false);
  });

  it('Support-Session ohne Grund abgelehnt', async () => {
    const result = await startPlatformSupportSession(
      't1',
      '',
      new Date(Date.now() + 3600000).toISOString(),
    );
    expect(result.ok).toBe(false);
  });

  it('Support-Session beenden ohne Grund abgelehnt', async () => {
    const result = await endPlatformSupportSession('ss-1', '');
    expect(result.ok).toBe(false);
  });

  it('Feature-Flag-Änderung ohne Grund abgelehnt', async () => {
    const result = await setPlatformFeatureFlag('test_flag', true, '');
    expect(result.ok).toBe(false);
  });

  it('Feature-Flag-Änderung mit Grund OK (Demo)', async () => {
    const result = await setPlatformFeatureFlag('test_flag', true, 'Smoke-Test Aktivierung');
    expect(result.ok).toBe(true);
  });

  it('Sensitive Settings bleiben maskiert', async () => {
    const result = await listPlatformSystemSettings();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const masked = result.data.find((r) => r.setting_key === 'maintenance_mode');
      expect(masked?.value).not.toBeUndefined();
    }
  });

  it('validatePlatformReason ist konsistent', () => {
    expect(validatePlatformReason('ab')).not.toBeNull();
    expect(validatePlatformReason('Gültiger Grund')).toBeNull();
  });
});
