// @vitest-environment happy-dom
// Real DOM interactions; layout remains a separate browser check.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyCourseEditor } from '@/features/akademie/AcademyCourseEditor.web';
import type { AcademyCommandHandler, AcademyContent, AcademyReusableTemplate } from '@/lib/akademie/workspaceModel';

const content = (): AcademyContent => ({ title: 'Unser eigener Kurs', summary: 'Abläufe kennen und anwenden', category: 'Einarbeitung',
  audiences: ['employee'], estimatedMinutes: 20, mandatory: false, passPercent: 80, maxAttempts: 3,
  lessons: [{ id: 'text-one', title: 'Einstieg', kind: 'text', body: 'Verständlicher Lerninhalt.' },
    { id: 'quiz-one', title: 'Wissen prüfen', kind: 'quiz', body: '', questions: [{ id: 'question-one', prompt: 'Was hilft?',
      options: [{ id: 'answer-one', text: 'Nachfragen' }, { id: 'answer-two', text: 'Raten' }], correctOptionId: 'answer-one' }] }],
});
const template = (patch: Partial<AcademyReusableTemplate> = {}): AcademyReusableTemplate => ({ id: 'template-one', revision: 2, name: 'Unsere Einarbeitung',
  description: 'Wiederverwendbarer Ablauf', content: content(), status: 'active', updatedAt: '2026-10-21T12:00:00Z', ...patch });

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const buttons = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].filter(element => element.textContent?.trim() === text || element.getAttribute('aria-label') === text);
function button(text: string) { const result = buttons(text)[0]; expect(result, `Button: ${text}`).toBeDefined(); return result!; }
const click = async (text: string) => { await act(async () => button(text).click()); };
const clickNode = async (element: HTMLElement) => { await act(async () => element.click()); };
function control(text: string, index = 0): HTMLInputElement | HTMLTextAreaElement {
  const explicit = [...host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')].filter(element => element.getAttribute('aria-label') === text)[index];
  const label = [...host.querySelectorAll('label')].filter(element => element.firstChild?.textContent?.trim() === text)[index];
  const result = explicit ?? label?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea');
  expect(result, `Field: ${text}`).toBeDefined(); return result!;
}
async function change(text: string, value: string, index = 0) {
  const element = control(text, index);
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const command = () => vi.fn<AcademyCommandHandler>().mockResolvedValue(null);
const editor = (onCommand: AcademyCommandHandler, options: Partial<React.ComponentProps<typeof AcademyCourseEditor>> = {}) =>
  <AcademyCourseEditor course={null} draftId="draft-one" initialContent={content()} busy={false} onCommand={onCommand} onClose={vi.fn()} {...options} />;
async function selectQuiz() { await clickNode(host.querySelectorAll<HTMLElement>('[aria-label="Lektionen bearbeiten"] .ac-lesson-nav')[1]!); }

describe('Academy authoring and reusable templates', () => {
  it('duplicates an entire quiz with independent lesson, question and answer identities', async () => {
    const input = content(); const onCommand = command(); await render(editor(onCommand, { initialContent: input }));
    await selectQuiz(); await click('Lektion duplizieren'); await click('Entwurf speichern');
    const saved = onCommand.mock.calls[0]![1].content as AcademyContent;
    const original = saved.lessons[1]!; const copy = saved.lessons[2]!;
    expect(copy.title).toBe('Wissen prüfen (Kopie)'); expect(copy.id).not.toBe(original.id);
    expect(copy.questions![0]!.id).not.toBe(original.questions![0]!.id);
    expect(copy.questions![0]!.options.map(option => option.id)).not.toEqual(original.questions![0]!.options.map(option => option.id));
    expect(copy.questions![0]!.correctOptionId).toBe(copy.questions![0]!.options[0]!.id);
    expect(input.lessons).toHaveLength(2);
  });

  it('duplicates and reorders questions and requires confirmation before removing them', async () => {
    const onCommand = command(); await render(editor(onCommand)); await selectQuiz();
    await click('Frage 1 duplizieren'); await change('Fragestellung', 'Welche Frage kommt zuerst?', 1); await click('Frage 2 nach oben');
    await click('Entwurf speichern');
    let saved = onCommand.mock.calls.at(-1)![1].content as AcademyContent;
    expect(saved.lessons[1]!.questions!.map(question => question.prompt)).toEqual(['Welche Frage kommt zuerst?', 'Was hilft?']);
    expect(saved.lessons[1]!.questions![0]!.correctOptionId).toBe(saved.lessons[1]!.questions![0]!.options[0]!.id);
    await click('Frage entfernen'); await click('Frage behalten'); expect(host.querySelectorAll('.ac-question')).toHaveLength(2);
    await click('Frage entfernen'); await click('Frage endgültig aus Entwurf entfernen'); await click('Entwurf speichern');
    saved = onCommand.mock.calls.at(-1)![1].content as AcademyContent;
    expect(saved.lessons[1]!.questions).toHaveLength(1); expect(saved.lessons[1]!.questions![0]!.id).toBe('question-one');
  });

  it('adds editable lesson building blocks without silently choosing the right answer', async () => {
    const onCommand = command(); await render(editor(onCommand)); await click('Bausteine auswählen');
    const preset = [...host.querySelectorAll<HTMLButtonElement>('.ac-template-card')].find(item => item.querySelector('strong')?.textContent === 'Richtig oder falsch?')!;
    await clickNode(preset); expect(onCommand).not.toHaveBeenCalled(); expect(control('Lektionstitel').value).toBe('Richtig oder falsch?');
    expect(host.textContent).toContain('Markieren Sie die richtige Antwort'); await click('Entwurf speichern');
    const lesson = (onCommand.mock.calls[0]![1].content as AcademyContent).lessons[2]!;
    expect(lesson.questions![0]!.options.map(option => option.text)).toEqual(['Richtig', 'Falsch']);
    expect(lesson.questions![0]!.correctOptionId).toBeUndefined();
  });

  it('previews material and quizzes locally while preserving unsaved course content', async () => {
    const onCommand = command(); await render(editor(onCommand)); await change('Kurstitel', 'Mein ungespeicherter Titel');
    await click('Vorschau für Lernende'); expect(host.querySelector('[aria-label="Vorschau für Lernende"]')).not.toBeNull();
    await click('In Vorschau als bearbeitet markieren'); expect(host.querySelector('[aria-label="Vorschaufortschritt"]')?.getAttribute('aria-valuenow')).toBe('50');
    await click('Nächste Lektion'); await clickNode(host.querySelectorAll<HTMLInputElement>('.ac-quiz-option input')[1]!); await click('Antworten in der Vorschau prüfen');
    expect(host.textContent).toContain('Vorschauergebnis: 0 %'); await clickNode(host.querySelectorAll<HTMLInputElement>('.ac-quiz-option input')[0]!); await click('Antworten in der Vorschau prüfen');
    expect(host.textContent).toContain('Vorschauergebnis: 100 %'); expect(onCommand).not.toHaveBeenCalled();
    await click('Zurück zur Bearbeitung'); expect(control('Kurstitel').value).toBe('Mein ungespeicherter Titel');
    await click('Vorschau für Lernende'); expect(host.querySelector('[aria-label="Vorschaufortschritt"]')?.getAttribute('aria-valuenow')).toBe('0');
  });

  it('stores a separate reusable template, retains its stable id after rejection and leaves course edits unsaved', async () => {
    const onCommand = command(); await render(editor(onCommand)); await click('Als eigene Vorlage speichern');
    await change('Name der neuen Vorlage', 'Meine Ablaufvorlage'); await change('Beschreibung der neuen Vorlage', 'Für neue Mitarbeitende');
    await click('Eigene Vorlage verbindlich speichern'); const first = onCommand.mock.calls[0]!;
    expect(first[0]).toBe('save_template'); expect(first[1]).toMatchObject({ name: 'Meine Ablaufvorlage', description: 'Für neue Mitarbeitende', content: { title: 'Unser eigener Kurs' } });
    expect(first[2]).toMatchObject({ revision: null });
    onCommand.mockImplementationOnce(async (_action, _data, record) => ({ recordId: record!.id, revision: 1 }));
    await click('Eigene Vorlage verbindlich speichern'); expect(onCommand.mock.calls[1]![2]).toEqual(first[2]);
    expect(host.querySelector('[aria-label="Kurs als eigene Vorlage speichern"]')).toBeNull(); expect(button('Entwurf speichern').disabled).toBe(false);
    expect(onCommand.mock.calls.map(call => call[0])).toEqual(['save_template', 'save_template']); expect(button('Veröffentlichen').disabled).toBe(true);
  });

  it('adopts a later template receipt despite JSON object ordering without writing a duplicate', async () => {
    const onCommand = command(); await render(editor(onCommand)); await click('Als eigene Vorlage speichern'); await click('Eigene Vorlage verbindlich speichern');
    const request = onCommand.mock.calls[0]!;
    const original = request[1].content as AcademyContent;
    const reordered = Object.fromEntries(Object.entries(original).reverse()) as AcademyContent;
    const confirmed = template({ id: request[2]!.id, revision: 1, name: String(request[1].name), description: String(request[1].description), content: reordered });
    await render(editor(onCommand, { templates: [confirmed] }));
    expect(host.querySelector('[aria-label="Kurs als eigene Vorlage speichern"]')).toBeNull(); expect(onCommand).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Die eigene Vorlage ist gespeichert'); expect(button('Entwurf speichern').disabled).toBe(false);
  });

  it('edits template content and metadata with CAS, preserves conflicts and never offers publication', async () => {
    const onCommand = command(); const input = template(); const props = { mode: 'template' as const, template: input, initialContent: input.content, draftId: input.id };
    await render(editor(onCommand, props)); expect(buttons('Veröffentlichen')).toHaveLength(0); await change('Vorlagenname', 'Mein Vorlagenname');
    onCommand.mockResolvedValueOnce({ recordId: input.id, revision: 3 }); await click('Vorlage speichern');
    expect(onCommand).toHaveBeenLastCalledWith('save_template', expect.objectContaining({ name: 'Mein Vorlagenname' }), { id: input.id, revision: 2 });
    await change('Kurstitel', 'Lokale Änderung');
    const changed = template({ revision: 4, name: 'Gemeinsame neue Vorlage', content: { ...content(), title: 'Serveränderung' } });
    await render(editor(onCommand, { ...props, template: changed })); expect(button('Vorlage speichern').disabled).toBe(true); expect(control('Kurstitel').value).toBe('Lokale Änderung');
    await click('Aktuellen gespeicherten Stand laden'); await click('Gespeicherten Stand übernehmen'); expect(control('Vorlagenname').value).toBe('Gemeinsame neue Vorlage');
    await change('Vorlagenbeschreibung', 'Abgestimmt'); await click('Vorlage speichern');
    expect(onCommand.mock.calls.at(-1)![2]).toEqual({ id: input.id, revision: 4 });
  });

  it('resolves a newly saved template after an external retry acknowledgement and saves the next revision', async () => {
    const onCommand = command(); const props = { mode: 'template' as const, template: null, draftId: 'new-template' };
    await render(editor(onCommand, props)); await click('Vorlage speichern');
    const saved = template({ id: 'new-template', revision: 1, name: 'Unser eigener Kurs', description: '' });
    await render(editor(onCommand, { ...props, template: saved })); expect(button('Vorlage speichern').disabled).toBe(true);
    await change('Vorlagenname', 'Ergänzte Vorlage'); await click('Vorlage speichern'); expect(onCommand.mock.calls.at(-1)![2]).toEqual({ id: 'new-template', revision: 1 });
  });

  it('warns before leaving an unsaved draft and removes the warning after a confirmed save', async () => {
    const onCommand = command(); await render(editor(onCommand));
    let event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    onCommand.mockResolvedValueOnce({ recordId: 'draft-one', revision: 1 }); await click('Entwurf speichern');
    event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
    await click('Als eigene Vorlage speichern'); event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
  });
});
