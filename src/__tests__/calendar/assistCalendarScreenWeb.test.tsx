// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/types/modules/calendarEvent';

type DetailProps = { visible: boolean; assignmentId: string | null; onChanged: () => void; onDeleted: () => void; onClose: () => void };
type ShellProps = { onEventPress: (event: CalendarEvent) => void; config: unknown };
type DrawerProps = { visible: boolean; event: CalendarEvent | null; onClose: () => void };
const f = vi.hoisted(() => ({
  tenantId: 'tenant-a' as string | null,
  user: { id: 'user-a' },
  profile: { id: 'profile-a', employeeId: null as string | null },
  roleKey: 'business_admin', permissions: ['assist.assignments.view', 'assist.assignments.manage'],
  isReadOnly: false, canView: true,
  shell: null as ShellProps | null, detail: null as DetailProps | null, drawer: null as DrawerProps | null,
  notify: vi.fn(), buildConfig: vi.fn(() => ({ moduleKey: 'assist', subtitle: 'Assist Kalender' })),
}));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenantId }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ user: f.user, profile: f.profile }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({
  roleKey: f.roleKey, roleLabel: 'Verwaltung', isReadOnly: f.isReadOnly, permissions: f.permissions, can: () => f.canView,
}) }));
vi.mock('@/lib/calendar/calendarEventService', () => ({ buildModuleCalendarConfig: f.buildConfig }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/calendar/calendarWorkspaceRefresh.web', () => ({ notifyCalendarWorkspaceChanged: f.notify }));
vi.mock('@/components/calendar/CalendarShell.web', () => ({ CalendarShell: (props: ShellProps) => { f.shell = props; return null; } }));
vi.mock('@/components/assist/AssignmentDetailGlassModal.web', () => ({ AssignmentDetailGlassModal: (props: DetailProps) => { f.detail = props; return null; } }));
vi.mock('@/components/calendar/CalendarEventDrawer.web', () => ({ CalendarEventDrawer: (props: DrawerProps) => { f.drawer = props; return null; } }));
import { AssistCalendarScreen } from '@/screens/assist/AssistCalendarScreen.web';

const assignment: CalendarEvent = {
  id: 'assist:series-occurrence:2026-10-20', sourceId: 'real-visit-42', sourceType: 'assist_visit',
  type: 'einsatz', title: 'Alltagsbegleitung · Erika Beispiel', clientName: 'Erika Beispiel',
  start: '2026-10-20T08:00:00Z', end: '2026-10-20T10:00:00Z', color: '#2572bf',
};
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  f.tenantId = 'tenant-a'; f.user = { id: 'user-a' }; f.profile = { id: 'profile-a', employeeId: null };
  f.roleKey = 'business_admin'; f.permissions = ['assist.assignments.view', 'assist.assignments.manage'];
  f.isReadOnly = false; f.canView = true; f.shell = null; f.detail = null; f.drawer = null;
  f.notify.mockClear(); f.buildConfig.mockClear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async () => { await act(async () => root.render(<AssistCalendarScreen />)); };
const openAssignment = async () => { await act(async () => f.shell!.onEventPress(assignment)); };

describe('Assist Web calendar detail integration', () => {
  it('opens the real visit source identity and retains stable calendar configuration through detail changes', async () => {
    await render();
    const config = f.shell!.config;
    await openAssignment();
    expect(f.detail!.visible).toBe(true);
    expect(f.detail!.assignmentId).toBe('real-visit-42');
    expect(f.shell!.config).toBe(config);
    expect(f.buildConfig).toHaveBeenCalledTimes(1);
    await act(async () => f.detail!.onChanged());
    expect(f.notify).toHaveBeenCalledExactlyOnceWith('tenant-a');
    await act(async () => f.detail!.onClose());
    expect(f.detail!.visible).toBe(false);
    // Closing also covers status/task changes made inside the detail panel.
    expect(f.notify).toHaveBeenCalledTimes(2);
  });

  it('notifies deletion once even when the modal immediately calls onClose afterwards', async () => {
    await render(); await openAssignment();
    const detail = f.detail!;
    await act(async () => { detail.onDeleted(); detail.onClose(); });
    expect(f.notify).toHaveBeenCalledExactlyOnceWith('tenant-a');
    expect(f.detail!.visible).toBe(false);
  });

  it.each(['tenant', 'user', 'role', 'permissions'] as const)('clears selection synchronously on %s changes and ignores old callbacks', async change => {
    await render(); await openAssignment();
    const previousDetail = f.detail!;
    if (change === 'tenant') f.tenantId = 'tenant-b';
    if (change === 'user') f.user = { id: 'user-b' };
    if (change === 'role') f.roleKey = 'business_manager';
    if (change === 'permissions') f.permissions = ['assist.assignments.view'];
    await render();
    expect(f.detail!.visible).toBe(false);
    expect(f.detail!.assignmentId).toBeNull();
    await act(async () => { previousDetail.onChanged(); previousDetail.onDeleted(); previousDetail.onClose(); });
    expect(f.notify).not.toHaveBeenCalled();
  });

  it('opens generic calendar records in the drawer and prevents two overlapping detail surfaces', async () => {
    await render(); await openAssignment();
    const appointment = { ...assignment, id: 'appointment-1', sourceId: 'appointment-1', sourceType: 'calendar_event', type: 'termin' as const };
    await act(async () => f.shell!.onEventPress(appointment));
    expect(f.drawer!.visible).toBe(true);
    expect(f.drawer!.event).toBe(appointment);
    expect(f.detail!.visible).toBe(false);
  });

  it('does not broadcast an old detail mutation after the screen unmounts', async () => {
    await render(); await openAssignment();
    const previousDetail = f.detail!;
    await act(async () => root.render(null));
    previousDetail.onChanged();
    expect(f.notify).not.toHaveBeenCalled();
  });
});
