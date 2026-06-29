import { describe, expect, it } from 'vitest';

describe('LT.GMAPS.4 saveEmployeeLocationConsent', () => {
  it('exports save function', async () => {
    const mod = await import('@/features/liveTracking/saveEmployeeLocationConsent');
    expect(typeof mod.saveEmployeeLocationConsent).toBe('function');
    expect(mod.saveEmployeeLocationConsent.toString()).toContain('resolveEmployeeLiveContext');
  });
});

describe('LT.GMAPS.4 getEmployeeLocationConsent', () => {
  it('exports get function', async () => {
    const mod = await import('@/features/liveTracking/getEmployeeLocationConsent');
    expect(typeof mod.getEmployeeLocationConsent).toBe('function');
  });

  it('rejects missing tenant via context', async () => {
    const { getEmployeeLocationConsent } = await import(
      '@/features/liveTracking/getEmployeeLocationConsent'
    );
    const result = await getEmployeeLocationConsent({
      tenantId: '',
      employeeId: 'e1',
      routeParamId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.ok).toBe(false);
  });
});

describe('LT.GMAPS.4 buildEmployeePortalLiveRoute', () => {
  it('exports live route builder', async () => {
    const mod = await import('@/features/liveTracking/buildEmployeePortalLiveRoute');
    expect(typeof mod.buildEmployeePortalLiveRoute).toBe('function');
    expect(mod.buildEmployeePortalLiveRoute.toString()).toContain('resolveEmployeeLiveContext');
  });
});
