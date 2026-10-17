// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistLiveMonitoringOverview, AssistLiveMonitoringRow } from '@/features/assistLive/getAssistLiveMonitoring';

const f = vi.hoisted(() => ({
  tenant: 'tenant-a', user: 'user-a', role: 'business_admin', readOnly: false,
  denied: new Set<string>(), monitoring: {} as any, hookOptions: {} as any,
  inbox: {} as any, map: {} as any, detail: {} as any, push: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: f.push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }) }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.user, roleKey: f.role }, user: { id: f.user }, session: { user: { id: f.user } } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (key: string) => !f.denied.has(key), check: () => ({ reason: 'Kein Zugriff auf Live-Status.' }), roleLabel: 'Verwaltung', roleKey: f.role, permissions: ['assist.assignments.view', 'assist.assignments.manage', 'assist.execution.view'].filter(key => !f.denied.has(key)), isReadOnly: f.readOnly }) }));
vi.mock('@/features/assistLive/useAssistLiveMonitoring.web', () => ({ useAssistLiveMonitoring: (options: any) => { f.hookOptions = options; return f.monitoring; } }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/components/layout', () => ({ ScreenShell: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/components/permissions', () => ({ LockedActionBanner: ({ message }: any) => <div role="alert">{message}</div> }));
vi.mock('@/components/assist/AssignmentDetailGlassModal.web', () => ({ AssignmentDetailGlassModal: (props: any) => {
  f.detail = props;
  return props.visible ? <div role="dialog" aria-label="Einsatzdetails"><span>{props.assignmentId}</span><button onClick={props.onClose}>Detail schließen</button><button onClick={props.onChanged}>Änderung bestätigen</button></div> : null;
} }));
vi.mock('@/components/assist/AssistExecutionProblemInboxPanel.web', () => ({ AssistExecutionProblemInboxPanel: (props: any) => {
  f.inbox = props;
  return <section aria-label="Problemfälle"><button onClick={() => props.onOpenAssignment?.('issue-assignment')}>Problemquelle öffnen</button><button onClick={() => props.onChanged?.()}>Reparatur bestätigen</button></section>;
} }));
vi.mock('@/components/assist/AssistLiveStatusMapPanel.web', () => ({ AssistLiveStatusMapPanel: (props: any) => {
  f.map = props;
  return <section aria-label="Positionskarte" />;
} }));
vi.mock('@/lib/calendar/calendarWorkspaceRefresh.web', () => ({ notifyCalendarWorkspaceChanged: f.notify }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ push: f.push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }) }));
vi.mock('@/hooks/useFlowRouter.web', () => ({ useFlowRouter: () => ({ push: f.push, back: vi.fn(), replace: vi.fn(), canGoBack: () => false }) }));

import { AssistLiveStatusScreen } from '@/screens/assist/AssistLiveStatusScreen.web';

const row = (partial: Partial<AssistLiveMonitoringRow> = {}): AssistLiveMonitoringRow => ({
  assignmentId: 'assignment-a', visitId: 'visit-a', tenantId: 'tenant-a', title: 'Unterstützung im Alltag', employeeId: 'employee-a', employeeName: 'Alex Beispiel', clientId: 'client-a', clientName: 'Erika Beispiel',
  status: 'geplant', canonicalStatus: 'planned', displayStatus: 'geplant', statusColor: '#64748b',
  plannedStartAt: '2026-10-17T08:00:00Z', plannedEndAt: '2026-10-17T10:00:00Z', actualStartAt: null, actualEndAt: null,
  delayMinutes: null, overrunMinutes: null, docStatus: 'na', signatureStatus: 'na', problemStatus: 'none', cancelRequest: false, rescheduleRequest: false, tracking: null, route: null, ...partial,
});
const overview = (rows: AssistLiveMonitoringRow[]): AssistLiveMonitoringOverview => ({ rows, todayCount: rows.length, runningCount: 0, activeTrackingCount: 0, freshGpsCount: 0, consentPendingCount: 0, gpsDeniedCount: 0, mapMarkers: [], readOnlyNotice: 'Standorte aus dem Mitarbeiterportal.', generatedAt: '2026-10-17T08:00:00Z' });
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-17T08:00:00Z'));
  history.replaceState(null, '', '/assist/live-status'); sessionStorage.clear();
  f.tenant = 'tenant-a'; f.user = 'user-a'; f.role = 'business_admin'; f.readOnly = false; f.denied = new Set();
  f.push.mockReset(); f.notify.mockReset(); f.inbox = {}; f.map = {}; f.detail = {}; f.hookOptions = {};
  f.monitoring = { overview: overview([row(), row({ assignmentId: 'assignment-b', visitId: 'visit-b', clientName: 'Bea Muster', employeeId: 'employee-b', employeeName: 'Alex Beispiel', status: 'gestartet', displayStatus: 'gestartet' })]), loading: false, refreshing: false, error: null, refreshError: null, refresh: vi.fn().mockResolvedValue(undefined), refreshWithResult: vi.fn().mockResolvedValue(true), isRealtimeConnected: true, partialData: false, warnings: [] };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
const render = async () => { await act(async () => root.render(<AssistLiveStatusScreen />)); };
const button = (label: string) => [...host.querySelectorAll('button')].find(element => element.getAttribute('aria-label') === label || element.textContent?.trim() === label);
const press = async (label: string) => { const element = button(label); expect(element, `button ${label}`).toBeTruthy(); await act(async () => element!.click()); };
const change = async (label: string, value: string) => {
  const element = host.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement | HTMLInputElement;
  expect(element, `input ${label}`).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};

describe('Live-Status Web workspace integration', () => {
  it('leaves native filter selections untouched while the live clock advances', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-17T08:00:00Z'));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    f.monitoring.overview = overview([row({ status: 'gestartet', displayStatus: 'gestartet', tracking: {
      assignmentId: 'assignment-a', tenantId: 'tenant-a', status: 'gestartet', consent: { granted: false, grantedAt: null, explainedAt: null },
      gpsPermission: 'undetermined', trackingActive: false, lastPosition: null, geofence: null, warnings: [], arrivalProof: null, assistVisible: false, clientPortalVisible: false,
      timers: { driveSeconds: 0, serviceSeconds: 120, pauseSeconds: 0, activeTimer: 'service', driveStartedAt: null, serviceStartedAt: '2026-10-17T07:58:00Z', pauseStartedAt: null },
    } })]);
    await render();
    const employee = host.querySelector('[aria-label="Mitarbeitende filtern"]') as HTMLSelectElement;
    const status = host.querySelector('[aria-label="Einsatzstatus filtern"]') as HTMLSelectElement;
    const selectionWrites = vi.spyOn(HTMLOptionElement.prototype, 'selected', 'set');
    try {
      for (const [index, select] of [employee, status].entries()) {
        select.focus();
        await act(async () => vi.advanceTimersByTime(3_000));
        expect(host.textContent).toContain(`00:02:0${(index + 1) * 3}`);
        expect(document.activeElement).toBe(select);
        expect(host.querySelector(`[aria-label="${select.getAttribute('aria-label')}"]`)).toBe(select);
        // Reassigning selected on a controlled native select can dismiss its open
        // browser picker even when React preserves the element and its focus.
        expect(selectionWrites).not.toHaveBeenCalled();
      }
    } finally { selectionWrites.mockRestore(); visibility.mockRestore(); }
  });

  it('preserves native filter selection when fresh data has unchanged employee options', async () => {
    await render();
    await change('Mitarbeitende filtern', 'employee-b');
    const employee = host.querySelector('[aria-label="Mitarbeitende filtern"]') as HTMLSelectElement;
    const status = host.querySelector('[aria-label="Einsatzstatus filtern"]') as HTMLSelectElement;
    employee.focus();
    const selectionWrites = vi.spyOn(HTMLOptionElement.prototype, 'selected', 'set');
    try {
      f.monitoring.overview = {
        ...f.monitoring.overview,
        generatedAt: '2026-10-17T08:00:05Z',
        rows: f.monitoring.overview.rows.map((value: AssistLiveMonitoringRow) => ({ ...value })),
      };
      await render();
      expect(host.querySelector('[aria-label="Mitarbeitende filtern"]')).toBe(employee);
      expect(host.querySelector('[aria-label="Einsatzstatus filtern"]')).toBe(status);
      expect(document.activeElement).toBe(employee);
      expect(employee.value).toBe('employee-b');
      expect(selectionWrites).not.toHaveBeenCalled();
    } finally { selectionWrites.mockRestore(); }
    await change('Einsatzstatus filtern', 'active');
    expect(status.value).toBe('active');
    expect(host.textContent).toContain('Bea Muster');
    expect(host.textContent).not.toContain('Erika Beispiel');
    await press('Filter zurücksetzen');
    expect(employee.value).toBe('');
    expect(status.value).toBe('all');
    expect(host.textContent).toContain('Erika Beispiel');
  });

  it('updates real employee option changes and discards filter selection after permission changes', async () => {
    await render();
    const employee = host.querySelector('[aria-label="Mitarbeitende filtern"]') as HTMLSelectElement;
    await change('Mitarbeitende filtern', 'employee-b');
    f.monitoring.overview = overview([
      row({ employeeName: 'Clara Umbenannt' }),
      row({ assignmentId: 'assignment-c', visitId: 'visit-c', clientName: 'Carla Neu', employeeId: 'employee-c', employeeName: 'Dora Neu' }),
    ]);
    await render();
    expect([...employee.options].map(option => [option.value, option.textContent])).toEqual([
      ['', 'Alle Mitarbeitenden'], ['employee-a', 'Clara Umbenannt'], ['employee-c', 'Dora Neu'],
    ]);
    await change('Mitarbeitende filtern', 'employee-c');
    expect(host.textContent).toContain('Carla Neu');
    expect(host.textContent).not.toContain('Erika Beispiel');
    f.denied.add('assist.assignments.manage');
    await render();
    const nextEmployee = host.querySelector('[aria-label="Mitarbeitende filtern"]') as HTMLSelectElement;
    expect(nextEmployee).not.toBe(employee);
    expect(nextEmployee.value).toBe('');
    expect(host.textContent).toContain('Erika Beispiel');
  });

  it('keeps equal employee names distinct by identity and filters the visible assignments', async () => {
    await render(); await change('Mitarbeitende filtern', 'employee-b');
    expect(host.textContent).toContain('Bea Muster'); expect(host.textContent).not.toContain('Erika Beispiel');
    await press('Filter zurücksetzen'); expect(host.textContent).toContain('Erika Beispiel');
    await change('Live-Status durchsuchen', 'ERIKA'); expect(host.textContent).toContain('Erika Beispiel'); expect(host.textContent).not.toContain('Bea Muster');
  });

  it('opens the chosen assignment and returns to the unchanged list when the detail closes', async () => {
    await render(); await change('Live-Status durchsuchen', 'Erika');
    const detailButton = [...host.querySelectorAll('button')].find(element => element.getAttribute('aria-label')?.startsWith('Einsatzdetails öffnen:'));
    expect(detailButton).toBeTruthy(); await act(async () => detailButton!.click());
    expect(f.detail.assignmentId).toBe('visit-a'); expect(f.detail.visible).toBe(true);
    await press('Detail schließen'); expect(f.detail.visible).toBe(false);
    expect((host.querySelector('[aria-label="Live-Status durchsuchen"]') as HTMLInputElement).value).toBe('Erika');
  });

  it('refreshes both sources after a confirmed source repair', async () => {
    await render(); await press('Problem-Inbox'); const token = f.inbox.refreshToken;
    await press('Reparatur bestätigen'); expect(f.monitoring.refresh).toHaveBeenCalled(); expect(f.inbox.refreshToken).not.toBe(token);
  });

  it('refreshes the live source and the inbox from the shared refresh control', async () => {
    await render(); await press('Problem-Inbox'); const token = f.inbox.refreshToken;
    await press('Live-Status aktualisieren'); expect(f.monitoring.refresh).toHaveBeenCalledOnce(); expect(f.inbox.refreshToken).not.toBe(token);
  });

  it('opens the assignment selected in the problem inbox', async () => {
    await render(); await press('Problem-Inbox'); await press('Problemquelle öffnen');
    expect(f.detail.visible).toBe(true); expect(f.detail.assignmentId).toBe('issue-assignment');
  });

  it('does not request monitoring or expose data when view permission is absent', async () => {
    f.denied.add('assist.assignments.view'); await render();
    expect(f.hookOptions.enabled).toBe(false); expect(host.textContent).not.toContain('Erika Beispiel'); expect(button('Live-Status aktualisieren')).toBeUndefined();
  });

  it('restores the active view and search after a refresh without reopening an old detail', async () => {
    await render(); await change('Live-Status durchsuchen', 'Erika'); await press('Problem-Inbox');
    await act(async () => root.unmount()); root = createRoot(host); await render();
    expect(host.querySelector('[aria-label="Problemfälle"]')).toBeTruthy();
    await press('Tagesübersicht'); expect((host.querySelector('[aria-label="Live-Status durchsuchen"]') as HTMLInputElement).value).toBe('Erika'); expect(f.detail.visible).toBe(false);
  });

  it('clears the selected detail and private filters when the identity changes', async () => {
    await render(); await change('Live-Status durchsuchen', 'Erika');
    const detailButton = [...host.querySelectorAll('button')].find(element => element.getAttribute('aria-label')?.startsWith('Einsatzdetails öffnen:'));
    await act(async () => detailButton!.click()); f.tenant = 'tenant-b'; f.monitoring.overview = overview([]); await render();
    expect(f.detail.visible).toBe(false); expect((host.querySelector('[aria-label="Live-Status durchsuchen"]') as HTMLInputElement).value).toBe('');
    await change('Live-Status durchsuchen', 'private'); f.user = 'user-b'; await render();
    expect((host.querySelector('[aria-label="Live-Status durchsuchen"]') as HTMLInputElement).value).toBe('');
    await change('Live-Status durchsuchen', 'window'); history.replaceState(null, '', '/assist/live-status?csWindow=other'); await render();
    expect((host.querySelector('[aria-label="Live-Status durchsuchen"]') as HTMLInputElement).value).toBe('');
  });

  it('keeps the last snapshot visible with an explicit refresh error and a working retry', async () => {
    f.monitoring.refreshError = 'Die Verbindung ist unterbrochen.'; await render();
    expect(host.textContent).toContain('Erika Beispiel'); expect(host.textContent).toContain('Die Verbindung ist unterbrochen.');
    await press('Live-Status aktualisieren'); expect(f.monitoring.refresh).toHaveBeenCalledOnce();
  });

  it('filters status and keeps an explicitly selected assignment on the map even without GPS', async () => {
    await render(); await change('Einsatzstatus filtern', 'active');
    expect(host.textContent).toContain('Bea Muster'); expect(host.textContent).not.toContain('Erika Beispiel');
    await press('Filter zurücksetzen'); await press('Auf Karte auswählen: Erika Beispiel');
    expect(f.map.row.assignmentId).toBe('assignment-a'); expect(f.map.row.tracking).toBeNull();
    await act(async () => f.map.onMarkerSelect('outside-current-results'));
    expect(f.map.row.assignmentId).toBe('assignment-a');
  });

  it('exposes later assignments through a real load-more action', async () => {
    f.monitoring.overview = overview(Array.from({ length: 22 }, (_, index) => row({ assignmentId: `assignment-${index}`, visitId: `visit-${index}`, clientName: `Beispiel ${index}` })));
    await render(); expect(host.querySelectorAll('article')).toHaveLength(20);
    await press('Weitere Einsätze anzeigen'); expect(host.querySelectorAll('article')).toHaveLength(22);
    expect(button('Weitere Einsätze anzeigen')).toBeUndefined();
  });

  it('discards an old source callback after tenant or permission changes', async () => {
    await render(); const oldCallback = f.inbox.onChanged; const oldCount = f.inbox.onCountChange;
    f.denied.add('assist.assignments.manage'); await render();
    await act(async () => { oldCallback(); oldCount(99); });
    expect(f.monitoring.refresh).not.toHaveBeenCalled(); expect(f.notify).not.toHaveBeenCalled();
    expect(host.querySelector('.ls-tab-count')?.textContent).not.toBe('99');
  });

  it('shows an unknown captured duration as unavailable instead of inventing zero', async () => {
    const active = row({ status: 'gestartet', displayStatus: 'gestartet', tracking: {
      assignmentId: 'assignment-a', tenantId: 'tenant-a', status: 'gestartet', consent: { granted: false, grantedAt: null, explainedAt: null },
      gpsPermission: 'undetermined', trackingActive: false, lastPosition: null, geofence: null, warnings: [], arrivalProof: null, assistVisible: false, clientPortalVisible: false,
      timers: { driveSeconds: null, serviceSeconds: 120, pauseSeconds: 0, activeTimer: 'service', driveStartedAt: null, serviceStartedAt: '2026-10-17T07:58:00Z', pauseStartedAt: null },
    } });
    f.monitoring.overview = overview([active]); await render();
    const drive = [...host.querySelectorAll('dt')].find(element => element.textContent === 'Anfahrt');
    expect(drive?.nextElementSibling?.textContent).toBe('—');
    expect(host.textContent).toContain('00:02:00');
  });
});
