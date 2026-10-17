// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteSaveOperation, NotesActor, OfficeNote } from '@/lib/office/notes/types.web';

const api = vi.hoisted(() => ({ list: vi.fn(), load: vi.fn(), save: vi.fn(), archive: vi.fn(), remove: vi.fn(), confirm: vi.fn(), leave: vi.fn(), replace: vi.fn(), download: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: api.replace }) }));
vi.mock('@/lib/office/notes/service.web', () => ({ listNotes: api.list, loadNote: api.load, saveNote: api.save, setNoteArchived: api.archive, deleteNote: api.remove }));
vi.mock('@/lib/office/notes/export.web', () => ({ downloadNote: api.download }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: api.confirm }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: (dirty: boolean, busy: boolean) => async () => !busy && (!dirty || await api.leave()) }));
import { NotesWorkspace } from '@/components/office/notes/NotesWorkspace.web';
import { createNoteDraft } from '@/lib/office/notes/model.web';

const actor: NotesActor = { tenantId: 'tenant-a', userId: 'user-a', roleKey: 'business_admin', permissions: ['office.access'] };
const timestamp = '2026-10-17T10:00:00.000Z';
const records = new Map<string, OfficeNote>();
const clone = <T,>(value: T): T => structuredClone(value);
const note = (id: string, title: string, patch: Partial<OfficeNote> = {}): OfficeNote => ({ ...createNoteDraft(), id, title, tenantId: actor.tenantId, ownerUserId: actor.userId, revision: 1, createdAt: timestamp, updatedAt: timestamp, archivedAt: null, ...patch });
function saved(owner: NotesActor, operation: NoteSaveOperation): OfficeNote {
  return { ...clone(operation.draft), id: operation.id, tenantId: owner.tenantId, ownerUserId: owner.userId, revision: (operation.expectedRevision ?? 0) + 1, createdAt: timestamp, updatedAt: timestamp, archivedAt: null };
}
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  records.clear(); Object.values(api).forEach(mock => mock.mockReset());
  api.leave.mockResolvedValue(true); api.confirm.mockResolvedValue(true);
  api.list.mockImplementation(async (owner: NotesActor) => ({ ok: true, data: clone([...records.values()].filter(item => item.tenantId === owner.tenantId && item.ownerUserId === owner.userId)) }));
  api.load.mockImplementation(async (_owner: NotesActor, id: string) => ({ ok: true, data: clone(records.get(id) ?? null) }));
  api.save.mockImplementation(async (owner: NotesActor, operation: NoteSaveOperation) => { const result = saved(owner, operation); records.set(result.id, result); return { ok: true, data: clone(result) }; });
  api.archive.mockImplementation(async (_owner: NotesActor, current: OfficeNote, archived: boolean) => { const result = { ...clone(current), revision: current.revision + 1, archivedAt: archived ? timestamp : null }; records.set(result.id, result); return { ok: true, data: clone(result) }; });
  api.remove.mockImplementation(async (_owner: NotesActor, id: string) => { records.delete(id); return { ok: true, data: { id } }; });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (owner = actor) => { await act(async () => root.render(<NotesWorkspace actor={owner} />)); };
const button = (label: string, scope: ParentNode = host) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label || item.getAttribute('aria-label') === label);
const click = async (label: string) => { const item = button(label); expect(item, label).toBeTruthy(); await act(async () => item!.click()); };
const card = (title: string) => [...host.querySelectorAll<HTMLButtonElement>('.nw-note-card')].find(item => item.querySelector('strong')?.textContent === title);
const open = async (title: string) => { expect(card(title), title).toBeTruthy(); await act(async () => card(title)!.click()); };
const editor = () => host.querySelector<HTMLElement>('.nw-editor-scroll')!;
const field = (label: string, scope: ParentNode = host) => scope.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
const change = async (label: string, value: string, scope: ParentNode = host) => {
  const input = field(label, scope); expect(input, label).toBeTruthy();
  await act(async () => {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};
const newDraft = async (title = 'Neue Gedanken') => { await click('Neue Notiz'); await change('Titel der Notiz', title, editor()); await change('Notiztext', 'Der persönliche Entwurf bleibt erhalten.', editor()); };

describe('personal Notes workspace workflows', () => {
  it('fills a real template, saves it once, closes and reopens the confirmed record', async () => {
    await render(); const template = [...host.querySelectorAll<HTMLButtonElement>('.nw-template-card')].find(item => item.querySelector('strong')?.textContent === 'Kontakt')!;
    await act(async () => template.click());
    await change('Titel der Notiz', 'Gespräch mit Anna', editor()); await change('Notiztext', 'Rückruf am Freitag', editor());
    await change('Angabe 1', 'Anna Beispiel', editor());
    await click('Speichern'); expect(api.save).toHaveBeenCalledOnce();
    const operation = api.save.mock.calls[0][1] as NoteSaveOperation;
    expect(operation).toMatchObject({ expectedRevision: null, draft: { title: 'Gespräch mit Anna', category: 'contacts', content: { text: 'Rückruf am Freitag', fields: [expect.objectContaining({ label: 'Name', value: 'Anna Beispiel' }), expect.anything(), expect.anything(), expect.anything()] } } });
    expect(button('Speichern')?.disabled).toBe(true); expect(card('Gespräch mit Anna')).toBeTruthy();
    await click('Liste'); expect(host.querySelector('.nw-editor-scroll')).toBeNull();
    await open('Gespräch mit Anna'); expect(api.load).toHaveBeenLastCalledWith(actor, operation.id);
    expect(field('Notiztext', editor()).value).toBe('Rückruf am Freitag'); expect(field('Angabe 1', editor()).value).toBe('Anna Beispiel');
    expect(api.leave).not.toHaveBeenCalled();
  });

  it('keeps the unsaved editor independent from list search, category, status and view filters', async () => {
    records.set('alpha', note('alpha', 'Alpha', { category: 'tasks', pinned: true }));
    records.set('bravo', note('bravo', 'Bravo', { category: 'general', status: 'done' }));
    records.set('old', note('old', 'Alt', { archivedAt: timestamp }));
    await render(); await open('Alpha'); await change('Titel der Notiz', 'Noch nicht gespeicherte Idee', editor());
    await change('Nach Kategorie filtern', 'general'); await change('Nach Status filtern', 'done'); await change('Notizen durchsuchen', 'Bravo');
    expect(card('Bravo')).toBeTruthy(); expect(card('Alpha')).toBeUndefined(); expect(field('Titel der Notiz', editor()).value).toBe('Noch nicht gespeicherte Idee');
    await click('Archiv'); expect(host.textContent).toContain('Keine passenden Notizen');
    await click('Filter zurücksetzen'); expect(card('Alpha')).toBeTruthy(); expect(card('Bravo')).toBeTruthy();
    expect(field('Titel der Notiz', editor()).value).toBe('Noch nicht gespeicherte Idee'); expect(api.save).not.toHaveBeenCalled(); expect(api.leave).not.toHaveBeenCalled();
  });

  it('finds German search terms with accents, uppercase and equivalent plain spelling', async () => {
    records.set('contact', note('contact', 'Rückruf bei Großmann')); await render();
    for (const query of ['RÜCKRUF', 'ruckruf', 'GROSSMANN', 'Großmann']) {
      await change('Notizen durchsuchen', query); expect(card('Rückruf bei Großmann'), query).toBeTruthy();
    }
  });

  it('keeps an unsaved draft when the same effective permissions arrive in another order', async () => {
    const owner: NotesActor = { ...actor, permissions: ['office.access', 'office.documents.view'] };
    await render(owner); await newDraft('Bleibt geöffnet'); const previousEditor = editor();
    await render({ ...owner, permissions: ['office.documents.view', 'office.access'] });
    expect(editor()).toBe(previousEditor); expect(field('Titel der Notiz', editor()).value).toBe('Bleibt geöffnet');
    expect(api.list).toHaveBeenCalledTimes(1); expect(api.save).not.toHaveBeenCalled();
  });

  it('retains dirty content when discard is cancelled and opens another note only after acceptance', async () => {
    records.set('a', note('a', 'Erste')); records.set('b', note('b', 'Zweite')); await render(); await open('Erste');
    await change('Notiztext', 'Nicht verwerfen', editor()); api.leave.mockResolvedValue(false);
    await open('Zweite'); await click('Neue Notiz'); await click('Vorlagen'); await click('Liste');
    expect(api.load).toHaveBeenCalledTimes(1); expect(field('Notiztext', editor()).value).toBe('Nicht verwerfen'); expect(api.save).not.toHaveBeenCalled();
    api.leave.mockResolvedValue(true); await open('Zweite'); expect(field('Titel der Notiz', editor()).value).toBe('Zweite'); expect(api.load).toHaveBeenLastCalledWith(actor, 'b');
  });

  it('shows load and save failures while keeping the editable draft for retry', async () => {
    api.list.mockResolvedValueOnce({ ok: false, error: 'Abfrage fehlgeschlagen' }); await render(); expect(host.textContent).toContain('Abfrage fehlgeschlagen');
    await click('Erneut versuchen'); expect(api.list).toHaveBeenCalledTimes(2); await newDraft();
    api.save.mockResolvedValueOnce({ ok: false, error: 'Speicherzugriff fehlgeschlagen' }); await click('Speichern');
    expect(host.textContent).toContain('Speicherzugriff fehlgeschlagen'); expect(field('Titel der Notiz', editor()).value).toBe('Neue Gedanken'); expect(button('Speichern')?.disabled).toBe(false);
    await click('Speichern'); expect(records.size).toBe(1); expect(host.textContent).toContain('Notiz gespeichert.');
    records.set('other', note('other', 'Weitere Notiz')); await click('Aktualisieren'); await change('Notiztext', 'Diesen Entwurf behalten', editor());
    api.load.mockResolvedValueOnce({ ok: false, error: 'Öffnen fehlgeschlagen' }); await open('Weitere Notiz');
    expect(host.textContent).toContain('Öffnen fehlgeschlagen'); expect(field('Notiztext', editor()).value).toBe('Diesen Entwurf behalten');
  });

  it('serializes a same-tick double click and keyboard save while a write is pending', async () => {
    await render(); await newDraft(); const pending = deferred<any>(); api.save.mockReturnValueOnce(pending.promise);
    const save = button('Speichern')!;
    await act(async () => { save.click(); save.click(); host.querySelector('section.nw')!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })); });
    expect(api.save).toHaveBeenCalledOnce(); expect(button('Neue Notiz')?.disabled).toBe(true);
    await act(async () => pending.resolve({ ok: true, data: saved(actor, api.save.mock.calls[0][1]) }));
    expect(host.textContent).toContain('Notiz gespeichert.'); expect(button('Speichern')?.disabled).toBe(true);
  });

  it('reconciles an uncertain committed write with the same ID instead of creating a duplicate', async () => {
    await render(); await newDraft(); api.save.mockResolvedValueOnce({ ok: false, uncertain: true, error: 'Bestätigung fehlt' }); await click('Speichern');
    const operation = api.save.mock.calls[0][1] as NoteSaveOperation; expect(button('Speichern')?.disabled).toBe(true); expect(button('Kopie')?.disabled).toBe(true);
    api.load.mockResolvedValueOnce({ ok: false, error: 'Noch keine Verbindung' }); await click('Speicherstand prüfen');
    expect(field('Titel der Notiz', editor()).value).toBe(operation.draft.title); expect(host.textContent).toContain('Noch keine Verbindung');
    api.load.mockResolvedValueOnce({ ok: true, data: saved(actor, operation) }); await click('Speicherstand prüfen');
    expect(api.load).toHaveBeenLastCalledWith(actor, operation.id); expect(api.save).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Speicherstand bestätigt.'); expect(card(operation.draft.title)).toBeTruthy(); expect(button('Speichern')?.disabled).toBe(true);
  });

  it('retries a confirmed missing new record under its original ID', async () => {
    await render(); await newDraft(); api.save.mockRejectedValueOnce(new Error('Network lost')); await click('Speichern');
    const first = api.save.mock.calls[0][1] as NoteSaveOperation;
    api.load.mockResolvedValueOnce({ ok: true, data: null }); await click('Speicherstand prüfen'); expect(button('Speichern')?.disabled).toBe(false);
    await click('Speichern'); expect(api.save.mock.calls[1][1]).toMatchObject({ id: first.id, expectedRevision: null, draft: first.draft }); expect(records.size).toBe(1);
  });

  it('compares a conflicting server revision and preserves the local version in a new copy', async () => {
    const original = note('existing', 'Protokoll'); records.set(original.id, original); await render(); await open(original.title);
    await change('Notiztext', 'Meine ungespeicherte Fassung', editor());
    api.save.mockResolvedValueOnce({ ok: false, conflict: true, error: 'Versionskonflikt' }); await click('Speichern');
    const server = note('existing', 'Neuere Serverfassung', { revision: 2, content: { ...createNoteDraft().content, text: 'Anderer gespeicherter Text' } });
    records.set(server.id, server); await click('Speicherstand prüfen');
    expect(host.textContent).toContain('Gespeicherte Fassung: Neuere Serverfassung');
    expect(field('Notiztext', host.querySelector('.nw-server-preview')!).value).toBe('Anderer gespeicherter Text');
    expect(field('Notiztext', editor()).value).toBe('Meine ungespeicherte Fassung'); expect(button('Speichern')?.disabled).toBe(true);
    api.confirm.mockResolvedValueOnce(false); await click('Gespeicherten Stand übernehmen'); expect(field('Notiztext', editor()).value).toBe('Meine ungespeicherte Fassung');
    await click('Als Kopie weiterbearbeiten'); expect(field('Titel der Notiz', editor()).value).toBe('Protokoll – Kopie'); await click('Speichern');
    const copy = api.save.mock.calls[1][1] as NoteSaveOperation;
    expect(copy.id).not.toBe(original.id); expect(copy.expectedRevision).toBeNull(); expect(copy.draft.content.text).toBe('Meine ungespeicherte Fassung');
    expect(records.get(original.id)).toEqual(server); expect(records.size).toBe(2);
  });

  it('requires a clean saved record for archive and confirmation before permanently deleting it', async () => {
    records.set('record', note('record', 'Besprechung')); await render(); await open('Besprechung');
    expect(button('Löschen')).toBeUndefined(); await change('Notiztext', 'Neue Angaben', editor()); expect(button('Archivieren')?.disabled).toBe(true);
    await click('Archivieren'); expect(api.archive).not.toHaveBeenCalled(); await click('Speichern'); await click('Archivieren');
    expect(api.archive).toHaveBeenLastCalledWith(actor, expect.objectContaining({ id: 'record', revision: 2 }), true);
    expect((editor().querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true); expect(button('Speichern')).toBeUndefined();
    await click('Wiederherstellen'); expect(api.archive).toHaveBeenLastCalledWith(actor, expect.objectContaining({ revision: 3 }), false);
    expect((editor().querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(false); await click('Archivieren');
    api.confirm.mockResolvedValueOnce(false); await click('Löschen'); expect(api.remove).not.toHaveBeenCalled(); expect(records.size).toBe(1);
    await click('Löschen'); expect(api.remove).toHaveBeenCalledExactlyOnceWith(actor, 'record', 5); expect(records.size).toBe(0); expect(host.querySelector('.nw-editor-scroll')).toBeNull();
  });

  it.each([false, true])('reconciles uncertain archive with archived=%s without reporting an unchanged active record as success', async archived => {
    const original = note('record', 'Archiventscheidung'); records.set(original.id, original); await render(); await open(original.title);
    api.archive.mockResolvedValueOnce({ ok: false, uncertain: true, error: 'Archivbestätigung fehlt' }); await click('Archivieren');
    expect(button('Archivieren')?.disabled).toBe(true);
    if (archived) records.set(original.id, { ...original, revision: 2, archivedAt: timestamp });
    await click('Speicherstand prüfen');
    if (archived) {
      expect(button('Wiederherstellen')?.disabled).toBe(false); expect(button('Archivieren')).toBeUndefined();
      expect((editor().querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true); expect(api.archive).toHaveBeenCalledTimes(1);
    } else {
      expect(button('Archivieren')?.disabled).toBe(false); expect(host.textContent).not.toContain('Notiz archiviert.');
      expect(button('Wiederherstellen')).toBeUndefined(); await click('Archivieren'); expect(api.archive).toHaveBeenCalledTimes(2);
      expect(api.archive).toHaveBeenLastCalledWith(actor, expect.objectContaining({ revision: 1, archivedAt: null }), true);
    }
  });

  it.each([false, true])('reconciles uncertain deletion with record missing=%s and only retries after explicit confirmation', async missing => {
    const original = note('record', 'Archivierte Notiz', { archivedAt: timestamp }); records.set(original.id, original); await render(); await click('Archiv'); await open(original.title);
    api.remove.mockResolvedValueOnce({ ok: false, uncertain: true, error: 'Löschbestätigung fehlt' }); await click('Löschen');
    expect(button('Löschen')?.disabled).toBe(true); if (missing) records.delete(original.id);
    await click('Speicherstand prüfen');
    if (missing) {
      expect(host.querySelector('.nw-editor-scroll')).toBeNull(); expect(card(original.title)).toBeUndefined(); expect(api.remove).toHaveBeenCalledTimes(1);
    } else {
      expect(button('Löschen')?.disabled).toBe(false); expect(field('Titel der Notiz', editor()).value).toBe(original.title);
      expect(host.textContent).not.toContain('Notiz gelöscht.'); api.confirm.mockResolvedValueOnce(false); await click('Löschen'); expect(api.remove).toHaveBeenCalledTimes(1);
      await click('Löschen'); expect(api.remove).toHaveBeenCalledTimes(2); expect(host.querySelector('.nw-editor-scroll')).toBeNull();
    }
  });

  it('discards pending list and save completions after switching account scope', async () => {
    const initial = deferred<any>(); api.list.mockReturnValueOnce(initial.promise); await render();
    const nextActor = { ...actor, tenantId: 'tenant-b', userId: 'user-b' }; await render(nextActor);
    await act(async () => initial.resolve({ ok: true, data: [note('old', 'Vertraulich alt')] })); expect(host.textContent).not.toContain('Vertraulich alt');
    await newDraft('Entwurf B'); const pending = deferred<any>(); api.save.mockReturnValueOnce(pending.promise); await click('Speichern');
    const operation = api.save.mock.calls[0][1] as NoteSaveOperation; await render(actor);
    expect(host.querySelector('.nw-editor-scroll')).toBeNull();
    await act(async () => pending.resolve({ ok: true, data: saved(nextActor, operation) }));
    expect(host.textContent).not.toContain('Entwurf B'); expect(host.textContent).not.toContain('Notiz gespeichert.'); expect(api.list).toHaveBeenLastCalledWith(actor);
  });
});
