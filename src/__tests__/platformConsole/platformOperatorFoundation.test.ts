import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignPlatformPlan,
  assignPlatformPlanModule,
  cancelPlatformTenantSubscription,
  createPlatformAddon,
  createPlatformAddonVersion,
  createPlatformPlan,
  createPlatformPlanVersion,
  recalculatePlatformTenantEntitlements,
  suspendPlatformTenantSubscription,
  updatePlatformPlan,
  updatePlatformSystemSetting,
  validatePlatformAddonKey,
  validatePlatformReason,
} from '@/lib/platformConsole';

describe('Platform 2.0B Operator Services (Demo)', () => {
  beforeEach(() => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validatePlatformReason verlangt mindestens 5 Zeichen', () => {
    expect(validatePlatformReason('abc')).not.toBeNull();
    expect(validatePlatformReason('abcde')).toBeNull();
  });

  it('createPlatformPlan ohne Grund abgelehnt', async () => {
    const res = await createPlatformPlan('test', 'Test', '');
    expect(res.ok).toBe(false);
  });

  it('createPlatformPlan mit Grund OK', async () => {
    const res = await createPlatformPlan('test_plan', 'Test Plan', 'Smoke Test Anlage');
    expect(res.ok).toBe(true);
  });

  it('createPlatformPlanVersion mit Grund OK', async () => {
    const res = await createPlatformPlanVersion('starter', 'Preisanpassung Q3', 12900, 129000);
    expect(res.ok).toBe(true);
  });

  it('updatePlatformPlan mit Grund OK', async () => {
    const res = await updatePlatformPlan('starter', 'Metadaten Update', { planName: 'Starter Plus' });
    expect(res.ok).toBe(true);
  });

  it('assignPlatformPlan delegiert an Foundation (Demo)', async () => {
    const res = await assignPlatformPlan('tenant-demo', 'starter', 'Planwechsel Test');
    expect(res.ok).toBe(true);
  });

  it('assignPlatformPlanModule ohne Grund abgelehnt', async () => {
    const res = await assignPlatformPlanModule('pv-1', 'office', 'included', '');
    expect(res.ok).toBe(false);
  });

  it('subscription suspend ohne Grund abgelehnt', async () => {
    const res = await suspendPlatformTenantSubscription('t1', '');
    expect(res.ok).toBe(false);
  });

  it('subscription cancel mit Grund OK', async () => {
    const res = await cancelPlatformTenantSubscription('t1', 'Kündigung auf Wunsch');
    expect(res.ok).toBe(true);
  });

  it('recalculate entitlements OK', async () => {
    const res = await recalculatePlatformTenantEntitlements('t1', 'Manuelle Neuberechnung');
    expect(res.ok).toBe(true);
  });

  it('updatePlatformSystemSetting ohne Grund abgelehnt', async () => {
    const res = await updatePlatformSystemSetting('maintenance_mode', false, '');
    expect(res.ok).toBe(false);
  });

  it('updatePlatformSystemSetting mit Grund OK', async () => {
    const res = await updatePlatformSystemSetting('maintenance_mode', false, 'Wartungsfenster beendet');
    expect(res.ok).toBe(true);
  });

  it('createPlatformAddon ohne Schlüssel abgelehnt', async () => {
    const res = await createPlatformAddon('', 'Test Add-on', 'Smoke Test Anlage');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Add-on-Schlüssel/);
  });

  it('createPlatformAddon mit gültigem Schlüssel OK', async () => {
    const res = await createPlatformAddon('smoke_addon_key', 'Smoke Add-on', 'Smoke Test Anlage');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.addon).toMatchObject({ addon_key: 'smoke_addon_key' });
  });

  it('validatePlatformAddonKey lehnt leere und ungültige Keys ab', () => {
    expect(validatePlatformAddonKey('')).toMatch(/Add-on-Schlüssel/);
    expect(validatePlatformAddonKey('ab')).toMatch(/Add-on-Schlüssel/);
    expect(validatePlatformAddonKey('Invalid Key')).toMatch(/Kleinbuchstaben/);
    expect(validatePlatformAddonKey('smoke_addon_fix')).toBeNull();
  });
});
