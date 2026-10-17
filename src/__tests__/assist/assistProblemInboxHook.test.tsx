// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistProblemSnapshot } from '@/lib/assist/assistProblemWorkspaceService.web';
const mocks = vi.hoisted(() => ({ tenant: 'tenant-a', profile: 'profile-a', user: 'user-a', permissions: ['assist.assignments.view'], read: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: mocks.profile }, user: { id: mocks.user } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => mocks.tenant }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: 'business_admin', permissions: mocks.permissions }) }));
vi.mock('@/lib/assist/assistProblemWorkspaceService.web', () => ({ fetchAssistProblemSnapshot: mocks.read }));
import { useAssistProblemInbox } from '@/hooks/useAssistProblemInbox.web';
const pending = () => { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function snapshot(id = 'old', complete = true): AssistProblemSnapshot {
  return { items: id ? [{ id, tenantId: mocks.tenant, assignmentId: 'a1', visitId: 'v1', proofId: null, clientId: 'c1', employeeId: 'e1', clientName: 'Testklient', employeeName: 'Testperson', date: '2026-10-17', title: 'Einsatz', category: 'documentation', source: 'Dokumentation', code: 'ended_missing_documentation', message: 'Dokumentation fehlt.' }] : [], complete, checkedAssignments: 1, totalAssignments: 1, checkedAt: '2026-10-17T08:00:00Z', warnings: complete ? [] : ['Nachweise konnten nicht geprüft werden.'] };
}
let root: Root, host: HTMLDivElement, api: ReturnType<typeof useAssistProblemInbox>;
function Harness({ enabled = true, refreshToken = 0 }) { api = useAssistProblemInbox({ enabled, refreshToken }); return <span>{api.snapshot?.items.map(item => item.id).join(',')}</span>; }
async function render(enabled = true, refreshToken = 0) { await act(async () => root.render(<Harness enabled={enabled} refreshToken={refreshToken} />)); }
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); mocks.tenant = 'tenant-a'; mocks.profile = 'profile-a'; mocks.user = 'user-a'; mocks.permissions = ['assist.assignments.view'];
  mocks.read.mockResolvedValue({ ok: true, data: snapshot() }); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('Problem-Inbox Identität und erneute Prüfung', () => {
  it('entfernt fremde Daten sofort und verwirft verspätete Antworten nach Mandanten-/Personwechsel', async () => {
    await render(); expect(host.textContent).toBe('old');
    const old = pending(), current = pending(); mocks.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    mocks.tenant = 'tenant-b'; await render(); expect(api.snapshot).toBeNull();
    mocks.user = 'user-b'; await render(); await act(async () => old.resolve({ ok: true, data: snapshot('stale') })); expect(api.snapshot).toBeNull();
    await act(async () => current.resolve({ ok: true, data: snapshot('current') })); expect(host.textContent).toBe('current');
  });
  it('hält bei fehlgeschlagener Aktualisierung die letzte Prüfung mit sichtbarem Fehler', async () => {
    await render(); mocks.read.mockResolvedValue({ ok: false, error: 'Verbindung fehlgeschlagen' });
    let returned: AssistProblemSnapshot | null = snapshot(); await act(async () => { returned = await api.refresh(); });
    expect(returned).toBeNull(); expect(api.snapshot?.items[0].id).toBe('old'); expect(api.error).toBe('Verbindung fehlgeschlagen'); expect(api.refreshing).toBe(false);
  });
  it('lässt alte Probleme bei unvollständiger Prüfung nicht als gelöst verschwinden', async () => {
    await render(); mocks.read.mockResolvedValue({ ok: true, data: snapshot('', false) });
    await act(async () => { await api.refresh(); });
    expect(api.snapshot?.complete).toBe(false); expect(api.snapshot?.items[0]).toMatchObject({ id: 'old', unverified: true });
    mocks.read.mockResolvedValue({ ok: true, data: snapshot('', true) }); await act(async () => { await api.refresh(); });
    expect(api.snapshot?.items).toEqual([]);
  });
  it('verwirft alte Rechteergebnisse und lädt auch nach ausdrücklich ausgelöstem Refresh', async () => {
    await render(); const next = pending(); mocks.read.mockReturnValueOnce(next.promise); mocks.permissions = [];
    await render(); expect(api.snapshot).toBeNull(); await act(async () => next.resolve({ ok: false, error: 'Keine Berechtigung' })); expect(api.error).toBe('Keine Berechtigung');
    const before = mocks.read.mock.calls.length; mocks.permissions = ['assist.assignments.view']; await render(true, 1); expect(mocks.read.mock.calls.length).toBe(before + 1);
  });
  it('beendet Ladezustände bei fehlendem Mandant und verhindert Anfragen bei deaktivierter Inbox', async () => {
    mocks.tenant = ''; await render(); expect(api.loading).toBe(false); expect(api.error).toContain('Unternehmen'); expect(mocks.read).not.toHaveBeenCalled();
    mocks.tenant = 'tenant-a'; await render(false); expect(api.snapshot).toBeNull(); expect(api.loading).toBe(false); expect(mocks.read).not.toHaveBeenCalled();
  });
  it('lässt bei überlappenden Aktualisierungen ausschließlich die jüngste Antwort gelten', async () => {
    await render(); const older = pending(), newer = pending(); mocks.read.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    let first!: Promise<unknown>, second!: Promise<unknown>;
    await act(async () => { first = api.refresh(); second = api.refresh(); });
    await act(async () => { newer.resolve({ ok: true, data: snapshot('newer') }); await second; });
    await act(async () => { older.resolve({ ok: true, data: snapshot('older') }); await first; });
    expect(host.textContent).toBe('newer');
  });
});
