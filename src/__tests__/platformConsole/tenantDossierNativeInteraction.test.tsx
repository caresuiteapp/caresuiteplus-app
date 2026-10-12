// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TenantDossier } from '@/lib/platformConsole/tenantDossierModel';

const api = { page: vi.fn(), summary: vi.fn() };
const Box = (p: any) => <div>{p.children}</div>;
const deps: Record<string, any> = {
  react: React, 'react/jsx-runtime': await import('react/jsx-runtime'),
  'react-native': { View: Box, Text: (p: any) => <span role={p.accessibilityRole}>{p.children}</span>, ActivityIndicator: () => <span>Warten</span>, StyleSheet: { create: (p: any) => p }, useWindowDimensions: () => ({ width: 320, height: 640, fontScale: 2 }), Linking: { openURL: vi.fn() }, Pressable: (p: any) => <button aria-label={p.accessibilityLabel} disabled={p.disabled} onClick={p.onPress}>{p.children}</button>, TextInput: (p: any) => <input aria-label={p.accessibilityLabel} value={p.value} maxLength={p.maxLength} onInput={event => p.onChangeText((event.target as HTMLInputElement).value)} />, Switch: (p: any) => <input aria-label={p.accessibilityLabel} type="checkbox" checked={p.value} onChange={event => p.onValueChange((event.target as HTMLInputElement).checked)} /> },
  'expo-image': { Image: (p: any) => <img src={p.source.uri} alt={p.accessibilityLabel} /> },
  '@/components/layout/platform/platformmodal': { PlatformModal: (p: any) => p.visible ? <dialog open><h3>{p.title}</h3>{p.children}</dialog> : null },
  '@/components/ui/ListFilterSelect': { ListFilterSelect: (p: any) => <select aria-label={p.label} value={p.value} onChange={event => p.onChange(event.target.value)}>{p.options.map((item: any) => <option key={item.key} value={item.key}>{item.label}</option>)}</select> },
  '@/components/platformConsole/PlatformColors': { PLATFORM_COLORS: {} },
  '@/lib/platformConsole/tenantDossierService': { getTenantDossierPage: api.page, getTenantDossier: api.summary },
};
const code = buildSync({ entryPoints: ['src/screens/platformConsole/TenantDossierWorkspace.native.tsx'], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: Object.keys(deps) }).outputFiles[0].text;
const mod = { exports: {} as any };
new Function('require', 'module', 'exports', code)((id: string) => { if (!(id in deps)) throw new Error(`Unexpected dependency ${id}`); return deps[id]; }, mod, mod.exports);
const { TenantDossierDataBrowser: Browser, TenantDossierFields: Fields, TenantDossierHistory: History, TenantSetupPanel: Setup, useTenantDossier } = mod.exports;
const dossier: TenantDossier = { tenantId: 'a', checkedAt: '2026-10-09T01:00:00Z', company: { name: 'Firma A' }, platform: {}, branding: null, billing: null, bank: null, portal: null, tax: null, register: null, counts: { clients: { total: 1055, active: 1055, deleted: 1, complete: 1000, portalEnabled: 0, portalLinked: 0 }, employees: { total: 2, active: 2, deleted: 0, complete: 1, portalEnabled: 0, portalLinked: 0 }, accounts: 3, adminAccounts: 1, loggedInAccounts: 0, lastLoginAt: null, services: 0, pricedServices: 0, assignments: 5, documents: 7 }, sections: [{ key: 'clients', label: 'Klient:innen', scope: 'clients', available: true, count: 1056, updatedAt: null }, { key: 'client_contacts', label: 'Kontaktpersonen', scope: 'clients', available: true, count: 2, updatedAt: null }, { key: 'tenants', label: 'Unternehmensstammdaten', scope: 'company', available: true, count: 1, updatedAt: null }] };
const row = { id: 'person-1', tenant_id: 'a', first_name: 'Anna', last_name: 'Test', care_level: '2', email: 'anna@example.test', status: 'active' };
const page = (id: string, query: any, rows: any[] = [row]) => ({ ok: true, data: { tenantId: id, section: query.section, rows, total: 1055, offset: query.offset ?? 0, limit: 50, hasMore: true, available: true, statuses: ['active', 'inactive'] } });
let root: Root, host: HTMLDivElement;
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(300); }); };
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); await flush(); };
const click = async (label: string) => { const button = [...host.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === label || node.textContent?.includes(label)); expect(button, label).toBeTruthy(); await act(async () => button!.click()); await flush(); };
const change = async (label: string, value: string) => { const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!; expect(input).toBeTruthy(); await act(async () => { Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }); await flush(); };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); api.page.mockImplementation(async (id, query) => page(id, query)); api.summary.mockResolvedValue({ ok: true, data: dossier }); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });

it('native search and pagination address the entire data set and reset offset on filters', async () => {
  await render(<Browser dossier={dossier} scope="clients" initialSection="clients" />); expect(host.textContent).toContain('1055 passende Datensätze');
  await click('Weitere Datensätze'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ offset: 50 }));
  await change('Suchen', 'Berlin'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ offset: 0, search: 'Berlin' }));
  await change('Status', 'inactive'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ offset: 0, status: 'inactive' }));
});

it('opens complete native fields and loads related records for the exact selected person', async () => {
  await render(<Browser dossier={dossier} scope="clients" initialSection="clients" />); await click('Alle Angaben zu Anna Test öffnen');
  expect(host.querySelector('dialog')?.textContent).toContain('Pflegegrad'); expect(host.querySelector('dialog')?.textContent).toContain('anna@example.test');
  await click('Zugehörige Angaben und Akten'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ section: 'client_contacts', parentId: 'person-1' }));
});

it('does not display responses from a company that has already been closed', async () => {
  let finish!: (value: any) => void; api.page.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(<Browser dossier={dossier} scope="clients" />);
  api.page.mockImplementation(async (id, query) => page(id, query, [{ ...row, first_name: 'Aktuelle Firma B' }]));
  await render(<Browser dossier={{ ...dossier, tenantId: 'b' }} scope="clients" />);
  await act(async () => finish(page('a', { section: 'clients' }, [{ ...row, first_name: 'Alte Firma A' }])));
  expect(host.textContent).toContain('Aktuelle Firma B'); expect(host.textContent).not.toContain('Alte Firma A');
});

it('keeps failed searches and retries with the same filter', async () => {
  await render(<Browser dossier={dossier} scope="clients" />); api.page.mockResolvedValueOnce({ ok: false, error: 'Verbindung unterbrochen' });
  await change('Suchen', 'Anna'); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Verbindung unterbrochen'); expect(host.querySelector<HTMLInputElement>('[aria-label="Suchen"]')?.value).toBe('Anna');
  await click('Erneut laden'); expect(api.page).toHaveBeenLastCalledWith('a', expect.objectContaining({ search: 'Anna' })); expect(host.textContent).toContain('Anna Test');
});

it('retains false and zero and removes nested credentials from native fields', async () => {
  await render(<Fields row={{ weekly_hours: 0, portal_enabled: false, email: null, api_key: 'hidden-top', details: { city: 'Berlin', password: 'hidden-nested' } }} />);
  expect(host.textContent).toContain('Nein'); expect(host.textContent).toContain('0'); expect(host.textContent).toContain('Nicht hinterlegt');
  await click('Weitere Angaben anzeigen'); expect(host.textContent).toContain('Berlin'); expect(host.textContent).not.toContain('hidden-');
});

it('opens the corresponding native setup section and exposes missing criteria', async () => {
  const open = vi.fn(); await render(<Setup dossier={dossier} onSection={open} />); expect(host.textContent).toContain('Rechnungspräfix'); expect(host.textContent).toContain('Nachweis:');
  await click('Daten prüfen: Bankverbindung'); expect(open).toHaveBeenCalledWith('tenant_bank_accounts');
});

it('shows recorded actors and before/after values without revealing credentials', async () => {
  api.page.mockImplementation(async (id, query) => page(id, query, [{ id: 'event', action: 'tenant.record_updated', actor_name: 'Inhaber', created_at: '2026-10-09T01:00:00Z', before: { city: 'Herne', secret: 'hidden-before' }, after: { city: 'Dortmund', secret: 'hidden-after' } }]));
  await render(<History tenantId="a" />); await click('Geänderte Angaben anzeigen'); expect(host.textContent).toContain('Inhaber'); expect(host.textContent).toContain('Herne'); expect(host.textContent).toContain('Dortmund'); expect(host.textContent).not.toContain('hidden-');
});

it('immediately hides an owner dossier when access is removed and ignores its pending response', async () => {
  let finish!: (value: any) => void; api.summary.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  function Probe({ enabled }: { enabled: boolean }) { const result = useTenantDossier('a', enabled); return <span>{result.data?.company.name ?? 'Keine Akte'}</span>; }
  await render(<Probe enabled />); await render(<Probe enabled={false} />); await act(async () => finish({ ok: true, data: dossier }));
  expect(host.textContent).toBe('Keine Akte'); expect(api.summary).toHaveBeenCalledTimes(1);
});
