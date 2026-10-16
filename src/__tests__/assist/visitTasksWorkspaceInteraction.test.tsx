// @vitest-environment happy-dom
// Interaction checks only; happy-dom does not provide visual layout verification.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
const h = vi.hoisted(() => ({ tenant: 'tenant-a', disabled: false, update: vi.fn(), load: vi.fn(), dirty: vi.fn() }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: 'actor-a', roleKey: 'business_admin' } }) }));
vi.mock('@/lib/assistCatalog', () => ({ loadCatalogItems: h.load }));
vi.mock('@/components/assist/AssignmentsWorkspaceShell.web', () => ({ AssignmentsWorkspaceStyles: () => null }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { addEventListener: () => ({ remove() { } }) } }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ useLiveRefresh: () => ({ isLiveConnected: false }), DEFAULT_LIVE_POLL_MS: 30000 }));
import { VisitTasksPanel } from '@/components/assist/VisitTasksPanel.web';
const visit = { id: 'visit-a', tasks: [{ id: 'task-a', title: 'Wohnung reinigen', status: 'open', isRequired: true }] } as VisitDispositionDetail;
let root: Root, host: HTMLDivElement;
const render = async () => { await act(async () => root.render(<VisitTasksPanel visit={visit} disabled={h.disabled} onUpdateTask={h.update} onDirtyChange={h.dirty}/>)); };
function button(text: string) { const value = [...host.querySelectorAll('button')].find(b => b.textContent === text); expect(value).toBeTruthy(); return value!; }
async function click(text: string) { await act(async () => button(text).click()); }
async function select(index: number, value: string) { const el = host.querySelectorAll('select')[index]!; await act(async () => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }); }
async function note(value: string) { const el = host.querySelector('textarea')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }); }
const defer = () => { let resolve!: (v?: unknown) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); h.tenant = 'tenant-a'; h.disabled = false; h.update.mockResolvedValue(undefined); h.load.mockResolvedValue({ ok: true, data: [{ id: 'reason-a', itemKey: 'abgelehnt', label: 'Klient:in wünscht die Aufgabe nicht' }, { id: 'reason-b', itemKey: 'sonstiger_grund', label: 'Sonstiger Grund' }] }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('Web assignment task edits', () => {
    it('loads choices once and persists a selected reason together with its explanatory note', async () => { await render(); expect(h.load).toHaveBeenCalledTimes(1); await click('Status bearbeiten'); await select(0, 'not_requested'); await select(1, 'abgelehnt'); await note('Heute ausdrücklich abgelehnt.'); await click('Aufgabe speichern'); expect(h.update).toHaveBeenCalledWith('task-a', 'not_requested', 'Klient:in wünscht die Aufgabe nicht — Heute ausdrücklich abgelehnt.', 'abgelehnt'); expect(host.querySelector('textarea')).toBeNull(); expect(h.dirty).toHaveBeenLastCalledWith(false); expect(h.load).toHaveBeenCalledTimes(1); });
    it('requires actual text for other reason instead of storing only the generic label', async () => { await render(); await click('Status bearbeiten'); await select(0, 'not_possible'); await select(1, 'sonstiger_grund'); expect(button('Aufgabe speichern').disabled).toBe(true); await note('Raum war nicht zugänglich.'); await click('Aufgabe speichern'); expect(h.update).toHaveBeenCalledWith('task-a', 'not_possible', 'Raum war nicht zugänglich.', 'sonstiger_grund'); });
    it('retains failed input for retry and rejects same-tick double submission', async () => { await render(); await click('Status bearbeiten'); await select(0, 'partial'); await note('Bad fehlt.'); h.update.mockRejectedValueOnce(new Error('Verbindung unterbrochen')); await click('Aufgabe speichern'); expect(host.textContent).toContain('Verbindung unterbrochen'); expect(host.querySelector('textarea')?.value).toBe('Bad fehlt.'); const pending = defer(); h.update.mockReturnValueOnce(pending.promise); const save = button('Aufgabe speichern'); await act(async () => { save.click(); save.click(); }); expect(h.update).toHaveBeenCalledTimes(2); await act(async () => pending.resolve()); expect(host.querySelector('textarea')).toBeNull(); });
    it('hides editing when permission is removed and prevents sending the previous draft', async () => { await render(); await click('Status bearbeiten'); h.disabled = true; await render(); expect(host.querySelector('select')).toBeNull(); expect(host.textContent).not.toContain('Status bearbeiten'); expect(h.update).not.toHaveBeenCalled(); });
    it('discards an old company draft and ignores its late completion', async () => { await render(); await click('Status bearbeiten'); const pending = defer(); h.update.mockReturnValueOnce(pending.promise); await click('Aufgabe speichern'); h.tenant = 'tenant-b'; await render(); await click('Status bearbeiten'); await select(0, 'partial'); await note('Neue Eingabe'); await act(async () => pending.resolve()); expect(host.querySelector('textarea')?.value).toBe('Neue Eingabe'); expect(h.load).toHaveBeenCalledTimes(2); });
    it('offers free text when catalog loading fails', async () => { h.load.mockResolvedValue({ ok: false, error: 'Nicht verfügbar' }); await render(); await click('Status bearbeiten'); await select(0, 'deferred'); await note('Nach Absprache auf nächste Woche verschoben.'); await click('Aufgabe speichern'); expect(h.update).toHaveBeenCalledWith('task-a', 'deferred', 'Nach Absprache auf nächste Woche verschoben.', undefined); });
});
