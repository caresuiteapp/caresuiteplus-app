// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClientIntakeWizard, type UseClientIntakeWizardOptions } from '@/hooks/useClientIntakeWizard';
import { EMPTY_CLIENT_INTAKE_FORM, type ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeDocumentState } from '@/features/intakeDocuments/intakeDocumentTypes';

const h = vi.hoisted(() => ({
  tenant: 'tenant-A',
  auth: { user: { id: 'user-A', roleKey: 'business_admin' }, profile: { id: 'actor-A', roleKey: 'business_admin' } },
  store: new Map<string, string>(), get: vi.fn(), set: vi.fn(), remove: vi.fn(),
  save: vi.fn(), load: vi.fn(), complete: vi.fn(), uuid: vi.fn(),
}));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('expo-crypto', () => ({ randomUUID: h.uuid }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: h.get, setItem: h.set, removeItem: h.remove } }));
vi.mock('@/lib/clients/repositories/clientIntakeDraftRepository.supabase', () => ({ upsertClientIntakeDraft: h.save, loadServerClientIntakeDraft: h.load }));
vi.mock('@/features/costCarriers/costCarrierService', () => ({ validateCostBearerEntry: () => null }));
vi.mock('@/lib/clients/clientIntakeEditService', () => ({ fetchClientIntakeEditData: vi.fn() }));
vi.mock('@/lib/client/clientServiceTypeService', () => ({ getServiceIntakeSections: vi.fn(), careContextsToServiceTypeKeys: (value: unknown) => value }));
vi.mock('@/lib/clients/clientIntakeService', async () => {
  const { EMPTY_CLIENT_INTAKE_FORM } = await import('@/types/forms/clientIntakeForm');
  const { getVisibleSectionsForClientContext } = await import('@/lib/clients/clientIntakeFieldRules');
  return {
    createEmptyIntakeForm: () => structuredClone(EMPTY_CLIENT_INTAKE_FORM),
    getIntakeStepsForContexts: getVisibleSectionsForClientContext,
    getIntakeStepsForServiceTypeKeys: vi.fn(), validateIntakeStep: () => ({}),
    hasIntakeErrors: (errors: object) => Object.keys(errors).length > 0,
    submitClientIntake: h.complete, submitClientIntakeUpdate: vi.fn(),
  };
});

const clientA = '11111111-1111-4111-8111-111111111111';
const clientB = '22222222-2222-4222-8222-222222222222';
const operation = '33333333-3333-4333-8333-333333333333';
const key = () => `caresuite:client-intake-draft:${h.tenant}:${h.auth.user.id}`;
const form = (firstName: string): ClientIntakeFormData => ({ ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), firstName });
const remote = (value: ClientIntakeFormData, revision: number, status = 'draft', clientId = clientA) => ({ ok: true, data: { clientId, revision, status, form: value } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
let host: HTMLDivElement;
let root: Root;
let wizard: ReturnType<typeof useClientIntakeWizard>;
function Probe({ options }: { options?: UseClientIntakeWizardOptions }) {
  const result = useClientIntakeWizard({ validateOnSubmit: false, completeSectionFlow: true, ...options });
  React.useLayoutEffect(() => { wizard = result; });
  return <span>{result.form.firstName}:{result.createdId}</span>;
}
async function render(options?: UseClientIntakeWizardOptions) { await act(async () => root.render(<Probe options={options} />)); }
async function remount(options?: UseClientIntakeWizardOptions) {
  await act(async () => root.unmount());
  root = createRoot(host);
  await render(options);
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers(); vi.clearAllMocks(); h.store.clear();
  h.tenant = 'tenant-A';
  h.auth = { user: { id: 'user-A', roleKey: 'business_admin' }, profile: { id: 'actor-A', roleKey: 'business_admin' } };
  h.get.mockImplementation(async (storageKey: string) => h.store.get(storageKey) ?? null);
  h.set.mockImplementation(async (storageKey: string, value: string) => { h.store.set(storageKey, value); });
  h.remove.mockImplementation(async (storageKey: string) => { h.store.delete(storageKey); });
  h.uuid.mockReturnValue(operation);
  h.load.mockResolvedValue({ ok: true, data: null });
  h.save.mockImplementation(async (_tenant, _form, options) => ({ ok: true, data: { id: options.clientId, revision: options.expectedRevision + 1 } }));
  h.complete.mockResolvedValue({ ok: true, data: { id: clientA } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

describe('server draft recovery with real local persistence', () => {
  it('replays the exact persisted request even when UI restoration recognizes fewer fields', async () => {
    h.uuid.mockReturnValue(clientB);
    const documentState: IntakeDocumentState = {
      templateKey: 'privacy_consent_default', documentType: 'privacy_consent',
      title: 'Datenschutzeinwilligung', isRequired: true, status: 'not_started',
      source: 'system', version: 1, missingPlaceholders: [], unresolvedKeys: [],
      previewHtml: null, finalizedHtml: null, renderedPdfPath: null,
      signatures: {}, previewOpenedAt: null, finalizedAt: null,
    };
    const original = {
      ...form('Unbestätigte Fassung'),
      intakeDocuments: [documentState],
      retainedFutureField: 'must stay in the replay',
    };
    const pendingSave = { operationId: operation, expectedRevision: 2, form: original };
    h.store.set(key(), JSON.stringify({ form: original, stepIndex: 0, clientId: clientA, schemaVersion: 2, serverRevision: 2, pendingSave }));
    h.load.mockResolvedValue(remote(original, 3));
    await render();
    expect(h.save.mock.calls[0][1]).toEqual(original);
    expect(h.save.mock.calls[0][2]).toMatchObject({ clientId: clientA, operationId: operation, expectedRevision: 2 });
    expect('retainedFutureField' in wizard.form).toBe(false);
    expect(wizard.form.intakeDocuments).toEqual([documentState]);
    expect(h.save.mock.calls[1][2].expectedRevision).toBe(3);
    expect(h.save.mock.calls[1][2].operationId).not.toBe(operation);
    expect(JSON.parse(h.store.get(key())!).pendingSave).toBeUndefined();
  });

  it('detects a newer server version after replaying a lost response, without adopting permission to overwrite it', async () => {
    h.load.mockResolvedValueOnce(remote(form('Ausgangsstand'), 2));
    await render({ mode: 'create', clientId: clientA });
    await act(async () => wizard.updateField('firstName', 'Unbestätigte lokale Fassung'));
    h.save.mockResolvedValueOnce({ ok: false, error: 'Antwort verloren' });
    await act(async () => { expect(await wizard.saveDraft()).toBe(false); });
    const pending = JSON.parse(h.store.get(key())!).pendingSave;
    expect(pending).toMatchObject({ operationId: operation, expectedRevision: 2 });

    h.load.mockResolvedValue(remote(form('Andere Person hat weitergearbeitet'), 5));
    h.save.mockResolvedValueOnce({ ok: true, data: { id: clientA, revision: 3, replayed: true } });
    await remount({ mode: 'create', clientId: clientA });
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(h.save.mock.calls[1][1]).toEqual(pending.form);
    expect(h.save.mock.calls[1][2]).toMatchObject({ operationId: pending.operationId, expectedRevision: 2 });
    expect(wizard.form.firstName).toBe('Unbestätigte lokale Fassung');
    expect(wizard.draftConflict).toBe(true);
    expect(wizard.draftSaveFeedback?.variant).toBe('warning');
    await act(async () => { expect(await wizard.submit()).toBeNull(); });
    expect(h.complete).not.toHaveBeenCalled();
    expect(h.save).toHaveBeenCalledTimes(2);
    expect(JSON.parse(h.store.get(key())!).form.firstName).toBe('Unbestätigte lokale Fassung');
  });

  it('clears the matching local draft after a confirmed completion replay so a fresh intake starts empty', async () => {
    h.store.set(key(), JSON.stringify({ form: form('Bereits aufgenommen'), stepIndex: 0, clientId: clientA, schemaVersion: 2, serverRevision: 4 }));
    h.load.mockResolvedValueOnce(remote(form('Bereits aufgenommen'), 4, 'completed'));
    await render();
    expect(h.complete.mock.calls[0][2]).toMatchObject({ draftClientId: clientA, expectedRevision: 4 });
    expect(wizard.isSuccess).toBe(true);
    expect(h.store.has(key())).toBe(false);
    await remount();
    expect(wizard.form.firstName).toBe('');
    expect(wizard.createdId).toBeNull();
    expect(h.load).toHaveBeenCalledTimes(1);
    expect(h.complete).toHaveBeenCalledTimes(1);
  });

  it('preserves an unrelated local draft when a different explicitly opened intake is already complete', async () => {
    const local = JSON.stringify({ form: form('Noch offen'), stepIndex: 0, clientId: clientA, schemaVersion: 2, serverRevision: 2 });
    h.store.set(key(), local);
    h.load.mockResolvedValueOnce(remote(form('Andere abgeschlossene Akte'), 6, 'completed', clientB));
    h.complete.mockResolvedValueOnce({ ok: true, data: { id: clientB } });
    await render({ mode: 'create', clientId: clientB });
    expect(wizard.createdId).toBe(clientB);
    expect(wizard.form.firstName).toBe('Andere abgeschlossene Akte');
    expect(h.store.get(key())).toBe(local);
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
  });

  it.each(['tenant', 'actor'] as const)('ignores a stale remote completion after changing the %s scope', async (changedScope) => {
    const oldLoad = deferred<ReturnType<typeof remote>>();
    h.load.mockReturnValueOnce(oldLoad.promise).mockResolvedValueOnce(remote(form('Aktuelle Sitzung'), 7));
    await render({ mode: 'create', clientId: clientA });
    if (changedScope === 'tenant') h.tenant = 'tenant-B';
    else h.auth = { ...h.auth, profile: { ...h.auth.profile, id: 'actor-B' } };
    await render({ mode: 'create', clientId: clientA });
    await act(async () => oldLoad.resolve(remote(form('Private alte Sitzung'), 3, 'completed')));
    expect(wizard.form.firstName).toBe('Aktuelle Sitzung');
    expect(wizard.createdId).toBeNull();
    expect(h.complete).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
  });
});
