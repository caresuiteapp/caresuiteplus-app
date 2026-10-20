// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionKey, Profile, ServiceResult } from '@/types';
import type { CatalogWorkspaceItem, CatalogWorkspaceSnapshot } from '@/lib/catalog/catalogWorkspaceModel.web';
import type { TenantServiceCatalogModalProps } from '@/components/tenant/TenantServiceCatalogModal.web';
import { CatalogsListScreen } from '@/screens/catalog/CatalogsListScreen.web';
import { CatalogDetailScreen } from '@/screens/catalog/CatalogDetailScreen.web';
import { CatalogEditScreen } from '@/screens/catalog/CatalogEditScreen.web';

const f = vi.hoisted(() => ({
  fetch: vi.fn(), push: vi.fn(), back: vi.fn(), editor: vi.fn(),
  tenantId: 'tenant-a', profileId: 'office-a', view: true, manage: true, office: true,
  params: { id: 'tenant-service:assist' } as Record<string, string>,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { addEventListener: vi.fn() } }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => f.params }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ push: f.push, back: f.back, replace: f.push }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenantId }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: {
  id: f.profileId, tenantId: f.tenantId, roleId: 'role-office', roleKey: 'business_admin',
  firstName: 'Office', lastName: 'Test', displayName: 'Office Test', email: null, phone: null, avatarUrl: null,
  createdAt: '2026-10-19T08:00:00Z', updatedAt: '2026-10-19T08:00:00Z',
} satisfies Profile }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => {
  const permissions: PermissionKey[] = [
    ...(f.view ? ['office.catalogs.view' as const] : []),
    ...(f.manage ? ['business.tenant.manage' as const] : []),
  ];
  return { permissions, can: (permission: PermissionKey) => permissions.includes(permission), hasModuleGate: () => f.office };
} }));
// Keep the real query hook, including stale-response handling. Polling is unrelated to these interactions.
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 60_000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/lib/catalog/catalogWorkspace.web', async () => ({
  ...await vi.importActual<typeof import('@/lib/catalog/catalogWorkspaceModel.web')>('@/lib/catalog/catalogWorkspaceModel.web'),
  fetchCatalogWorkspace: (...args: unknown[]) => f.fetch(...args),
}));
vi.mock('@/components/tenant/TenantServiceCatalogModal.web', () => ({
  TenantServiceCatalogModal: (props: TenantServiceCatalogModalProps) => {
    f.editor(props);
    return props.visible ? <section role="dialog" aria-label="Position bearbeiten"><button type="button" onClick={props.onClose}>Editor schließen</button><button type="button" onClick={props.onSaved}>Gespeicherte Position übernehmen</button></section> : null;
  },
}));

const item = (overrides: Partial<CatalogWorkspaceItem> = {}): CatalogWorkspaceItem => ({
  id: 'support', catalogId: 'tenant-service:assist', code: 'assist.support', label: 'Alltagsbegleitung',
  description: 'Unterstützung beim Einkauf', category: 'service', unitKey: 'hour', unit: 'Stunde',
  isActive: true, status: 'aktiv', priceNet: 38, priceCents: 3800, defaultTaxMode: 'none',
  validFrom: '2026-01-01', validUntil: null, priceState: 'current', nextPriceNet: null, nextValidFrom: null,
  updatedAt: '2026-10-19T08:00:00Z', ...overrides,
});
const fixture = (name = 'Assist-Leistungskatalog', canEdit = true): CatalogWorkspaceSnapshot => ({
  asOf: '2026-10-19', canEdit,
  catalogs: [{
    id: 'tenant-service:assist', moduleKey: 'assist', name,
    description: 'Leistungen, Fahrtkosten und Zuschläge.',
    itemCount: 3, activeCount: 2, inactiveCount: 1, missingPriceCount: 0, status: 'aktiv',
    updatedAt: '2026-10-19T08:00:00Z', createdAt: '2026-01-01T08:00:00Z',
    items: [item(), item({ id: 'weekend', code: 'assist.weekend', label: 'Wochenendzuschlag', description: 'Zuschlag am Wochenende', category: 'surcharge', unitKey: 'percent', unit: 'Prozent', priceNet: 25, priceCents: null }),
      item({ id: 'old-travel', code: 'assist.travel.old', label: 'Frühere Fahrtkosten', description: '', category: 'travel', unitKey: 'km', unit: 'Kilometer', isActive: false, status: 'inaktiv', priceNet: 0.3, priceCents: 30 })],
  }],
});
let host: HTMLDivElement;
let root: Root;
const render = async (detail = false) => { await act(async () => root.render(detail ? <CatalogDetailScreen/> : <CatalogsListScreen/>)); };
const button = (name: string) => {
  const found = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(node => (node.getAttribute('aria-label') ?? node.textContent?.trim()) === name);
  expect(found, `Button ${name}`).toBeTruthy();
  return found!;
};
const click = async (name: string) => { await act(async () => button(name).click()); };
const search = async (value: string) => {
  const input = host.querySelector<HTMLInputElement>('input[type="search"]');
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const select = async (label: string, value: string) => {
  const input = Array.from(host.querySelectorAll('label')).find(node => node.querySelector('span')?.textContent === label)?.querySelector('select');
  expect(input, `Select ${label}`).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(input, value);
    input!.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); f.fetch.mockReset(); f.tenantId = 'tenant-a'; f.profileId = 'office-a'; f.view = true; f.manage = true; f.office = true;
  f.params = { id: 'tenant-service:assist' };
  f.fetch.mockResolvedValue({ ok: true, data: fixture() });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Office catalogue Web interactions (DOM; not visual acceptance)', () => {
  it('finds a catalogue through its positions, recovers from no results, and opens the selected catalogue in either view', async () => {
    await render();
    await search('  WOCHENENDZUSCHLAG  ');
    await click('Assist-Leistungskatalog öffnen');
    expect(f.push).toHaveBeenLastCalledWith({ pathname: '/office/catalogs/[id]', params: { id: 'tenant-service:assist' } });
    await search('nicht vorhanden');
    expect(host.textContent).toContain('Keine passenden Kataloge');
    expect(host.querySelector('button[aria-label="Assist-Leistungskatalog öffnen"]')).toBeNull();
    await click('Alle Kataloge anzeigen');
    expect(host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
    await click('Tabellenansicht');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    await click('Assist-Leistungskatalog öffnen');
    expect(f.push).toHaveBeenCalledTimes(2);
  });

  it('preserves loaded data on refresh failure and replaces it only after a successful retry', async () => {
    await render();
    f.fetch.mockResolvedValueOnce({ ok: false, error: 'Lesefreigabe abgelehnt.' });
    await click('Aktualisieren');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Der letzte geladene Stand bleibt sichtbar');
    expect(host.querySelector('h3')?.textContent).toBe('Assist-Leistungskatalog');
    f.fetch.mockResolvedValueOnce({ ok: true, data: fixture('Aktualisierter Leistungskatalog') });
    await click('Aktualisieren');
    expect(host.querySelector('h3')?.textContent).toBe('Aktualisierter Leistungskatalog');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('clears old tenant content and its editor immediately and ignores a late refresh response', async () => {
    await render(); await click('Assist-Leistungskatalog bearbeiten');
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    let finishOld!: (result: ServiceResult<CatalogWorkspaceSnapshot>) => void;
    let finishNew!: (result: ServiceResult<CatalogWorkspaceSnapshot>) => void;
    f.fetch.mockImplementationOnce(() => new Promise<ServiceResult<CatalogWorkspaceSnapshot>>(resolve => { finishOld = resolve; }));
    await click('Aktualisieren');
    f.tenantId = 'tenant-b'; f.profileId = 'office-b';
    f.fetch.mockImplementationOnce(() => new Promise<ServiceResult<CatalogWorkspaceSnapshot>>(resolve => { finishNew = resolve; }));
    await render();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).not.toContain('Assist-Leistungskatalog');
    await act(async () => finishNew({ ok: true, data: fixture('Katalog Unternehmen B') }));
    await act(async () => finishOld({ ok: true, data: fixture('Veralteter Katalog Unternehmen A') }));
    expect(host.querySelector('h3')?.textContent).toBe('Katalog Unternehmen B');
    expect(host.textContent).not.toContain('Veralteter Katalog Unternehmen A');
    expect(f.fetch).toHaveBeenLastCalledWith('tenant-b', expect.objectContaining({ id: 'office-b', tenantId: 'tenant-b' }), expect.any(Array));
  });

  it('requires read access and an Office release before loading data', async () => {
    f.view = false; await render();
    expect(f.fetch).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Kataloge nicht verfügbar');
    f.view = true; f.office = false; await render();
    expect(f.fetch).not.toHaveBeenCalled();
    expect(host.querySelector('input[type="search"]')).toBeNull();
  });

  it.each([{ client: false, server: true }, { client: true, server: false }])('keeps contents readable when either client or verified server access is read-only: %j', async ({ client, server }) => {
    f.manage = client; f.fetch.mockResolvedValue({ ok: true, data: fixture('Assist-Leistungskatalog', server) });
    await render();
    expect(host.textContent).toContain('Lesezugriff');
    expect(host.querySelector('button[aria-label="Assist-Leistungskatalog bearbeiten"]')).toBeNull();
    expect(Array.from(host.querySelectorAll('button')).some(node => node.textContent?.trim() === 'Neue Position')).toBe(false);
    expect(Array.from(host.querySelectorAll('button')).some(node => node.textContent?.trim() === 'Standardvorlagen')).toBe(false);
    await click('Assist-Leistungskatalog öffnen');
    await render(true);
    expect(host.textContent).toContain('Alltagsbegleitung');
    expect(host.querySelector('button[aria-label$=" bearbeiten"]')).toBeNull();
    expect(Array.from(host.querySelectorAll('button')).some(node => node.textContent?.trim() === 'Standardvorlagen')).toBe(false);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it.each([false, true])('opens standard templates in the catalogue module and keeps a new position independent (detail: %s)', async detail => {
    await render(detail);
    await click('Standardvorlagen');
    expect(f.editor).toHaveBeenLastCalledWith(expect.objectContaining({
      visible: true, tenantId: 'tenant-a', initialModuleKey: 'assist', startWithTemplates: true, startCreating: false,
      effectivePermissions: expect.arrayContaining(['business.tenant.manage']),
    }));
    expect(f.editor.mock.lastCall?.[0].initialItemId).toBeUndefined();
    await click('Editor schließen');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await click('Neue Position');
    expect(f.editor).toHaveBeenLastCalledWith(expect.objectContaining({ initialModuleKey: 'assist', startCreating: true, startWithTemplates: false }));
    await click('Editor schließen');
    await click(detail ? 'Wochenendzuschlag bearbeiten' : 'Assist-Leistungskatalog bearbeiten');
    expect(f.editor).toHaveBeenLastCalledWith(expect.objectContaining({ initialModuleKey: 'assist', startCreating: false, startWithTemplates: false }));
    await click('Editor schließen');
    await click('Standardvorlagen');
    expect(f.editor).toHaveBeenLastCalledWith(expect.objectContaining({ startWithTemplates: true, startCreating: false }));
    expect(f.editor.mock.lastCall?.[0].initialItemId).toBeUndefined();
    expect(f.push).not.toHaveBeenCalled();
  });

  it.each([false, true])('offers templates and a blank position in an available empty catalogue (detail: %s)', async detail => {
    const snapshot = fixture();
    Object.assign(snapshot.catalogs[0], { items: [], itemCount: 0, activeCount: 0, inactiveCount: 0, missingPriceCount: 0, updatedAt: null });
    f.fetch.mockResolvedValue({ ok: true, data: snapshot });
    await render(detail);
    expect(host.textContent).toContain('Standardvorlage auswählen oder eigene Position anlegen.');
    await click('Standardvorlage auswählen');
    expect(f.editor).toHaveBeenLastCalledWith(expect.objectContaining({ initialModuleKey: 'assist', startWithTemplates: true, startCreating: false }));
    await click('Editor schließen');
    await click('Eigene Position anlegen');
    expect(f.editor).toHaveBeenLastCalledWith(expect.objectContaining({ initialModuleKey: 'assist', startWithTemplates: false, startCreating: true }));
  });

  it('hides template actions when no released catalogue is available or the requested catalogue is missing', async () => {
    f.fetch.mockResolvedValue({ ok: true, data: { ...fixture(), catalogs: [] } });
    await render();
    expect(host.textContent).toContain('Noch kein Katalog verfügbar');
    expect(Array.from(host.querySelectorAll('button')).some(node => node.textContent?.includes('Standardvorlage'))).toBe(false);
    await render(true);
    expect(host.textContent).toContain('Katalog nicht verfügbar');
    expect(Array.from(host.querySelectorAll('button')).some(node => node.textContent?.includes('Standardvorlage'))).toBe(false);
    expect(f.editor).not.toHaveBeenCalled();
  });

  it('filters positions by category, status and text, then restores all positions', async () => {
    await render(true);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    await select('Kategorie', 'travel');
    await select('Status', 'inactive');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.querySelector('tbody')?.textContent).toContain('Frühere Fahrtkosten');
    await search('Wochenende');
    expect(host.textContent).toContain('Keine passenden Positionen');
    await click('Alle Positionen anzeigen');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(host.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
    await search('EINKAUF');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.querySelector('tbody')?.textContent).toContain('Alltagsbegleitung');
  });

  it('opens the exact selected item in its tenant and module and refreshes after a confirmed save', async () => {
    await render(true);
    await click('Wochenendzuschlag bearbeiten');
    expect(f.editor).toHaveBeenLastCalledWith(expect.objectContaining({
      visible: true, tenantId: 'tenant-a', initialModuleKey: 'assist', initialItemId: 'weekend', startCreating: false,
      effectivePermissions: expect.arrayContaining(['business.tenant.manage']),
    }));
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    const updated = fixture(); updated.catalogs[0].items[1].priceNet = 30;
    f.fetch.mockResolvedValueOnce({ ok: true, data: updated });
    await click('Gespeicherte Position übernehmen');
    expect(host.textContent).toContain('Die Position wurde gespeichert.');
    const row = Array.from(host.querySelectorAll('tbody tr')).find(node => node.textContent?.includes('Wochenendzuschlag'));
    expect(row?.textContent).toContain('30,00 %');
    await click('Editor schließen');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await click('Neue Position');
    expect(f.editor).toHaveBeenLastCalledWith(expect.objectContaining({ initialModuleKey: 'assist', initialItemId: undefined, startCreating: true }));
  });

  it('renders percentage surcharges as percentages in both views and retains valid zero prices', async () => {
    const snapshot = fixture();
    snapshot.catalogs[0].items[0].priceNet = 0;
    snapshot.catalogs[0].items[0].priceCents = 0;
    f.fetch.mockResolvedValue({ ok: true, data: snapshot });
    await render(true);
    const surcharge = Array.from(host.querySelectorAll('tbody tr')).find(node => node.textContent?.includes('Wochenendzuschlag'));
    expect(surcharge?.textContent).toContain('25,00 %');
    expect(surcharge?.textContent).not.toContain('25,00 €');
    const freeService = Array.from(host.querySelectorAll('tbody tr')).find(node => node.textContent?.includes('Alltagsbegleitung'));
    expect(freeService?.textContent).toContain('0,00 €');
    expect(freeService?.textContent).not.toContain('Kein gültiger Preis');
    await click('Kartenansicht');
    const surchargeCard = Array.from(host.querySelectorAll('article')).find(node => node.textContent?.includes('Wochenendzuschlag'));
    expect(surchargeCard?.textContent).toContain('25,00 %');
    expect(surchargeCard?.textContent).not.toContain('25,00 €');
  });

  it('uses the persisted position editor for the historical create route without creating on entry', async () => {
    f.params = {};
    await act(async () => root.render(<CatalogEditScreen/>));
    expect(host.querySelector('h1')?.textContent).toBe('Neue Katalogposition');
    expect(f.editor).toHaveBeenLastCalledWith(expect.objectContaining({
      visible: true, tenantId: 'tenant-a', initialModuleKey: 'assist', startCreating: true,
    }));
    expect(host.textContent).not.toContain('Die Position wurde gespeichert');
    expect(f.push).not.toHaveBeenCalled();
    await click('Editor schließen');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await click('Position anlegen');
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
