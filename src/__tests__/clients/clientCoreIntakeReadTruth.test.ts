import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
const mocks = vi.hoisted(() => ({ profiles: vi.fn(), sync: vi.fn(), budgets: vi.fn(), init: vi.fn(), portal: vi.fn(), upsert: vi.fn() }));
vi.mock('@/lib/client/clientServiceTypeService', () => ({ careContextsToServiceTypeKeys: () => ['assist'], listClientServiceProfiles: mocks.profiles, syncClientServiceProfiles: mocks.sync }));
vi.mock('@/lib/client/clientBudgetSettingsService', () => ({ listClientBudgetSettings: mocks.budgets, initializeClientBudgetFromDefaults: mocks.init }));
vi.mock('@/lib/client/clientPortalSettingsService', () => ({ fetchClientPortalSettingsResolved: mocks.portal, upsertClientPortalSettings: mocks.upsert }));
import { syncClientCoreAfterIntake } from '@/lib/client/clientCoreIntakeSyncService';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.profiles.mockResolvedValue({ ok: true, data: [] });
  mocks.sync.mockResolvedValue({ ok: true, data: undefined });
  mocks.budgets.mockResolvedValue({ ok: true, data: [] });
  mocks.init.mockResolvedValue({ ok: true, data: undefined });
  mocks.portal.mockResolvedValue({ ok: true, data: { source: 'tenant' } });
  mocks.upsert.mockResolvedValue({ ok: true, data: undefined });
});
describe('intake core projection read truth', () => {
  it.each(['profiles', 'budgets', 'portal'] as const)('propagates %s read errors', async (step) => {
    mocks[step].mockResolvedValue({ ok: false, error: step + ' failed' });
    expect(await syncClientCoreAfterIntake('tenant', 'client', EMPTY_CLIENT_INTAKE_FORM)).toEqual({ ok: false, error: step + ' failed' });
    if (step === 'profiles') expect(mocks.sync).not.toHaveBeenCalled();
    if (step === 'budgets') expect(mocks.init).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('does not create a budget for a fabricated fallback year', async () => {
    expect((await syncClientCoreAfterIntake('tenant', 'client', { ...EMPTY_CLIENT_INTAKE_FORM, serviceStart: 'invalid' })).ok).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
  });
  it('uses the actual service year and retains an existing primary profile', async () => {
    mocks.profiles.mockResolvedValue({ ok: true, data: [{ isPrimary: true, serviceTypeKey: 'assist' }] });
    expect((await syncClientCoreAfterIntake('tenant', 'client', { ...EMPTY_CLIENT_INTAKE_FORM, serviceStart: '2027-01-03' })).ok).toBe(true);
    expect(mocks.sync).toHaveBeenCalledWith('tenant', 'client', ['assist'], 'assist');
    expect(mocks.init).toHaveBeenCalledWith('tenant', 'client', 2027);
  });
});
