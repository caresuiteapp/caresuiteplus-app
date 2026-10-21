// @vitest-environment happy-dom
// React interactions prove behavior, not browser geometry.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcademyReports } from '@/features/akademie/AcademyReports.web';
import { downloadAcademyReportCsv } from '@/lib/akademie/academyReportsExport';
import type { AcademyEnrollment, AcademyWorkspace } from '@/lib/akademie/workspaceModel';

vi.mock('@/lib/akademie/academyReportsExport', () => ({ downloadAcademyReportCsv: vi.fn() }));

const enrollment = (id: string, state: AcademyEnrollment['state']): AcademyEnrollment => ({
  id, state, courseId: 'course-a', versionId: 'version-a', versionNumber: 1, revision: 1,
  participant: { id, name: `Person ${id}`, kind: 'employee', contextLabel: '', portalReady: true },
  content: { title: 'Sicher lernen', summary: '', category: '', audiences: ['employee'], estimatedMinutes: 20, mandatory: true, passPercent: 80, maxAttempts: 3, lessons: [] },
  dueDate: null, progress: 0, completedLessonIds: [], attempts: [], assignedAt: '2026-10-21', startedAt: null, submittedAt: null, completedAt: null, reviewNote: null, certificateId: null,
});
const workspace = (): AcademyWorkspace => ({ schemaVersion: 1, viewer: { mode: 'office', name: 'Verwaltung', audience: null }, capabilities: { manageCourses: true, assign: true, review: true, learn: false }, courses: [], participants: [], enrollments: [enrollment('one', 'completed'), enrollment('two', 'assigned'), enrollment('three', 'cancelled')], certificates: [] });

let host: HTMLDivElement;
let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); vi.mocked(downloadAcademyReportCsv).mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(data = workspace(), busy = false, selected = data.enrollments) {
  await act(async () => root.render(<AcademyReports workspace={data} courses={data.courses} enrollments={selected} certificates={data.certificates} busy={busy} />));
}
function exportButton() { return [...host.querySelectorAll('button')].find(button => button.textContent === 'Kursauswertung als CSV')!; }

describe('academy report interactions', () => {
  it('shows the denominator and exports the current selection only after an explicit click', async () => {
    const data = workspace();
    await render(data);
    expect(host.querySelector('[aria-label="Abschlussquote"]')?.textContent).toContain('50 %');
    expect(host.textContent).toContain('1 von 2 Teilnahmen abgeschlossen. 1 beendete Teilnahmen');
    expect(downloadAcademyReportCsv).not.toHaveBeenCalled();
    await render(data, false, [data.enrollments[0]!]);
    await act(async () => exportButton().click());
    expect(downloadAcademyReportCsv).toHaveBeenCalledWith(expect.objectContaining({ total: 1, completed: 1, completionRate: 100 }));
  });

  it('blocks exports while data is unresolved and reports a download failure without losing the data', async () => {
    await render(workspace(), true);
    expect(exportButton().disabled).toBe(true);
    await act(async () => exportButton().click());
    expect(downloadAcademyReportCsv).not.toHaveBeenCalled();
    await render();
    vi.mocked(downloadAcademyReportCsv).mockImplementationOnce(() => { throw new Error('download unavailable'); });
    await act(async () => exportButton().click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('konnte nicht heruntergeladen');
    expect(host.textContent).toContain('Sicher lernen');
    await act(async () => exportButton().click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows an empty state and never renders office reports for a learner workspace', async () => {
    const data = workspace(); data.enrollments = [];
    await render(data);
    expect(exportButton().disabled).toBe(true);
    expect(host.textContent).toContain('Keine Teilnahmen für diese Auswahl');
    expect(host.textContent).not.toContain('NaN');
    data.viewer.mode = 'learner';
    await render(data);
    expect(host.textContent).toBe('');
  });
});
