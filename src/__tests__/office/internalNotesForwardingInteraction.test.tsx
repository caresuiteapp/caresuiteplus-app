// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ recipients: vi.fn(), send: vi.fn(), list: vi.fn(), recover: vi.fn() }));
vi.mock('@/lib/office/notes/internalService.web', () => ({ listInternalRecipients: api.recipients, sendInternalNote: api.send, listInternalNotes: api.list, recoverPendingInternalNoteSend: api.recover }));
import { InternalNoteForwarder } from '@/components/office/notes/InternalNoteForwarder.web';
import { InternalNotesOutbox } from '@/components/office/notes/InternalNotesOutbox.web';
import { createNoteDraft } from '@/lib/office/notes/model.web';
import type { InternalNoteActor } from '@/lib/office/notes/internalTypes.web';

const actor: InternalNoteActor = { tenantId: '10000000-0000-4000-8000-000000000001', userId: '20000000-0000-4000-8000-000000000001', roleKey: 'business_admin', permissions: ['office.access', 'communication.send_message'] };
const people = [
  { employeeId: '30000000-0000-4000-8000-000000000001', displayName: 'Anna Beispiel' },
  { employeeId: '30000000-0000-4000-8000-000000000002', displayName: 'Lena Muster' },
];
const source = () => { const note = createNoteDraft(); note.title = 'Rückruf Termin'; note.content.text = 'Bitte morgen bei Frau Beispiel zurückrufen.'; note.tags = ['Privates Schlagwort']; note.content.cues = 'Versteckter Cornelltext'; return note; };
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.values(api).forEach(mock => mock.mockReset());
  api.recover.mockResolvedValue({ ok: true, data: null }); api.recipients.mockResolvedValue({ ok: true, data: people }); api.list.mockResolvedValue({ ok: true, data: [] });
  api.send.mockResolvedValue({ ok: true, data: { dispatchId: '40000000-0000-4000-8000-000000000001', createdAt: '2026-10-18T12:00:00Z' } });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === text)!;
const click = async (text: string) => { expect(button(text), text).toBeTruthy(); await act(async () => button(text).click()); };
const selectPerson = async (index = 0) => { await act(async () => host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[index].click()); };
const change = async (label: string, value: string) => {
  const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[aria-label="${label}"]`)!; expect(input, label).toBeTruthy();
  await act(async () => { const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
};
const renderComposer = async (note = source()) => {
  const onSent = vi.fn(), onClose = vi.fn(), onStateChange = vi.fn();
  await act(async () => root.render(<InternalNoteForwarder actor={actor} sourceNote={note} onSent={onSent} onClose={onClose} onStateChange={onStateChange}/>));
  return { onSent, onClose, onStateChange };
};

describe('internal note forwarding from a private draft', () => {
  it('requires review and an explicit send, sends only the edited copy, and blocks double clicks', async () => {
    const note = source(), original = structuredClone(note); const callbacks = await renderComposer(note);
    await selectPerson(0); await selectPerson(1); await change('Inhalt der Übermittlung', 'Nur diese Rückrufbitte weitergeben.'); await change('Art der internen Übermittlung', 'callback');
    await click('Weiter zur Vorschau'); expect(api.send).not.toHaveBeenCalled(); expect(host.textContent).toContain('An 2 Personen'); expect(host.textContent).not.toContain('Privates Schlagwort'); expect(host.textContent).not.toContain('Versteckter Cornelltext');
    let resolve!: (value: any) => void; api.send.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await act(async () => { button('Jetzt intern senden').click(); button('Jetzt intern senden').click(); });
    expect(api.send).toHaveBeenCalledTimes(1); expect(button('Wird übermittelt …').disabled).toBe(true);
    const [owner, requestId, sent] = api.send.mock.calls[0]; expect(owner).toEqual(actor); expect(requestId).toMatch(/^[a-f\d-]{36}$/i);
    expect(sent).toEqual({ title: 'Rückruf Termin', body: 'Nur diese Rückrufbitte weitergeben.', kind: 'callback', priority: 'normal', dueDate: '', recipientEmployeeIds: people.map(person => person.employeeId) });
    expect(note).toEqual(original);
    await act(async () => resolve({ ok: true, data: { dispatchId: 'receipt', createdAt: '2026-10-18T12:00:00Z' } })); expect(callbacks.onSent).toHaveBeenCalledOnce();
  });

  it('requires at least one recipient and preserves text on validation failure', async () => {
    await renderComposer(); await click('Weiter zur Vorschau'); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Mitarbeitende'); expect(api.send).not.toHaveBeenCalled();
    expect((host.querySelector('[aria-label="Inhalt der Übermittlung"]') as HTMLTextAreaElement).value).toContain('Bitte morgen');
  });

  it('retries an uncertain transmission with the identical ID and immutable payload even after a later permission error', async () => {
    const callbacks = await renderComposer(); await selectPerson(); await click('Weiter zur Vorschau');
    api.send.mockResolvedValueOnce({ ok: false, uncertain: true, error: 'Bestätigung fehlt' }); await click('Jetzt intern senden');
    expect(button('Ausgang prüfen').disabled).toBe(false); expect(button('Angaben bearbeiten').disabled).toBe(true); const original = structuredClone(api.send.mock.calls[0]);
    api.send.mockResolvedValueOnce({ ok: false, error: 'Anmeldung prüfen' }); await click('Übermittlung erneut prüfen');
    expect(button('Angaben bearbeiten').disabled).toBe(true); expect(api.send.mock.calls[1]).toEqual(original);
    await click('Übermittlung erneut prüfen'); expect(api.send.mock.calls[2]).toEqual(original); expect(callbacks.onSent).toHaveBeenCalledOnce();
  });

  it('shows roster errors and reloads before allowing review', async () => {
    api.recipients.mockResolvedValueOnce({ ok: false, error: 'Keine Verbindung' }); await renderComposer(); expect(host.textContent).toContain('Keine Verbindung'); expect(button('Weiter zur Vorschau').disabled).toBe(true);
    await click('Erneut laden'); expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(2); expect(button('Weiter zur Vorschau').disabled).toBe(false);
  });

  it('does not send on closing and ignores a completed request after unmount', async () => {
    const callbacks = await renderComposer(); await click('Schließen'); expect(callbacks.onClose).toHaveBeenCalledOnce(); expect(api.send).not.toHaveBeenCalled();
    await selectPerson(); await click('Weiter zur Vorschau'); let resolve!: (value: any) => void;
    api.send.mockReturnValueOnce(new Promise(done => { resolve = done; })); await click('Jetzt intern senden');
    await act(async () => root.render(<div>Anderer Zugang</div>)); await act(async () => resolve({ ok: true, data: { dispatchId: 'receipt' } })); expect(callbacks.onSent).not.toHaveBeenCalled();
  });

  it('shows each recipient response and keeps a partly completed transmission open', async () => {
    api.list.mockResolvedValue({ ok: true, data: [{ id: 'note1', tenantId: actor.tenantId, senderUserId: actor.userId, senderName: 'Office', kind: 'callback', priority: 'high', title: 'Rückruf', body: 'Bitte zurückrufen', dueDate: '2026-10-19', createdAt: '2026-10-18T12:00:00Z', recipients: [
      { ...people[0], id: 'd1', recipientUserId: 'u1', status: 'done', readAt: '2026-10-18T12:10:00Z', response: 'Termin geklärt.', revision: 2, updatedAt: '2026-10-18T12:15:00Z' },
      { ...people[1], id: 'd2', recipientUserId: 'u2', status: 'open', readAt: null, response: '', revision: 1, updatedAt: '2026-10-18T12:00:00Z' },
    ] }] });
    await act(async () => root.render(<InternalNotesOutbox actor={actor} onCompose={vi.fn()}/>)); expect(host.textContent).toContain('Termin geklärt.'); expect(host.textContent).toContain('Noch nicht gelesen');
    await change('Bearbeitungsstand filtern', 'open'); expect(host.querySelectorAll('.ni-sent-card')).toHaveLength(1);
    await change('Bearbeitungsstand filtern', 'done'); expect(host.querySelectorAll('.ni-sent-card')).toHaveLength(0);
  });
});
