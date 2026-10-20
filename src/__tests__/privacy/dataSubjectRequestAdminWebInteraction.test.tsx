// @vitest-environment happy-dom
import React, { act, type ComponentType, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSubjectRequest } from '@/lib/privacy/dataSubjectRequest.types';
import type { DataRequestAdminPage } from '@/lib/privacy/dataSubjectRequestAdminWeb.web';
import type { ServiceResult } from '@/types';

const row: DataSubjectRequest = {
  id: 'request-1', tenantId: 'tenant-a', profileId: 'profile-a', requestType: 'access', status: 'queued',
  requesterName: 'Ada Beispiel', requesterEmail: 'ada@example.test', verificationNotes: 'Hinweis der Person',
  requestNumber: 'DSR-123', receivedAt: '2026-10-19T10:00:00Z', createdAt: '2026-10-19T10:00:00Z', updatedAt: '2026-10-19T10:00:00Z',
};
const api = {
  user: { id: 'auth-a', roleKey: 'business_admin' },
  profile: { id: 'profile-a', tenantId: 'tenant-a', roleKey: 'business_admin' },
  authMode: 'supabase', isAuthenticated: true, isLoading: false, authReady: true,
  session: { user: { id: 'auth-a' }, accessToken: 'test-token' },
  portalSession: null as null | { id: string },
};
const services = {
  listDataRequestsForAdmin: vi.fn(), prepareDataRequestAdminCsv: vi.fn(),
  updateDataRequestForAdmin: vi.fn(), downloadDataRequestAdminCsv: vi.fn(),
};
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
  '@/components/layout/ScreenShell': { ScreenShell: ({ children }: { children: ReactNode }) => <main>{children}</main> },
  '@/lib/auth/context': { useAuth: () => api },
  '@/lib/privacy/dataSubjectRequestAdminWeb.web': services,
  '@/lib/permissions/workspaceRoles': { isPortalOnlyRole: (role: string) => ['employee_portal', 'client_portal', 'family_portal'].includes(role) },
};
const bundle = buildSync({
  entryPoints: ['src/screens/security/DataSubjectRequestsAdminScreen.web.tsx'], bundle: true, write: false,
  platform: 'node', format: 'cjs', jsx: 'automatic', external: Object.keys(dependencies),
}).outputFiles[0].text;
const loaded = { exports: {} as { DataSubjectRequestsAdminScreen: ComponentType } };
new Function('require', 'module', 'exports', bundle)((id: string) => {
  if (!(id in dependencies)) throw new Error('Unexpected data request admin dependency: ' + id);
  return dependencies[id];
}, loaded, loaded.exports);
const Screen = loaded.exports.DataSubjectRequestsAdminScreen;
let root: Root;
let host: HTMLDivElement;
const page = (items = [row], manage = true): ServiceResult<DataRequestAdminPage> => ({
  ok: true, data: { items, hasMore: false, nextOffset: items.length, access: { view: true, manage } },
});
const render = async () => { await act(async () => root.render(<Screen />)); };
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent?.trim() === text)!;
const click = async (node: HTMLElement) => { expect(node).toBeTruthy(); await act(async () => node.click()); };
const selectStatus = async (value: string) => {
  const node = host.querySelector<HTMLSelectElement>('.cs-dsr-admin-status select')!;
  expect(node).toBeTruthy();
  await act(async () => { node.value = value; node.dispatchEvent(new Event('change', { bubbles: true })); });
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  api.user = { id: 'auth-a', roleKey: 'business_admin' };
  api.profile = { id: 'profile-a', tenantId: 'tenant-a', roleKey: 'business_admin' };
  api.authMode = 'supabase'; api.isAuthenticated = true; api.isLoading = false; api.authReady = true;
  api.session = { user: { id: 'auth-a' }, accessToken: 'test-token' }; api.portalSession = null;
  services.listDataRequestsForAdmin.mockResolvedValue(page());
  services.updateDataRequestForAdmin.mockImplementation(async (_scope, item, status) => ({ ok: true, data: { ...item, status, updatedAt: '2026-10-19T11:00:00Z' } }));
  services.prepareDataRequestAdminCsv.mockResolvedValue({ ok: true, data: { csv: 'prepared-csv', rowCount: 1 } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

// These exercise the actual screen/controller. Shell and network boundaries are mocked;
// happy-dom does not verify geometry, focus appearance or visual layout.
describe('Data request admin Web interactions', () => {
  it('waits for auth and refuses portal access without calling the data service', async () => {
    api.isLoading = true; api.authReady = false; await render();
    expect(host.textContent).toContain('Ihr Zugang wird geprüft');
    expect(services.listDataRequestsForAdmin).not.toHaveBeenCalled();
    api.isLoading = false; api.authReady = true; api.portalSession = { id: 'portal' }; await render();
    expect(host.textContent).toContain('keine Berechtigung');
    expect(services.listDataRequestsForAdmin).not.toHaveBeenCalled();
  });
  it('shows the one-month guidance and treats a failed request as unresolved', async () => {
    services.listDataRequestsForAdmin.mockResolvedValue(page([{ ...row, status: 'failed' }]));
    await render();
    expect(host.textContent).toContain('Regelfrist: ein Monat ab Eingang');
    expect(host.textContent).toContain('1 offen einschließlich fehlgeschlagener Bearbeitungen');
    expect(host.textContent).not.toContain('30 Tage');
    expect(host.textContent).not.toContain('Überfällig');
  });
  it('offers read-only details when server capabilities do not allow management', async () => {
    services.listDataRequestsForAdmin.mockResolvedValue(page([row], false));
    await render();
    expect(host.querySelector('.cs-dsr-admin-status')).toBeNull();
    expect(host.textContent).toContain('weitere Berechtigung');
    expect(services.updateDataRequestForAdmin).not.toHaveBeenCalled();
  });
  it('keeps request details open while an explicit status save persists', async () => {
    await render();
    const details = host.querySelector<HTMLDetailsElement>('details')!;
    details.open = true;
    await selectStatus('running');
    expect(services.updateDataRequestForAdmin).not.toHaveBeenCalled();
    await click(button('Status speichern'));
    expect(services.updateDataRequestForAdmin).toHaveBeenCalledWith(
      { authUserId: 'auth-a', tenantId: 'tenant-a', profileId: 'profile-a' }, row, 'running',
    );
    expect(host.textContent).toContain('Der Status wurde gespeichert');
    expect(details.open).toBe(true);
    expect(host.querySelector('.cs-dsr-admin-badge')?.textContent).toBe('In Bearbeitung');
  });
  it('prevents duplicate writes and requires confirmation before completing a request', async () => {
    const saving = deferred<ServiceResult<DataSubjectRequest>>();
    services.updateDataRequestForAdmin.mockReturnValueOnce(saving.promise);
    await render(); await selectStatus('completed');
    const save = button('Status speichern');
    await act(async () => { save.click(); save.click(); });
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(services.updateDataRequestForAdmin).toHaveBeenCalledOnce();
    expect(host.querySelector<HTMLSelectElement>('.cs-dsr-admin-status select')?.disabled).toBe(true);
    await act(async () => saving.resolve({ ok: true, data: { ...row, status: 'completed' } }));
    expect(host.textContent).toContain('Der Status wurde gespeichert');
  });
  it('does not save a cancelled completion confirmation', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await render(); await selectStatus('completed'); await click(button('Status speichern'));
    expect(services.updateDataRequestForAdmin).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Der Status wurde gespeichert');
  });
  it('starts the real download action only after successful preparation', async () => {
    await render(); await click(button('Geladene Anfragen (CSV)'));
    expect(services.prepareDataRequestAdminCsv).toHaveBeenCalledWith(
      { authUserId: 'auth-a', tenantId: 'tenant-a', profileId: 'profile-a' }, [row],
    );
    expect(services.downloadDataRequestAdminCsv).toHaveBeenCalledWith('prepared-csv');
    expect(host.textContent).toContain('CSV-Download gestartet: 1 geladene Anfragen.');
  });
  it('shows a download failure without claiming export success and permits retry', async () => {
    services.downloadDataRequestAdminCsv.mockImplementationOnce(() => { throw new Error('blocked'); });
    await render(); await click(button('Geladene Anfragen (CSV)'));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('nicht gestartet');
    expect(host.textContent).not.toContain('CSV-Download gestartet');
    expect(button('Geladene Anfragen (CSV)').disabled).toBe(false);
  });
  it('ignores a late export after an account switch', async () => {
    const pending = deferred<ServiceResult<{ csv: string; rowCount: number }>>();
    services.prepareDataRequestAdminCsv.mockReturnValueOnce(pending.promise);
    await render(); await click(button('Geladene Anfragen (CSV)'));
    api.user = { id: 'auth-b', roleKey: 'business_admin' };
    api.profile = { id: 'profile-b', tenantId: 'tenant-b', roleKey: 'business_admin' };
    api.session = { user: { id: 'auth-b' }, accessToken: 'next-token' };
    services.listDataRequestsForAdmin.mockResolvedValue(page([]));
    await render(); await act(async () => pending.resolve({ ok: true, data: { csv: 'old-account', rowCount: 1 } }));
    expect(services.downloadDataRequestAdminCsv).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Ada Beispiel');
  });
  it('removes cached requests after a failed authorization refresh', async () => {
    await render(); expect(host.textContent).toContain('Ada Beispiel');
    services.listDataRequestsForAdmin.mockResolvedValueOnce({ ok: false, error: 'Zugriff entzogen.' });
    await click(button('Aktualisieren'));
    expect(host.textContent).not.toContain('Ada Beispiel');
    expect(host.textContent).toContain('Zugriff entzogen.');
    expect(button('Geladene Anfragen (CSV)').disabled).toBe(true);
  });
  it('handles a network rejection and allows a successful reload', async () => {
    services.listDataRequestsForAdmin.mockRejectedValueOnce(new Error('offline'));
    await render(); expect(host.querySelector('[role="alert"]')).toBeTruthy();
    expect(button('Aktualisieren').disabled).toBe(false);
    await click(button('Aktualisieren')); expect(host.textContent).toContain('Ada Beispiel');
  });
});
