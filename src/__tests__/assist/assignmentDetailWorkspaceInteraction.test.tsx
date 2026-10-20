// @vitest-environment happy-dom
// Real Web detail UI + query/mutation hooks. These interactions do not prove CSS layout.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import type { RoleKey } from '@/types';

const f = vi.hoisted(() => ({
  tenant: 'tenant-a', actor: 'actor-a', readonly: false, allowed: true,
  roleKey: 'business_admin' as RoleKey | null, canView: true, canManage: true,
  read: vi.fn(), status: vi.fn(), remove: vi.fn(), history: vi.fn(), task: vi.fn(),
  push: vi.fn(), replace: vi.fn(), deleted: vi.fn(), edit: vi.fn(), notify: vi.fn(), dispatch: vi.fn(), prevent: vi.fn(), confirm: vi.fn(), taskProps: {} as any,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() {} }) } }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: f.push, replace: f.replace }), useNavigation: () => ({ dispatch: f.dispatch }) }));
vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: f.prevent }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: f.confirm }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children }: any) => <main>{children}</main> }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.actor, roleKey: f.roleKey } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (key: string) => key === 'assist.assignments.view' ? f.canView : key === 'assist.assignments.manage' ? f.canManage : f.allowed, isReadOnly: f.readonly, roleKey: f.roleKey }) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ useLiveRefresh: () => ({ isLiveConnected: false }), DEFAULT_LIVE_POLL_MS: 30000 }));
vi.mock('@/hooks/core', async () => ({ useAsyncQuery: (await import('@/hooks/core/useAsyncQuery')).useAsyncQuery, useMutation: (await import('@/hooks/core/useMutation')).useMutation }));
vi.mock('@/lib/assist/visitService', () => ({ fetchVisitDispositionDetail: f.read, updateVisitDispositionStatus: f.status }));
vi.mock('@/lib/assist', () => ({ deleteVisitDisposition: f.remove, fetchVisitStatusHistory: f.history, updateVisitTaskStatus: f.task, buildVisitProofPreview: () => ({ title: 'Nachweis' }) }));
vi.mock('@/lib/wfm/wfmOfficeDataChanged', () => ({ notifyWfmOfficeDataChanged: f.notify }));
vi.mock('@/components/assist/VisitProofPreviewPanel', () => ({ VisitProofPreviewPanel: () => <span>Nachweisvorschau</span> }));
vi.mock('@/components/assist/VisitInternalAttachmentsPanel', () => ({ VisitInternalAttachmentsPanel: () => <span>Anhänge</span> }));
vi.mock('@/components/assist/VisitTasksPanel.web', () => ({ VisitTasksPanel: (props: any) => {
  f.taskProps = props;
  return <button disabled={props.disabled || props.actionLoading} onClick={() => void props.onUpdateTask('task-a', 'done').catch(() => {})}>Aufgabe speichern</button>;
} }));
import { AssignmentDetailTabsPanel } from '@/components/assist/AssignmentDetailTabsPanel.web';

const visit = (overrides: Partial<VisitDispositionDetail> = {}): VisitDispositionDetail => ({
  id: 'visit-a', tenantId: f.tenant, title: 'Alltagsbegleitung', serviceName: 'Haushalt', clientName: 'Anna Muster',
  employeeName: 'Tom Test', clientId: 'client-a', employeeId: 'employee-a', scheduledStart: '2026-10-16T08:00:00Z',
  scheduledEnd: '2026-10-16T09:00:00Z', durationMinutes: 60, status: 'aktiv', assignmentStatus: 'geplant',
  planningStatus: 'scheduled', executionStatus: 'pending', proofStatus: 'none', documentationStatus: 'none',
  billingStatus: 'none', portalStatus: 'none', location: 'Herne', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
  allowedStatusTransitions: ['bestaetigt', 'storniert'], tasks: [{ id: 'task-a', title: 'Einkauf', status: 'open', isRequired: true, notDoneReason: null }],
  ...overrides,
} as VisitDispositionDetail);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); f.tenant = 'tenant-a'; f.actor = 'actor-a'; f.readonly = false; f.allowed = true; f.roleKey = 'business_admin'; f.canView = true; f.canManage = true;
  f.read.mockImplementation(async () => ({ ok: true, data: visit() }));
  f.status.mockResolvedValue({ ok: false, error: 'Statusänderung nicht erlaubt' });
  f.remove.mockResolvedValue({ ok: true, data: { id: 'visit-a' } });
  f.task.mockImplementation(async (_visitId, taskId, _tenantId, status, _role, reason) => ({ ok: true, data: visit({ tasks: [{ id: taskId, title: 'Einkauf', status, isRequired: true, notDoneReason: reason ?? null }] }) }));
  f.history.mockResolvedValue({ ok: true, data: [] }); f.confirm.mockResolvedValue(false);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function mount(props: Partial<React.ComponentProps<typeof AssignmentDetailTabsPanel>> = {}) {
  await act(async () => root.render(<AssignmentDetailTabsPanel assignmentId="visit-a" onDeleted={f.deleted} onEdit={f.edit} {...props}/>));
}
function button(label: string) { const found = [...host.querySelectorAll('button')].find(b => b.textContent === label); expect(found, label).toBeTruthy(); return found!; }
async function click(label: string) { await act(async () => button(label).click()); }

describe('Web assignment detail interactions', () => {
  it('keeps the detail visible after a rejected status write and permits retry', async () => {
    await mount(); await click('Bestätigt');
    expect(f.status).toHaveBeenCalledOnce(); expect(host.textContent).toContain('Statusänderung nicht erlaubt');
    expect(host.textContent).toContain('Anna Muster'); expect(host.textContent).not.toContain('erfolgreich');
    expect(button('Bestätigt').disabled).toBe(false);
  });
  it('does not expose write actions without assignment manage or execution permission', async () => {
    f.readonly = true; f.canManage = false; f.allowed = false; await mount();
    expect(host.textContent).toContain('Lesemodus');
    expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Einsatz löschen')).toBe(false);
    expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Bearbeiten')).toBe(false);
    await click('Aufgaben'); expect(button('Aufgabe speichern').disabled).toBe(true);
    expect(f.status).not.toHaveBeenCalled(); expect(f.task).not.toHaveBeenCalled();
  });
  it('lets dispatch edit and change status while Office master data is read-only', async () => {
    f.roleKey = 'dispatch'; f.readonly = true; await mount(); await click('Bearbeiten');
    expect(f.edit).toHaveBeenCalledWith(expect.objectContaining({ id: 'visit-a' }));
    await click('Bestätigt'); expect(f.status).toHaveBeenCalledWith('visit-a', 'tenant-a', 'bestaetigt', 'dispatch');
    expect(host.textContent).not.toContain('Lesemodus');
  });
  it('lets dispatch save execution tasks with read-only Office data and without assignment manage permission', async () => {
    f.roleKey = 'dispatch'; f.readonly = true; f.canManage = false; await mount();
    expect(host.textContent).not.toContain('Lesemodus');
    expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Bearbeiten')).toBe(false);
    await click('Aufgaben'); expect(button('Aufgabe speichern').disabled).toBe(false);
    await click('Aufgabe speichern');
    expect(f.task).toHaveBeenCalledWith('visit-a', 'task-a', 'tenant-a', 'done', 'dispatch', undefined);
    expect(host.textContent).toContain('Aufgabe gespeichert.');
    f.allowed = false; await mount();
    expect(button('Aufgabe speichern').disabled).toBe(true);
    await act(async () => { await expect(f.taskProps.onUpdateTask('task-a', 'done')).rejects.toThrow('Die Aufgabe kann derzeit nicht geändert werden.'); });
    expect(f.task).toHaveBeenCalledOnce();
  });
  it('does not grant task writes from assignment manage permission alone', async () => {
    f.allowed = false; await mount(); await click('Aufgaben');
    expect(button('Aufgabe speichern').disabled).toBe(true);
    await act(async () => { await expect(f.taskProps.onUpdateTask('task-a', 'done')).rejects.toThrow('Die Aufgabe kann derzeit nicht geändert werden.'); });
    expect(f.task).not.toHaveBeenCalled();
  });
  it('does not load details when assignment view is absent even if manage is granted', async () => {
    f.canView = false; await mount();
    expect(f.read).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled();
    expect(host.textContent).toContain('keine Berechtigung');
  });
  it.each(['employee_portal', 'client_portal', 'family_portal', null] as const)('does not expose administrative details to a %s session with stale permissions', async (roleKey) => {
    f.roleKey = roleKey; await mount();
    expect(f.read).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled(); expect(f.task).not.toHaveBeenCalled();
    expect(host.textContent).toContain('keine Berechtigung');
  });
  it('removes status, edit and delete confirmation actions after manage permission is revoked', async () => {
    await mount(); await click('Einsatz löschen'); f.canManage = false; await mount();
    expect([...host.querySelectorAll('button')].some(b => ['Bestätigt', 'Bearbeiten', 'Endgültig löschen'].includes(b.textContent ?? ''))).toBe(false);
    expect(f.status).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
  });
  it('disables execution and task edits for cancelled visits', async () => {
    f.read.mockResolvedValue({ ok: true, data: visit({ assignmentStatus: 'storniert', executionStatus: 'cancelled' }) });
    await mount(); expect(host.textContent).toContain('Durchführung und Aufgabenänderungen sind gesperrt');
    expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Durchführung öffnen')).toBe(false);
    await click('Aufgaben'); expect(button('Aufgabe speichern').disabled).toBe(true);
  });
  it.each([{ assignmentStatus: 'abgeschlossen' }, { proofStatus: 'signed' }, { proofStatus: 'verified' }])('protects finalized task data for %j', async patch => {
    f.read.mockResolvedValue({ ok: true, data: visit(patch as Partial<VisitDispositionDetail>) });
    await mount(); await click('Aufgaben'); expect(button('Aufgabe speichern').disabled).toBe(true);
    expect(host.textContent).toContain('Korrekturen erfolgen über die administrative Nachbearbeitung'); expect(f.task).not.toHaveBeenCalled();
  });
  it('keeps unsaved task corrections on the current tab until leaving is confirmed', async () => {
    await mount(); await click('Aufgaben'); await act(async () => f.taskProps.onDirtyChange(true));
    await click('Planung'); expect(f.confirm).toHaveBeenCalledOnce(); expect(button('Aufgaben').getAttribute('aria-selected')).toBe('true');
    f.confirm.mockResolvedValue(true); await click('Planung'); expect(button('Planung').getAttribute('aria-selected')).toBe('true');
  });
  it('requires explicit delete confirmation and rejects two synchronous confirmations', async () => {
    const pending = deferred<any>(); f.remove.mockReturnValue(pending.promise);
    await mount(); await click('Einsatz löschen'); expect(f.remove).not.toHaveBeenCalled();
    const confirm = button('Endgültig löschen'); await act(async () => { confirm.click(); confirm.click(); });
    expect(f.remove).toHaveBeenCalledTimes(1); expect(f.remove).toHaveBeenCalledWith('visit-a', 'tenant-a', 'business_admin', 'this_only');
    await act(async () => pending.resolve({ ok: true, data: { id: 'visit-a' } }));
    expect(f.deleted).toHaveBeenCalledOnce(); expect(host.textContent).toContain('Der Einsatz wurde gelöscht.');
  });
  it('shows a failed deletion and keeps the same record available for retry', async () => {
    f.remove.mockResolvedValue({ ok: false, error: 'Nachweise verhindern das Löschen' });
    await mount(); await click('Einsatz löschen'); await click('Endgültig löschen');
    expect(host.textContent).toContain('Nachweise verhindern das Löschen'); expect(host.textContent).toContain('Anna Muster');
    expect(button('Endgültig löschen').disabled).toBe(false); expect(f.deleted).not.toHaveBeenCalled();
  });
  it('ignores late delete success after the company changes', async () => {
    const pending = deferred<any>(); f.remove.mockReturnValue(pending.promise);
    await mount(); await click('Einsatz löschen'); await click('Endgültig löschen');
    f.tenant = 'tenant-b'; await mount();
    await act(async () => pending.resolve({ ok: true, data: { id: 'visit-a' } }));
    expect(f.deleted).not.toHaveBeenCalled(); expect(f.notify).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Der Einsatz wurde gelöscht.'); expect(host.textContent).toContain('Anna Muster');
  });
  it('does not claim task success if the required readback fails', async () => {
    await mount(); await click('Aufgaben'); f.read.mockResolvedValue({ ok: false, error: 'Keine Freigabe' });
    await click('Aufgabe speichern'); expect(f.task).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Aktualisierung nicht bestätigt'); expect(host.textContent).not.toContain('Aufgabe gespeichert.');
    expect(button('Aufgabe speichern').disabled).toBe(false);
  });
  it('does not report success when a concurrent signature makes the task update affect zero rows', async () => {
    const pending = deferred<any>(); f.task.mockReturnValueOnce(pending.promise);
    await mount(); await click('Aufgaben'); await click('Aufgabe speichern');
    await act(async () => pending.resolve({ ok: true, data: visit({ proofStatus: 'signed', assignmentStatus: 'abgeschlossen' }) }));
    expect(f.task).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Die Aufgabenänderung wurde nicht übernommen.');
    expect(host.textContent).not.toContain('Aufgabe gespeichert.');
    expect(f.notify).not.toHaveBeenCalled(); expect(f.read).toHaveBeenCalledOnce();
    expect(button('Aufgabe speichern').disabled).toBe(false);
  });
  it('requires the requested reason to be present in the returned persisted task', async () => {
    await mount(); await click('Aufgaben');
    f.task.mockResolvedValueOnce({ ok: true, data: visit({ tasks: [{ id: 'task-a', title: 'Einkauf', status: 'partial', isRequired: true, notDoneReason: 'Alter Grund' }] }) });
    await act(async () => {
      await expect(f.taskProps.onUpdateTask('task-a', 'partial', 'Neuer Grund')).rejects.toThrow('Die Aufgabenänderung wurde nicht übernommen.');
    });
    expect(host.textContent).not.toContain('Aufgabe gespeichert.');
    expect(f.notify).not.toHaveBeenCalled();
  });
  it('loads the status history only on demand and recovers from a failed history read', async () => {
    await mount(); expect(f.history).not.toHaveBeenCalled();
    f.history.mockResolvedValueOnce({ ok: false, error: 'Verlauf nicht freigegeben' }); await click('Verlauf');
    expect(host.textContent).toContain('Verlauf nicht freigegeben');
    await click('Erneut laden'); expect(host.textContent).toContain('Noch keine Statusänderungen protokolliert.');
    expect(f.history).toHaveBeenCalledTimes(2);
  });
});
