// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { useClientIntakeWizard, type UseClientIntakeWizardOptions } from '@/hooks/useClientIntakeWizard';
import { getVisibleSectionsForClientContext } from '@/lib/clients/clientIntakeFieldRules';

const h = vi.hoisted(() => ({
  tenant: 'tenant-A', auth: {} as any, mode: 'supabase', store: new Map<string, string>(),
  get: vi.fn(), set: vi.fn(), remove: vi.fn(), remote: vi.fn(), docs: vi.fn(), create: vi.fn(), update: vi.fn(), edit: vi.fn(), sections: vi.fn(),
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => h.mode }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: h.get, setItem: h.set, removeItem: h.remove } }));
vi.mock('@/lib/clients/repositories/clientIntakeDraftRepository.supabase', () => ({ upsertClientIntakeDraft: h.remote }));
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
  h.remote.mockResolvedValue({ ok: true, data: { id } }); h.docs.mockResolvedValue({ ok: true });
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
    expect(JSON.parse(h.store.get(key())!).form.firstName).toBe('Erhalten'); expect(wizard.draftSaveFeedback?.message).toContain('lokal erhalten');
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
  it('serializes competing draft saves and reuses the first server id rather than creating two leads', async () => {
    const first = deferred(); h.remote.mockReturnValueOnce(first.promise); await render(); await name('Erste Fassung');
    let a!: Promise<boolean>; await act(async () => { a = wizard.saveDraft(); });
    await name('Neue Fassung'); let b!: Promise<boolean>; await act(async () => { b = wizard.saveDraft(); });
    expect(h.remote).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve({ ok: true, data: { id } }); await a; await b; });
    expect(h.remote.mock.calls[0][2].clientId).toBe(id); expect(h.remote.mock.calls[1][2].clientId).toBe(id);
    expect(JSON.parse(h.store.get(key())!).form.firstName).toBe('Neue Fassung');
  });
  it('waits for an in-flight draft before activating the same lead and clears the local draft', async () => {
    const first = deferred(); h.remote.mockReturnValueOnce(first.promise); await render(); await name('Anna');
    let draft!: Promise<boolean>; await act(async () => { draft = wizard.saveDraft(); });
    let submit!: Promise<string | null>; await act(async () => { submit = wizard.submit(); }); expect(h.create).not.toHaveBeenCalled();
    await act(async () => { first.resolve({ ok: true, data: { id } }); await draft; expect(await submit).toBe(id); });
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
  it('preserves signed document and stable client id locally before any unsafe remote mutation', async () => {
    h.docs.mockResolvedValue({ ok: false, error: 'Unterschrift-Upload fehlgeschlagen' }); await render(); await name('Mit Unterschrift');
    await act(async () => wizard.updateField('intakeDocuments', [{ templateKey: 'privacy', signatures: { client: { dataUrl: 'data:image/png;base64,review' } } }] as any));
    await act(async () => { expect(await wizard.saveDraft()).toBe(false); });
    const saved = JSON.parse(h.store.get(key())!); expect(saved.clientId).toBe(id); expect(saved.form.intakeDocuments[0].signatures.client.dataUrl).toContain('review');
    expect(h.remote).not.toHaveBeenCalled(); expect(h.docs).not.toHaveBeenCalled();
    expect(wizard.draftSaveFeedback?.message).toContain('Serversicherung');
    expect(wizard.draftSaveFeedback?.message).toContain('gesperrt');
    expect(wizard.draftSaveFeedback?.variant).toBe('warning');
  });
  it('blocks finalized documents without signature bytes before lead creation but still saves the local original', async () => {
    await render(); await name('Finales Original');
    await act(async () => wizard.updateField('intakeDocuments', [{ templateKey: 'privacy', status: 'finalized', finalizedHtml: '<p>Original</p>', signatures: {} }] as any));
    await act(async () => { expect(await wizard.saveDraft()).toBe(false); });
    expect(JSON.parse(h.store.get(key())!).form.intakeDocuments[0].finalizedHtml).toBe('<p>Original</p>');
    expect(h.remote).not.toHaveBeenCalled(); expect(h.docs).not.toHaveBeenCalled();
  });
  it('retains a legacy original in preview_open with final HTML and no capture before any remote lead mutation', async () => {
    await render(); await name('Legacy Original');
    const originalHtml = '<p>Original mit eingebetteten Signaturbytes data:image/png;base64,legacy</p>';
    await act(async () => wizard.updateField('intakeDocuments', [{ templateKey: 'privacy', status: 'preview_open', finalizedHtml: originalHtml, finalizedAt: null, signatures: {} }] as any));
    await act(async () => { expect(await wizard.saveDraft()).toBe(false); });
    const saved = JSON.parse(h.store.get(key())!);
    expect(saved.form.intakeDocuments[0].finalizedHtml).toBe(originalHtml); expect(saved.clientId).toBe(id);
    expect(h.remote).not.toHaveBeenCalled(); expect(h.docs).not.toHaveBeenCalled();
    expect(wizard.draftSaveFeedback?.variant).toBe('warning');
  });
  it('suppresses all success callbacks after unmount', async () => {
    const save = deferred(); h.create.mockReturnValueOnce(save.promise); await render(); await name('Unmount');
    let pending!: Promise<string | null>; await act(async () => { pending = wizard.submit(); });
    await act(async () => root.unmount()); unmounted = true;
    await act(async () => { save.resolve({ ok: true, data: { id } }); expect(await pending).toBeNull(); });
    expect(h.remove).not.toHaveBeenCalled();
  });
});
