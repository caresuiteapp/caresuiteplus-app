// @vitest-environment happy-dom
// Interaction checks only; responsive geometry requires a browser.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyTemplateLibrary, type AcademyTemplateLibraryProps } from '@/features/akademie/AcademyTemplateLibrary.web';
import { AcademyWorkspaceView } from '@/features/akademie/AcademyWorkspace.web';
import type { AcademyCommandHandler, AcademyContent, AcademyCourse, AcademyReusableTemplate, AcademyWorkspace } from '@/lib/akademie/workspaceModel';

const content = (): AcademyContent => ({ title: 'Unsere Abläufe', summary: 'Gemeinsam verlässlich arbeiten', category: 'Eigene Abläufe', audiences: ['employee'], estimatedMinutes: 25,
  mandatory: true, passPercent: 80, maxAttempts: 3, lessons: [{ id: 'text-one', title: 'Gemeinsamer Einstieg', kind: 'text', body: 'Unsere Lerninhalte.' },
    { id: 'quiz-one', title: 'Wissen überprüfen', kind: 'quiz', body: '', questions: [{ id: 'question-one', prompt: 'Was hilft?', options: [{ id: 'yes', text: 'Nachfragen' }, { id: 'no', text: 'Raten' }], correctOptionId: 'yes' }] }] });
const template = (patch: Partial<AcademyReusableTemplate> = {}): AcademyReusableTemplate => ({ id: 'template-one', revision: 3, name: 'Teamvorlage', description: 'Unsere interne Einarbeitung', status: 'active', content: content(), updatedAt: '2026-10-21T10:00:00Z', ...patch });
const course = (patch: Partial<AcademyCourse> = {}): AcademyCourse => ({ id: 'course-one', revision: 6, content: content(), status: 'published', versionNumber: 2, publishedVersionId: 'version-two', updatedAt: '2026-10-21T10:00:00Z', ...patch });
const workspace = (patch: Partial<AcademyWorkspace> = {}): AcademyWorkspace => ({ schemaVersion: 1, viewer: { mode: 'office', name: 'Redaktion', audience: null }, capabilities: { manageCourses: true, assign: true, review: true, learn: false }, courses: [course()], templates: [template()], participants: [], enrollments: [], certificates: [], ...patch });
let host: HTMLDivElement; let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const buttons = (label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].filter(element => element.textContent?.trim() === label || element.getAttribute('aria-label') === label);
const button = (label: string) => { const found = buttons(label)[0]; expect(found, label).toBeDefined(); return found!; };
const click = async (label: string) => { await act(async () => button(label).click()); };
function field(label: string) { const wrapper = [...host.querySelectorAll('label')].find(element => element.firstChild?.textContent?.trim() === label); const input = wrapper?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'); expect(input, label).toBeDefined(); return input!; }
async function change(label: string, value: string) { const input = field(label); await act(async () => { const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); }); }
const command = () => vi.fn<AcademyCommandHandler>().mockResolvedValue(null);
const library = (props: Partial<AcademyTemplateLibraryProps> = {}) => <AcademyTemplateLibrary templates={[template()]} busy={false} onCommand={command()} onUseContent={vi.fn()} onEditTemplate={vi.fn()} onCreateBlank={vi.fn()} onCreateTemplate={vi.fn()} {...props} />;

describe('Academy reusable template library', () => {
  it('filters by ownership, audience, topic and text, then focuses a real content outline', async () => {
    const family = template({ id: 'family', name: 'Familienvorlage', content: { ...content(), category: 'Angehörige', audiences: ['family'] } });
    const archived = template({ id: 'old', name: 'Alte Vorlage', status: 'archived' });
    await render(library({ templates: [template(), family, archived] }));
    expect(host.textContent).not.toContain('Alte Vorlage');
    await change('Herkunft', 'own'); expect(host.querySelectorAll('.ac-template-tile')).toHaveLength(2);
    await change('Vorlagen-Zielgruppe', 'employee'); expect(host.querySelectorAll('.ac-template-tile')).toHaveLength(1);
    await change('Themenbereich', 'Eigene Abläufe'); await change('Vorlagen suchen', 'Einarbeitung'); expect(host.querySelectorAll('.ac-template-tile')).toHaveLength(1);
    await click('Vorlage ansehen: Teamvorlage');
    const details = host.querySelector('[aria-label="Vorlagendetails"]')!;
    expect(document.activeElement).toBe(details); expect(details.textContent).toContain('Gemeinsamer Einstieg'); expect(details.textContent).toContain('Wissenscheck · 1 Frage');
    await change('Vorlagen suchen', 'nicht vorhanden'); expect(host.textContent).toContain('Keine passende Vorlage'); expect(host.querySelector('[aria-label="Vorlagendetails"]')).toBeNull();
  });

  it('opens reusable content and the current template without mutating or publishing it', async () => {
    const onCommand = command(); const onUseContent = vi.fn(); const onEditTemplate = vi.fn(); const own = template();
    await render(library({ templates: [own], onCommand, onUseContent, onEditTemplate }));
    await click('Als Kurs verwenden: Teamvorlage'); expect(onUseContent).toHaveBeenCalledWith(own.content); expect(onCommand).not.toHaveBeenCalled();
    await click('Vorlage ansehen: Teamvorlage'); await click('Vorlage bearbeiten'); expect(onEditTemplate).toHaveBeenCalledWith(own);
    expect(own.content.lessons[1]!.questions![0]!.correctOptionId).toBe('yes');
  });

  it('requires archive confirmation and a fresh revision while retaining a rejected action', async () => {
    const onCommand = command(); await render(library({ onCommand })); await click('Vorlage ansehen: Teamvorlage'); await click('Vorlage archivieren');
    expect(onCommand).not.toHaveBeenCalled(); await click('Jetzt archivieren');
    expect(onCommand).toHaveBeenLastCalledWith('archive_template', {}, { id: 'template-one', revision: 3 });
    expect(host.querySelector('[aria-label="Vorlagenstatus ändern"]')).not.toBeNull();
    await render(library({ onCommand, templates: [template({ revision: 5 })] })); expect(button('Jetzt archivieren').disabled).toBe(true);
    expect(host.textContent).toContain('Die Vorlage wurde inzwischen geändert.'); await click('Abbrechen'); await click('Vorlage archivieren');
    onCommand.mockResolvedValueOnce({ recordId: 'template-one', revision: 6 }); await click('Jetzt archivieren');
    expect(onCommand).toHaveBeenLastCalledWith('archive_template', {}, { id: 'template-one', revision: 5 });
    expect(host.textContent).toContain('Die Vorlage wurde archiviert.');
  });

  it('shows archived templates only in the archive and restores them after confirmation', async () => {
    const onCommand = command(); const data = [template({ status: 'archived', revision: 4 })];
    await render(library({ templates: data, onCommand })); expect(buttons('Als Kurs verwenden: Teamvorlage')).toHaveLength(0);
    await change('Herkunft', 'archived'); await click('Vorlage ansehen: Teamvorlage');
    expect(buttons('Vorlage bearbeiten')).toHaveLength(0); await click('Vorlage wiederherstellen');
    await render(library({ templates: data, onCommand, busy: true })); expect(button('Jetzt wiederherstellen').disabled).toBe(true); expect(field('Herkunft').disabled).toBe(true);
    await render(library({ templates: data, onCommand })); onCommand.mockResolvedValueOnce({ recordId: 'template-one', revision: 5 }); await click('Jetzt wiederherstellen');
    expect(onCommand).toHaveBeenLastCalledWith('restore_template', {}, { id: 'template-one', revision: 4 });
    expect(host.textContent).toContain('wieder für neue Kurse');
  });

  it('copies an archived course into an independent unsaved course with fresh answer identifiers', async () => {
    const onCommand = command(); const original = course({ status: 'archived' });
    await render(<AcademyWorkspaceView workspace={workspace({ courses: [original] })} loading={false} busy={false} error={null} notice={null} view="office" initialSection="courses" onCommand={onCommand} onReload={vi.fn()} onDownloadCertificate={vi.fn()} />);
    await click('Kurs kopieren: Unsere Abläufe'); expect(field('Kurstitel').value).toBe('Unsere Abläufe – Kopie'); expect(onCommand).not.toHaveBeenCalled();
    await click('Entwurf speichern'); const [action, data, record] = onCommand.mock.calls[0]!; const draft = data.content as AcademyContent;
    expect(action).toBe('save_course'); expect(record?.id).not.toBe(original.id); expect(record?.revision).toBeNull();
    expect(draft.lessons[0]!.id).not.toBe(original.content.lessons[0]!.id);
    const question = draft.lessons[1]!.questions![0]!; expect(question.id).not.toBe('question-one'); expect(question.correctOptionId).toBe(question.options[0]!.id); expect(question.correctOptionId).not.toBe('yes');
    expect(original.content.title).toBe('Unsere Abläufe'); expect(original.status).toBe('archived');
  });

  it('uses saved templates as new course drafts and restricts template tools to authors', async () => {
    const onCommand = command(); const props = { loading: false, busy: false, error: null, notice: null, onCommand, onReload: vi.fn(), onDownloadCertificate: vi.fn() };
    await render(<AcademyWorkspaceView {...props} workspace={workspace()} view="office" initialSection="templates" />);
    await click('Als Kurs verwenden: Teamvorlage'); await click('Entwurf speichern');
    expect(onCommand.mock.calls[0]![0]).toBe('save_course'); expect(onCommand.mock.calls[0]![2]?.id).not.toBe('template-one');
    expect((onCommand.mock.calls[0]![1].content as AcademyContent).lessons[0]!.id).not.toBe('text-one');
    await render(<AcademyWorkspaceView key="viewer" {...props} workspace={workspace({ capabilities: { manageCourses: false, assign: false, review: false, learn: false }, templates: [] })} view="office" initialSection="templates" />);
    expect(buttons('Vorlagen')).toHaveLength(0); expect(buttons('Eigene Vorlage erstellen')).toHaveLength(0); expect(buttons('Kurs kopieren: Unsere Abläufe')).toHaveLength(0);
    expect(host.textContent).toContain('Berechtigung zur Kursbearbeitung');
  });
});
