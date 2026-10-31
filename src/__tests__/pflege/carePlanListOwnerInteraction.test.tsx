// @vitest-environment happy-dom
import React, { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CarePlansListView as Web } from '@/components/pflege/CarePlansListView.web';
import { CarePlansListView as Native } from '@/components/pflege/CarePlansListView.native';
type List = NonNullable<ComponentProps<typeof Web>['list']>;
const h = vi.hoisted(() => ({ list: null as List | null, query: vi.fn(), push: vi.fn(), current: true, manage: true,
  select: null as null | ((id: string) => void), detail: null as null | ((id: string) => void) }));
vi.mock('@/hooks/useCarePlanList.web', () => ({ useCarePlanList: h.query }));
vi.mock('@/hooks/useCarePlanList.native', () => ({ useCarePlanList: h.query }));
vi.mock('@/hooks/pflege/useCareRuntimePermissions.web', () => ({ useCareRuntimePermissions: () => ({ can: (key: string) => key.endsWith('manage') ? h.manage : true, roleLabel: 'Pflege', check: () => ({ allowed: true }) }) }));
vi.mock('@/hooks/pflege/useCareRuntimePermissions.native', () => ({ useCareRuntimePermissions: () => ({ can: (key: string) => key.endsWith('manage') ? h.manage : true, roleLabel: 'Pflege', check: () => ({ allowed: true }) }) }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { roleKey: 'nurse' } }) }));
vi.mock('react-native', () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>, Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>, RefreshControl: () => null, FlatList: () => null,
  StyleSheet: { create: (s: unknown) => s },
}));
vi.mock('@/components/ui/CareSuiteNativeText', () => ({ CareSuiteNativeText: ({ children }: { children?: ReactNode }) => <span>{children}</span> }));
vi.mock('@/components/ui', () => ({
  EmptyState: ({ title, onAction }: { title: string; onAction?: () => void }) => <button onClick={onAction}>{title}</button>,
  ErrorState: ({ message }: { message: string }) => <div>{message}</div>, LoadingState: () => <div>Loading plans</div>, SuccessState: () => <div>Success</div>,
  FilterChipGroup: () => null, PremiumInput: () => null,
  PremiumButton: ({ title, onPress }: { title: string; onPress: () => void }) => <button onClick={onPress}>{title}</button>,
}));
vi.mock('@/components/permissions', () => ({ LockedActionBanner: () => <div>Locked</div> }));
vi.mock('@/components/pflege/CarePlanListCard', () => ({ CarePlanListCard: () => null }));
vi.mock('@/components/pflege/CarePlansListHero', () => ({ CarePlansListHero: ({ onCreatePress }: { onCreatePress: () => void }) => <button onClick={onCreatePress}>Hero create</button> }));
vi.mock('@/components/pflege/CarePlansListTable', () => ({ CarePlansListTable: (p: { onPlanPress: (id: string) => void; onOpenDetail: (id: string) => void }) => { h.select = p.onPlanPress; h.detail = p.onOpenDetail; return <div>Plan table</div>; } }));
vi.mock('@/lib/pflege/carePlanListStats', () => ({ buildCarePlanListKpis: () => [] }));
vi.mock('@/hooks/platform/useDeviceClass', () => ({ useDeviceClass: () => 'desktop' }));
vi.mock('@/hooks/platform/usePlatformLayout', () => ({ usePlatformLayout: () => ({ shellVariant: 'desktop' }) }));
vi.mock('@/hooks/useDesktopListViewPreference', () => ({ useDesktopListViewPreference: () => ({ viewMode: 'table', setViewMode: vi.fn() }) }));
vi.mock('@/lib/platform/breakpoints', () => ({ isDesktopClass: () => true }));
vi.mock('@/lib/table/tableColumnSort', () => ({ useTableColumnSort: () => ({}) }));
vi.mock('@/theme', () => ({ colors: {}, spacing: {}, typography: {} }));
const makeList = (): List => ({
  allItems: [], items: [{ id: 'own-a' }, { id: 'own-b' }], totalCount: 12, filteredCount: 12,
  loading: false, error: null, refreshing: false, showSuccess: false, search: '', statusFilter: 'all', sortKey: 'client_asc', sortOptions: [], statusFilters: [],
  hasMore: false, hasActiveFilters: false, isEmpty: false, isFilterEmpty: false,
  refresh: vi.fn(), resetFilters: vi.fn(), setSearch: vi.fn(), setStatusFilter: vi.fn(), setSortKey: vi.fn(), loadMore: vi.fn(),
  isCurrent: () => h.current, isCurrentItem: (id: string) => h.current && ['own-a', 'own-b'].includes(id),
} as unknown as List);
describe.each([['Web', Web], ['Native', Native]] as const)('%s current plan list interactions', (_platform, View) => {
  let root: Root, host: HTMLDivElement;
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); h.current = h.manage = true; h.list = makeList(); h.query.mockImplementation(() => h.list); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  it('uses the supplied source without a second query and reports displayed rows accurately', async () => {
    await act(async () => root.render(<View list={h.list!} />)); expect(h.query).not.toHaveBeenCalled(); expect(host.textContent).toContain('2 von 12 Pflegeplänen angezeigt');
  });
  it('owns exactly one query when no source is supplied', async () => { await act(async () => root.render(<View />)); expect(h.query).toHaveBeenCalledOnce(); });
  it('guards both selection and separate detail actions against stale or foreign rows', async () => {
    const select = vi.fn(); await act(async () => root.render(<View list={h.list!} onPlanPress={select} />));
    h.select!('foreign'); h.detail!('foreign'); expect(select).not.toHaveBeenCalled(); expect(h.push).not.toHaveBeenCalled();
    h.select!('own-a'); expect(select).toHaveBeenCalledWith('own-a'); h.detail!('own-a'); expect(h.push).toHaveBeenCalledWith('/pflege/plans/own-a');
    vi.clearAllMocks(); h.current = false; h.select!('own-a'); h.detail!('own-a'); expect(select).not.toHaveBeenCalled(); expect(h.push).not.toHaveBeenCalled();
  });
  it('rechecks current source and management capability for retained create actions', async () => {
    await act(async () => root.render(<View list={h.list!} />)); const button = host.querySelector('button')!;
    h.current = false; await act(async () => button.click()); expect(h.push).not.toHaveBeenCalled();
    h.current = true; h.manage = false; await act(async () => button.click()); expect(h.push).not.toHaveBeenCalled();
    h.manage = true; await act(async () => button.click()); expect(h.push).toHaveBeenCalledWith('/pflege/plans/create');
  });
  it('does not display zero-count hero data while a list is still loading', async () => {
    h.list!.loading = true; h.list!.items = []; await act(async () => root.render(<View list={h.list!} />)); expect(host.textContent).toContain('Loading plans'); expect(host.textContent).not.toContain('Hero create'); expect(host.textContent).not.toContain('Plan table');
  });
});
