// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { EmployeesListExperience } from '@/components/office/EmployeesListExperience.web';
const h = vi.hoisted(() => ({ canView: true, canCreate: true, error: null as string | null, refresh: vi.fn(), open: vi.fn(), create: vi.fn() }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (key: string) => key === 'office.employees.view' ? h.canView : h.canCreate, isReadOnly: !h.canCreate, roleLabel: 'Verwaltung' }) }));
vi.mock('@/hooks/useEmployeeList', async () => {
  const { useState } = await import('react');
  return { useEmployeeList: () => {
    const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState('all'); const [sortKey, setSortKey] = useState('name_asc');
    return { allItems: [
      { id: 'one', firstName: 'Mara', lastName: 'Sommer', jobTitle: 'pflegefachkraft', department: 'pflege', email: 'mara@example.invalid', phone: '+49 123', status: 'aktiv' },
      { id: 'two', firstName: 'Leon', lastName: 'Seidel', jobTitle: 'verwaltung', department: 'verwaltung', email: '', phone: '', status: 'archiviert' },
    ], search, setSearch, statusFilter, setStatusFilter, sortKey, setSortKey, resetFilters: () => { setSearch(''); setStatusFilter('all'); }, statusFilters: [{ key: 'all' }, { key: 'aktiv' }, { key: 'archiviert' }], error: h.error, loading: false, refreshing: false, refresh: h.refresh, isLiveConnected: true };
  } };
});
vi.mock('@/hooks/useDesktopListViewPreference', async () => { const { useState } = await import('react'); return { useDesktopListViewPreference: () => { const [viewMode, setViewMode] = useState('table'); return { viewMode, setViewMode }; } }; });
let root: Root; let host: HTMLDivElement;
beforeEach(() => { (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); h.canView = true; h.canCreate = true; h.error = null; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = () => act(async () => root.render(<EmployeesListExperience onOpenDetail={h.open} onCreatePress={h.create} />));
const click = (el: Element) => act(async () => (el as HTMLElement).click());
describe('personnel list actions', () => {
  it('filters via KPI, resets, switches cards and opens the right record', async () => {
    await render();
    await click(host.querySelectorAll('.cs-records-kpi')[1]);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    await click(host.querySelector('.cs-records-table .cs-records-open')!); expect(h.open).toHaveBeenCalledWith('one');
    await click(host.querySelector('.pe-filter-summary button')!); expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    await click(host.querySelectorAll('.cs-records-view-toggle button')[1]); expect(host.querySelector('.cs-records-data--cards')).not.toBeNull();
    await click(host.querySelectorAll('.cs-records-cards .cs-records-open')[1]); expect(h.open).toHaveBeenLastCalledWith('one');
  });
  it('keeps stale records and a retry action when refresh fails', async () => {
    h.error = 'Verbindung unterbrochen'; await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('zuletzt geladenen Angaben'); expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    await click(host.querySelector('[role="alert"] button')!); expect(h.refresh).toHaveBeenCalledOnce();
  });
  it('removes write actions for readers and records for denied access', async () => {
    h.canCreate = false; await render(); expect(host.querySelector('.cs-records-button--primary')).toBeNull(); expect(host.textContent).toContain('Nur lesen');
    h.canView = false; await render(); expect(host.querySelector('table')).toBeNull(); expect(host.textContent).not.toContain('Mara');
  });
});
