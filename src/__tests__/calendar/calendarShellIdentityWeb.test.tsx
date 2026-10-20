// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/types/modules/calendarEvent';

type PageProps = { onEventPress: (event: CalendarEvent) => void };
type DrawerProps = { visible: boolean; event: CalendarEvent | null; onClose: () => void };
const f = vi.hoisted(() => ({
  tenant: 'tenant-a', user: 'user-a', profile: 'profile-a', role: 'business_admin',
  permissions: ['office.appointments.view', 'office.appointments.edit'],
  page: null as PageProps | null, drawer: null as DrawerProps | null,
  renderedDrawers: [] as DrawerProps[], override: vi.fn(),
}));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: { id: f.user }, profile: { id: f.profile, employeeId: null } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({
  roleKey: f.role, isReadOnly: false, permissions: f.permissions,
  can: (permission: string) => f.permissions.includes(permission),
}) }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/lib/calendar/calendarEventService', () => ({
  buildOfficeCalendarConfig: () => ({ moduleKey: 'office', calendarScope: 'office' }),
  buildModuleCalendarConfig: (moduleKey: string) => ({ moduleKey, calendarScope: 'module' }),
}));
vi.mock('@/components/calendar/CalendarPageShell.web', () => ({ CalendarPageShell: (props: PageProps) => { f.page = props; return <div>Kalenderinhalt</div>; } }));
vi.mock('@/components/calendar/CalendarEventDrawer.web', () => ({ CalendarEventDrawer: (props: DrawerProps) => {
  f.drawer = props; f.renderedDrawers.push(props); return props.visible ? <div role="dialog">{props.event?.title}</div> : null;
} }));
import { CalendarShell } from '@/components/calendar/CalendarShell.web';

const event: CalendarEvent = { id: 'record-a', title: 'Termin Unternehmen A', type: 'termin', color: '#247bcc', start: '2026-10-20T08:00:00Z', end: '2026-10-20T09:00:00Z' };
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  f.tenant = 'tenant-a'; f.user = 'user-a'; f.profile = 'profile-a'; f.role = 'business_admin'; f.permissions = ['office.appointments.view', 'office.appointments.edit'];
  f.page = null; f.drawer = null; f.renderedDrawers = []; f.override.mockReset();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (override = false) => { await act(async () => root.render(<CalendarShell moduleKey="office" onEventPress={override ? f.override : undefined} />)); };
const open = async (selected = event) => { await act(async () => f.page!.onEventPress(selected)); };

describe('Generic Web calendar identity boundaries', () => {
  it('opens and closes a permitted record in the current identity', async () => {
    await render(); await open(); expect(f.drawer!.visible).toBe(true); expect(f.drawer!.event).toBe(event);
    await act(async () => f.drawer!.onClose()); expect(f.drawer!.event).toBeNull();
  });

  it.each(['tenant', 'user', 'profile', 'role', 'permissions'] as const)('clears an open record synchronously after a %s change and rejects its previous open callback', async change => {
    await render(); await open(); const previousOpen = f.page!.onEventPress;
    f.renderedDrawers = [];
    if (change === 'permissions') f.permissions = ['office.appointments.view'];
    else f[change] = `${change}-b`;
    await render();
    expect(f.renderedDrawers.length).toBeGreaterThan(0);
    expect(f.renderedDrawers.every(drawer => !drawer.visible && drawer.event === null)).toBe(true);
    await act(async () => previousOpen(event));
    expect(f.drawer!.event).toBeNull();
  });

  it('does not let the old close callback dismiss a newly selected record', async () => {
    await render(); await open(); const previousClose = f.drawer!.onClose;
    f.tenant = 'tenant-b'; await render(); const current = { ...event, id: 'record-b', title: 'Termin Unternehmen B' }; await open(current);
    await act(async () => previousClose());
    expect(f.drawer!.visible).toBe(true); expect(f.drawer!.event).toBe(current);
  });

  it('removes the selected record and calendar content when read permission is revoked', async () => {
    await render(); await open(); const previousOpen = f.page!.onEventPress;
    f.permissions = []; f.role = 'employee'; await render();
    expect(host.textContent).toContain('Leseberechtigung'); expect(host.textContent).not.toContain('Kalenderinhalt'); expect(f.drawer!.event).toBeNull();
    await act(async () => previousOpen(event)); expect(f.drawer!.visible).toBe(false);
  });

  it('prevents stale or unmounted callbacks from reaching an external detail handler', async () => {
    await render(true); const previousOpen = f.page!.onEventPress;
    f.tenant = 'tenant-b'; await render(true);
    await act(async () => previousOpen(event)); expect(f.override).not.toHaveBeenCalled();
    await open(); expect(f.override).toHaveBeenCalledExactlyOnceWith(event);
    const currentOpen = f.page!.onEventPress; await act(async () => root.render(null));
    currentOpen(event); expect(f.override).toHaveBeenCalledOnce();
  });
});
