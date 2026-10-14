// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientsListExperience } from '@/components/office/ClientsListExperience.web';
import type { ClientListItem } from '@/types/modules/office';

const h = vi.hoisted(() => ({
  list: {} as Record<string, unknown>, canCreate: true, canCsv: true, canViewSensitive: true,
  push: vi.fn(), create: vi.fn(), select: vi.fn(), open: vi.fn(),
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({
  can: (permission: string) => permission === 'office.clients.create' ? h.canCreate : permission === 'office.clients.view_sensitive' ? h.canViewSensitive : h.canCsv,
  isReadOnly: !h.canCreate, roleLabel: 'Lesende Mitarbeitende',
}) }));
vi.mock('@/hooks/useClientList', () => ({ useClientList: () => h.list }));
vi.mock('@/hooks/useDesktopListViewPreference', async () => {
  const { useState } = await import('react');
  return { useDesktopListViewPreference: () => {
    const [viewMode, setViewMode] = useState('table');
    return { viewMode, setViewMode };
  } };
});
const first: ClientListItem = { id: 'client-1', tenantId: 'tenant', firstName: 'Alexandra', lastName: 'Bergmann', dateOfBirth: '1949-03-02', careLevel: 'pg2', primaryContactPhone: '+49 (2323) 12345', city: 'Herne', zip: '44623', status: 'aktiv', costCarrier: 'AOK', sensitivity: 'internal', updatedAt: '2026-10-14T10:00:00Z' };
const second: ClientListItem = { ...first, id: 'client-2', firstName: 'Johann', lastName: 'Winter', costCarrier: 'BARMER', status: 'entwurf' };
let root: Root;
let host: HTMLDivElement;
const render = async () => { await act(async () => root.render(<ClientsListExperience onCreatePress={h.create} onClientPress={h.select} onOpenDetail={h.open} />)); };
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((node) => node.textContent?.trim() === text)!;
const change = async (select: HTMLSelectElement, value: string) => { await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); }); };

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.canCreate = true; h.canCsv = true; h.canViewSensitive = true;
  h.list = {
    items: [first], kpiItems: [first, second], allItems: [first], filteredCount: 1,
    loading: false, refreshing: false, error: null, isLive: true, isLiveConnected: true,
    search: '', statusFilter: 'all', lifecycleFilter: 'active', careLevelFilter: 'all', costBearerFilter: 'all', sortKey: 'name_asc',
    setSearch: vi.fn(), setStatusFilter: vi.fn(), setLifecycleFilter: vi.fn(), setCareLevelFilter: vi.fn(), setCostBearerFilter: vi.fn(), setSortKey: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined), resetFilters: vi.fn(), loadMore: vi.fn(),
    hasActiveFilters: false, hasMore: false, hasLocalOnlyIntakeDraft: false,
    sortOptions: [{ key: 'name_asc', label: 'Name A–Z' }, { key: 'name_desc', label: 'Name Z–A' }, { key: 'city_asc', label: 'Ort A–Z' }],
    statusFilters: [{ key: 'all', label: 'Alle' }, { key: 'aktiv', label: 'Aktiv' }, { key: 'entwurf', label: 'Entwurf' }, { key: 'archiviert', label: 'Archiviert' }],
    careLevelFilters: [{ key: 'all', label: 'Alle' }, { key: 'pg2', label: 'Pflegegrad 2' }],
  };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('web client records list interaction', () => {
  it('keeps selection, opening the full record and starting an intake separate', async () => {
    await render();
    await click(host.querySelector<HTMLButtonElement>('.cs-records-identity')!);
    expect(h.select).toHaveBeenCalledExactlyOnceWith(first.id); expect(h.open).not.toHaveBeenCalled();
    await click(host.querySelector<HTMLButtonElement>('.cs-records-table .cs-records-open')!);
    expect(h.open).toHaveBeenCalledExactlyOnceWith(first.id); expect(h.select).toHaveBeenCalledTimes(1);
    await click(button('Klient:in aufnehmen')); expect(h.create).toHaveBeenCalledOnce();
    expect(host.querySelector('a')?.getAttribute('href')).toBe('tel:+49232312345');
  });

  it('hides create and import actions when the role lacks their permissions', async () => {
    h.canCreate = false; h.canCsv = false; await render();
    expect(button('Klient:in aufnehmen')).toBeUndefined(); expect(button('Import / Export')).toBeUndefined();
    expect(host.textContent).toContain('Nur lesen');
    await click(host.querySelector<HTMLButtonElement>('.cs-records-table .cs-records-open')!);
    expect(h.open).toHaveBeenCalledWith(first.id); expect(h.create).not.toHaveBeenCalled();
  });

  it('preserves other cost bearers after filtering and makes archived status reachable', async () => {
    h.list.costBearerFilter = 'AOK'; h.list.hasActiveFilters = true;
    await render(); await click(button('Filter1'));
    const selects = host.querySelectorAll<HTMLSelectElement>('.cs-records-filters select');
    expect([...selects[2].options].map((option) => option.value)).toEqual(['all', 'AOK', 'BARMER']);
    await change(selects[0], 'archiviert');
    expect(h.list.setStatusFilter).toHaveBeenCalledWith('archiviert');
    expect(h.list.setLifecycleFilter).toHaveBeenCalledWith('archived');
  });

  it('clears unrelated filters when choosing the paused-care overview', async () => {
    h.list.search = 'Alexandra'; h.list.careLevelFilter = 'pg2';
    await render();
    const intake = [...host.querySelectorAll<HTMLButtonElement>('.cs-records-kpi')].find((node) => node.textContent?.includes('Pausiert'))!;
    await click(intake);
    expect(h.list.setSearch).toHaveBeenCalledWith('');
    expect(h.list.setCareLevelFilter).toHaveBeenCalledWith('all');
    expect(h.list.setCostBearerFilter).toHaveBeenCalledWith('all');
    expect(h.list.setLifecycleFilter).toHaveBeenCalledWith('all');
    expect(h.list.setStatusFilter).toHaveBeenCalledWith('in_bearbeitung');
  });

  it('keeps stale rows and recovery controls visible when refreshing fails', async () => {
    h.list.error = 'Verbindung unterbrochen'; await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Die zuletzt geladenen Angaben bleiben sichtbar.');
    expect(host.querySelector('tbody')?.textContent).toContain('Alexandra Bergmann');
    expect(host.textContent).not.toContain('Liste erfolgreich aktualisiert');
    await click(button('Erneut versuchen')); expect(h.list.refresh).toHaveBeenCalledOnce();
  });

  it('shows filter recovery rather than an empty company message for zero matches', async () => {
    h.list.items = []; h.list.allItems = []; h.list.filteredCount = 0; h.list.hasActiveFilters = true; h.list.search = 'unbekannt';
    await render(); expect(host.querySelector('.cs-records-empty')?.textContent).toContain('Keine passende Akte gefunden');
    await click(host.querySelector<HTMLButtonElement>('.cs-records-empty button')!);
    expect(h.list.resetFilters).toHaveBeenCalledOnce(); expect(h.list.setLifecycleFilter).toHaveBeenCalledWith('active');
  });

  it('applies insurer and archive choices to local data before rendering results', async () => {
    const archived = { ...second, id: 'archived-client', status: 'archiviert' as const };
    h.list.isLive = false; h.list.allItems = [first, second, archived]; h.list.kpiItems = [first, second, archived];
    h.list.lifecycleFilter = 'archived'; h.list.costBearerFilter = 'BARMER'; h.list.hasActiveFilters = true;
    await render();
    const rows = host.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Johann Winter');
    expect(rows[0].textContent).toContain('Archiviert');
    expect(host.querySelector('.cs-records-results')?.textContent).toContain('1 Akte gefunden');
  });

  it.each([true, false])('shows insurance below the carrier in both list views with permission %s', async (allowed) => {
    h.canViewSensitive = allowed;
    h.list.items = [{ ...first, insuranceNumber: 'A123456789' }];
    await render();
    const tableNumber = host.querySelector('.cs-records-table .cs-records-insurance')!;
    expect(tableNumber.previousElementSibling?.textContent).toBe('AOK');
    expect(tableNumber.textContent).toBe(`Versichertennummer${allowed ? 'A123456789' : '••• Geschützt'}`);
    await click(button('Aktenkarten'));
    const cardCarrier = host.querySelector('.cs-records-card-carrier')!;
    expect(cardCarrier.firstChild?.textContent).toBe('AOK');
    expect(cardCarrier.querySelector('.cs-records-insurance')?.textContent).toBe(tableNumber.textContent);
    if (!allowed) expect(host.innerHTML).not.toContain('A123456789');
  });

  it('explains a missing insurance number in both list views', async () => {
    await render();
    for (const element of host.querySelectorAll('.cs-records-insurance')) expect(element.textContent).toBe('VersichertennummerNicht hinterlegt');
  });

  it('continues an unsaved intake through the existing intake action and supports display changes', async () => {
    h.list.hasLocalOnlyIntakeDraft = true; await render();
    await click(button('Aufnahme fortsetzen')); expect(h.create).toHaveBeenCalledOnce();
    await click(button('Aktenkarten')); expect(host.querySelector('.cs-records-data--cards')).not.toBeNull();
    expect(button('Aktenkarten').getAttribute('aria-pressed')).toBe('true');
  });
});
