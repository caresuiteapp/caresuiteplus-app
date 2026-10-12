import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), activate: vi.fn(), repair: vi.fn(), documents: vi.fn(), carriers: vi.fn(), extended: vi.fn(), modules: vi.fn(), core: vi.fn(), validate: vi.fn(), actor: vi.fn() }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: mocks.actor }));
vi.mock('@/lib/clients/clientIntakeValidation', () => ({ validateIntakeStep: mocks.validate, hasIntakeErrors: (errors: object) => Object.keys(errors).length > 0 }));
vi.mock('@/lib/clients/clientBackend', () => ({ isDemoClientBackend: () => false, assertDemoTenant: () => null }));
vi.mock('@/lib/services/serviceRunner', () => ({ runService: async (action: () => Promise<unknown>) => { try { return await action(); } catch { return { ok: false, error: 'Unerwarteter Fehler' }; } } }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/clients/repositories/clientIntakeRepository.supabase', () => ({ createClientFromIntake: mocks.create, updateClientFromIntake: mocks.update, activateClientFromIntake: mocks.activate, repairCompletedClientIntakeActivation: mocks.repair }));
vi.mock('@/features/intakeDocuments/intakeDocumentService', () => ({ persistClientIntakeDocuments: mocks.documents }));
vi.mock('@/features/costCarriers/costCarrierService', () => ({ persistIntakeCostCarriers: mocks.carriers }));
vi.mock('@/lib/clients/clientIntakePersistence', () => ({ syncIntakeClientExtendedData: mocks.extended }));
vi.mock('@/lib/portal/clientModuleAssignmentService', () => ({ mapIntakeModulesToPortal: (value: unknown) => value, saveClientModuleAssignments: mocks.modules }));
vi.mock('@/lib/client/clientCoreIntakeSyncService', () => ({ syncClientCoreAfterIntake: mocks.core }));
vi.mock('@/lib/clients/clientCareLevelDocumentSync', () => ({ syncCareLevelDependentDocuments: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => null }));
import { submitClientIntake, submitClientIntakeUpdate } from '@/lib/clients/clientIntakeService';

const id = '20000000-0000-4000-8000-000000000001';
const form = { ...EMPTY_CLIENT_INTAKE_FORM, assignedModules: ['assist'] as typeof EMPTY_CLIENT_INTAKE_FORM.assignedModules };
beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(mocks)) fn.mockResolvedValue({ ok: true, data: undefined });
  mocks.actor.mockResolvedValue({ ok: true, data: 'actual-profile' });
  mocks.create.mockResolvedValue({ ok: true, data: { id } });
  mocks.update.mockResolvedValue({ ok: true, data: { id } });
  mocks.activate.mockResolvedValue({ ok: true, data: { id } });
  mocks.validate.mockReturnValue({});
});
describe('truthful and resumable intake completion', () => {
  it('blocks live completion before its first client or evidence write and preserves a stable draft identity', async () => {
    const result = await submitClientIntake('tenant', form, { draftClientId: id });
    expect(result).toMatchObject({ ok: false, recoverableClientId: id });
    if (result.ok) throw new Error('unsafe completion');
    expect(result.error).toContain('atomare Serverabschluss');
    for (const name of ['create','documents','activate','carriers','extended','modules','core'] as const) expect(mocks[name]).not.toHaveBeenCalled();
  });
  it('validates mandatory data before attempting a live completion', async () => {
    mocks.validate.mockReturnValue({ intakePrivacy: 'Datenschutz fehlt' });
    expect((await submitClientIntake('tenant', form)).ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('blocks edits of signed documents before updating the client and retains the known identity', async () => {
    const signedForm = { ...form, intakeDocuments: [{ status: 'finalized', signatures: {} }] } as typeof form;
    expect(await submitClientIntakeUpdate('tenant', id, signedForm, { sections: ['vertraege_einwilligungen'] })).toMatchObject({ ok: false, recoverableClientId: id });
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.documents).not.toHaveBeenCalled();
  });
  it('binds unsigned section edits to the authenticated profile and rejects a forged actor before writes', async () => {
    expect((await submitClientIntakeUpdate('tenant', id, form, { sections: ['stammdaten'], actorProfileId: 'foreign' })).ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
    expect((await submitClientIntakeUpdate('tenant', id, form, { sections: ['stammdaten'] })).ok).toBe(true);
    expect(mocks.update.mock.calls[0][3]).toBe('actual-profile');
  });
  it('does not activate a partial intake merely because one profile section was edited', async () => {
    expect((await submitClientIntakeUpdate('tenant', id, form, { sections: ['stammdaten'] })).ok).toBe(true);
    expect(mocks.repair).not.toHaveBeenCalled();
    expect(mocks.activate).not.toHaveBeenCalled();
  });
  it('does not call a derived synchronization failure a successful edit', async () => {
    mocks.core.mockResolvedValue({ ok: false, error: 'Leistungsprofile fehlen' });
    expect(await submitClientIntakeUpdate('tenant', id, form, { sections: ['leistungsart'] })).toMatchObject({ ok: false, recoverableClientId: id });
  });
});
