// @vitest-environment happy-dom
// Functional interaction evidence; this DOM environment does not verify visual layout.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

const h = vi.hoisted(() => ({
  focused: true, params: {} as Record<string, string>, tenant: 'tenant-a', correctAllowed: true,
  read: vi.fn(), audit: vi.fn(), review: vi.fn(), correct: vi.fn(), confirm: vi.fn(), setParams: vi.fn(), dispatch: vi.fn(), onChanged: vi.fn(), live: vi.fn(),
  feedback: { showLoading: vi.fn(), dismiss: vi.fn(), showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() },
  guardEnabled: false, guard: null as null | ((event: { data: { action: unknown } }) => void),
}));
vi.mock('expo-router', () => ({ useIsFocused: () => h.focused, useNavigation: () => ({ dispatch: h.dispatch }), useRouter: () => ({ setParams: h.setParams }), useLocalSearchParams: () => h.params }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: (enabled: boolean, callback: typeof h.guard) => { h.guardEnabled = enabled; h.guard = callback; } }));
vi.mock('@/components/ui', () => ({ useWorkflowFeedback: () => h.feedback }));
vi.mock('@/components/layout/platform', () => ({ PlatformModal: (props: { visible: boolean; onClose: () => void; children: React.ReactNode; dismissOnBackdrop: boolean }) => props.visible ? <div role="dialog" data-backdrop-dismissible={props.dismissOnBackdrop}><button type="button" onClick={props.onClose}>Dialog schließen</button>{props.children}</div> : null }));
vi.mock('@/lib/wfm/wfmOfficeTimekeepingService.web', () => ({ getWfmOfficeTimeOverview: (...args: unknown[]) => h.read(...args), reviewWfmOfficeTimeEntry: (...args: unknown[]) => h.review(...args), applyWfmOfficeTimeCorrection: (...args: unknown[]) => h.correct(...args) }));
vi.mock('@/lib/wfm/wfmOfficeAuditReader.web', () => ({ listOfficeWebAudit: (...args: unknown[]) => h.audit(...args) }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: (...args: unknown[]) => h.confirm(...args) }));
vi.mock('@/lib/realtime/presets', () => ({ subscribeToWfmLiveChanges: vi.fn() }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: (options: unknown) => { h.live(options); return { isLiveConnected: false }; } }));
vi.mock('@/lib/services/queryTimeout', () => ({ NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000, withServiceQueryTimeout: (promise: Promise<unknown>) => promise }));
import { WfmOfficeTimeHistoryPanel } from '@/components/wfm/WfmOfficeTimeHistoryPanel.web';

const NOW = Date.parse('2026-10-18T08:00:00Z');
function entry(id = 'one', patch: Partial<WfmOfficeTimeEntry> = {}): WfmOfficeTimeEntry {
  return { id, tenantId: 'tenant-a', employeeId: 'employee-' + id, employeeName: 'Person ' + id, workDate: '2026-10-17', assignmentId: null, visitId: null, clientLabel: 'Klient ' + id, plannedStartAt: '2026-10-17T08:00:00Z', plannedEndAt: '2026-10-17T10:00:00Z', actualStartAt: '2026-10-17T08:00:00Z', actualEndAt: '2026-10-17T10:00:00Z', startDeviationMinutes: 0, endDeviationMinutes: 0, startAmpel: 'green', endAmpel: 'green', overallAmpel: 'green', startJustification: null, endJustification: null, startJustificationAt: null, endJustificationAt: null, pauseMinutes: 15, grossMinutes: 120, netMinutes: 105, travelMinutes: null, workKind: 'buero', status: 'pending_review', source: 'office', reviewStatus: 'pending_review', exportStatus: 'not_exported', sessionId: null, officeComment: null, hasOpenOfficeMessage: false, flags: [], canApprove: true, canEdit: true, canReject: true, canRequestClarification: true, ...patch };
}
const ok = <T,>(data: T) => ({ ok: true as const, data });
const overview = (entries: WfmOfficeTimeEntry[]) => ({ entries, employees: entries.map(item => ({ id: item.employeeId, name: item.employeeName })), period: { preset: 'custom', fromDate: '2026-10-01', toDate: '2026-10-31' }, kpis: { pendingReviewCount: entries.filter(item => item.reviewStatus === 'pending_review').length, missingBookings: 0, unplannedBookings: 0, planningDeviations: 0, totalHours: 3.5, exportedCount: 0 } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let host: HTMLDivElement; let root: Root; let rows: WfmOfficeTimeEntry[];
async function render(extra: Partial<React.ComponentProps<typeof WfmOfficeTimeHistoryPanel>> = {}) {
  await act(async () => root.render(<WfmOfficeTimeHistoryPanel tenantId={h.tenant} reviewerId="reviewer-a" roleKey="business_admin" canCorrect={h.correctAllowed} onChanged={h.onChanged} {...extra} />));
}
function button(name: string) { const found = [...host.querySelectorAll<HTMLButtonElement>('[role=dialog] button'), ...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === name || item.getAttribute('aria-label') === name); if (!found) throw new Error('Button fehlt: ' + name); return found; }
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
function field(name: string) { const label = [...host.querySelectorAll('label')].find(item => item.textContent?.trim().startsWith(name)); const input = label?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select'); if (!input) throw new Error('Feld fehlt: ' + name); return input; }
async function change(name: string, value: string) {
  const input = field(name); const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); h.focused = true; h.params = {}; h.tenant = 'tenant-a'; h.correctAllowed = true; h.guardEnabled = false; h.guard = null;
  rows = [entry(), entry('two'), entry('locked', { reviewStatus: 'locked' }), entry('planned', { actualStartAt: null, actualEndAt: null, rowKind: 'planned_upcoming' })];
  h.read.mockReset().mockImplementation(async () => ok(overview(rows))); h.audit.mockReset().mockResolvedValue(ok([]));
  h.review.mockReset().mockImplementation(async (_tenant: string, _actor: string, _role: string, id: string, decision: WfmOfficeTimeEntry['reviewStatus']) => { const result = { ...rows.find(item => item.id === id)!, reviewStatus: decision }; rows = rows.map(item => item.id === id ? result : item); return ok(result); });
  h.correct.mockReset().mockImplementation(async (_tenant: string, _actor: string, _role: string, input: { entryId: string; actualStartAt: string; actualEndAt: string; pauseMinutes: number; reason: string }) => { const result = { ...rows.find(item => item.id === input.entryId)!, actualStartAt: input.actualStartAt, actualEndAt: input.actualEndAt, pauseMinutes: input.pauseMinutes, reviewStatus: 'corrected' as const }; rows = rows.map(item => item.id === input.entryId ? result : item); return ok(result); });
  h.confirm.mockReset().mockResolvedValue(true); h.setParams.mockReset().mockImplementation((params: Record<string, string>) => { h.params = { ...h.params, ...params }; }); h.onChanged.mockReset().mockResolvedValue(undefined);
  vi.spyOn(Date, 'now').mockReturnValue(NOW); vi.spyOn(window, 'confirm').mockReturnValue(true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

describe('Arbeitszeit review web interactions', () => {
  it('selects and approves only eligible displayed entries, retaining failures for retry', async () => {
    await render(); const checks = [...host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')]; expect(checks).toHaveLength(4); expect(checks.map(item => item.disabled)).toEqual([false, false, true, true]);
    await click(button('Alle auswählen')); expect(button('Auswahl genehmigen (2)').disabled).toBe(false);
    h.review.mockImplementation(async (_tenant: string, _actor: string, _role: string, id: string) => id === 'one' ? ok(entry('one', { reviewStatus: 'approved' })) : { ok: false, error: 'Prüfung abgewiesen' });
    await click(button('Auswahl genehmigen (2)'));
    expect(h.review.mock.calls.map(call => call[3])).toEqual(['one', 'two']); expect(h.feedback.showSuccess).not.toHaveBeenCalled(); expect(h.feedback.showWarning.mock.calls[0][0]).toContain('1 genehmigt, 1 nicht genehmigt');
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Person two, 17.10.2026 auswählen"]')?.checked).toBe(true);
  });
  it('does not report success when the server returns an unconfirmed decision', async () => {
    await render(); await click(button('Details: Person one, 17.10.2026')); h.review.mockResolvedValue(ok(entry('one')));
    await click(button('Genehmigen')); expect(h.feedback.showSuccess).not.toHaveBeenCalled(); expect(h.feedback.showError).toHaveBeenCalledWith(expect.stringContaining('nicht bestätigt'), 'Prüfung kontrollieren'); expect(host.querySelector('[role=dialog]')).not.toBeNull();
  });
  it('saves correction drafts, prevents review before save, and preserves input on a failed write', async () => {
    await render(); await click(button('Details: Person one, 17.10.2026')); await change('Pause in Minuten', '20'); await change('Begründung der Korrektur', 'Pause ergänzt');
    expect(button('Genehmigen').disabled).toBe(true); h.correct.mockResolvedValueOnce({ ok: false, error: 'Korrektur abgewiesen' }); await click(button('Korrektur speichern'));
    expect(field('Begründung der Korrektur').value).toBe('Pause ergänzt'); expect(field('Pause in Minuten').value).toBe('20'); expect(h.feedback.showSuccess).not.toHaveBeenCalled();
    await click(button('Korrektur speichern')); expect(h.correct.mock.calls[1][3]).toMatchObject({ pauseMinutes: 20, reason: 'Pause ergänzt' }); expect(field('Begründung der Korrektur').value).toBe(''); expect(button('Genehmigen').disabled).toBe(false);
  });
  it('keeps a dirty modal open after canceled close, and ignores close or repeat save while busy', async () => {
    await render(); await click(button('Details: Person one, 17.10.2026')); await change('Begründung der Korrektur', 'Korrektur prüfen');
    expect(host.querySelector('[role=dialog]')?.getAttribute('data-backdrop-dismissible')).toBe('false'); h.confirm.mockResolvedValueOnce(false); await click(button('Dialog schließen')); expect(host.querySelector('[role=dialog]')).not.toBeNull(); expect(h.guardEnabled).toBe(true);
    const pending = deferred<ReturnType<typeof ok<WfmOfficeTimeEntry>>>(); h.correct.mockReturnValueOnce(pending.promise);
    await act(async () => { const save = button('Korrektur speichern'); save.click(); save.click(); }); expect(h.correct).toHaveBeenCalledTimes(1);
    await click(button('Dialog schließen')); expect(host.querySelector('[role=dialog]')).not.toBeNull();
    await act(async () => pending.resolve(ok(entry('one', { reviewStatus: 'corrected' })))); await click(button('Dialog schließen')); expect(host.querySelector('[role=dialog]')).toBeNull();
  });
  it('discards old tenant state and ignores a late mutation response', async () => {
    await render(); await click(button('Details: Person one, 17.10.2026')); await change('Begründung der Korrektur', 'Alter Mandant'); const pending = deferred<ReturnType<typeof ok<WfmOfficeTimeEntry>>>(); h.correct.mockReturnValueOnce(pending.promise); await click(button('Korrektur speichern'));
    h.tenant = 'tenant-b'; rows = [entry('new', { tenantId: 'tenant-b' })]; await render(); expect(host.querySelector('[role=dialog]')).toBeNull();
    await act(async () => pending.resolve(ok(entry('one', { reviewStatus: 'corrected' })))); expect(h.feedback.showSuccess).not.toHaveBeenCalled(); expect(h.onChanged).not.toHaveBeenCalled(); expect(host.querySelector('tbody')?.textContent).not.toContain('Person one');
  });
  it('keeps confirmed saves successful when a refresh fails and shows audit errors', async () => {
    h.audit.mockResolvedValue({ ok: false, error: 'Audit nicht freigegeben' }); await render(); await click(button('Details: Person one, 17.10.2026')); expect(host.textContent).toContain('Änderungsverlauf konnte nicht vollständig geladen');
    await change('Begründung der Korrektur', 'Pause geprüft'); h.read.mockResolvedValue({ ok: false, error: 'Abruf abgewiesen' }); await click(button('Korrektur speichern'));
    expect(h.feedback.showSuccess).toHaveBeenCalled(); expect(h.feedback.showWarning).toHaveBeenCalledWith(expect.stringContaining('Änderung ist gespeichert'), 'Übersicht aktualisieren'); expect(h.feedback.showError).not.toHaveBeenCalled();
  });
  it('restores month and employee links, persists active filters and follows navigation back', async () => {
    h.params = { month: '2026-09', employeeId: 'employee-one', filter: 'pending' }; await render();
    expect(h.read).toHaveBeenCalledWith('tenant-a', 'business_admin', expect.objectContaining({ preset: 'custom', fromDate: '2026-09-01', toDate: '2026-09-30', filters: { employeeIds: ['employee-one'], onlyPendingReview: true } }));
    await change('Prüffilter', 'rot_blau'); expect(h.setParams).toHaveBeenLastCalledWith(expect.objectContaining({ month: '2026-09', employeeId: 'employee-one', filter: 'rot_blau' }));
    h.params = { preset: 'today', filter: 'all' }; await render(); expect(field('Zeitraum').value).toBe('today'); expect(field('Mitarbeitende').value).toBe('');
  });
  it('does not modify the URL when embedded or outside the active workspace', async () => {
    await render({ period: { preset: 'custom', fromDate: '2026-10-01', toDate: '2026-10-31' }, lockEmployeeFilter: true, initialEmployeeId: 'employee-one', onEditorStateChange: vi.fn() });
    await change('Prüffilter', 'rot_blau'); expect(h.setParams).not.toHaveBeenCalled();
    h.focused = false; await render(); await change('Prüffilter', 'pending'); expect(h.setParams).not.toHaveBeenCalled();
  });
  it('loads pending reviews for the exact cross-month range of an account link', async () => {
    h.params = { preset: 'custom', month: '2026-09', from: '2026-09-28', to: '2026-10-04', employeeId: 'employee-one', filter: 'pending' };
    await render({ reviewQueueMode: true, initialFilterAmpel: 'pending' });
    expect(h.read).toHaveBeenCalledWith('tenant-a', 'business_admin', expect.objectContaining({ preset: 'custom', fromDate: '2026-09-28', toDate: '2026-10-04', filters: { employeeIds: ['employee-one'], onlyPendingReview: true } }));
    expect(field('Prüffilter').value).toBe('pending');
  });
  it('disables exported entries independently of misleading editable flags', async () => {
    rows = [entry('exported', { exportStatus: 'exported', canEdit: true, canApprove: true })]; await render(); await click(button('Details: Person exported, 17.10.2026'));
    expect(button('Genehmigen').disabled).toBe(true); expect(button('Korrektur speichern').disabled).toBe(true); expect(host.textContent).toContain('exportiert oder gesperrt');
  });
});
