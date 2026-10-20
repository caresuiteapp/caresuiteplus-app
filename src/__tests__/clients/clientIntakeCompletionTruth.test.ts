import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), activate: vi.fn(), repair: vi.fn(), documents: vi.fn(), carriers: vi.fn(), extended: vi.fn(), modules: vi.fn(), core: vi.fn(), validate: vi.fn(), actor: vi.fn(), invoke: vi.fn() }));
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
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ functions: { invoke: mocks.invoke } }) }));
import { submitClientIntake, submitClientIntakeUpdate } from '@/lib/clients/clientIntakeService';

const tenant = '10000000-0000-4000-8000-000000000001';
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
  mocks.invoke.mockResolvedValue({ data: { ok: true, data: { contract: 'client-intake-completion-v1', clientId: id, revision: 3, status: 'active', confirmed: true, replayed: false } }, error: null });
});
describe('truthful and resumable intake completion', () => {
  it('completes only through the verified server endpoint after a saved revision', async () => {
    expect(await submitClientIntake(tenant, form, { draftClientId: id, expectedRevision: 3 })).toEqual({ ok: true, data: { id } });
    expect(mocks.invoke).toHaveBeenCalledWith('complete-client-intake', { body: { tenantId: tenant, clientId: id, expectedRevision: 3 } });
    for (const name of ['create','documents','activate','carriers','extended','modules','core'] as const) expect(mocks[name]).not.toHaveBeenCalled();
  });
  it('requires the stable saved draft revision before calling completion', async () => {
    expect(await submitClientIntake(tenant, form, { draftClientId: id })).toMatchObject({ ok: false, recoverableClientId: id });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it.each([{ clientId: tenant }, { revision: 4 }, { confirmed: false }, { status: 'draft' }, { contract: 'wrong' }, { replayed: undefined }])('rejects an incomplete or foreign completion receipt %j', async patch => {
    mocks.invoke.mockResolvedValueOnce({ data: { ok: true, data: { contract: 'client-intake-completion-v1', clientId: id, revision: 3, status: 'active', confirmed: true, replayed: false, ...patch } }, error: null });
    expect(await submitClientIntake(tenant, form, { draftClientId: id, expectedRevision: 3 })).toMatchObject({ ok: false, recoverableClientId: id });
  });
  it('keeps the draft identity and reports revision conflicts from a non-2xx response', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: { context: new Response(JSON.stringify({ error: 'Neuere Fassung vorhanden' }), { status: 409 }) } });
    expect(await submitClientIntake(tenant, form, { draftClientId: id, expectedRevision: 3 })).toMatchObject({ ok: false, error: 'Neuere Fassung vorhanden', conflict: true, recoverableClientId: id });
  });
  it('does not treat a document verification failure as permission to adopt a different draft', async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: { context: new Response(JSON.stringify({ error: 'Unterlagen erneut prüfen' }), { status: 422 }) } });
    expect(await submitClientIntake(tenant, form, { draftClientId: id, expectedRevision: 3 })).toMatchObject({ ok: false, conflict: false, error: 'Unterlagen erneut prüfen' });
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
