// @vitest-environment happy-dom
// Real panel and scoped query hook. Service boundaries are isolated; DOM does not prove visual layout.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistProblemItem, AssistProblemSnapshot } from '@/lib/assist/assistProblemWorkspaceService.web';
import type { PermissionKey } from '@/types/permissions';

const f = vi.hoisted(() => ({ tenant: 'tenant-a', actor: 'actor-a', user: 'user-a', permissions: [] as PermissionKey[], readOnly: false, fetch: vi.fn(), repair: vi.fn(), push: vi.fn(), count: vi.fn(), changed: vi.fn(), opened: vi.fn() }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => f.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: { id: f.actor, roleKey: 'business_admin' }, user: { id: f.user } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: (permission: PermissionKey) => f.permissions.includes(permission), permissions: f.permissions, roleKey: 'business_admin', isReadOnly: f.readOnly }) }));
vi.mock('@/hooks/useFlowRouter', () => ({ useFlowRouter: () => ({ push: f.push }) }));
vi.mock('@/lib/assist/assistProblemWorkspaceService.web', () => ({
  fetchAssistProblemSnapshot: f.fetch,
  runAssistProblemRepair: f.repair,
  getAssistProblemRepair: (item: AssistProblemItem, can: (p: PermissionKey) => boolean, readOnly = false) => !readOnly && !item.unverified && item.code === 'proof_missing_pdf' && can('assist.records.export') ? { id: 'generate_pdf', label: 'PDF erzeugen', description: 'Erzeugt die fehlende PDF aus dem vorhandenen Nachweis.' } : null,
}));
import { AssistExecutionProblemInboxPanel } from '@/components/assist/AssistExecutionProblemInboxPanel.web';

function item(values: Partial<AssistProblemItem> = {}): AssistProblemItem {
  return { id: 'problem-a', tenantId: f.tenant, code: 'ended_missing_documentation', assignmentId: 'assignment-a', visitId: 'visit-a', proofId: null, clientId: 'client-a', employeeId: 'employee-a', clientName: 'Anna Muster', employeeName: 'Sam Beispiel', date: '2026-10-16T08:00:00Z', title: 'Haushalt', message: 'Die Dokumentation fehlt.', category: 'documentation', source: 'Einsatzdokumentation', ...values };
}
function initialItems() { return [item(), item({ id: 'problem-budget', code: 'budget_ledger_missing', message: 'Budgetbuchung fehlt.', category: 'budget' }), item({ id: 'problem-pdf', assignmentId: 'assignment-b', visitId: 'visit-b', clientId: 'client-b', employeeId: 'employee-b', clientName: 'Berta Beispiel', employeeName: 'Kim Test', date: '2026-10-15T10:00:00Z', code: 'proof_missing_pdf', proofId: 'proof-b', category: 'proof', message: 'Die PDF-Datei fehlt.', source: 'Leistungsnachweis-PDF' })]; }
function snapshot(items = initialItems(), extra: Partial<AssistProblemSnapshot> = {}): AssistProblemSnapshot { return { items, complete: true, checkedAssignments: 9, totalAssignments: 9, checkedAt: '2026-10-17T08:30:00Z', warnings: [], ...extra }; }
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  f.tenant = 'tenant-a'; f.actor = 'actor-a'; f.user = 'user-a'; f.readOnly = false;
  f.permissions = ['assist.assignments.view', 'assist.execution.view', 'assist.records.view', 'assist.records.export'];
  f.fetch.mockImplementation(async () => ({ ok: true, data: snapshot() })); f.repair.mockResolvedValue({ ok: true, data: undefined });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(props: React.ComponentProps<typeof AssistExecutionProblemInboxPanel> = {}) { await act(async () => root.render(<AssistExecutionProblemInboxPanel onCountChange={f.count} onChanged={f.changed} {...props}/>)); }
function button(label: string) { const value = [...host.querySelectorAll('button')].find(element => element.textContent === label || element.getAttribute('aria-label') === label); expect(value, label).toBeTruthy(); return value!; }
async function click(label: string) { await act(async () => button(label).click()); }
async function expand(name: string) { const value = [...host.querySelectorAll<HTMLButtonElement>('.pbi-toggle')].find(element => element.getAttribute('aria-label')?.includes(name)); expect(value).toBeTruthy(); await act(async () => value!.click()); }
async function search(value: string) { const input = host.querySelector('input[type=search]')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); }
function employeePicker() { return host.querySelector<HTMLButtonElement>('[role=combobox][aria-label="Problem-Inbox nach Mitarbeitenden filtern"]')!; }
async function openEmployeePicker() { const picker = employeePicker(); expect(picker).toBeTruthy(); if (picker.getAttribute('aria-expanded') !== 'true') await act(async () => picker.click()); return picker; }
function employeeOptions(label: string) { return [...host.querySelectorAll<HTMLElement>('[role=option]')].filter(option => option.getAttribute('aria-label') === label || option.textContent?.trim() === label); }
async function employee(label: string, occurrence = 0) { await openEmployeePicker(); const option = employeeOptions(label)[occurrence]; expect(option, label).toBeTruthy(); await act(async () => option.click()); }
function names() { return [...host.querySelectorAll('.pbi-card-title')].map(element => element.textContent); }

describe('Problem inbox Web workflows and confirmed repair', () => {
  it('groups issues by assignment with names, dates and employee context', async () => {
    await render(); expect(names()).toEqual(['Anna Muster', 'Berta Beispiel']);
    expect(host.textContent).toContain('3 offene Punkte in 2 Einsätzen'); expect(host.textContent).toContain('16.10.2026'); expect(host.textContent).toContain('Sam Beispiel');
    await expand('Anna Muster'); expect(host.querySelectorAll('.pbi-issue')).toHaveLength(2); expect(host.textContent).toContain('Geprüft: Einsatzdokumentation'); expect(f.count).toHaveBeenLastCalledWith(3);
  });
  it('opens the selected canonical visit and routes each issue to its relevant workflow', async () => {
    await render({ onOpenAssignment: f.opened });
    await act(async () => host.querySelector<HTMLButtonElement>('.pbi-card-header>.pbi-button')!.click()); expect(f.opened).toHaveBeenCalledWith('visit-a');
    await expand('Anna Muster'); await click('Dokumentation bearbeiten'); expect(f.push).toHaveBeenLastCalledWith('/assist/assignments/visit-a/execute');
    await click('Budget prüfen'); expect(f.push).toHaveBeenLastCalledWith('/assist/assignments/visit-a?tab=budget');
    await expand('Berta Beispiel'); await click('Nachweis prüfen'); expect(f.push).toHaveBeenLastCalledWith('/assist/assignments/visit-b?tab=proof');
  });
  it('filters real category, employee and search controls and clears them together', async () => {
    await render(); await click('Budget1'); expect(names()).toEqual(['Anna Muster']); await employee('Kim Test'); expect(names()).toEqual([]);
    await click('Filter zurücksetzen'); await search('kim 15.10'); expect(names()).toEqual(['Berta Beispiel']);
    await click('Filter zurücksetzen'); expect(names()).toHaveLength(2);
  });
  it('distinguishes two employees with the same display name by id', async () => {
    f.fetch.mockResolvedValue({ ok: true, data: snapshot(initialItems().map(value => ({ ...value, employeeName: 'Alex Beispiel' }))) });
    await render(); await employee('Alex Beispiel', 1); expect(names()).toEqual(['Berta Beispiel']);
  });
  it('keeps the employee menu open and usable across parent rerenders and unchanged refresh results', async () => {
    await render({ refreshToken: 0 });
    const picker = await openEmployeePicker();
    picker.focus();
    await render({ refreshToken: 0 });
    expect(employeePicker()).toBe(picker);
    expect(document.activeElement).toBe(picker);
    expect(picker.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[role=listbox]')).not.toBeNull();

    // The service returns fresh objects while the user's selection menu is open.
    await render({ refreshToken: 1 });
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(employeePicker()).toBe(picker);
    expect(document.activeElement).toBe(picker);
    expect(picker.getAttribute('aria-expanded')).toBe('true');
    await employee('Kim Test');
    expect(names()).toEqual(['Berta Beispiel']);
    expect(picker.getAttribute('aria-expanded')).toBe('false');
    expect(picker.textContent).toContain('Kim Test');
    await click('Filter zurücksetzen');
    expect(picker.textContent).toContain('Alle Mitarbeitenden');
    expect(names()).toHaveLength(2);
  });
  it('updates options inside the open employee menu and keeps selection and reset functional', async () => {
    await render({ refreshToken: 0 });
    await employee('Kim Test');
    const picker = await openEmployeePicker();
    expect(employeeOptions('Kim Test')[0]?.getAttribute('aria-selected')).toBe('true');
    const refreshed = initialItems().map(value => value.employeeId === 'employee-b' ? { ...value, employeeName: 'Kim Neuer Name' } : value);
    refreshed.push(item({ id: 'problem-c', assignmentId: 'assignment-c', visitId: 'visit-c', clientName: 'Cora Beispiel', employeeId: 'employee-c', employeeName: 'Charlie Beispiel' }));
    f.fetch.mockResolvedValueOnce({ ok: true, data: snapshot(refreshed) });
    await render({ refreshToken: 1 });
    expect(employeePicker()).toBe(picker);
    expect(picker.getAttribute('aria-expanded')).toBe('true');
    expect(employeeOptions('Kim Neuer Name')[0]?.getAttribute('aria-selected')).toBe('true');
    expect(picker.textContent).toContain('Kim Neuer Name');
    expect(names()).toEqual(['Berta Beispiel']);
    await employee('Charlie Beispiel');
    expect(picker.getAttribute('aria-expanded')).toBe('false');
    expect(picker.textContent).toContain('Charlie Beispiel');
    expect(names()).toEqual(['Cora Beispiel']);
    await click('Filter zurücksetzen');
    expect(picker.textContent).toContain('Alle Mitarbeitenden');
    expect(names()).toHaveLength(3);
  });
  it('keeps the last result on refresh failure and allows a real retry', async () => {
    await render(); f.fetch.mockResolvedValueOnce({ ok: false, error: 'Die Verbindung ist unterbrochen.' }); await click('Erneut prüfen');
    expect(names()).toHaveLength(2); expect(host.textContent).toContain('Die Verbindung ist unterbrochen.'); expect(f.count).toHaveBeenLastCalledWith(null);
    f.fetch.mockResolvedValueOnce({ ok: true, data: snapshot([]) }); await click('Erneut prüfen');
    expect(names()).toHaveLength(0); expect(host.textContent).toContain('Keine offenen Punkte gefunden'); expect(f.count).toHaveBeenLastCalledWith(0);
  });
  it('does not announce a healthy inbox after a partial empty check', async () => {
    f.fetch.mockResolvedValue({ ok: true, data: snapshot([], { complete: false, warnings: ['Nachweise konnten nicht geladen werden.'] }) }); await render();
    expect(host.textContent).toContain('Nur teilweise geprüft'); expect(host.textContent).toContain('Bisher keine offenen Punkte gefunden'); expect(host.querySelector('[data-tone=healthy]')).toBeNull(); expect(f.count).toHaveBeenLastCalledWith(null);
  });
  it('serializes repair clicks and announces resolution only after checking the persisted source', async () => {
    const write = deferred(), recheck = deferred(); f.repair.mockReturnValue(write.promise); await render(); await expand('Berta Beispiel');
    await act(async () => { button('PDF erzeugen').click(); button('PDF erzeugen').click(); }); expect(f.repair).toHaveBeenCalledOnce();
    f.fetch.mockReturnValueOnce(recheck.promise); await act(async () => write.resolve({ ok: true, data: undefined }));
    expect(names()).toContain('Berta Beispiel'); expect(host.textContent).not.toContain('Der offene Punkt ist behoben.');
    await act(async () => recheck.resolve({ ok: true, data: snapshot(initialItems().filter(value => value.id !== 'problem-pdf')) }));
    expect(names()).not.toContain('Berta Beispiel'); expect(host.textContent).toContain('Erneut geprüft: Der offene Punkt ist behoben.'); expect(f.changed).toHaveBeenCalledOnce();
  });
  it('keeps an unsuccessful repair actionable without pretending to resolve it', async () => {
    f.repair.mockResolvedValueOnce({ ok: false, error: 'Die PDF konnte nicht gespeichert werden.' }); await render(); await expand('Berta Beispiel'); await click('PDF erzeugen');
    expect(names()).toContain('Berta Beispiel'); expect(host.textContent).toContain('Die PDF konnte nicht gespeichert werden.'); expect(f.changed).not.toHaveBeenCalled();
    await click('Nachweis prüfen'); expect(f.push).toHaveBeenLastCalledWith('/assist/assignments/visit-b?tab=proof');
  });
  it('reports a remaining cause after a technically successful action', async () => {
    await render(); await expand('Berta Beispiel'); await click('PDF erzeugen');
    expect(names()).toContain('Berta Beispiel'); expect(host.textContent).toContain('besteht dieser offene Punkt weiterhin'); expect(host.textContent).not.toContain('Der offene Punkt ist behoben.');
  });
  it('retains the issue when checking after a successful action fails', async () => {
    await render(); await expand('Berta Beispiel'); f.fetch.mockResolvedValueOnce({ ok: false, error: 'Prüfung nicht verfügbar.' }); await click('PDF erzeugen');
    expect(names()).toContain('Berta Beispiel'); expect(host.textContent).toContain('gilt noch nicht als erledigt');
  });
  it('retains an unresolved result from a partial recheck and disables unverified repairs', async () => {
    await render(); await expand('Berta Beispiel');
    f.fetch.mockResolvedValueOnce({ ok: true, data: snapshot([], { complete: false, warnings: ['Nachweise nicht erreichbar.'] }) });
    await click('PDF erzeugen');
    expect(names()).toContain('Berta Beispiel'); expect(host.textContent).toContain('Zuletzt erkannt; noch nicht erneut bestätigt.');
    expect([...host.querySelectorAll('button')].some(element => element.textContent === 'PDF erzeugen')).toBe(false);
    expect(host.textContent).toContain('3 zu prüfen'); expect(f.count).toHaveBeenLastCalledWith(null);
  });
  it('does not apply a late repair result after changing company', async () => {
    const pending = deferred(); f.repair.mockReturnValue(pending.promise); await render(); await expand('Berta Beispiel'); await click('PDF erzeugen');
    f.tenant = 'tenant-b'; f.fetch.mockResolvedValue({ ok: true, data: snapshot([]) }); await render(); const reads = f.fetch.mock.calls.length;
    await act(async () => pending.resolve({ ok: true, data: undefined })); expect(f.fetch).toHaveBeenCalledTimes(reads); expect(f.changed).not.toHaveBeenCalled(); expect(names()).toHaveLength(0);
  });
  it('discards expanded actions when actor permissions change and preserves read navigation', async () => {
    await render(); await expand('Berta Beispiel'); f.permissions = ['assist.assignments.view']; await render();
    expect(host.querySelector('.pbi-details')).toBeNull(); await expand('Anna Muster'); await click('Dokumentation bearbeiten'); expect(f.push).toHaveBeenLastCalledWith('/assist/assignments/visit-a?tab=execution');
    await expand('Berta Beispiel'); expect([...host.querySelectorAll('button')].some(element => element.textContent === 'PDF erzeugen')).toBe(false);
  });
  it('hides mutations for a read-only access while keeping the selected visit readable', async () => {
    f.readOnly = true; await render(); await expand('Berta Beispiel');
    expect([...host.querySelectorAll('button')].some(element => element.textContent === 'PDF erzeugen')).toBe(false);
    await click('Nachweis prüfen'); expect(f.push).toHaveBeenLastCalledWith('/assist/assignments/visit-b?tab=proof');
    await expand('Anna Muster'); expect(button('Dokumentation ansehen')).toBeTruthy(); expect(f.repair).not.toHaveBeenCalled();
  });
  it('invalidates a pending repair guard when only read-only access changes', async () => {
    const pending = deferred(); f.repair.mockReturnValue(pending.promise); await render(); await expand('Berta Beispiel'); await click('PDF erzeugen');
    const input = f.repair.mock.calls[0][0]; expect(input.isCurrent()).toBe(true); expect(input.actor.isReadOnly).toBe(false);
    f.readOnly = true; await render(); expect(input.isCurrent()).toBe(false);
    await act(async () => pending.resolve({ ok: false, error: 'Unterbrochen' })); expect(f.changed).not.toHaveBeenCalled(); expect(host.textContent).not.toContain('Unterbrochen');
    await expand('Berta Beispiel'); expect([...host.querySelectorAll('button')].some(element => element.textContent === 'PDF erzeugen')).toBe(false);
  });
  it('makes more than twelve affected assignments reachable without dropping them', async () => {
    f.fetch.mockResolvedValue({ ok: true, data: snapshot(Array.from({ length: 15 }, (_, index) => item({ id: `p-${index}`, assignmentId: `a-${index}`, visitId: `v-${index}`, clientName: `Beispiel ${index + 1}` }))) });
    await render(); expect(names()).toHaveLength(12); await click('Weitere Einsätze'); expect(names()).toEqual(['Beispiel 13', 'Beispiel 14', 'Beispiel 15']);
    await click('Vorherige Einsätze'); expect(names()).toHaveLength(12); expect(f.count).toHaveBeenLastCalledWith(15);
  });
  it('uses parent refresh tokens and never loads without the view permission', async () => {
    await render({ refreshToken: 0 }); expect(f.fetch).toHaveBeenCalledOnce(); await render({ refreshToken: 1 }); expect(f.fetch).toHaveBeenCalledTimes(2);
    f.permissions = []; await render({ refreshToken: 2 }); expect(f.fetch).toHaveBeenCalledTimes(2); expect(host.textContent).toContain('keine Berechtigung'); expect(names()).toHaveLength(0);
  });
});
