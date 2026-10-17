// @vitest-environment happy-dom
import React, { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { ClientListItem } from '@/types/modules/office';

const state = vi.hoisted(() => ({ tenant: 'tenant-a' as string | null, user: 'user-a' as string | null, role: 'business_admin' as RoleKey | null, permissions: ['office.clients.view'] as PermissionKey[], params: {} as { clientId?: string | string[] }, fetch: vi.fn(), setParams: vi.fn(), confirm: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => router, useLocalSearchParams: () => state.params }));
const router = { setParams: state.setParams };
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: state.user ? { id: state.user } : null }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => state.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: state.role, permissions: state.permissions, can: (permission: PermissionKey) => state.permissions.includes(permission) }) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children, contentOwnsHeader }: any) => <main data-own-header={String(contentOwnsHeader)}>{children}</main> }));
vi.mock('@/lib/office/clientListService', () => ({ fetchClientList: (...args: unknown[]) => state.fetch(...args) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: (...args: unknown[]) => state.confirm(...args) }));
vi.mock('@/components/office/ClientCareGradeBudgetsPanel.web', () => ({ ClientCareGradeBudgetsPanel: ({ clientId, clientName, onDirtyChange, onBusyChange, onRecordRefresh }: any) => {
  const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { onDirtyChange(Boolean(draft)); }, [draft, onDirtyChange]);
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  return <section data-panel={clientId}><span>{clientName}</span><input aria-label="Budgetentwurf" value={draft} onInput={event => setDraft(event.currentTarget.value)} /><button onClick={() => setBusy(value => !value)}>Schreibvorgang</button><button onClick={() => void onRecordRefresh()}>Nach Speichern aktualisieren</button></section>;
} }));
import { AssistBudgetOverviewScreen } from '@/screens/assist/AssistBudgetOverviewScreen.web';

const client = (id: string, firstName: string, lastName: string, careLevel = 'pg2', tenantId = 'tenant-a'): ClientListItem => ({ id, tenantId, firstName, lastName, careLevel, city: 'Herne', status: 'aktiv', dateOfBirth: null, primaryContactPhone: null, sensitivity: 'standard', updatedAt: '2026-10-17T06:00:00Z' });
const clients = [client('client-a', 'Anna', 'Müller', 'none'), client('client-b', 'Ben', 'Schuster')];
const result = (items = clients): ServiceResult<ClientListItem[]> => ({ ok: true, data: items });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.tenant = 'tenant-a'; state.user = 'user-a'; state.role = 'business_admin'; state.permissions = ['office.clients.view']; state.params = {};
  state.fetch.mockReset().mockResolvedValue(result()); state.setParams.mockReset(); state.confirm.mockReset().mockResolvedValue(false);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<AssistBudgetOverviewScreen />)); };
const button = (label: string) => [...host.querySelectorAll('button')].find(element => element.textContent?.includes(label))!;
const click = async (label: string) => { await act(async () => button(label).click()); };
const panel = () => host.querySelector<HTMLElement>('[data-panel]');
const draft = () => host.querySelector<HTMLInputElement>('[aria-label="Budgetentwurf"]')!;
const editDraft = async () => { await act(async () => { draft().value = 'Noch nicht gespeichert'; draft().dispatchEvent(new Event('input', { bubbles: true })); }); };
const openChooser = async () => { if (!host.querySelector('.abo-picker')) await click('Klient:in wechseln'); };

describe('Web budget client workspace', () => {
  it('uses a compact collapsed selection, normal care labels and the live list service', async () => {
    await render();
    expect(state.fetch).toHaveBeenCalledWith('tenant-a', 'business_admin', { lifecycleFilter: 'active' });
    expect(host.querySelector('main')?.dataset.ownHeader).toBe('true');
    expect(panel()?.dataset.panel).toBe('client-a');
    expect(host.textContent).toContain('kein Pflegegrad'); expect(host.textContent).not.toContain('Pflegegrad none');
    expect(host.querySelector('.abo-results')).toBeNull();
    expect(state.setParams).toHaveBeenLastCalledWith({ clientId: 'client-a' });
  });

  it('loads a repeated query parameter safely and lets a manual choice survive refresh with the old URL', async () => {
    state.params = { clientId: ['client-b', 'client-a'] }; await render();
    expect(panel()?.dataset.panel).toBe('client-b');
    await openChooser(); await click('Anna Müller');
    expect(panel()?.dataset.panel).toBe('client-a'); expect(state.setParams).toHaveBeenLastCalledWith({ clientId: 'client-a' });
    await click('Liste aktualisieren');
    expect(panel()?.dataset.panel).toBe('client-a');
    state.params = { clientId: 'client-a' }; await render();
    expect(panel()?.dataset.panel).toBe('client-a');
    state.params = { clientId: 'client-b' }; await render();
    expect(panel()?.dataset.panel).toBe('client-b');
  });

  it('searches normalized names, full care grades and towns; Escape returns focus', async () => {
    await render(); await openChooser();
    const input = host.querySelector<HTMLInputElement>('input[type=search]')!;
    expect(document.activeElement).toBe(input);
    const setSearch = async (value: string) => { await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); };
    await setSearch('muller'); expect(host.querySelector('.abo-results')?.textContent).toContain('Anna Müller'); expect(host.querySelector('.abo-results')?.textContent).not.toContain('Ben Schuster');
    await setSearch('pflegegrad 2 herne'); expect(host.querySelector('.abo-results')?.textContent).toContain('Ben Schuster'); expect(host.querySelector('.abo-results')?.textContent).not.toContain('Anna Müller');
    await setSearch('unbekannter Name'); expect(host.textContent).toContain('Kein Suchtreffer');
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('.abo-picker')).toBeNull(); expect(document.activeElement).toBe(button('Klient:in wechseln'));
  });

  it('retains the current editor and unsaved fields through successful list refresh', async () => {
    await render(); await editDraft(); const previous = draft();
    state.fetch.mockResolvedValue(result(clients.map(item => ({ ...item })))); await click('Nach Speichern aktualisieren');
    expect(draft()).toBe(previous); expect(draft().value).toBe('Noch nicht gespeichert');
  });

  it('protects an unsaved client choice and resets the editor only after accepted discard', async () => {
    await render(); await editDraft(); await openChooser(); await click('Ben Schuster');
    expect(state.confirm).toHaveBeenCalledOnce(); expect(panel()?.dataset.panel).toBe('client-a'); expect(draft().value).toBe('Noch nicht gespeichert');
    state.confirm.mockResolvedValue(true); await click('Ben Schuster');
    expect(panel()?.dataset.panel).toBe('client-b'); expect(draft().value).toBe('');
  });

  it('blocks switching while a mutation or modal is active without offering discard', async () => {
    await render(); await click('Schreibvorgang'); await openChooser(); await click('Ben Schuster');
    expect(panel()?.dataset.panel).toBe('client-a'); expect(state.confirm).not.toHaveBeenCalled();
    expect(host.textContent).toContain('warten Sie, bis das Speichern beendet ist');
    await click('Schreibvorgang'); await click('Ben Schuster'); expect(panel()?.dataset.panel).toBe('client-b');
  });

  it('restores the current URL when a changed deep link would discard rejected edits', async () => {
    state.params = { clientId: 'client-a' }; await render(); await editDraft();
    state.params = { clientId: 'client-b' }; await render();
    expect(panel()?.dataset.panel).toBe('client-a'); expect(draft().value).toBe('Noch nicht gespeichert');
    expect(state.setParams).toHaveBeenLastCalledWith({ clientId: 'client-a' });
  });

  it('shows an unavailable deep link instead of silently opening another person', async () => {
    state.params = { clientId: 'outside-tenant' }; await render();
    expect(panel()).toBeNull(); expect(host.textContent).toContain('Die verlinkte Klient:in'); expect(host.querySelector('.abo-picker')).toBeTruthy();
    await click('Ben Schuster'); expect(panel()?.dataset.panel).toBe('client-b');
  });

  it('shows loading, then an empty state without inventing a selection', async () => {
    const pending = deferred<ServiceResult<ClientListItem[]>>(); state.fetch.mockReturnValue(pending.promise); await render();
    expect(host.textContent).toContain('Klient:innen werden geladen'); expect(panel()).toBeNull();
    await act(async () => pending.resolve(result([])));
    expect(host.textContent).toContain('Keine aktiven Klient:innen'); expect(panel()).toBeNull();
  });

  it('keeps stale list failures visible and retries without unmounting a draft', async () => {
    await render(); await editDraft(); const previous = draft();
    state.fetch.mockResolvedValue({ ok: false, error: 'Abfrage abgelehnt.' }); await click('Liste aktualisieren');
    expect(host.querySelector('[role=alert]')?.textContent).toContain('zuletzt geladene Stand'); expect(host.textContent).toContain('Abfrage abgelehnt.');
    expect(draft()).toBe(previous); expect(draft().value).toBe('Noch nicht gespeichert');
    state.fetch.mockResolvedValue(result()); await click('Erneut laden'); expect(host.querySelector('[role=alert]')).toBeNull(); expect(draft()).toBe(previous);
  });

  it('distinguishes a first-load error from an empty list and can retry', async () => {
    state.fetch.mockResolvedValue({ ok: false, error: 'Keine Berechtigung.' }); await render();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Klientenliste konnte nicht geladen'); expect(host.textContent).not.toContain('Keine aktiven Klient:innen');
    state.fetch.mockResolvedValue(result()); await click('Erneut laden'); expect(panel()?.dataset.panel).toBe('client-a');
  });

  it('clears a removed selection immediately and waits for an explicit alternative', async () => {
    await render(); state.params = { clientId: 'client-a' }; await render();
    state.fetch.mockResolvedValue(result([clients[1]])); await click('Liste aktualisieren');
    expect(panel()).toBeNull(); expect(host.textContent).toContain('nicht mehr in der aktiven Liste');
    state.params = {}; await render(); expect(panel()).toBeNull();
    await click('Ben Schuster'); expect(panel()?.dataset.panel).toBe('client-b');
  });

  it('drops old identity data immediately and rejects a late result from the previous tenant', async () => {
    const pending = deferred<ServiceResult<ClientListItem[]>>(); state.fetch.mockReturnValueOnce(pending.promise); await render();
    state.tenant = 'tenant-b'; state.fetch.mockResolvedValue(result([client('other-client', 'Clara', 'Neumann', 'pg3', 'tenant-b')])); await render();
    expect(panel()?.dataset.panel).toBe('other-client');
    await act(async () => pending.resolve(result())); expect(panel()?.dataset.panel).toBe('other-client'); expect(host.textContent).not.toContain('Anna Müller');
    await editDraft(); const previous = draft(); state.user = 'user-b'; await render(); expect(draft()).not.toBe(previous); expect(draft().value).toBe('');
  });

  it('ignores a pending discard confirmation after the account boundary changes', async () => {
    await render(); await editDraft(); await openChooser();
    const pending = deferred<boolean>(); state.confirm.mockReturnValue(pending.promise); await click('Ben Schuster');
    state.tenant = 'tenant-b'; state.fetch.mockResolvedValue(result([client('other-client', 'Clara', 'Neumann', 'pg3', 'tenant-b')])); await render();
    state.setParams.mockClear(); await act(async () => pending.resolve(true));
    expect(panel()?.dataset.panel).toBe('other-client'); expect(state.setParams).not.toHaveBeenCalled();
  });

  it('does not reset drafts when permission order changes but closes them on revoked access', async () => {
    state.permissions = ['office.clients.view', 'clients.budgets.edit']; await render(); await editDraft(); const previous = draft();
    state.permissions = ['clients.budgets.edit', 'office.clients.view', 'office.clients.view']; await render(); expect(draft()).toBe(previous);
    state.permissions = []; await render(); expect(panel()).toBeNull(); expect(host.textContent).toContain('Freigabe zum Anzeigen');
    expect(state.fetch).toHaveBeenCalledOnce();
  });

  it('never fetches client data for a portal, signed-out account or missing tenant', async () => {
    for (const role of ['employee_portal', 'client_portal', 'family_portal', null] as const) { state.role = role; await render(); expect(panel()).toBeNull(); }
    state.role = 'business_admin'; state.user = null; await render(); state.user = 'user-a'; state.tenant = null; await render();
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
