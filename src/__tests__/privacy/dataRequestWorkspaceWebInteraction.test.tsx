// @vitest-environment happy-dom
import React, { act, type ComponentType, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession, AuthUser, Profile, ServiceResult } from '@/types';
import type {
  DataRequestAccountSnapshot, DataRequestWorkspaceDraft, DataRequestWorkspaceItem,
  DataRequestWorkspacePage, DataRequestWorkspaceResult, DataRequestWorkspaceScope,
} from '@/lib/privacy/dataRequestWorkspaceService.web';
import { canLeaveWebPage } from '@/lib/navigation/webPageLeaveGuard.web';

const makeProfile = (patch: Partial<Profile> = {}): Profile => ({
  id: 'profile-a', tenantId: 'tenant-a', roleId: 'admin-role', roleKey: 'business_admin',
  firstName: 'Mara', lastName: 'Muster', displayName: 'Mara Muster', email: 'mara@example.test',
  phone: '+49 123', avatarUrl: null, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-19T10:00:00Z',
  ...patch,
});
const item = (id = 'request-a', patch: Partial<DataRequestWorkspaceItem> = {}): DataRequestWorkspaceItem => ({
  id, requestType: 'access', status: 'queued', requestNumber: 'DS-2026-001',
  receivedAt: '2026-10-19T12:30:00Z', createdAt: '2026-10-19T12:30:00Z', updatedAt: '2026-10-19T12:30:00Z',
  ...patch,
});
const snapshot: DataRequestAccountSnapshot = {
  version: 1, generatedAt: '2026-10-19T12:00:00Z',
  account: { firstName: 'Servername', lastName: 'Muster', displayName: 'Servername Muster',
    email: 'server@example.test', phone: null, createdAt: '2026-10-01T10:00:00Z', updatedAt: null },
};
type Removal = { data: { action: { type: string } } };
const api = {
  profile: makeProfile() as Profile | null,
  user: { id: 'auth-a', email: 'mara@example.test', displayName: 'Mara Muster', roleKey: 'business_admin' } as AuthUser | null,
  isLoading: false, isInitialized: true, authReady: true, isAuthenticated: true, authMode: 'supabase',
  session: null as AuthSession | null, portalSession: null, profileBootstrapError: null as string | null,
  push: vi.fn(), dispatch: vi.fn(), retryProfileBootstrap: vi.fn<() => Promise<void>>(),
  preventRemoval: false, onRemove: null as ((event: Removal) => void) | null,
  demo: false, configured: true,
};
const services = {
  createDataRequestIdempotencyKey: vi.fn<() => ServiceResult<string>>(),
  validateDataRequestWorkspaceDraft: vi.fn<(draft: DataRequestWorkspaceDraft) => ServiceResult<DataRequestWorkspaceDraft>>(),
  listOwnDataRequests: vi.fn<(scope: DataRequestWorkspaceScope, options?: { offset?: number; limit?: number }) => Promise<DataRequestWorkspaceResult<DataRequestWorkspacePage>>>(),
  submitOwnDataRequest: vi.fn<(scope: DataRequestWorkspaceScope, draft: DataRequestWorkspaceDraft & { idempotencyKey: string }) => Promise<DataRequestWorkspaceResult<{ request: DataRequestWorkspaceItem; replayed: boolean }>>>(),
  fetchOwnAccountExport: vi.fn<(scope: DataRequestWorkspaceScope) => Promise<DataRequestWorkspaceResult<DataRequestAccountSnapshot>>>(),
  downloadDataRequestAccountExport: vi.fn<(value: DataRequestAccountSnapshot, format: 'json' | 'csv') => ServiceResult<{ fileName: string }>>(),
};

// Actual controller, workspace and unsaved-change guard. The shell, auth and I/O
// are boundaries; this verifies DOM behavior, not rendered geometry.
const dependencies: Record<string, unknown> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
  'expo-router': { useRouter: () => ({ push: api.push }), useNavigation: () => ({ dispatch: api.dispatch }), usePathname: () => '/settings/data-request' },
  'expo-router/react-navigation': { usePreventRemove: (prevent: boolean, callback: (event: Removal) => void) => { api.preventRemoval = prevent; api.onRemove = callback; } },
  '@/lib/auth/context': { useAuth: () => api },
  '@/lib/supabase/config': { isDemoMode: () => api.demo, isSupabaseConfigured: () => api.configured },
  '@/lib/privacy/dataRequestWorkspaceService.web': services,
  '@/components/settings/settingsscreenframe': {
    SettingsScreenFrame: ({ title, children }: { title: string; children: ReactNode }) => <main aria-label={title}>{children}</main>,
  },
};
const bundle = buildSync({
  entryPoints: ['src/screens/settings/DataRequestScreen.web.tsx'], bundle: true, write: false,
  platform: 'node', format: 'cjs', jsx: 'automatic', external: Object.keys(dependencies),
}).outputFiles[0].text;
const loaded = { exports: {} as { DataRequestScreen: ComponentType } };
new Function('require', 'module', 'exports', bundle)((id: string) => {
  if (!(id in dependencies)) throw new Error('Unexpected request-workspace dependency: ' + id);
  return dependencies[id];
}, loaded, loaded.exports);
const Screen = loaded.exports.DataRequestScreen;

let host: HTMLDivElement;
let root: Root;
const render = async () => { await act(async () => root.render(<Screen />)); };
const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('button')]
  .find(element => (element.getAttribute('aria-label') ?? element.textContent?.trim()) === name)!;
const field = (name: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>('[name="' + name + '"]')!;
const click = async (name: string) => { const target = button(name); expect(target).toBeTruthy(); await act(async () => target.click()); };
const type = async (name: string, value: string) => {
  const target = field(name); expect(target).toBeTruthy();
  const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  });
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
  api.profile = makeProfile();
  api.user = { id: 'auth-a', email: 'mara@example.test', displayName: 'Mara Muster', roleKey: 'business_admin' };
  api.session = { user: api.user, accessToken: 'test-session', refreshToken: 'test-refresh', expiresAt: null };
  api.isLoading = false; api.authReady = true; api.isAuthenticated = true; api.authMode = 'supabase';
  api.profileBootstrapError = null; api.preventRemoval = false; api.onRemove = null; api.demo = false; api.configured = true;
  api.retryProfileBootstrap.mockResolvedValue(undefined);
  let nextKey = 0;
  services.createDataRequestIdempotencyKey.mockImplementation(() => ({ ok: true, data: 'key-' + (++nextKey) }));
  services.validateDataRequestWorkspaceDraft.mockImplementation(draft => ({ ok: true, data: {
    ...draft, requesterName: draft.requesterName.trim(), requesterEmail: draft.requesterEmail.trim(), message: draft.message.trim(),
  } }));
  services.listOwnDataRequests.mockResolvedValue({ ok: true, data: { items: [], hasMore: false, nextOffset: null } });
  services.submitOwnDataRequest.mockImplementation(async (_scope, draft) => ({
    ok: true, data: { request: item('request-a', { requestType: draft.requestType }), replayed: false },
  }));
  services.fetchOwnAccountExport.mockResolvedValue({ ok: true, data: snapshot });
  services.downloadDataRequestAccountExport.mockImplementation((_snapshot, format) => ({ ok: true, data: { fileName: 'konto.' + format } }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks();
});

describe('Data request and export in the actual Web workspace', () => {
  it('waits for the account, retries a failed load and fills the real response contact', async () => {
    api.profile = null; api.isLoading = true; api.authReady = false;
    await render();
    expect(host.textContent).toContain('Ihr Konto wird geladen…');
    expect(host.querySelector('form')).toBeNull();
    expect(services.listOwnDataRequests).not.toHaveBeenCalled();
    api.isLoading = false; api.authReady = true; api.profileBootstrapError = 'Test: Profil nicht erreichbar.';
    await render();
    expect(host.textContent).toContain('Test: Profil nicht erreichbar.');
    api.retryProfileBootstrap.mockImplementationOnce(async () => { api.profile = makeProfile(); });
    await click('Konto erneut laden');
    await render();
    expect(field('requesterName').value).toBe('Mara Muster');
    expect(field('requesterEmail').value).toBe('mara@example.test');
    expect(services.listOwnDataRequests).toHaveBeenCalledWith(
      { authUserId: 'auth-a', tenantId: 'tenant-a', profileId: 'profile-a' }, { offset: 0, limit: 20 },
    );
  });

  it('submits the selected type and optional details once, then reuses the key after an ambiguous failure', async () => {
    const first = deferred<DataRequestWorkspaceResult<{ request: DataRequestWorkspaceItem; replayed: boolean }>>();
    services.submitOwnDataRequest.mockReturnValueOnce(first.promise);
    await render();
    await act(async () => host.querySelector<HTMLInputElement>('input[value="correction"]')!.click());
    await type('requesterEmail', 'reply@example.test');
    const form = host.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(services.submitOwnDataRequest).toHaveBeenCalledOnce();
    expect(services.submitOwnDataRequest.mock.calls[0][1]).toEqual({
      requestType: 'correction', requesterName: 'Mara Muster', requesterEmail: 'reply@example.test', message: '', idempotencyKey: 'key-1',
    });
    expect(field('requesterName').disabled).toBe(true);
    expect(host.textContent).not.toContain('Ihre Anfrage wurde gespeichert.');
    await act(async () => first.reject(new Error('Connection lost after write')));
    expect(host.textContent).toContain('Der Eingang Ihrer Anfrage konnte nicht bestätigt werden.');
    expect(field('requesterEmail').value).toBe('reply@example.test');
    await click('Anfrage einreichen');
    expect(services.submitOwnDataRequest).toHaveBeenCalledTimes(2);
    expect(services.submitOwnDataRequest.mock.calls[1][1].idempotencyKey).toBe('key-1');
    expect(services.createDataRequestIdempotencyKey).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Ihre Anfrage wurde gespeichert. Referenz: DS-2026-001.');
    expect(field('requesterEmail').value).toBe('reply@example.test');
  });


  it('protects an unchanged request after an ambiguous failure and retains its retry key', async () => {
    const pending = deferred<DataRequestWorkspaceResult<{ request: DataRequestWorkspaceItem; replayed: boolean }>>();
    services.submitOwnDataRequest.mockReturnValueOnce(pending.promise);
    await render();
    expect(api.preventRemoval).toBe(false);
    await click('Anfrage einreichen');
    await act(async () => pending.reject(new Error('Connection lost after write')));
    expect(api.preventRemoval).toBe(true);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    expect(canLeaveWebPage()).toBe(false);
    expect(window.confirm).toHaveBeenCalledWith(
      'Der Eingang Ihrer Anfrage ist noch nicht bestätigt. Möchten Sie die Seite verlassen und den Entwurf verwerfen?',
    );
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await click('Anfrage einreichen');
    expect(services.submitOwnDataRequest.mock.calls[0][1].idempotencyKey).toBe('key-1');
    expect(services.submitOwnDataRequest.mock.calls[1][1].idempotencyKey).toBe('key-1');
    expect(services.createDataRequestIdempotencyKey).toHaveBeenCalledOnce();
    expect(api.preventRemoval).toBe(false);
    expect(button('Anfrage einreichen').disabled).toBe(true);
  });

  it('keeps the retry key when only whitespace changes in the normalized payload', async () => {
    services.submitOwnDataRequest.mockResolvedValueOnce({ ok: false, error: 'Test: Eingang nicht bestätigt.' });
    await render();
    await click('Anfrage einreichen');
    await type('requesterName', '  Mara Muster  ');
    await click('Anfrage einreichen');
    expect(services.submitOwnDataRequest).toHaveBeenCalledTimes(2);
    expect(services.submitOwnDataRequest.mock.calls[0][1]).toEqual(services.submitOwnDataRequest.mock.calls[1][1]);
    expect(services.createDataRequestIdempotencyKey).toHaveBeenCalledOnce();
  });

  it('creates a new idempotency key for an edited retry and respects validation failures', async () => {
    services.submitOwnDataRequest.mockResolvedValueOnce({ ok: false, error: 'Test: Anfrage nicht bestätigt.' });
    await render(); await type('requestDetails', 'Erster Entwurf'); await click('Anfrage einreichen');
    await type('requestDetails', 'Geänderter Entwurf'); await click('Anfrage einreichen');
    expect(services.submitOwnDataRequest.mock.calls[0][1].idempotencyKey).toBe('key-1');
    expect(services.submitOwnDataRequest.mock.calls[1][1].idempotencyKey).toBe('key-2');
    await type('requesterName', '');
    services.validateDataRequestWorkspaceDraft.mockReturnValueOnce({ ok: false, error: 'Bitte geben Sie Ihren Namen an.' });
    await click('Anfrage einreichen');
    expect(services.submitOwnDataRequest).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Bitte geben Sie Ihren Namen an.');
  });

  it('preserves edited response contacts during background profile updates', async () => {
    await render(); await type('requesterName', 'Antwortkontakt');
    api.profile = makeProfile({ firstName: 'Neuer', lastName: 'Profilname', email: 'neu@example.test' });
    await render();
    expect(field('requesterName').value).toBe('Antwortkontakt');
    expect(field('requesterEmail').value).toBe('neu@example.test');
    expect(services.submitOwnDataRequest).not.toHaveBeenCalled();
  });

  it('loads more own requests without duplicates and preserves the list after a failed refresh', async () => {
    services.listOwnDataRequests
      .mockResolvedValueOnce({ ok: true, data: { items: [item('one')], hasMore: true, nextOffset: 1 } })
      .mockResolvedValueOnce({ ok: true, data: { items: [item('one'), item('two', { requestNumber: 'DS-2026-002' })], hasMore: false, nextOffset: null } })
      .mockResolvedValueOnce({ ok: false, error: 'Test: Aktualisierung fehlgeschlagen.' });
    await render(); await click('Weitere Anfragen laden');
    expect(services.listOwnDataRequests.mock.calls[1][1]).toEqual({ offset: 1, limit: 20 });
    expect(host.querySelectorAll('.cs-data-request-item')).toHaveLength(2);
    await click('Aktualisieren');
    expect(host.querySelectorAll('.cs-data-request-item')).toHaveLength(2);
    expect(host.textContent).toContain('Test: Aktualisierung fehlgeschlagen.');
    expect(button('Aktualisieren').disabled).toBe(false);
    await click('Aktualisieren');
    expect(host.textContent).toContain('Noch keine Anfragen');
    expect(host.textContent).not.toContain('Test: Aktualisierung fehlgeschlagen.');
  });

  it('blocks unavailable server functions and restores actions only after a successful refresh', async () => {
    services.listOwnDataRequests.mockResolvedValueOnce({ ok: false, error: 'Test: Online-Bereich nicht verfügbar.', code: 'unavailable' });
    await render();
    expect(button('Anfrage einreichen').disabled).toBe(true);
    expect(button('Kontoangaben als JSON').disabled).toBe(true);
    expect(button('Aktualisieren').disabled).toBe(false);
    await click('Anfrage einreichen'); await click('Kontoangaben als JSON');
    expect(services.submitOwnDataRequest).not.toHaveBeenCalled();
    expect(services.fetchOwnAccountExport).not.toHaveBeenCalled();
    await click('Aktualisieren');
    expect(button('Anfrage einreichen').disabled).toBe(false);
    expect(button('Kontoangaben als JSON').disabled).toBe(false);
  });

  it('downloads fresh server data once and never labels a failed download as successful', async () => {
    const pending = deferred<DataRequestWorkspaceResult<DataRequestAccountSnapshot>>();
    services.fetchOwnAccountExport.mockReturnValueOnce(pending.promise);
    await render(); await type('requesterName', 'Ungespeicherter Antwortkontakt');
    const download = button('Kontoangaben als JSON');
    await act(async () => { download.click(); download.click(); });
    expect(services.fetchOwnAccountExport).toHaveBeenCalledOnce();
    expect(services.downloadDataRequestAccountExport).not.toHaveBeenCalled();
    expect(button('Kontoangaben als CSV').disabled).toBe(true);
    await act(async () => pending.resolve({ ok: true, data: snapshot }));
    expect(services.downloadDataRequestAccountExport).toHaveBeenCalledWith(snapshot, 'json');
    expect(host.textContent).toContain('Der Download von konto.json wurde gestartet.');
    services.downloadDataRequestAccountExport.mockReturnValueOnce({ ok: false, error: 'Test: Browser hat Download abgewiesen.' });
    await click('Kontoangaben als CSV');
    expect(host.textContent).toContain('Test: Browser hat Download abgewiesen.');
    expect(host.textContent).not.toContain('Der Download von konto.json wurde gestartet.');
    expect(field('requesterName').value).toBe('Ungespeicherter Antwortkontakt');
  });

  it('ignores a late export from another account and discards that account draft and history', async () => {
    const pending = deferred<DataRequestWorkspaceResult<DataRequestAccountSnapshot>>();
    services.listOwnDataRequests.mockResolvedValueOnce({ ok: true, data: { items: [item()], hasMore: false, nextOffset: null } });
    services.fetchOwnAccountExport.mockReturnValueOnce(pending.promise);
    await render(); await type('requestDetails', 'Alter Entwurf'); await click('Kontoangaben als JSON');
    api.profile = makeProfile({ id: 'profile-b', tenantId: 'tenant-b', firstName: 'Ben', lastName: 'Beispiel', email: 'ben@example.test' });
    api.user = { id: 'auth-b', email: 'ben@example.test', displayName: 'Ben Beispiel', roleKey: 'business_admin' };
    api.session = { user: api.user, accessToken: 'next-session', refreshToken: 'next-refresh', expiresAt: null };
    await render();
    await act(async () => pending.resolve({ ok: true, data: snapshot }));
    expect(services.downloadDataRequestAccountExport).not.toHaveBeenCalled();
    expect(field('requesterName').value).toBe('Ben Beispiel');
    expect(field('requestDetails').value).toBe('');
    expect(host.querySelectorAll('.cs-data-request-item')).toHaveLength(0);
    expect(host.textContent).not.toContain('Der Download von');
  });

  it('protects draft navigation and blocks removal during submission', async () => {
    await render(); await type('requestDetails', 'Noch nicht eingereicht');
    expect(api.preventRemoval).toBe(true);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    expect(canLeaveWebPage()).toBe(false);
    expect(field('requestDetails').value).toBe('Noch nicht eingereicht');
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await click('Hilfe & Kontakt');
    expect(api.push).not.toHaveBeenCalled();
    const pending = deferred<DataRequestWorkspaceResult<{ request: DataRequestWorkspaceItem; replayed: boolean }>>();
    services.submitOwnDataRequest.mockReturnValueOnce(pending.promise);
    await click('Anfrage einreichen');
    await act(async () => api.onRemove?.({ data: { action: { type: 'GO_BACK' } } }));
    expect(api.dispatch).not.toHaveBeenCalled();
    expect(button('Hilfe & Kontakt').disabled).toBe(true);
    await act(async () => pending.resolve({ ok: false, error: 'Test: Nicht gespeichert.' }));
    await click('Hilfe & Kontakt');
    expect(api.push).toHaveBeenCalledWith('/support');
  });

  it('does not contact the live service in demo mode or without a matching session', async () => {
    api.demo = true; await render();
    expect(button('Anfrage einreichen').disabled).toBe(true);
    expect(button('Kontoangaben als CSV').disabled).toBe(true);
    expect(services.listOwnDataRequests).not.toHaveBeenCalled();
    api.demo = false; api.session = null; await render();
    expect(button('Anfrage einreichen').disabled).toBe(true);
    expect(services.listOwnDataRequests).not.toHaveBeenCalled();
    await click('Hilfe & Kontakt');
    expect(api.push).toHaveBeenCalledWith('/support');
  });
});
