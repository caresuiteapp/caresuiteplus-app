// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WfmOfficeEmployeeTimeAccount } from '@/types/modules/wfmOfficeTimekeeping';

const h = vi.hoisted(() => ({
  focused: true, allowed: true, params: {} as Record<string, string>,
  push: vi.fn(), setParams: vi.fn(), read: vi.fn(), confirm: vi.fn(), close: vi.fn(),
}));
vi.mock('expo-router', () => ({ useIsFocused: () => h.focused, useLocalSearchParams: () => h.params, useNavigation: () => ({ dispatch: vi.fn() }), useRouter: () => ({ push: h.push, setParams: h.setParams }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ authReady: true, isAuthenticated: true, user: { id: 'reviewer' }, portalSession: false }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'tenant' }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: 'business_admin', permissions: ['time.tracking.team.view'], can: () => h.allowed }) }));
vi.mock('@/lib/wfm/wfmOfficeZeitkontenService.web', () => ({
  getWfmOfficeEmployeeTimeAccounts: (...args: unknown[]) => h.read(...args),
  listOpenReviewEntriesForEmployee: (account: WfmOfficeEmployeeTimeAccount) => account.entries.filter(entry => entry.reviewStatus === 'pending_review'),
}));
vi.mock('@/lib/payroll', () => ({ getPayrollPdfUrl: vi.fn() }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: (...args: unknown[]) => h.confirm(...args) }));
vi.mock('@/lib/realtime/presets', () => ({ subscribeToWfmLiveChanges: vi.fn() }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
vi.mock('@/components/layout/platform', () => ({ PlatformModal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? <div role="dialog">{children}</div> : null }));
vi.mock('@/components/wfm/WfmRuleWarningsPanel', () => ({ WfmRuleWarningsPanel: () => null }));
vi.mock('@/components/wfm/WfmOfficeManualEntryPanel.web', () => ({ WfmOfficeManualEntryPanel: () => null }));
vi.mock('@/components/wfm/WfmOfficeTimeHistoryPanel.web', () => ({
  WfmOfficeTimeHistoryPanel: (props: { onEditorStateChange: (state: { dirty: boolean; busy: boolean; childOpen: boolean }) => void }) => <div data-bookings="all">
    <button onClick={() => props.onEditorStateChange({ dirty: true, busy: false, childOpen: false })}>Entwurf ändern</button>
    <button onClick={() => props.onEditorStateChange({ dirty: false, busy: true, childOpen: true })}>Speicherung starten</button>
  </div>,
}));
import { WfmEmployeeTimeAccountWorkspace } from '@/components/wfm/WfmEmployeeTimeAccountWorkspace.web';
import { WfmZeitkontenScreen } from '@/components/wfm/TimeTrackingTeamScreen.web';

const period = { preset: 'custom' as const, fromDate: '2026-09-28', toDate: '2026-10-04' };
const account: WfmOfficeEmployeeTimeAccount = {
  employeeId: 'employee-one', employeeName: 'Anne Adler', plannedMinutes: 120, actualMinutes: 100,
  approvedMinutes: 0, exportedMinutes: 0, saldoMinutes: -20, openReviewCount: 1, targetMinutes: 120,
  overtimeMinutes: 0, undertimeMinutes: 20, travelMinutes: 0, absenceMinutes: 0, vacationDaysUsed: 0,
  sickDays: 0, annualVacationDays: null, remainingVacationDays: null, payrollStatements: [],
  entries: [{
    id: 'pending', tenantId: 'tenant', employeeId: 'employee-one', employeeName: 'Anne Adler', workDate: '2026-09-30',
    assignmentId: null, visitId: null, clientLabel: null, plannedStartAt: null, plannedEndAt: null,
    actualStartAt: '2026-09-30T08:00:00Z', actualEndAt: '2026-09-30T09:40:00Z',
    startDeviationMinutes: null, endDeviationMinutes: null, startAmpel: null, endAmpel: null, overallAmpel: null,
    startJustification: null, endJustification: null, startJustificationAt: null, endJustificationAt: null,
    pauseMinutes: 0, grossMinutes: 100, netMinutes: 100, travelMinutes: 0, workKind: 'buero',
    status: 'pending_review', source: 'office', reviewStatus: 'pending_review', exportStatus: 'not_exported',
    sessionId: null, officeComment: null, hasOpenOfficeMessage: false, flags: [],
  }],
};
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  h.focused = true; h.allowed = true; h.params = { month: '2026-09' };
  h.push.mockReset(); h.setParams.mockReset(); h.close.mockReset(); h.confirm.mockReset().mockResolvedValue(true);
  h.read.mockReset().mockResolvedValue({ ok: true, data: [account] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function workspace(value = account) {
  await act(async () => root.render(<WfmEmployeeTimeAccountWorkspace account={value} tenantId="tenant" reviewerId="reviewer" roleKey="business_admin" canCorrect canManage period={period} periodLabel="Diese Woche" onClose={h.close} />));
}
async function team() { await act(async () => root.render(<WfmZeitkontenScreen />)); }
function button(name: string) {
  const element = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(name) || item.getAttribute('aria-label') === name);
  if (!element) throw new Error('Schaltfläche fehlt: ' + name);
  return element;
}
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const reviewRoute = (from = period.fromDate, to = period.toDate) => ({
  pathname: '/business/office/time-tracking/pruefqueue',
  params: expect.objectContaining({ employeeId: 'employee-one', preset: 'custom', from, to, filter: 'pending' }),
});

describe('Zeitkonten: offene Prüfungen direkt erreichen', () => {
  it.each(['1 offene Prüfung', 'Offene Prüfungen öffnen'])('opens the pending queue from %s with the exact employee and cross-month range', async label => {
    await workspace(); await click(button(label));
    expect(h.push).toHaveBeenCalledExactlyOnceWith(reviewRoute()); expect(h.close).toHaveBeenCalledOnce();
  });
  it('opens all bookings separately from the pending queue', async () => {
    await workspace(); await click(button('Zeitbuchungen öffnen'));
    expect(host.querySelector('[data-bookings=all]')).not.toBeNull(); expect(h.push).not.toHaveBeenCalled();
  });
  it('preserves a dirty draft when leaving is canceled, and opens the queue after confirmation', async () => {
    await workspace(); await click(button('Zeitbuchungen öffnen')); await click(button('Entwurf ändern'));
    h.confirm.mockResolvedValueOnce(false); await click(button('1 offene Prüfung'));
    expect(h.push).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled();
    await click(button('1 offene Prüfung')); expect(h.push).toHaveBeenCalledWith(reviewRoute());
  });
  it('prevents navigation while a child review is saving', async () => {
    await workspace(); await click(button('Zeitbuchungen öffnen')); await click(button('Speicherung starten'));
    expect(button('1 offene Prüfung').disabled).toBe(true); await click(button('1 offene Prüfung'));
    expect(h.push).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled();
  });
  it('ignores navigation from a background account', async () => {
    await workspace(); h.focused = false; await workspace(); await click(button('1 offene Prüfung'));
    expect(h.push).not.toHaveBeenCalled(); expect(h.close).not.toHaveBeenCalled();
  });
  it('keeps the review page discoverable when the count is zero', async () => {
    await workspace({ ...account, entries: [], openReviewCount: 0 });
    expect(host.textContent).toContain('Keine offenen Prüfungen'); await click(button('Offene Prüfungen öffnen'));
    expect(h.push).toHaveBeenCalledWith(reviewRoute());
  });
  it('opens the selected employee queue from the table instead of all bookings', async () => {
    await team(); await click(button('1 offene Prüfung für Anne Adler'));
    expect(h.push).toHaveBeenCalledExactlyOnceWith(reviewRoute('2026-09-01', '2026-09-30'));
    expect(h.setParams).not.toHaveBeenCalled(); expect(host.querySelector('[role=dialog]')).toBeNull();
  });
  it('makes the entire review metric actionable and preserves the current person filter', async () => {
    h.params.employee = 'employee-one'; await team(); await click(button('Offene Prüfungen'));
    expect(h.push).toHaveBeenCalledExactlyOnceWith(reviewRoute('2026-09-01', '2026-09-30'));
  });
  it('does not grant access to time accounts without the existing permission', async () => {
    h.allowed = false; await team(); expect(h.read).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Verwaltungszugang'); expect(host.querySelector('.wta-kpi-action')).toBeNull();
  });
});
