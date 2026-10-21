// @vitest-environment happy-dom
// Real DOM interactions; calendar geometry still requires a browser layout check.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyPlanning, type AcademyPlanningProps } from '@/features/akademie/AcademyPlanning.web';
import { AcademyWorkspaceView } from '@/features/akademie/AcademyWorkspace.web';
import type { AcademyCertificate, AcademyCommandHandler, AcademyContent, AcademyCourse, AcademyEnrollment, AcademyWorkspace } from '@/lib/akademie/workspaceModel';

const content = (title = 'Sicher im Team', mandatory = true): AcademyContent => ({ title, summary: 'Abläufe gemeinsam kennenlernen', category: 'Einarbeitung', audiences: ['employee'], estimatedMinutes: 30, mandatory, passPercent: 80, maxAttempts: 3, lessons: [{ id: 'lesson', kind: 'text', title: 'Grundlagen', body: 'Ein Lerntext.' }] });
const person = { id: 'employee', kind: 'employee' as const, name: 'Alex Beispiel', contextLabel: 'Team Nord', portalReady: true };
const course = (): AcademyCourse => ({ id: 'course', revision: 8, versionNumber: 2, publishedVersionId: 'version-2', status: 'published', content: content(), updatedAt: '2026-10-20' });
const enrollment = (patch: Partial<AcademyEnrollment> = {}): AcademyEnrollment => ({ id: 'enrollment', courseId: 'course', versionId: 'version-1', versionNumber: 1, revision: 4, participant: person, dueDate: '2026-10-24', state: 'assigned', progress: 0, completedLessonIds: [], attempts: [], content: content(), assignedAt: '2026-09-20', startedAt: null, submittedAt: null, completedAt: null, reviewNote: null, certificateId: null, ...patch });
const certificate = (patch: Partial<AcademyCertificate> = {}): AcademyCertificate => ({ id: 'certificate', enrollmentId: 'enrollment', number: 'AK-001', courseTitle: 'Sicher im Team', participantName: person.name, audience: 'employee', issuedAt: '2026-10-01', validUntil: '2026-10-26', revokedAt: null, revokedReason: null, issuerName: 'Prüfperson', organizationName: 'CareSuite', versionNumber: 1, estimatedMinutes: 30, ...patch });
const workspace = (patch: Partial<AcademyWorkspace> = {}): AcademyWorkspace => ({ schemaVersion: 1, viewer: { mode: 'office', name: 'Verwaltung', audience: null }, capabilities: { manageCourses: true, assign: true, review: true, learn: false }, courses: [course()], participants: [person], enrollments: [enrollment()], certificates: [], ...patch });
let host: HTMLDivElement; let root: Root;
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-21T10:00:00Z')); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });
const render = async (element: React.ReactNode) => { await act(async () => root.render(element)); };
const buttons = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].filter(element => element.textContent?.trim() === text || element.getAttribute('aria-label') === text);
const button = (text: string) => { const found = buttons(text)[0]; expect(found, text).toBeDefined(); return found!; };
const click = async (text: string) => { await act(async () => button(text).click()); };
function control(text: string) { const label = [...host.querySelectorAll('label')].find(element => element.firstChild?.textContent?.trim() === text); const found = label?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input,textarea'); expect(found, text).toBeDefined(); return found!; }
async function change(text: string, value: string) { const field = control(text); await act(async () => { Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); if (field instanceof HTMLInputElement && ['date', 'month'].includes(field.type)) field.dispatchEvent(new Event('change', { bubbles: true })); }); }
const command = () => vi.fn<AcademyCommandHandler>().mockResolvedValue(null);
const view = (props: Partial<AcademyPlanningProps> = {}) => <AcademyPlanning workspace={workspace()} busy={false} onCommand={command()} audience="all" query="" mandatoryOnly={false} onOpenEnrollment={vi.fn()} {...props} />;

describe('Academy planning interactions', () => {
  it('changes months, selects one day and restores the complete monthly agenda', async () => {
    const data = workspace({ enrollments: [enrollment(), enrollment({ id: 'november', content: content('Schulung im November'), dueDate: '2026-11-03' })] });
    await render(view({ workspace: data })); expect(control('Monat').value).toBe('2026-10');
    await click('24.10.2026 · 1 Eintrag'); expect(host.textContent).toContain('Einträge am 24.10.2026'); expect(button('24.10.2026 · 1 Eintrag').getAttribute('aria-pressed')).toBe('true');
    await click('Ganzer Monat'); expect(host.textContent).toContain('Fristen und Nachweise im Monat');
    await click('Nächster Monat'); expect(control('Monat').value).toBe('2026-11'); expect(host.textContent).toContain('Schulung im November'); expect(host.textContent).not.toContain('Einträge am 24.10.2026');
    await change('Monat', '2026-12'); await click('Nächster Monat'); expect(control('Monat').value).toBe('2027-01');
    await click('Aktueller Monat'); expect(control('Monat').value).toBe('2026-10');
  });

  it('keeps an unconfirmed deadline edit, then saves its reason against the actual enrollment revision', async () => {
    const onCommand = command(); await render(view({ onCommand })); await click('Frist ändern');
    await change('Begründung', 'Urlaub berücksichtigt'); expect(button('Frist verbindlich ändern').disabled).toBe(true);
    await change('Neue Abschlussfrist', '2026-11-10'); await click('Frist verbindlich ändern');
    expect(onCommand).toHaveBeenLastCalledWith('change_due_date', { dueDate: '2026-11-10', note: 'Urlaub berücksichtigt' }, { id: 'enrollment', revision: 4 });
    expect(control('Neue Abschlussfrist').value).toBe('2026-11-10'); expect(control('Begründung').value).toBe('Urlaub berücksichtigt');
    onCommand.mockResolvedValueOnce({ recordId: 'enrollment', revision: 5 }); await click('Frist verbindlich ändern'); expect(host.querySelector('[aria-label="Frist bearbeiten"]')).toBeNull();
  });

  it('requires acknowledgement of a changed revision without losing the local deadline and reason', async () => {
    const onCommand = command(); await render(view({ onCommand })); await click('Frist ändern'); await change('Neue Abschlussfrist', '2026-11-04'); await change('Begründung', 'Zeitbedarf neu abgestimmt');
    await render(view({ onCommand, workspace: workspace({ enrollments: [enrollment({ revision: 7, dueDate: '2026-10-30' })] }) }));
    expect(button('Frist verbindlich ändern').disabled).toBe(true); expect(host.textContent).toContain('Der gespeicherte Stand hat sich geändert.'); expect(control('Neue Abschlussfrist').value).toBe('2026-11-04');
    await click('Aktuellen Stand übernehmen'); await click('Frist verbindlich ändern'); expect(onCommand).toHaveBeenLastCalledWith('change_due_date', { dueDate: '2026-11-04', note: 'Zeitbedarf neu abgestimmt' }, { id: 'enrollment', revision: 7 });
  });

  it('renews a completed course without an expiry date using the current published course revision', async () => {
    const onCommand = command(); const onOpenEnrollment = vi.fn(); const completed = enrollment({ state: 'completed', progress: 100, completedAt: '2026-10-01', certificateId: 'certificate' });
    await render(view({ onCommand, onOpenEnrollment, workspace: workspace({ enrollments: [completed], certificates: [certificate({ validUntil: null })] }) }));
    await act(async () => host.querySelector<HTMLDetailsElement>('details')!.querySelector('summary')!.click()); await click('Folgeschulung planen');
    expect(host.textContent).toContain('aktuell veröffentlichte Fassung 2'); expect(button('Folgeschulung verbindlich zuweisen').disabled).toBe(true);
    await change('Abschlussfrist der Folgeschulung', '2026-12-01'); await change('Begründung', 'Jährliche Auffrischung');
    onCommand.mockResolvedValueOnce({ recordId: 'enrollment', revision: 5, createdEnrollmentId: 'follow-up' }); await click('Folgeschulung verbindlich zuweisen');
    expect(onCommand).toHaveBeenLastCalledWith('renew_enrollment', { dueDate: '2026-12-01', note: 'Jährliche Auffrischung', courseRevision: 8 }, { id: 'enrollment', revision: 4 });
    expect(host.textContent).toContain('Die Folgeschulung ist angelegt.'); await click('Neue Teilnahme ansehen'); expect(onOpenEnrollment).toHaveBeenLastCalledWith('follow-up');
  });

  it('links an already planned follow-up and allows a new cycle only from its cancelled successor', async () => {
    const onCommand = command(); const onOpenEnrollment = vi.fn(); const source = enrollment({ state: 'completed', nextEnrollmentId: 'follow-up', certificateId: 'certificate' });
    const followup = enrollment({ id: 'follow-up', state: 'cancelled', previousEnrollmentId: source.id, assignedAt: '2026-10-18', revision: 3 });
    await render(view({ onCommand, onOpenEnrollment, workspace: workspace({ enrollments: [source, followup], certificates: [certificate()] }) }));
    await click('Folgeteilnahme ansehen'); expect(onOpenEnrollment).toHaveBeenLastCalledWith('follow-up');
    await click('Folgeschulung planen'); await change('Begründung', 'Erneuter Termin nach Absage'); await click('Folgeschulung verbindlich zuweisen');
    expect(onCommand).toHaveBeenLastCalledWith('renew_enrollment', { dueDate: null, note: 'Erneuter Termin nach Absage', courseRevision: 8 }, { id: 'follow-up', revision: 3 });
  });

  it('does not offer a parallel renewal or a disabled personal portal account', async () => {
    const completed = enrollment({ state: 'completed', certificateId: 'certificate' });
    await render(view({ workspace: workspace({ enrollments: [completed, enrollment({ id: 'active', assignedAt: '2026-10-18' })], certificates: [certificate()] }) }));
    expect(buttons('Folgeschulung planen')).toHaveLength(0); expect(host.textContent).toContain('läuft bereits eine Teilnahme');
    await render(view({ workspace: workspace({ enrollments: [completed], certificates: [certificate()], participants: [{ ...person, portalReady: false }] }) }));
    expect(buttons('Folgeschulung planen')).toHaveLength(0); expect(host.textContent).toContain('Ein aktiver, für Sie freigegebener Portalzugang ist erforderlich.');
  });

  it('shows the saved deadline history to learners without exposing office mutations', async () => {
    const onCommand = command(); const onOpenEnrollment = vi.fn(); const personal = workspace({ viewer: { mode: 'learner', name: person.name, audience: 'employee' }, capabilities: { manageCourses: false, assign: false, review: false, learn: true }, participants: [], courses: [], enrollments: [enrollment({ dateChanges: [{ previousDueDate: '2026-10-20', dueDate: '2026-10-24', note: 'Termin gemeinsam abgestimmt', changedAt: '2026-10-21T08:00:00Z' }] })] });
    await render(view({ workspace: personal, onCommand, onOpenEnrollment }));
    expect(host.textContent).toContain('Fristverlauf (1)'); expect(host.textContent).toContain('Termin gemeinsam abgestimmt'); expect(buttons('Frist ändern')).toHaveLength(0); expect(buttons('Folgeschulung planen')).toHaveLength(0);
    await click('Schulung öffnen'); expect(onOpenEnrollment).toHaveBeenCalledWith('enrollment'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('locks a visible edit while a write is pending and retains the form on a rejected request', async () => {
    const onCommand = command().mockRejectedValue(new Error('offline')); await render(view({ onCommand })); await click('Frist ändern'); await change('Neue Abschlussfrist', '2026-11-04'); await change('Begründung', 'Gemeinsam abgestimmt');
    await render(view({ onCommand, busy: true })); expect(button('Frist verbindlich ändern').matches(':disabled')).toBe(true); await click('Frist verbindlich ändern'); expect(onCommand).not.toHaveBeenCalled();
    await render(view({ onCommand })); await click('Frist verbindlich ändern'); expect(host.textContent).toContain('Ihre Eingaben bleiben erhalten.'); expect(control('Begründung').value).toBe('Gemeinsam abgestimmt');
  });

  it('applies the real mandatory filter in the workspace and opens the personal course from the plan', async () => {
    const data = workspace({ viewer: { mode: 'learner', name: person.name, audience: 'employee' }, capabilities: { manageCourses: false, assign: false, review: false, learn: true }, courses: [], participants: [], enrollments: [enrollment(), enrollment({ id: 'optional', content: content('Freiwilliger Kurs', false) })] });
    await render(<AcademyWorkspaceView workspace={data} loading={false} busy={false} error={null} notice={null} view="learner" initialSection="planning" initialMandatoryOnly onCommand={command()} onReload={vi.fn()} onDownloadCertificate={vi.fn()} />);
    expect(host.textContent).not.toContain('Freiwilliger Kurs'); const filter = [...host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')][0]!; expect(filter.checked).toBe(true);
    await act(async () => filter.click()); expect(host.textContent).toContain('Freiwilliger Kurs'); await click('Schulung öffnen'); expect(host.textContent).toContain('Schulung starten'); expect(host.querySelector('.ac-calendar')).toBeNull();
  });

  it('keeps certificate counts linked to the participants found by their team context', async () => {
    const north = enrollment({ state: 'completed', completedAt: '2026-10-01', certificateId: 'certificate' });
    const south = enrollment({ id: 'south', state: 'completed', completedAt: '2026-10-01', certificateId: 'south-certificate', participant: { ...person, id: 'south-person', name: 'Sam Beispiel', contextLabel: 'Team Süd' } });
    const data = workspace({ enrollments: [north, south], certificates: [certificate(), certificate({ id: 'south-certificate', enrollmentId: 'south', participantName: 'Sam Beispiel', number: 'AK-002', validUntil: null })] });
    await render(<AcademyWorkspaceView workspace={data} loading={false} busy={false} error={null} notice={null} view="office" initialSection="reports" onCommand={command()} onReload={vi.fn()} onDownloadCertificate={vi.fn()} />);
    expect(host.textContent).toContain('2 Nachweise sind in der gefilterten Historie enthalten.');
    await change('Suchen', 'Team Nord');
    const proofs = host.querySelector('[aria-label="Nachweise in der Auswertung"]')!;
    expect(proofs.textContent).toContain('1 Nachweise sind in der gefilterten Historie enthalten.');
    const expiring = [...proofs.querySelectorAll('.ac-kpi')].find(element => element.querySelector('span')?.textContent === 'Läuft in 30 Tagen ab');
    expect(expiring?.querySelector('strong')?.textContent).toBe('1');
    const total = [...host.querySelectorAll('.ac-kpi')].find(element => element.querySelector('span')?.textContent === 'Teilnahmen in Auswahl');
    expect(total?.querySelector('strong')?.textContent).toBe('1');
  });
});
