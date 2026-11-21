// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NeoActionsPanel } from '@/ai/neo/NeoActionsPanel';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const api = vi.hoisted(() => ({ create: vi.fn(), move: vi.fn(), can: true }));
vi.mock('@/ai/neo/neoUi', () => ({ PremiumButton: (p: any) => <button type="button" disabled={p.disabled} onClick={p.onPress}>{p.title}</button>, PremiumInput: (p: any) => <textarea aria-label={p.label} value={p.value} disabled={p.editable === false} onChange={e => p.onChangeText(e.target.value)} /> }));
vi.mock('@/ai/neo/NeoCommandRecorder', () => ({ NeoCommandRecorder: () => null }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => api.can }) }));
vi.mock('@/ai/neo/neoActionService', () => ({ createNeoAppointment: api.create, moveNeoVisit: api.move }));
vi.mock('@/lib/assist/visitService', () => ({ fetchVisitDispositionList: vi.fn(), fetchVisitDispositionDetail: vi.fn() }));
const scope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333' };
let root: Root, host: HTMLDivElement;
beforeEach(async () => { vi.resetAllMocks(); api.can = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root.render(<NeoActionsPanel scope={scope} role="business_admin" />)); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function click(label: string) { const el = [...host.querySelectorAll('button')].find(b => b.textContent === label); expect(el, label).toBeTruthy(); await act(async () => el!.click()); }
async function input(value: string) { const el = host.querySelector('textarea')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }); }
const command = 'Erstelle einen Termin am 21.11.2090 um 14 Uhr für 30 Minuten: Beratung';
describe('NEO concrete command confirmation', () => {
  it('invalidates a prepared action when its command changes', async () => { await input(command); await click('Auftrag prüfen'); expect(host.textContent).toContain('Geprüften Auftrag ausführen'); await input(command.replace('Beratung', 'Besprechung')); expect(host.textContent).not.toContain('Geprüften Auftrag ausführen'); expect(api.create).not.toHaveBeenCalled(); });
  it('retries an uncertain appointment with the same request id and locks successful execution', async () => {
    api.create.mockResolvedValueOnce({ ok: false, uncertain: true, error: 'Bestätigung fehlt' }).mockResolvedValueOnce({ ok: true, id: scope.subjectId, message: 'Gespeichert' });
    await input(command); await click('Auftrag prüfen'); await click('Geprüften Auftrag ausführen'); await click('Dieselbe Terminbestätigung prüfen');
    expect(api.create).toHaveBeenCalledTimes(2); expect(api.create.mock.calls[0][1]).toBe(api.create.mock.calls[1][1]); expect(host.textContent).toContain('Neuen Auftrag beginnen');
    await click('Auftrag abgeschlossen / gesperrt'); expect(api.create).toHaveBeenCalledTimes(2);
  });
  it('rechecks current permissions immediately before executing', async () => { await input(command); await click('Auftrag prüfen'); api.can = false; await click('Geprüften Auftrag ausführen'); expect(api.create).not.toHaveBeenCalled(); expect(host.textContent).toContain('Berechtigung'); });
});


describe('NEO ambient action transfer', () => {
  it('prepares an addressed administrative command without executing or starting another microphone', async () => {
    await act(async () => root.render(<NeoActionsPanel scope={scope} role="business_admin" initialCommand={{ id: 'source1', text: command }} disableRecorder />));
    expect(host.querySelector('textarea')?.value).toBe(command); expect(api.create).not.toHaveBeenCalled();
    await click('Auftrag prüfen'); expect(host.textContent).toContain('Geprüften Auftrag ausführen'); expect(api.create).not.toHaveBeenCalled();
  });
  it('leaves task and handover requests to the workbench without creating an unrelated pending action', async () => {
    const pending = vi.fn();
    await act(async () => root.render(<NeoActionsPanel scope={scope} role="business_admin" initialCommand={{ id: 'source2', text: 'Erstelle eine Aufgabe: Rollator besorgen.' }} disableRecorder onPendingChange={pending} />));
    expect(host.querySelector('textarea')?.value).toBe(''); expect(pending).toHaveBeenLastCalledWith(false); expect(api.create).not.toHaveBeenCalled();
  });
});
