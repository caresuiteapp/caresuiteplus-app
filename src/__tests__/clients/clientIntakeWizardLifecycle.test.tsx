// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { useClientIntakeWizard, type UseClientIntakeWizardOptions } from '@/hooks/useClientIntakeWizard';
import { getVisibleSectionsForClientContext } from '@/lib/clients/clientIntakeFieldRules';

const h = vi.hoisted(() => ({
  tenant: 'tenant-A', auth: {} as any, mode: 'supabase', store: new Map<string, string>(),
  get: vi.fn(), set: vi.fn(), remove: vi.fn(), remote: vi.fn(), loadRemote: vi.fn(), reconcile: vi.fn(), deleteDraft: vi.fn(), schedule: vi.fn(), docs: vi.fn(), create: vi.fn(), update: vi.fn(), edit: vi.fn(), sections: vi.fn(),
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => h.mode }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: h.get, setItem: h.set, removeItem: h.remove } }));
vi.mock('@/lib/clients/repositories/clientIntakeDraftRepository.supabase', () => ({ upsertClientIntakeDraft: h.remote, loadServerClientIntakeDraft: h.loadRemote, reconcileServerClientIntakeDraft: h.reconcile, deleteClientIntakeDraft: h.deleteDraft, scheduleIntakeFirstAppointment: h.schedule }));
vi.mock('@/features/intakeDocuments/intakeDocumentService', () => ({ persistClientIntakeDocuments: h.docs }));
vi.mock('@/features/costCarriers/costCarrierService', () => ({ validateCostBearerEntry: () => null }));
vi.mock('@/lib/clients/clientIntakeEditService', () => ({ fetchClientIntakeEditData: h.edit }));
vi.mock('@/lib/client/clientServiceTypeService', () => ({ getServiceIntakeSections: h.sections, careContextsToServiceTypeKeys: (value: unknown) => value }));
vi.mock('@/lib/clients/clientIntakeService', async () => {
  const { EMPTY_CLIENT_INTAKE_FORM } = await import('@/types/forms/clientIntakeForm');
  const { getVisibleSectionsForClientContext } = await import('@/lib/clients/clientIntakeFieldRules');
  return { createEmptyIntakeForm: () => structuredClone(EMPTY_CLIENT_INTAKE_FORM),
    getIntakeStepsForContexts: getVisibleSectionsForClientContext,
    getIntakeStepsForServiceTypeKeys: (_keys: unknown, contexts: any) => getVisibleSectionsForClientContext(contexts),
    validateIntakeStep: () => ({}), hasIntakeErrors: (errors: object) => Object.keys(errors).length > 0,
    submitClientIntake: h.create, submitClientIntakeUpdate: h.update };
});
const id = '11111111-1111-4111-8111-111111111111';
const key = (tenant = h.tenant, user = h.auth.user.id) => `caresuite:client-intake-draft:${tenant}:${user}`;
const form = (firstName: string) => ({ ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), firstName });
function deferred<T = any>() { let resolve!: (value: T) => void; let reject!: (reason: any) => void;
  const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }
let host: HTMLDivElement, root: Root, wizard: ReturnType<typeof useClientIntakeWizard>, unmounted: boolean;
function Probe({ options }: { options?: UseClientIntakeWizardOptions }) {
  const result = useClientIntakeWizard({ validateOnSubmit: false, ...options });
  React.useLayoutEffect(() => { wizard = result; });
  return <span>{result.loading ? 'loading' : result.form.firstName}:{result.createdId}:{result.loadError}</span>;
}
async function render(options?: UseClientIntakeWizardOptions) { await act(async () => root.render(<Probe options={options} />)); }
async function name(value: string) { await act(async () => wizard.updateField('firstName', value)); }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers(); vi.clearAllMocks(); h.store.clear();
  h.tenant = 'tenant-A'; h.mode = 'supabase'; h.auth = { user: { id: 'user-A', roleKey: 'business_admin' }, profile: { id: 'profile-A', roleKey: 'business_admin' } };
  h.get.mockImplementation(async (key: string) => h.store.get(key) ?? null);
  h.set.mockImplementation(async (key: string, value: string) => { h.store.set(key, value); });
  h.remove.mockImplementation(async (key: string) => { h.store.delete(key); });
  h.remote.mockImplementation(async (_tenant, _form, options) => ({ ok: true, data: { id, revision: options.expectedRevision + 1 } })); h.loadRemote.mockResolvedValue({ ok: true, data: null }); h.docs.mockResolvedValue({ ok: true });
  h.deleteDraft.mockResolvedValue({ ok: true }); h.schedule.mockResolvedValue({ ok: true, data: { id, status: 'aktiv' } });
  h.create.mockResolvedValue({ ok: true, data: { id } }); h.update.mockResolvedValue({ ok: true, data: { id } });
  h.edit.mockImplementation(async (client: string) => ({ ok: true, data: form(client) }));
  h.sections.mockResolvedValue({ ok: true, data: [] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); unmounted = false;
});
afterEach(async () => { if (!unmounted) await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('client intake identity, draft and submission behavior', () => {
  it('keeps every submission section available and the active section stable when guided care contexts change', async () => {
    await render({ completeSectionFlow: true });
    expect(wizard.steps).toEqual(['leistungsart']);
    await act(async () => wizard.updateField('careContexts', ['daily_assistance']));
    expect(wizard.steps).toEqual(getVisibleSectionsForClientContext(['daily_assistance']));
    expect(wizard.steps).toEqual(expect.arrayContaining(['kostentraeger', 'notfall_zugang', 'vertraege_einwilligungen', 'pruefung']));
    await act(async () => wizard.goToStep(wizard.steps.indexOf('kostentraeger')));
    await act(async () => wizard.updateField('careContexts', ['consulting', 'ambulatory_care']));
    expect(wizard.steps).toEqual(getVisibleSectionsForClientContext(['consulting', 'ambulatory_care']));
    expect(wizard.currentSection).toBe('kostentraeger');
    expect(h.sections).not.toHaveBeenCalled();
    await act(async () => wizard.updateField('careContexts', []));
    expect(wizard.steps).toEqual(['leistungsart']);
    expect(wizard.currentSection).toBe('leistungsart');
    expect(wizard.stepIndex).toBe(0);
  });
  it('keeps the default section query but ignores its late response after opting into the complete flow', async () => {
    const configured = deferred(); h.sections.mockReturnValueOnce(configured.promise);
    await render();
    await act(async () => wizard.updateField('careContexts', ['daily_assistance']));
    expect(h.sections).toHaveBeenCalledTimes(1);
    await act(async () => wizard.goToStep(wizard.steps.indexOf('vertraege_einwilligungen')));
    await render({ completeSectionFlow: true });
    await act(async () => configured.resolve({ ok: true, data: [{ sectionKey: 'pruefung', isRequired: true, sortOrder: 1 }] }));
    expect(wizard.steps).toEqual(getVisibleSectionsForClientContext(['daily_assistance']));
    expect(wizard.currentSection).toBe('vertraege_einwilligungen');
    expect(h.sections).toHaveBeenCalledTimes(1);
  });
  it('waits for restore and never overwrites a stored draft with an initially empty form', async () => {
    const stored = deferred<string | null>(); h.get.mockReturnValueOnce(stored.promise);
    await render(); expect(wizard.loading).toBe(true); expect(h.remote).not.toHaveBeenCalled();
    await act(async () => stored.resolve(JSON.stringify({ form: form('Anna'), stepIndex: 1, clientId: id, schemaVersion: 2 })));
    expect(wizard.form.firstName).toBe('Anna'); expect(wizard.draftRestored).toBe(true); expect(wizard.loading).toBe(false);
  });
  it('does not overwrite inaccessible storage and offers a real restore retry', async () => {
    h.get.mockRejectedValueOnce(new Error('storage unavailable'));
    await render(); expect(wizard.loadError).toContain('nicht überschrieben');
    await act(async () => vi.advanceTimersByTime(600)); expect(h.set).not.toHaveBeenCalled();
    h.store.set(key(), JSON.stringify({ form: form('Wiederhergestellt'), stepIndex: 0, clientId: id, schemaVersion: 2 }));
    await act(async () => wizard.retryLoad()); expect(wizard.form.firstName).toBe('Wiederhergestellt');
  });
  it('clears the form and ignores a late restore after changing authenticated tenant/account', async () => {
    const old = deferred<string | null>(); h.get.mockReturnValueOnce(old.promise);
    await render(); h.tenant = 'tenant-B'; h.auth = { user: { id: 'user-B' }, profile: { id: 'profile-B', roleKey: 'business_admin' } };
    await render(); expect(wizard.form.firstName).toBe('');
    await act(async () => old.resolve(JSON.stringify({ form: form('Privat A'), stepIndex: 0, schemaVersion: 2 })));
    expect(wizard.form.firstName).toBe(''); expect(wizard.draftRestored).toBe(false);
  });
  it('isolates edit A→B and ignores the old fetch, errors and success state', async () => {
    const old = deferred(); h.edit.mockReturnValueOnce(old.promise);
    await render({ mode: 'edit', clientId: 'A' }); await render({ mode: 'edit', clientId: 'B' });
    expect(wizard.form.firstName).toBe('B');
    await act(async () => old.resolve({ ok: true, data: form('A') })); expect(wizard.form.firstName).toBe('B');
    await act(async () => wizard.submit()); expect(h.update.mock.calls[0][1]).toBe('B');
    await render({ mode: 'edit', clientId: 'C' }); expect(wizard.createdId).toBeNull(); expect(wizard.form.firstName).toBe('C');
  });
  it('never treats edit without a client id as new intake', async () => {
    await render({ mode: 'edit' }); expect(wizard.notFound).toBe(true);
    await act(async () => wizard.submit()); expect(h.create).not.toHaveBeenCalled(); expect(h.update).not.toHaveBeenCalled();
  });
  it('locally retains all work when remote draft save fails and permits retry', async () => {
    h.remote.mockResolvedValueOnce({ ok: false, error: 'Server offline' }); await render(); await name('Erhalten');
    await act(async () => { expect(await wizard.saveDraft()).toBe(false); });
    expect(JSON.parse(h.store.get(key())!).form.firstName).toBe('Erhalten'); expect(wizard.draftSaveFeedback?.message).toContain('auf diesem Gerät erhalten');
    await act(async () => { expect(await wizard.saveDraft()).toBe(true); }); expect(h.remote).toHaveBeenCalledTimes(2);
  });
  it('persists the allocated UUID before an uncertain server insert and reuses it on retry', async () => {
    h.remote.mockImplementationOnce(async (_tenant, _form, options) => {
      expect(options.clientId).toBe(id); expect(JSON.parse(h.store.get(key())!).clientId).toBe(id);
      throw new Error('Antwort verloren');
    });
    await render(); await name('Gleicher Entwurf');
    await act(async () => { expect(await wizard.saveDraft()).toBe(false); });
    await act(async () => { expect(await wizard.saveDraft()).toBe(true); });
    expect(h.remote.mock.calls[1][2].clientId).toBe(id);
  });
  it('lets the user correct a definitively rejected payload instead of replaying it forever', async () => {
    h.remote.mockResolvedValueOnce({ ok: false, rejected: true, error: 'Bitte Angaben korrigieren' });
    await render(); await name('Ungültiger Stand');
    await act(async () => { expect(await wizard.saveDraft()).toBe(false); });
    expect(JSON.parse(h.store.get(key())!).pendingSave).toBeUndefined();
    await name('Korrigierter Stand'); await act(async () => { expect(await wizard.saveDraft()).toBe(true); });
    expect(h.remote.mock.calls[1][1].firstName).toBe('Korrigierter Stand');
    expect(h.remote.mock.calls[1][2].expectedRevision).toBe(0);
  });
  it('serializes competing draft saves and reuses the first server id rather than creating two leads', async () => {
    const first = deferred(); h.remote.mockReturnValueOnce(first.promise); await render(); await name('Erste Fassung');
    let a!: Promise<boolean>; await act(async () => { a = wizard.saveDraft(); });
    await name('Neue Fassung'); let b!: Promise<boolean>; await act(async () => { b = wizard.saveDraft(); });
    expect(h.remote).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve({ ok: true, data: { id, revision: 1 } }); await a; await b; });
    expect(h.remote.mock.calls[0][2].clientId).toBe(id); expect(h.remote.mock.calls[1][2].clientId).toBe(id);
    expect(JSON.parse(h.store.get(key())!).form.firstName).toBe('Neue Fassung');
  });
  it('waits for an in-flight draft before activating the same lead and clears the local draft', async () => {
    const first = deferred(); h.remote.mockReturnValueOnce(first.promise); await render(); await name('Anna');
    let draft!: Promise<boolean>; await act(async () => { draft = wizard.saveDraft(); });
    let submit!: Promise<string | null>; await act(async () => { submit = wizard.submit(); }); expect(h.create).not.toHaveBeenCalled();
    await act(async () => { first.resolve({ ok: true, data: { id, revision: 1 } }); await draft; expect(await submit).toBe(id); });
    expect(h.create.mock.calls[0][2].draftClientId).toBe(id); expect(h.store.has(key())).toBe(false);
    await act(async () => vi.advanceTimersByTime(800)); expect(h.remote).toHaveBeenCalledTimes(1);
  });
  it('keeps the recoverable client id after a partial service failure and reuses it on retry', async () => {
    h.create.mockResolvedValueOnce({ ok: false, error: 'Dokumentarchiv fehlgeschlagen', recoverableClientId: id }); await render(); await name('Retry');
    await act(async () => { expect(await wizard.submit()).toBeNull(); });
    expect(wizard.submitError).toContain('Dokumentarchiv'); expect(JSON.parse(h.store.get(key())!).clientId).toBe(id);
    await act(async () => { expect(await wizard.submit()).toBe(id); }); expect(h.create.mock.calls[1][2].draftClientId).toBe(id);
  });
  it('guards two submit taps in the same batch and never reports a committed intake as failed because cleanup failed', async () => {
    const save = deferred(); h.create.mockReturnValueOnce(save.promise); h.remove.mockRejectedValueOnce(new Error('storage denied'));
    await render(); await name('Nur einmal'); let a!: Promise<string | null>, b!: Promise<string | null>;
    await act(async () => { a = wizard.submit(); b = wizard.submit(); }); expect(h.create).toHaveBeenCalledTimes(1);
    await act(async () => { save.resolve({ ok: true, data: { id } }); expect(await a).toBe(id); expect(await b).toBeNull(); });
    expect(wizard.isSuccess).toBe(true); expect(wizard.submitError).toBeNull();
    await act(async () => { expect(await wizard.submit()).toBeNull(); });
    expect(h.create).toHaveBeenCalledTimes(1);
  });
  it('does not return a previous account success or overwrite its successor when the old submit finishes', async () => {
    const save = deferred(); h.create.mockReturnValueOnce(save.promise); await render(); await name('A');
    let pending!: Promise<string | null>; await act(async () => { pending = wizard.submit(); });
    h.tenant = 'tenant-B'; h.auth.user = { id: 'user-B' }; await render(); await name('B');
    await act(async () => { save.resolve({ ok: true, data: { id } }); expect(await pending).toBeNull(); });
    expect(wizard.form.firstName).toBe('B'); expect(wizard.createdId).toBeNull(); expect(wizard.submitting).toBe(false);
  });
  it('does not resurrect a discarded draft when a server response arrives late', async () => {
    const remote = deferred(); h.remote.mockReturnValueOnce(remote.promise); await render(); await name('Verwerfen');
    let writing!: Promise<boolean>, discard!: Promise<boolean>; await act(async () => { writing = wizard.saveDraft(); });
    await act(async () => { discard = wizard.discardDraft(); });
    await act(async () => { expect(await wizard.discardDraft()).toBe(false); });
    await act(async () => { remote.resolve({ ok: true, data: { id } }); await writing; expect(await discard).toBe(true); });
    expect(wizard.form.firstName).toBe(''); expect(h.store.has(key())).toBe(false);
  });
  it('reports a failed discard without clearing form or storage and confirms a successful retry only after removal', async () => {
    await render(); await name('Bleibt erhalten');
    await act(async () => { expect(await wizard.saveDraft()).toBe(true); });
    const stored = h.store.get(key());
    h.remove.mockRejectedValueOnce(new Error('storage denied'));
    await act(async () => { expect(await wizard.discardDraft()).toBe(false); });
    expect(wizard.form.firstName).toBe('Bleibt erhalten');
    expect(h.store.get(key())).toBe(stored);
    expect(wizard.draftSaveFeedback?.variant).toBe('warning');
    expect(wizard.discardingDraft).toBe(false);
    await act(async () => { expect(await wizard.discardDraft()).toBe(true); });
    expect(wizard.form.firstName).toBe('');
    expect(h.store.has(key())).toBe(false);
    expect(wizard.draftSaveFeedback).toBeNull();
  });
  it('saves signatures and final HTML as a server draft without calling original-document persistence', async () => {
    await render(); await name('Mit Unterschrift');
    const signed = [{ templateKey: 'privacy', status: 'finalized', finalizedHtml: '<p>Original</p>', signatures: { client: { dataUrl: 'data:image/png;base64,review' } } }];
    await act(async () => wizard.updateField('intakeDocuments', signed as any));
    await act(async () => { expect(await wizard.saveDraft()).toBe(true); });
    const saved = JSON.parse(h.store.get(key())!);
    expect(saved.form.intakeDocuments).toEqual(signed); expect(saved.serverRevision).toBe(1); expect(saved.pendingSave).toBeUndefined();
    expect(h.remote.mock.calls[0][1].intakeDocuments).toEqual(signed); expect(h.docs).not.toHaveBeenCalled();
    expect(wizard.draftSaveFeedback?.message).toContain('noch nicht abgeschlossen');
  });
  it('restores the complete server draft on another device through a known client ID', async () => {
    h.loadRemote.mockResolvedValueOnce({ ok: true, data: { clientId: id, status: 'draft', revision: 8, form: form('Anderes Gerät') } });
    await render({ clientId: id });
    expect(wizard.form.firstName).toBe('Anderes Gerät'); expect(wizard.draftIsSaved).toBe(true);
    await name('Fortgesetzt'); await act(async () => { expect(await wizard.saveDraft()).toBe(true); });
    expect(h.remote.mock.calls[0][2]).toMatchObject({ clientId: id, expectedRevision: 8 });
  });
  it('replays an uncertain stored operation before submitting newly edited data', async () => {
    const pending = { operationId: id, expectedRevision: 2, form: form('Vorher') };
    h.store.set(key(), JSON.stringify({ form: form('Danach'), stepIndex: 0, clientId: id, serverRevision: 2, pendingSave: pending, schemaVersion: 2 }));
    h.loadRemote.mockResolvedValueOnce({ ok: true, data: { clientId: id, status: 'draft', revision: 3, form: form('Vorher') } });
    await render();
    expect(h.remote.mock.calls[0][1].firstName).toBe('Vorher'); expect(h.remote.mock.calls[0][2]).toMatchObject({ expectedRevision: 2, operationId: id });
    expect(h.remote.mock.calls[1][1].firstName).toBe('Danach'); expect(h.remote.mock.calls[1][2].expectedRevision).toBe(3);
    expect(JSON.parse(h.store.get(key())!).serverRevision).toBe(4);
  });
  it('does not overwrite a newer revision or submit after a conflict; the user can explicitly load the server version', async () => {
    h.remote.mockResolvedValueOnce({ ok: false, conflict: true, error: 'Andere Fassung' });
    await render(); await name('Lokale Änderung');
    await act(async () => { expect(await wizard.saveDraft()).toBe(false); });
    expect(wizard.draftConflict).toBe(true); expect(wizard.form.firstName).toBe('Lokale Änderung');
    await act(async () => { expect(await wizard.submit()).toBeNull(); });
    expect(h.create).not.toHaveBeenCalled(); expect(h.remote).toHaveBeenCalledTimes(1);
    h.loadRemote.mockResolvedValueOnce({ ok: true, data: { clientId: id, status: 'draft', revision: 9, form: form('Serverstand') } });
    await act(async () => { expect(await wizard.reloadServerDraft()).toBe(true); });
    expect(wizard.form.firstName).toBe('Serverstand'); expect(wizard.draftConflict).toBe(false);
    await name('Abgestimmt'); await act(async () => { expect(await wizard.saveDraft()).toBe(true); });
    expect(h.remote.mock.calls[1][2].expectedRevision).toBe(9);
  });
  it('explicitly reconciles externally changed core fields, preserves originals and continues with the new revision', async () => {
    const original = [{ templateKey: 'contract', status: 'finalized', finalizedHtml: '<p>Original</p>', signatures: {} }];
    const serverForm = { ...form('Alter Name'), intakeDocuments: original };
    const mergedForm = { ...serverForm, firstName: 'Aktueller Aktenname' };
    const changed = { ok: true, data: { clientId: id, status: 'draft', revision: 5, form: serverForm, coreChanged: true, currentClientUpdatedAt: '2026-10-14T12:00:00Z' } };
    h.loadRemote.mockResolvedValueOnce(changed).mockResolvedValueOnce(changed)
      .mockResolvedValueOnce({ ok: true, data: { ...changed.data, form: mergedForm, revision: 6, coreChanged: false } });
    h.reconcile.mockImplementationOnce(async (_tenant, options) => {
      expect(JSON.parse(h.store.get(key())!).pendingReconciliation).toEqual({ operationId: options.operationId, expectedRevision: 5, expectedClientUpdatedAt: '2026-10-14T12:00:00Z' });
      return { ok: true, data: { id, revision: 6 } };
    });
    await render({ clientId: id });
    expect(wizard.draftConflict).toBe(true); expect(h.remote).not.toHaveBeenCalled(); expect(h.reconcile).not.toHaveBeenCalled();
    await act(async () => { expect(await wizard.reloadServerDraft()).toBe(true); });
    expect(wizard.form.firstName).toBe('Aktueller Aktenname'); expect(wizard.form.intakeDocuments).toEqual(original);
    expect(wizard.draftConflict).toBe(false); expect(wizard.draftSaveFeedback?.message).toContain('erneut');
    await name('Abgestimmte Änderung'); await act(async () => { expect(await wizard.saveDraft()).toBe(true); });
    expect(h.remote.mock.calls[0][2].expectedRevision).toBe(6);
  });
  it('replays a reconciliation lost response after reload with the same operation and core timestamp', async () => {
    const changed = { ok: true, data: { clientId: id, status: 'draft', revision: 5, form: form('Alt'), coreChanged: true, currentClientUpdatedAt: '2026-10-14T12:00:00Z' } };
    h.loadRemote.mockResolvedValue(changed);
    h.reconcile.mockResolvedValueOnce({ ok: false, error: 'Antwort verloren', rejected: false });
    await render({ clientId: id });
    await act(async () => { expect(await wizard.reloadServerDraft()).toBe(false); });
    const operation = JSON.parse(h.store.get(key())!).pendingReconciliation;
    expect(operation.expectedRevision).toBe(5);
    h.loadRemote.mockResolvedValue({ ok: true, data: { ...changed.data, revision: 6, form: form('Aktuell'), coreChanged: false } });
    h.reconcile.mockResolvedValueOnce({ ok: true, data: { id, revision: 6, replayed: true } });
    await act(async () => root.unmount()); root = createRoot(host); await render({ clientId: id });
    expect(wizard.draftConflict).toBe(true); expect(h.remote).not.toHaveBeenCalled();
    await act(async () => { expect(await wizard.reloadServerDraft()).toBe(true); });
    expect(h.reconcile.mock.calls[0][1]).toEqual(h.reconcile.mock.calls[1][1]);
    expect(wizard.form.firstName).toBe('Aktuell'); expect(wizard.draftConflict).toBe(false);
    expect(JSON.parse(h.store.get(key())!).pendingReconciliation).toBeUndefined();
  });
  it('keeps reconciliation blocked when another actor changes the core again during adoption', async () => {
    const changed = { ok: true, data: { clientId: id, status: 'draft', revision: 5, form: form('Lokal'), coreChanged: true, currentClientUpdatedAt: '2026-10-14T12:00:00Z' } };
    h.loadRemote.mockResolvedValue(changed);
    h.reconcile.mockResolvedValueOnce({ ok: false, error: 'Erneut geändert', rejected: true, conflict: true });
    await render({ clientId: id }); await act(async () => { expect(await wizard.reloadServerDraft()).toBe(false); });
    expect(wizard.draftConflict).toBe(true); expect(wizard.form.firstName).toBe('Lokal'); expect(h.remote).not.toHaveBeenCalled();
    expect(JSON.parse(h.store.get(key())!).pendingReconciliation).toBeUndefined();
  });
  it('keeps an offline local change when another device has saved a newer version', async () => {
    h.store.set(key(), JSON.stringify({ form: form('Lokale Änderung'), serverFormSnapshot: JSON.stringify(form('Alt')), serverRevision: 2, clientId: id, stepIndex: 0, schemaVersion: 2 }));
    h.loadRemote.mockResolvedValueOnce({ ok: true, data: { clientId: id, status: 'draft', revision: 3, form: form('Neue Serverfassung') } });
    await render();
    expect(wizard.form.firstName).toBe('Lokale Änderung'); expect(wizard.draftConflict).toBe(true);
    await act(async () => vi.advanceTimersByTime(800)); expect(h.remote).not.toHaveBeenCalled();
  });
  it('suppresses all success callbacks after unmount', async () => {
    const save = deferred(); h.create.mockReturnValueOnce(save.promise); await render(); await name('Unmount');
    let pending!: Promise<string | null>; await act(async () => { pending = wizard.submit(); });
    await act(async () => root.unmount()); unmounted = true;
    await act(async () => { save.resolve({ ok: true, data: { id } }); expect(await pending).toBeNull(); });
    expect(h.remove).not.toHaveBeenCalled();
  });
});

it('persists the just-signed package snapshot immediately, including both signatures, and restores it', async () => {
  await render(); await name('Erika');
  const signed = { ...wizard.form, intakeDocuments: [{ templateKey: 'client_contract_assist', documentType: 'client_contract',
    title: 'Aufnahmevertrag', status: 'finalized', isRequired: true, source: 'system', version: 3,
    previewHtml: '<p>Signed original</p>', finalizedHtml: '<p>Signed original</p>', renderedPdfPath: null,
    missingPlaceholders: [], unresolvedKeys: [], previewOpenedAt: '2026-10-20T07:00:00Z', finalizedAt: '2026-10-20T07:01:00Z',
    signatures: { client: { role: 'client', dataUrl: 'data:image/png;base64,Y2xpZW50', signedAt: '2026-10-20T07:00:30Z' },
      employee: { role: 'employee', dataUrl: 'data:image/png;base64,ZW1wbG95ZWU=', signedAt: '2026-10-20T07:00:40Z' } } }] } as any;
  let saved = false; await act(async () => { saved = await wizard.saveDocumentPackage(signed); });
  expect(saved).toBe(true); expect(h.remote.mock.calls.at(-1)?.[1]).toEqual(signed);
  const stored = JSON.parse(h.store.get(key())!); expect(stored.form.intakeDocuments).toEqual(signed.intakeDocuments);
  expect(wizard.form.intakeDocuments).toEqual(signed.intakeDocuments);
});


describe('first-contact continuation and deletion', () => {
  it('saves contact without completing or scheduling and resumes the same client for full intake', async () => {
    await render({ completeSectionFlow: true });
    await act(async () => wizard.replaceForm({ ...form(''), intakeStage: 'first_contact', intakeWorkflowVersion: 2, lastName: 'Beispiel', phone: '03012345' }));
    await act(async () => { expect(await wizard.saveFirstContact()).toBe(true); });
    expect(h.create).not.toHaveBeenCalled(); expect(h.schedule).not.toHaveBeenCalled();
    const firstId=wizard.draftClientId;
    await act(async () => { wizard.updateField('intakeStage','full_intake'); wizard.updateField('dateOfBirth','1950-01-01'); });
    await act(async () => { await wizard.saveDraft(); });
    expect(wizard.draftClientId).toBe(firstId);
    expect(h.remote.mock.calls.at(-1)?.[1]).toMatchObject({lastName:'Beispiel',phone:'03012345',intakeStage:'full_intake'});
  });
  it('keeps contact saved when calendar confirmation fails and retries against the same draft', async () => {
    await render({ completeSectionFlow: true });
    await act(async () => wizard.replaceForm({ ...form(''), intakeWorkflowVersion:2,intakeStage:'first_contact',lastName:'Beispiel',phone:'03012345',intakeAppointmentRequested:true,intakeAppointmentStart:'2026-11-01T11:00',intakeAppointmentEnd:'2026-11-01T12:00' }));
    h.schedule.mockResolvedValueOnce({ok:false,error:'Antwort verloren'});
    await act(async () => { expect(await wizard.saveFirstContact()).toBe(false); });
    expect(wizard.draftSaveFeedback?.message).toContain('Erstkontakt gespeichert');
    expect(h.store.size).toBeGreaterThan(0);
    await act(async () => { expect(await wizard.saveFirstContact()).toBe(true); });
    expect(h.schedule.mock.calls[1]).toEqual(h.schedule.mock.calls[0]); expect(h.create).not.toHaveBeenCalled();
  });
  it('waits for an in-flight save, deletes its confirmed revision and clears only after server confirmation', async () => {
    await render({completeSectionFlow:true}); await name('Entwurf');
    const write=deferred(); h.remote.mockReturnValueOnce(write.promise);
    let saving!:Promise<boolean>; await act(async () => { saving=wizard.saveDraft(); });
    let deleting!:Promise<boolean>; await act(async () => { deleting=wizard.discardDraft(true); });
    expect(h.deleteDraft).not.toHaveBeenCalled();
    await act(async () => { write.resolve({ok:true,data:{id,revision:1}}); await saving; await deleting; });
    expect(h.deleteDraft).toHaveBeenCalledWith(h.tenant,id,1);
    expect(wizard.form.firstName).toBe(''); expect(h.store.size).toBe(0);
  });
  it('does not clear local data on failed server deletion and does not resurrect a deleted remote draft', async () => {
    await render(); await name('Behalten'); await act(async () => { await wizard.saveDraft(); });
    h.deleteDraft.mockResolvedValueOnce({ok:false,error:'Zwischenzeitlich geändert'});
    await act(async () => { expect(await wizard.discardDraft(true)).toBe(false); });
    expect(wizard.form.firstName).toBe('Behalten'); expect(h.store.size).toBeGreaterThan(0);
    h.loadRemote.mockResolvedValueOnce({ok:false,deleted:true,error:'Gelöscht'});
    h.remote.mockClear(); await render({ clientId:id });
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(wizard.loadError).toContain('gelöscht'); expect(h.remote).not.toHaveBeenCalled(); expect(h.store.size).toBe(0);
  });
});
