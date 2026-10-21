// @vitest-environment happy-dom
// Real React DOM interactions; these assertions do not establish browser layout quality.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyCourseEditor } from '@/features/akademie/AcademyCourseEditor.web';
import { AcademyLearningPlayer } from '@/features/akademie/AcademyLearningPlayer.web';
import { AcademyWorkspaceView, type AcademyWorkspaceViewProps } from '@/features/akademie/AcademyWorkspace.web';
import type { AcademyCertificate, AcademyCommandHandler, AcademyContent, AcademyCourse, AcademyEnrollment, AcademyMutationResult, AcademyWorkspace } from '@/lib/akademie/workspaceModel';

const title = 'Wissen für den Alltag';
const content = (): AcademyContent => ({
  title, summary: 'Sichere Abläufe kennenlernen', category: 'Einarbeitung', audiences: ['employee', 'client', 'family'], estimatedMinutes: 20,
  mandatory: true, passPercent: 80, maxAttempts: 3,
  lessons: [
    { id: 'lesson-text', kind: 'text', title: 'Erster Lernschritt', body: 'Ein verständlicher Lerntext.' },
    { id: 'lesson-quiz', kind: 'quiz', title: 'Wissen anwenden', body: '', questions: [{ id: 'question-1', prompt: 'Was hilft?', options: [{ id: 'option-a', text: 'Nachfragen' }, { id: 'option-b', text: 'Raten' }], correctOptionId: 'option-a' }] },
  ],
});
const course = (patch: Partial<AcademyCourse> = {}): AcademyCourse => ({ id: 'course-1', revision: 3, status: 'published', publishedVersionId: 'version-1', versionNumber: 1, content: content(), updatedAt: '2026-10-20', ...patch });
const enrollment = (patch: Partial<AcademyEnrollment> = {}): AcademyEnrollment => ({
  id: 'enrollment-1', courseId: 'course-1', versionId: 'version-1', versionNumber: 1, revision: 2,
  participant: { id: 'employee-1', kind: 'employee', name: 'Alex Beispiel', contextLabel: 'Team Pflege', portalReady: true },
  dueDate: '2026-11-30', state: 'assigned', progress: 0, completedLessonIds: [], attempts: [], content: content(), assignedAt: '2026-10-21',
  startedAt: null, submittedAt: null, completedAt: null, reviewNote: null, certificateId: null, ...patch,
});
const certificate = (patch: Partial<AcademyCertificate> = {}): AcademyCertificate => ({
  id: 'certificate-1', enrollmentId: 'enrollment-1', number: 'AK-001', courseTitle: title, participantName: 'Alex Beispiel', audience: 'employee', issuedAt: '2026-10-21', validUntil: null,
  revokedAt: null, revokedReason: null, issuerName: 'Prüfperson', organizationName: 'CareSuite', versionNumber: 1, estimatedMinutes: 20, ...patch,
});
const workspace = (patch: Partial<AcademyWorkspace> = {}): AcademyWorkspace => ({
  schemaVersion: 1, viewer: { mode: 'office', name: 'Verwaltung', audience: null }, capabilities: { manageCourses: true, assign: true, review: true, learn: true },
  courses: [course()], participants: [], enrollments: [enrollment()], certificates: [], ...patch,
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const buttons = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].filter(element => element.textContent?.trim() === text || element.getAttribute('aria-label') === text);
function button(text: string) { const result = buttons(text)[0]; expect(result, `Button: ${text}`).toBeDefined(); return result!; }
const click = async (text: string) => { await act(async () => button(text).click()); };
function control(text: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const explicit = [...host.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select')].find(element => element.getAttribute('aria-label') === text);
  const label = [...host.querySelectorAll('label')].find(element => element.firstChild?.textContent?.trim() === text || element.textContent?.trim() === text);
  const result = explicit ?? label?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select');
  expect(result, `Field: ${text}`).toBeDefined(); return result!;
}
async function change(text: string, value: string) {
  const element = control(text);
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    if (element instanceof HTMLInputElement && element.type === 'date') element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
const tick = async (element: HTMLInputElement) => { await act(async () => element.click()); };
const command = () => vi.fn<AcademyCommandHandler>().mockResolvedValue(null);
const receipt = (revision: number, fields: Partial<AcademyMutationResult> = {}): AcademyMutationResult => ({ recordId: 'enrollment-1', revision, ...fields });
const view = (props: Partial<AcademyWorkspaceViewProps> = {}) => <AcademyWorkspaceView workspace={workspace()} loading={false} busy={false} error={null} notice={null} view="office" onCommand={command()} onReload={vi.fn()} onDownloadCertificate={vi.fn().mockResolvedValue(undefined)} {...props} />;

describe('Academy course editor', () => {
  it('retains edits and the stable new record on failed save, then uses the acknowledged revision for publication', async () => {
    const onCommand = command();
    await render(<AcademyCourseEditor course={null} draftId="stable-draft" initialContent={content()} busy={false} onCommand={onCommand} onClose={vi.fn()} />);
    await change('Kurstitel', 'Mein eigener Kurs');
    await click('Entwurf speichern');
    expect(onCommand).toHaveBeenLastCalledWith('save_course', { content: expect.objectContaining({ title: 'Mein eigener Kurs' }) }, { id: 'stable-draft', revision: null });
    expect(control('Kurstitel').value).toBe('Mein eigener Kurs'); expect(button('Veröffentlichen').disabled).toBe(true);
    onCommand.mockResolvedValueOnce(receipt(1, { recordId: 'stable-draft' })); await click('Entwurf speichern');
    expect(button('Veröffentlichen').disabled).toBe(false);
    onCommand.mockResolvedValueOnce(receipt(2, { recordId: 'stable-draft' })); await click('Veröffentlichen');
    expect(onCommand).toHaveBeenLastCalledWith('publish_course', {}, { id: 'stable-draft', revision: 1 });
    expect(host.textContent).toContain('Die Fassung ist veröffentlicht'); expect(button('Veröffentlichen').disabled).toBe(true);
  });

  it('authors and reorders lessons and answer choices while preserving generated identifiers', async () => {
    const onCommand = command();
    await render(<AcademyCourseEditor course={null} draftId="new-course" initialContent={content()} busy={false} onCommand={onCommand} onClose={vi.fn()} />);
    await click('+ Wissenscheck'); await change('Lektionstitel', 'Zusatzfragen'); await change('Fragestellung', 'Was ist der nächste Schritt?');
    await change('Antwort 1 zu Frage 1', 'Nachfragen'); await change('Antwort 2 zu Frage 1', 'Abwarten'); await click('+ Antwortmöglichkeit'); await change('Antwort 3 zu Frage 1', 'Dokumentieren');
    await tick(control('Antwort 3 ist richtig') as HTMLInputElement); await click('Zusatzfragen nach oben'); await click('Entwurf speichern');
    const firstContent = onCommand.mock.calls[0]![1].content as AcademyContent;
    expect(firstContent.lessons.map(lesson => lesson.title)).toEqual(['Erster Lernschritt', 'Zusatzfragen', 'Wissen anwenden']);
    const question = firstContent.lessons[1]!.questions![0]!;
    expect(question.correctOptionId).toBe(question.options[2]!.id); expect(new Set(question.options.map(option => option.id)).size).toBe(3);
    await click('Entwurf speichern');
    expect((onCommand.mock.calls[1]![1].content as AcademyContent).lessons[1]).toEqual(firstContent.lessons[1]);
  });

  it('blocks unsafe material publication and confirms discarding an unsaved edit', async () => {
    const onCommand = command(); const onClose = vi.fn(); const input = content(); input.lessons = [{ id: 'video-1', title: 'Video', kind: 'video', body: '', url: 'javascript:alert(1)' }];
    await render(<AcademyCourseEditor course={course({ status: 'draft', content: input })} draftId="course-1" initialContent={input} busy={false} onCommand={onCommand} onClose={onClose} />);
    await click('Veröffentlichen'); expect(onCommand).not.toHaveBeenCalled(); expect(host.textContent).toContain('HTTPS-Link');
    await change('Kurstitel', 'Änderung'); await click('Schließen'); expect(onClose).not.toHaveBeenCalled();
    await click('Weiter bearbeiten'); expect(control('Kurstitel').value).toBe('Änderung'); await click('Schließen'); await click('Änderungen verwerfen'); expect(onClose).toHaveBeenCalledOnce();
  });

  it('locks authoring and discard controls while a pending mutation is unresolved', async () => {
    const onCommand = command(); const props = { course: null, draftId: 'new-course', initialContent: content(), onCommand, onClose: vi.fn() };
    await render(<AcademyCourseEditor {...props} busy={false} />); await click('Schließen');
    await render(<AcademyCourseEditor {...props} busy />);
    for (const element of host.querySelectorAll('button,input,textarea,select')) expect(element.matches(':disabled') || Boolean(element.closest('fieldset[disabled]')), element.outerHTML).toBe(true);
    await click('Entwurf speichern'); await click('Weiter bearbeiten'); expect(onCommand).not.toHaveBeenCalled(); expect(host.textContent).toContain('Ungespeicherte Änderungen verwerfen?');
  });

  it('keeps a conflicted draft until saved content is explicitly accepted and then continues with the current revision', async () => {
    const onCommand = command(); const initial = course({ status: 'draft' }); const props = { draftId: initial.id, initialContent: initial.content, busy: false, onCommand, onClose: vi.fn() };
    await render(<AcademyCourseEditor {...props} course={initial} />); await change('Kurstitel', 'Mein ungespeicherter Titel');
    const current = course({ revision: 7, status: 'draft', content: { ...content(), title: 'Änderung einer Kollegin' } });
    await render(<AcademyCourseEditor {...props} course={current} />);
    expect(control('Kurstitel').value).toBe('Mein ungespeicherter Titel'); expect(button('Entwurf speichern').disabled).toBe(true);
    await click('Aktuellen gespeicherten Stand laden'); await click('Meinen Entwurf behalten'); expect(control('Kurstitel').value).toBe('Mein ungespeicherter Titel');
    await click('Aktuellen gespeicherten Stand laden'); await click('Gespeicherten Stand übernehmen'); expect(control('Kurstitel').value).toBe('Änderung einer Kollegin');
    await change('Kurstitel', 'Gemeinsam überarbeiteter Kurs'); await click('Entwurf speichern');
    expect(onCommand).toHaveBeenLastCalledWith('save_course', { content: expect.objectContaining({ title: 'Gemeinsam überarbeiteter Kurs' }) }, { id: 'course-1', revision: 7 });
  });

  it('saves unfinished lesson and quiz drafts while preventing more than eight answer options', async () => {
    const onCommand = command(); await render(<AcademyCourseEditor course={null} draftId="draft" initialContent={content()} busy={false} onCommand={onCommand} onClose={vi.fn()} />);
    await click('+ Wissenscheck'); for (let index = 0; index < 6; index += 1) await click('+ Antwortmöglichkeit');
    expect(button('+ Antwortmöglichkeit').disabled).toBe(true); await click('Entwurf speichern');
    const saved = onCommand.mock.calls[0]![1].content as AcademyContent;
    expect(saved.lessons[2]).toMatchObject({ title: '', body: '', kind: 'quiz' }); expect(saved.lessons[2]!.questions![0]!.options).toHaveLength(8);
  });
});

describe('Academy learner', () => {
  it('persists start, material confirmation, server-scored attempts and submission using acknowledged revisions', async () => {
    const onCommand = command();
    await render(<AcademyLearningPlayer enrollment={enrollment()} certificate={null} busy={false} onCommand={onCommand} onDownloadCertificate={vi.fn()} onBack={vi.fn()} />);
    await click('Schulung starten'); expect(button('Bearbeitung bestätigen').disabled).toBe(true);
    onCommand.mockResolvedValueOnce(receipt(3)); await click('Schulung starten');
    expect(button('Bearbeitung bestätigen').disabled).toBe(true); await tick(control('Ich habe das Material bearbeitet.') as HTMLInputElement);
    onCommand.mockResolvedValueOnce(receipt(4)); await click('Bearbeitung bestätigen');
    expect(onCommand).toHaveBeenLastCalledWith('complete_lesson', { lessonId: 'lesson-text' }, { id: 'enrollment-1', revision: 3 });
    expect(host.textContent).toContain('1 von 2 Lektionen bearbeitet'); await click('Nächste Lektion');
    expect(host.querySelector('input[type=radio]:checked')).toBeNull();
    await tick([...host.querySelectorAll<HTMLInputElement>('input[type=radio]')][0]!);
    await click('Antworten abgeben'); expect(host.textContent).toContain('Bisher genutzt: 0 von 3');
    onCommand.mockResolvedValueOnce(receipt(5, { score: 0, passed: false })); await click('Antworten abgeben');
    expect(onCommand).toHaveBeenLastCalledWith('submit_quiz', { lessonId: 'lesson-quiz', answers: { 'question-1': 'option-a' } }, { id: 'enrollment-1', revision: 4 });
    expect(host.textContent).toContain('Noch nicht bestanden'); expect(button('Zur Prüfung einreichen').disabled).toBe(true);
    onCommand.mockResolvedValueOnce(receipt(6, { score: 100, passed: true })); await click('Antworten abgeben');
    expect(host.textContent).toContain('2 von 2 Lektionen bearbeitet'); expect(button('Zur Prüfung einreichen').disabled).toBe(false);
    onCommand.mockResolvedValueOnce(receipt(7)); await click('Zur Prüfung einreichen');
    expect(onCommand).toHaveBeenLastCalledWith('submit_enrollment', {}, { id: 'enrollment-1', revision: 6 });
    expect(host.textContent).toContain('Ihre Schulung ist eingereicht'); expect(button('Zur Prüfung einreichen').disabled).toBe(true);
  });

  it('continues with the first unfinished lesson and never renders answer keys or auto-loads outside media', async () => {
    const input = content(); input.lessons[0] = { id: 'lesson-text', title: 'Material', kind: 'video', body: '<img src="https://example.org/track" onerror="bad()">', url: 'https://example.org/video' };
    await render(<AcademyLearningPlayer enrollment={enrollment({ content: input, state: 'in_progress' })} certificate={null} busy={false} onCommand={command()} onDownloadCertificate={vi.fn()} onBack={vi.fn()} />);
    expect(host.querySelector('video,iframe,img,script')).toBeNull(); expect(host.textContent).toContain('<img src=');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('https://example.org/video'); expect(host.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
    await render(<AcademyLearningPlayer key="resumed" enrollment={enrollment({ completedLessonIds: ['lesson-text'], state: 'in_progress' })} certificate={null} busy={false} onCommand={command()} onDownloadCertificate={vi.fn()} onBack={vi.fn()} />);
    expect(host.querySelector('.ac-lesson-nav[aria-current=step]')?.textContent).toContain('Wissen anwenden');
    expect(host.querySelector('input[type=radio]:checked')).toBeNull(); expect(host.innerHTML).not.toContain('correctOptionId');
  });

  it('locks exhausted quiz attempts and untrusted resource links', async () => {
    const onCommand = command(); const input = content(); input.lessons = [input.lessons[1]!]; input.maxAttempts = 1;
    await render(<AcademyLearningPlayer enrollment={enrollment({ state: 'in_progress', content: input, attempts: [{ lessonId: 'lesson-quiz', attempt: 1, score: 0, passed: false, submittedAt: '2026-10-21' }] })} certificate={null} busy={false} onCommand={onCommand} onDownloadCertificate={vi.fn()} onBack={vi.fn()} />);
    expect(button('Antworten abgeben').disabled).toBe(true); expect(host.textContent).toContain('Versuche sind aufgebraucht');
    await click('Antworten abgeben'); expect(onCommand).not.toHaveBeenCalled();
    const videoContent = content(); videoContent.lessons = [{ id: 'video', title: 'Material', kind: 'video', body: '', url: 'https://user:password@example.org/private' }];
    await render(<AcademyLearningPlayer key="resource" enrollment={enrollment({ content: videoContent, state: 'in_progress' })} certificate={null} busy={false} onCommand={onCommand} onDownloadCertificate={vi.fn()} onBack={vi.fn()} />);
    expect(host.querySelector('a')).toBeNull(); await tick(control('Ich habe das Material bearbeitet.') as HTMLInputElement); expect(button('Bearbeitung bestätigen').disabled).toBe(true);
  });
});

describe('Academy workspace workflows', () => {
  it('assigns only published courses to individually selected active portal identities', async () => {
    const onCommand = command(); const data = workspace({ participants: [
      { id: 'same-id', kind: 'client', name: 'Klientin', contextLabel: '', portalReady: true },
      { id: 'same-id', kind: 'family', name: 'Angehörige', contextLabel: 'Zur Klientin', portalReady: true },
      { id: 'inactive', kind: 'employee', name: 'Ohne Portal', contextLabel: '', portalReady: false },
    ] });
    await render(view({ workspace: data, onCommand, initialSection: 'courses' })); await click('Zuweisen'); await click('Sichtbare Personen auswählen'); await change('Abschluss bis', '2026-12-01');
    expect([...host.querySelectorAll<HTMLInputElement>('.ac-target-row input')].find(element => element.disabled)).toBeDefined();
    await click('Schulung verbindlich zuweisen');
    expect(onCommand).toHaveBeenLastCalledWith('assign', { targets: [{ kind: 'client', id: 'same-id' }, { kind: 'family', id: 'same-id' }], dueDate: '2026-12-01' }, expect.objectContaining({ id: 'course-1', revision: 3 }));
    expect(host.textContent).toContain('2 von höchstens 200 ausgewählt');
    await render(view({ workspace: { ...data, courses: [course({ status: 'draft' })] }, onCommand, initialSection: 'courses' }));
    expect(button('Schulung verbindlich zuweisen').disabled).toBe(true);
  });

  it('shows a returned course again when a newer revision is submitted for another review', async () => {
    const onCommand = command(); const submitted = enrollment({ state: 'submitted', completedLessonIds: ['lesson-text', 'lesson-quiz'], progress: 100, submittedAt: '2026-10-21' });
    await render(view({ workspace: workspace({ enrollments: [submitted] }), onCommand, initialSection: 'reviews' })); await click('Prüfen');
    expect(button('Zur Überarbeitung zurückgeben').disabled).toBe(true); await change('Rückmeldung', 'Bitte noch einmal prüfen.');
    onCommand.mockResolvedValueOnce(receipt(3)); await click('Zur Überarbeitung zurückgeben');
    expect(onCommand).toHaveBeenLastCalledWith('review_enrollment', { decision: 'return', note: 'Bitte noch einmal prüfen.', validUntil: null }, submitted);
    expect(buttons('Prüfen')).toHaveLength(0);
    await render(view({ workspace: workspace({ enrollments: [{ ...submitted, state: 'returned', revision: 3 }] }), onCommand, initialSection: 'reviews' }));
    expect(buttons('Prüfen')).toHaveLength(0);
    await render(view({ workspace: workspace({ enrollments: [{ ...submitted, revision: 5 }] }), onCommand, initialSection: 'reviews' }));
    expect(buttons('Prüfen')).toHaveLength(1); await click('Prüfen');
    onCommand.mockResolvedValueOnce(receipt(6)); await click('Abschluss freigeben & Nachweis erstellen');
    expect(onCommand.mock.calls.at(-1)?.[2]).toMatchObject({ id: 'enrollment-1', revision: 5 });
  });

  it('opens the routed proof and returns to all proofs; download failures remain visible', async () => {
    const download = vi.fn().mockRejectedValue(new Error('read failed')); const data = workspace({ certificates: [certificate(), certificate({ id: 'certificate-2', enrollmentId: 'enrollment-2', courseTitle: 'Zweite Schulung', number: 'AK-002' })] });
    await render(view({ workspace: data, initialSection: 'certificates', initialEnrollmentId: 'enrollment-1', onDownloadCertificate: download }));
    expect(host.textContent).not.toContain('Zweite Schulung'); await click('PDF öffnen'); expect(download).toHaveBeenCalledWith(data.certificates[0]); expect(host.textContent).toContain('Nachweis konnte nicht geöffnet werden');
    await click('Alle Nachweise'); expect(host.textContent).toContain('Zweite Schulung');
  });

  it('opens an individually routed office enrollment and can return to the full assignment list', async () => {
    const other = enrollment({ id: 'enrollment-2', content: { ...content(), title: 'Andere Teilnahme' } });
    await render(view({ workspace: workspace({ enrollments: [enrollment(), other] }), initialSection: 'assignments', initialEnrollmentId: 'enrollment-1' }));
    expect(host.textContent).not.toContain('Andere Teilnahme'); await click('Alle Zuweisungen'); expect(host.textContent).toContain('Andere Teilnahme');
  });

  it('returns from a course detail route to learner cards and omits unreliable overview totals on errors', async () => {
    await render(view({ view: 'learner', initialCourseId: 'course-1' })); expect(host.querySelector('[aria-label="Lernbereich"]')).not.toBeNull();
    await click('Zur Übersicht'); expect(host.querySelector('[aria-label="Lernbereich"]')).toBeNull(); expect(buttons('Schulung öffnen')).toHaveLength(1);
    await render(view({ view: 'office', error: 'Die Daten konnten nicht aktualisiert werden.' })); expect(host.querySelector('.ac-kpis')).toBeNull(); expect(host.querySelector('[role=alert]')?.textContent).toContain('zuletzt geladenen Stand');
  });
});
