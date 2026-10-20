// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ dashboardRefresh: vi.fn(), inboxRefresh: vi.fn(), props: {} as Record<string, unknown>, inboxError: null as string | null }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ displayName: 'Anna' }) }));
vi.mock('@/hooks/useEmployeePortalDashboard', () => ({ useEmployeePortalDashboard: () => ({
  dashboard: { todayAssignments: [], upcomingAssignments: [], openTasks: [], openDocumentationCount: 0, missingSignatureCount: 0, openSignatureDocumentCount: 0, overdueSignatureDocumentCount: 0, messageCount: 0 },
  loading: false, error: null, refreshing: false, refreshError: null, fromCache: false, cachedAt: null, refreshWithResult: f.dashboardRefresh,
}) }));
vi.mock('@/hooks/useportalofficemessages', () => ({ usePortalOfficeMessages: () => ({
  threads: [{ unreadCount: 2 }, { unreadCount: 3 }], loading: false, error: f.inboxError, refreshError: null, refreshing: false, refreshWithResult: f.inboxRefresh,
}) }));
vi.mock('@/components/healthos/employee', () => ({ HealthOSEmployeePortalTodayView: (props: Record<string, unknown>) => {
  f.props = props;
  return <button onClick={props.onRefresh as () => void}>Aktualisieren</button>;
} }));
import { EmployeePortalDashboardScreen } from '@/screens/portal/EmployeePortalDashboardScreen';
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); f.inboxError = null; f.dashboardRefresh.mockResolvedValue(true); f.inboxRefresh.mockResolvedValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (onRefresh = vi.fn()) => { await act(async () => root.render(<EmployeePortalDashboardScreen onRefresh={onRefresh} />)); return onRefresh; };
const refresh = async () => { await act(async () => host.querySelector('button')!.click()); };
describe('Dashboard screen refresh and inbox projections', () => {
  it('uses actual unread thread counts instead of the overview placeholder zero', async () => {
    await render(); expect(f.props.dashboard).toMatchObject({ messageCount: 5, messageCountUnavailable: false });
  });
  it.each(['dashboard', 'inbox'])('does not display refresh success when %s fails', async (source) => {
    (source === 'dashboard' ? f.dashboardRefresh : f.inboxRefresh).mockResolvedValue(false);
    const onRefresh = await render(); await refresh(); expect(onRefresh).not.toHaveBeenCalled();
  });
  it('confirms success after both live reads complete successfully', async () => {
    const onRefresh = await render(); await refresh(); expect(onRefresh).toHaveBeenCalledOnce();
  });
  it('marks an unread count unavailable when its own scoped inbox read fails', async () => {
    f.inboxError = 'Nachrichtenabruf verweigert.'; await render();
    expect(f.props.dashboard).toMatchObject({ messageCountUnavailable: true, messagesError: 'Nachrichtenabruf verweigert.' });
  });
});
