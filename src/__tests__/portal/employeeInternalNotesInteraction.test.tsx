// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalDelivery, InternalNote, InternalNoteActor } from '@/lib/office/notes/internalTypes.web';

const api = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), leave: vi.fn() }));
vi.mock('@/lib/office/notes/internalService.web', () => ({ listInternalNotes: api.list, updateInternalDelivery: api.update }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: (dirty: boolean, busy: boolean) => async () => !busy && (!dirty || await api.leave()) }));
import { EmployeeInternalNotes } from '@/components/portal/EmployeeInternalNotes.web';

const actor: InternalNoteActor = { tenantId: 'tenant-a', userId: 'user-a', employeeId: 'employee-a', roleKey: 'employee_portal' };
const timestamp = '2026-10-18T09:00:00.000Z';
const delivery = (patch: Partial<InternalDelivery> = {}): InternalDelivery => ({ id: 'delivery-a', employeeId: 'employee-a', recipientUserId: 'user-a', displayName: 'Anna Beispiel', status: 'open', readAt: null, updatedAt: timestamp, revision: 1, response: '', ...patch });
const note = (patch: Partial<InternalNote> = {}): InternalNote => ({ id: 'note-a', tenantId: 'tenant-a', senderUserId: 'sender-a', senderName: 'Büro Nord', kind: 'callback', priority: 'high', title: 'Rückruf bei Großmann', body: 'Bitte den Rückruf übernehmen und das Ergebnis mitteilen.', dueDate: '2026-10-19', createdAt: timestamp, recipients: [delivery()], ...patch });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.values(api).forEach(mock => mock.mockReset()); api.leave.mockResolvedValue(true);
  api.list.mockResolvedValue({ ok: true, data: [note()] });
  api.update.mockImplementation(async (_actor, operation) => ({ ok: true, data: delivery({ id: operation.deliveryId, revision: operation.expectedRevision + 1, readAt: timestamp,
    ...(operation.action === 'read' ? { readAt: timestamp } : { status: operation.status, response: operation.response }) }) }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (current = actor) => { await act(async () => root.render(<EmployeeInternalNotes actor={current} />)); };
const button = (title: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === title);
const click = async (title: string) => { const found = button(title); expect(found, title).toBeTruthy(); await act(async () => found!.click()); };
const open = async (title = 'Rückruf bei Großmann') => { const found = [...host.querySelectorAll<HTMLButtonElement>('.ein-entry')].find(item => item.querySelector('strong')?.textContent === title); expect(found, title).toBeTruthy(); await act(async () => found!.click()); };
const field = (label: string) => host.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
const change = async (label: string, value: string) => {
  const input = field(label); expect(input, label).toBeTruthy();
  await act(async () => {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};

describe('employee internal notes receiving workflow', () => {
  it('renders only the current tenant, employee and authenticated recipient and does not silently acknowledge reads', async () => {
    api.list.mockResolvedValue({ ok: true, data: [note(), note({ id: 'other-tenant', title: 'Andere Firma', tenantId: 'tenant-b' }), note({ id: 'other-employee', title: 'Andere Person', recipients: [delivery({ employeeId: 'employee-b' })] }), note({ id: 'old-account', title: 'Alter Zugang', recipients: [delivery({ recipientUserId: 'user-b' })] })] });
    await render(); expect(api.list).toHaveBeenCalledWith(actor, 'inbox');
    expect(host.querySelectorAll('.ein-entry')).toHaveLength(1); expect(host.textContent).not.toContain('Andere Firma'); expect(host.textContent).not.toContain('Andere Person'); expect(host.textContent).not.toContain('Alter Zugang');
    await open(); expect(host.querySelector('article')?.textContent).toContain('Büro Nord'); expect(api.update).not.toHaveBeenCalled();
    await click('Als gelesen bestätigen');
    expect(api.update).toHaveBeenCalledWith(actor, { deliveryId: 'delivery-a', employeeId: 'employee-a', expectedRevision: 1, action: 'read' });
    expect(host.textContent).toContain('Gelesen bestätigt am'); expect(field('Bearbeitungsstand').value).toBe('open');
  });

  it('preserves a pending response while acknowledging a read, then saves the status with the confirmed revision', async () => {
    await render(); await open(); await change('Bearbeitungsstand', 'in_progress'); await change('Rückmeldung an das Büro', 'Rückruf für heute eingeplant.');
    await click('Als gelesen bestätigen');
    expect(field('Bearbeitungsstand').value).toBe('in_progress'); expect(field('Rückmeldung an das Büro').value).toBe('Rückruf für heute eingeplant.');
    await click('Rückmeldung speichern');
    expect(api.update).toHaveBeenLastCalledWith(actor, { deliveryId: 'delivery-a', employeeId: 'employee-a', expectedRevision: 2, action: 'status', status: 'in_progress', response: 'Rückruf für heute eingeplant.' });
    expect(button('Rückmeldung speichern')?.disabled).toBe(true); expect(host.textContent).toContain('Bearbeitungsstand und Rückmeldung wurden gespeichert.');
  });

  it('protects unsaved responses when changing selection and offers explicit completed entries', async () => {
    api.list.mockResolvedValue({ ok: true, data: [note(), note({ id: 'note-b', title: 'Zweiter Eintrag', recipients: [delivery({ id: 'delivery-b', status: 'done', readAt: timestamp })] })] });
    await render(); await open(); await change('Rückmeldung an das Büro', 'Entwurf behalten'); api.leave.mockResolvedValue(false);
    await click('Erledigt'); await open('Zweiter Eintrag'); expect(field('Rückmeldung an das Büro').value).toBe('Entwurf behalten');
    await click('← Zur Liste'); expect(host.querySelector('article')).not.toBeNull();
    api.leave.mockResolvedValue(true); await open('Zweiter Eintrag'); expect(field('Bearbeitungsstand').value).toBe('done'); expect(field('Rückmeldung an das Büro').value).toBe('');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('requires an explicit server reload after a conflict and does not silently rebase the draft', async () => {
    await render(); await open(); await change('Bearbeitungsstand', 'done'); await change('Rückmeldung an das Büro', 'Erledigt');
    api.update.mockResolvedValueOnce({ ok: false, conflict: true, error: 'Der Eintrag wurde inzwischen geändert.' });
    await click('Rückmeldung speichern'); expect(button('Rückmeldung speichern')?.disabled).toBe(true); expect(field('Rückmeldung an das Büro').value).toBe('Erledigt');
    api.leave.mockResolvedValue(false); await click('Gespeicherten Stand laden'); expect(api.list).toHaveBeenCalledTimes(1);
    api.leave.mockResolvedValue(true); api.list.mockResolvedValueOnce({ ok: true, data: [note({ recipients: [delivery({ revision: 4, status: 'in_progress', response: 'Anderer gespeicherter Stand' })] })] });
    await click('Gespeicherten Stand laden'); expect(field('Rückmeldung an das Büro').value).toBe('Anderer gespeicherter Stand'); expect(field('Bearbeitungsstand').value).toBe('in_progress');
    await change('Bearbeitungsstand', 'done'); await click('Rückmeldung speichern'); expect(api.update.mock.calls[1][1].expectedRevision).toBe(4);
  });

  it('serializes double clicks and blocks retries after an uncertain write until reconciliation', async () => {
    await render(); await open(); const pending = deferred<any>(); api.update.mockReturnValueOnce(pending.promise);
    await act(async () => { button('Als gelesen bestätigen')!.click(); button('Als gelesen bestätigen')!.click(); }); expect(api.update).toHaveBeenCalledOnce();
    await act(async () => pending.resolve({ ok: false, uncertain: true, error: 'Bestätigung fehlt' }));
    expect(button('Als gelesen bestätigen')?.disabled).toBe(true); expect(host.textContent).toContain('Bestätigung fehlt');
    api.list.mockResolvedValueOnce({ ok: true, data: [note({ recipients: [delivery({ readAt: timestamp, revision: 2 })] })] });
    await click('Gespeicherten Stand laden'); expect(api.update).toHaveBeenCalledOnce(); expect(host.textContent).toContain('Gelesen bestätigt am');
  });

  it('drops previous account data immediately and ignores a late previous account response', async () => {
    const old = deferred<any>(); api.list.mockReturnValueOnce(old.promise);
    await render(); await render({ ...actor, userId: 'user-b', employeeId: 'employee-b' });
    expect(host.textContent).not.toContain('Rückruf bei Großmann');
    await act(async () => old.resolve({ ok: true, data: [note()] })); expect(host.textContent).not.toContain('Rückruf bei Großmann');
    api.list.mockResolvedValueOnce({ ok: true, data: [note()] }); await render(actor); await open(); await change('Rückmeldung an das Büro', 'Vertraulicher Entwurf');
    await render({ ...actor, tenantId: 'tenant-b' }); expect(host.textContent).not.toContain('Vertraulicher Entwurf'); expect(host.querySelector('article')).toBeNull();
  });

  it('shows the read-only state without allowing acknowledgements or responses', async () => {
    await render({ ...actor, readOnly: true }); await open();
    expect(host.textContent).toContain('nur lesend verfügbar'); expect(button('Als gelesen bestätigen')?.disabled).toBe(true); expect(field('Bearbeitungsstand').disabled).toBe(true); expect(field('Rückmeldung an das Büro').disabled).toBe(true); expect(api.update).not.toHaveBeenCalled();
  });

  it('shows a failed load as unavailable rather than claiming no open work, and retries', async () => {
    api.list.mockResolvedValueOnce({ ok: false, error: 'Verbindung fehlt' }); await render();
    expect(host.textContent).toContain('Eingang nicht verfügbar'); expect(host.textContent).not.toContain('Aktuell nichts offen');
    await click('Erneut versuchen'); expect(host.querySelectorAll('.ein-entry')).toHaveLength(1);
    await change('Aufgaben und Notizen durchsuchen', 'GROSSMANN'); expect(host.querySelectorAll('.ein-entry')).toHaveLength(1);
    await change('Aufgaben und Notizen durchsuchen', 'Nicht vorhanden'); expect(host.textContent).toContain('Keine passenden Einträge');
  });
});
