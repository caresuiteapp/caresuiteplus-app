import { useMemo, useState } from 'react';
import { academyReportToday, deriveAcademyReport } from '@/lib/akademie/academyReports';
import { downloadAcademyReportCsv } from '@/lib/akademie/academyReportsExport';
import type { AcademyCertificate, AcademyCourse, AcademyEnrollment, AcademyWorkspace } from '@/lib/akademie/workspaceModel';

type Props = {
  workspace: AcademyWorkspace;
  enrollments: AcademyEnrollment[];
  courses: AcademyCourse[];
  certificates: AcademyCertificate[];
  busy: boolean;
};

function dateText(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
}

export function AcademyReports({ workspace, enrollments, courses, certificates, busy }: Props) {
  const [exportError, setExportError] = useState<string | null>(null);
  const today = academyReportToday();
  const report = useMemo(() => deriveAcademyReport(enrollments, certificates, courses, today, workspace), [enrollments, certificates, courses, today, workspace]);
  // A query parameter must never turn a personal learning area into an office report.
  if (workspace.viewer.mode !== 'office') return null;

  const exportReport = () => {
    if (busy || !report.total) return;
    setExportError(null);
    try { downloadAcademyReportCsv(report); }
    catch { setExportError('Die Auswertung konnte nicht heruntergeladen werden. Bitte versuchen Sie es erneut.'); }
  };
  return <div aria-label="Akademie-Auswertungen">
    <section className="ac-panel">
      <div className="ac-panel-header">
        <div><p className="ac-eyebrow">LERNSTÄNDE AUSWERTEN</p><h2 className="ac-section-title">Schulungen im Überblick</h2>
          <p className="ac-muted">Stichtag {dateText(report.today)} · Die gewählte Zielgruppe, Pflichtauswahl und Suche gelten für diese Auswertung.</p>
        </div>
        <button type="button" className="ac-button" disabled={busy || !report.total} onClick={exportReport}>Kursauswertung als CSV</button>
      </div>
      {exportError && <p className="ac-message" data-tone="error" role="alert">{exportError}</p>}
      <div className="ac-kpis">
        <div className="ac-kpi"><span>Teilnahmen in Auswahl</span><strong className="ac-kpi-value">{report.total}</strong><small className="ac-muted">Jede Folgeschulung zählt einzeln.</small></div>
        <div className="ac-kpi"><span>Offen</span><strong className="ac-kpi-value">{report.open}</strong><small className="ac-muted">Zugewiesen, in Bearbeitung oder zurückgegeben.</small></div>
        <div className="ac-kpi"><span>Zur Prüfung</span><strong className="ac-kpi-value">{report.submitted}</strong><small className="ac-muted">Lernende haben vollständig eingereicht.</small></div>
        <div className="ac-kpi"><span>Abgeschlossen</span><strong className="ac-kpi-value">{report.completed}</strong><small className="ac-muted">Durch Prüfende bestätigt.</small></div>
      </div>
      <div className="ac-card-grid">
        <article className="ac-course-card" aria-label="Abschlussquote">
          <div className="ac-stat-line"><h3>Abschlussquote</h3><strong className="ac-kpi-value">{report.completionRate === null ? '–' : `${report.completionRate} %`}</strong></div>
          {report.completionRate !== null && <div className="ac-progress" role="progressbar" aria-label="Abschlussquote" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.completionRate}><span style={{ width: `${report.completionRate}%` }} /></div>}
          <p className="ac-muted">{report.completed} von {report.completionBase} Teilnahmen abgeschlossen. {report.cancelled} beendete Teilnahmen werden nicht in die Quote einbezogen.</p>
        </article>
        <article className="ac-course-card" aria-label="Überfällige Schulungen">
          <div className="ac-stat-line"><h3>Frist überschritten</h3><strong className="ac-kpi-value">{report.overdue}</strong></div>
          <p>{report.mandatoryOverdue} davon verpflichtend</p>
          <p className="ac-muted">Zur Prüfung eingereichte Schulungen gelten nicht mehr als offene Lernfrist.</p>
        </article>
      </div>
    </section>
    <section className="ac-panel" aria-label="Nachweise in der Auswertung">
      <div className="ac-panel-header"><div><h2 className="ac-section-title">Gültigkeit der Nachweise</h2><p className="ac-muted">Je Person und Kurs zählt der jüngste ausgestellte Nachweis. {report.certificates.historical} Nachweise sind in der gefilterten Historie enthalten.</p></div></div>
      <div className="ac-kpis">
        <div className="ac-kpi"><span>Läuft in 30 Tagen ab</span><strong className="ac-kpi-value">{report.certificates.expiring}</strong><small className="ac-muted">Bis einschließlich {dateText(report.expiringThrough)}</small></div>
        <div className="ac-kpi"><span>Abgelaufen</span><strong className="ac-kpi-value">{report.certificates.expired}</strong></div>
        <div className="ac-kpi"><span>Zurückgenommen</span><strong className="ac-kpi-value">{report.certificates.revoked}</strong></div>
        <div className="ac-kpi"><span>Ohne Ablaufdatum</span><strong className="ac-kpi-value">{report.certificates.withoutExpiry}</strong></div>
      </div>
      <p className="ac-muted">Diese Angaben beschreiben den dokumentierten Lernabschluss. Sie ersetzen keine Prüfung beruflicher Qualifikationen.</p>
    </section>
    <section className="ac-panel">
      <div className="ac-panel-header"><div><h2 className="ac-section-title">Auswertung je Kurs</h2><p className="ac-muted">Kurse mit offenen Fristen stehen zuerst. Der CSV-Export enthält diese Kurszahlen ohne Personennamen.</p></div></div>
      {report.courses.length ? <div className="ac-card-grid">{report.courses.map(course => <article className="ac-course-card" key={course.courseId}>
        <div><h3>{course.title}</h3><p className="ac-muted">Fassungen {course.versions.join(', ')} · {course.total} Teilnahmen</p></div>
        <div className="ac-badges"><span className="ac-status">{course.open} offen</span><span className="ac-status" data-tone="attention">{course.submitted} zur Prüfung</span><span className="ac-status" data-tone="good">{course.completed} abgeschlossen</span>{course.cancelled > 0 && <span className="ac-status">{course.cancelled} beendet</span>}{course.overdue > 0 && <span className="ac-status" data-tone="danger">{course.overdue} überfällig</span>}</div>
        <div className="ac-stat-line"><span>Abschlussquote</span><strong>{course.completionRate === null ? '–' : `${course.completionRate} %`}</strong></div>
        {course.completionRate !== null && <div className="ac-progress" role="progressbar" aria-label={`Abschlussquote ${course.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={course.completionRate}><span style={{ width: `${course.completionRate}%` }} /></div>}
        <p className="ac-muted">{course.certificates.expiring} Nachweise laufen in 30 Tagen ab · {course.certificates.expired} abgelaufen</p>
      </article>)}</div> : <div className="ac-empty"><h3>Keine Teilnahmen für diese Auswahl</h3><p>Passen Sie die Filter an oder weisen Sie einen veröffentlichten Kurs zu.</p></div>}
    </section>
  </div>;
}
