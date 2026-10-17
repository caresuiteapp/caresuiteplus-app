// @vitest-environment happy-dom
// DOM interaction checks do not claim browser layout or pointer drawing coverage.
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteDraft } from '@/lib/office/notes/types.web';
import { createNoteDraft } from '@/lib/office/notes/model.web';
import { NoteEditor } from '@/components/office/notes/NoteEditor.web';

vi.mock('@/components/office/notes/MindMapEditor.web', () => ({ MindMapEditor: () => <div data-testid="mindmap-editor" /> }));
vi.mock('@/components/office/notes/HandwritingEditor.web', () => ({ HandwritingEditor: () => <div data-testid="handwriting-editor" /> }));

let host: HTMLDivElement, root: Root, current: NoteDraft, disabled = false;
function Harness({ initial }: { initial: NoteDraft }) {
  const [draft, setDraft] = useState(initial);
  current = draft;
  return <NoteEditor draft={draft} onChange={setDraft} disabled={disabled} />;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  disabled = false;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = async (initial = createNoteDraft()) => { await act(async () => root.render(<Harness initial={initial} />)); };
function button(label: string) {
  const match = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label);
  expect(match, label).toBeDefined(); return match!;
}
const click = async (label: string) => { await act(async () => button(label).click()); };
async function change(label: string, value: string) {
  const target = host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  expect(target, label).not.toBeNull();
  await act(async () => {
    const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : target instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    if (target instanceof HTMLInputElement && target.type === 'date') target.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('Office notes editor', () => {
  it('keeps all structured and handwritten content when formats change and retains Cornell edits', async () => {
    const draft = createNoteDraft('cornell');
    draft.content.text = 'Gesprächsinhalt'; draft.content.cues = 'Frage'; draft.content.summary = 'Zusammenfassung';
    draft.content.nodes = [{ id: 'topic', parentId: null, text: 'Thema', x: 500, y: 300 }];
    draft.content.strokes = [{ id: 'stroke', color: '#17384d', width: 2, points: [[1, 1], [4, 4]] }];
    await render(draft);
    await change('Schlüsselwörter und Fragen', 'Neue Kernfrage');
    await change('Notiztext', 'Eigene Worte');
    await change('Zusammenfassung', 'Ergebnis');
    for (const [label, format] of [['Mindmap', 'mindmap'], ['Handschrift', 'handwriting'], ['Freie Notiz', 'plain'], ['Cornell', 'cornell']]) {
      await click(label); expect(current.format).toBe(format);
      expect(current.content).toEqual({ ...draft.content, text: 'Eigene Worte', cues: 'Neue Kernfrage', summary: 'Ergebnis' });
    }
    expect((host.querySelector('[aria-label="Schlüsselwörter und Fragen"]') as HTMLTextAreaElement).value).toBe('Neue Kernfrage');
  });

  it('adds, edits and removes tasks including status, responsible person and deadline without changing the note status', async () => {
    await render(createNoteDraft('task')); await click('+ Aufgabe hinzufügen');
    await change('Aufgabe 1', 'Unterlagen anfordern'); await change('Status Aufgabe 1', 'in_progress');
    await change('Verantwortlich Aufgabe 1', 'Alex'); await change('Frist Aufgabe 1', '2026-11-03');
    expect(current.content.tasks[0]).toMatchObject({ text: 'Unterlagen anfordern', status: 'in_progress', assignee: 'Alex', dueDate: '2026-11-03' });
    const firstId = current.content.tasks[0].id;
    await click('+ Aufgabe hinzufügen'); await change('Aufgabe 2', 'Rückruf'); await change('Status Aufgabe 1', 'done');
    expect(host.textContent).toContain('1 von 2 erledigt'); expect(current.status).toBe('open');
    expect(new Set(current.content.tasks.map(task => task.id)).size).toBe(2);
    await click('Aufgabe 2 entfernen'); expect(current.content.tasks).toHaveLength(1); expect(current.content.tasks[0].id).toBe(firstId);
  });

  it('uses independent fields for contacts and permits adding and removing details', async () => {
    await render(createNoteDraft('contact'));
    await change('Angabe 1', 'Alex Beispiel'); await change('Angabe 3', '030 123456');
    await click('+ Angabe hinzufügen'); await change('Bezeichnung 5', 'Geburtstag'); await change('Angabe 5', '12. Dezember');
    expect(current.content.fields.map(field => [field.label, field.value])).toEqual([
      ['Name', 'Alex Beispiel'], ['Organisation', ''], ['Telefon', '030 123456'], ['E-Mail', ''], ['Geburtstag', '12. Dezember'],
    ]);
    await click('Angabe 2 entfernen'); expect(current.content.fields).toHaveLength(4); expect(current.content.fields[1].value).toBe('030 123456');
  });

  it('never exposes non-web source schemes as clickable links and permits book sources without a URL', async () => {
    await render(createNoteDraft('source')); await click('+ Quelle hinzufügen'); await change('Titel Quelle 1', 'Fachbuch');
    expect(host.querySelector('a')).toBeNull();
    await change('Webadresse Quelle 1', 'javascript:alert(1)');
    expect(host.querySelector('a')).toBeNull(); expect(host.querySelector('[aria-invalid=true]')).not.toBeNull();
    await change('Webadresse Quelle 1', 'https://example.org/fachbuch');
    const link = host.querySelector<HTMLAnchorElement>('[aria-label="Quelle 1 öffnen"]')!;
    expect(link.href).toBe('https://example.org/fachbuch'); expect(link.rel).toBe('noopener noreferrer');
    expect(host.querySelector('[aria-invalid=true]')).toBeNull();
    await change('Webadresse Quelle 1', ''); expect(host.querySelector('a')).toBeNull(); expect(current.content.sources[0].title).toBe('Fachbuch');
    await click('Quelle 1 entfernen'); expect(current.content.sources).toEqual([]);
  });

  it('adds and removes complete tag chips, rejects case-insensitive duplicates and updates metadata', async () => {
    await render(); await change('Neues Schlagwort', 'Teamrunde'); await click('Hinzufügen');
    expect(current.tags).toEqual(['Teamrunde']);
    await change('Neues Schlagwort', 'teamrunde'); await click('Hinzufügen');
    expect(current.tags).toHaveLength(1); expect(host.textContent).toContain('schon vorhanden');
    await change('Neues Schlagwort', 'Entscheidung');
    await act(async () => host.querySelector('[aria-label="Neues Schlagwort"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(current.tags).toEqual(['Teamrunde', 'Entscheidung']);
    await click('Schlagwort Teamrunde entfernen'); await change('Status der Notiz', 'in_progress'); await change('Datum oder Frist der Notiz', '2026-11-04');
    expect(current).toMatchObject({ tags: ['Entscheidung'], status: 'in_progress', dueDate: '2026-11-04' });
    await act(async () => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click()); expect(current.pinned).toBe(true);
  });

  it('disables mutation controls when the workspace is read only', async () => {
    disabled = true; await render(createNoteDraft('task'));
    const fieldset = host.querySelector('fieldset')!; expect(fieldset.disabled).toBe(true);
    await click('Cornell'); await click('+ Aufgabe hinzufügen');
    expect(current.format).toBe('plain'); expect(current.content.tasks).toEqual([]);
  });

  it('makes array limits visible and prevents adding more entries', async () => {
    const draft = createNoteDraft();
    draft.content.tasks = Array.from({ length: 200 }, (_, index) => ({ id: `${index}`, text: '', status: 'open', assignee: '', dueDate: '' }));
    draft.tags = Array.from({ length: 30 }, (_, index) => `Tag ${index}`);
    await render(draft);
    expect(button('+ Aufgabe hinzufügen').disabled).toBe(true); expect(host.textContent).toContain('Grenze von 200 Aufgaben');
    await change('Neues Schlagwort', 'Weiteres'); expect(button('Hinzufügen').disabled).toBe(true); expect(host.textContent).toContain('Grenze von 30 Schlagwörtern');
  });
});
