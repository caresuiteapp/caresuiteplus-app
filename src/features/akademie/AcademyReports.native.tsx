// Generated native presentation from src/features/akademie/AcademyReports.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeSection,NativeP,NativeH2,NativeButton,NativeSpan,NativeStrong,NativeSmall,NativeArticle,NativeH3} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
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
    if (workspace.viewer.mode !== 'office')
        return null;
    const exportReport = async () => {
        if (busy || !report.total)
            return;
        setExportError(null);
        try {
            await downloadAcademyReportCsv(report);
        }
        catch {
            setExportError('Die Auswertung konnte nicht heruntergeladen werden. Bitte versuchen Sie es erneut.');
        }
    };
    return <NativeDiv aria-label="Akademie-Auswertungen">
    <NativeSection className="ac-panel">
      <NativeDiv className="ac-panel-header">
        <NativeDiv><NativeP className="ac-eyebrow">LERNSTÄNDE AUSWERTEN</NativeP><NativeH2 className="ac-section-title">Schulungen im Überblick</NativeH2>
          <NativeP className="ac-muted">Stichtag {dateText(report.today)} · Die gewählte Zielgruppe, Pflichtauswahl und Suche gelten für diese Auswertung.</NativeP>
        </NativeDiv>
        <NativeButton type="button" className="ac-button" disabled={busy || !report.total} onClick={exportReport}>Kursauswertung als CSV</NativeButton>
      </NativeDiv>
      {exportError && <NativeP className="ac-message" data-tone="error" role="alert">{exportError}</NativeP>}
      <NativeDiv className="ac-kpis">
        <NativeDiv className="ac-kpi"><NativeSpan>Teilnahmen in Auswahl</NativeSpan><NativeStrong className="ac-kpi-value">{report.total}</NativeStrong><NativeSmall className="ac-muted">Jede Folgeschulung zählt einzeln.</NativeSmall></NativeDiv>
        <NativeDiv className="ac-kpi"><NativeSpan>Offen</NativeSpan><NativeStrong className="ac-kpi-value">{report.open}</NativeStrong><NativeSmall className="ac-muted">Zugewiesen, in Bearbeitung oder zurückgegeben.</NativeSmall></NativeDiv>
        <NativeDiv className="ac-kpi"><NativeSpan>Zur Prüfung</NativeSpan><NativeStrong className="ac-kpi-value">{report.submitted}</NativeStrong><NativeSmall className="ac-muted">Lernende haben vollständig eingereicht.</NativeSmall></NativeDiv>
        <NativeDiv className="ac-kpi"><NativeSpan>Abgeschlossen</NativeSpan><NativeStrong className="ac-kpi-value">{report.completed}</NativeStrong><NativeSmall className="ac-muted">Durch Prüfende bestätigt.</NativeSmall></NativeDiv>
      </NativeDiv>
      <NativeDiv className="ac-card-grid">
        <NativeArticle className="ac-course-card" aria-label="Abschlussquote">
          <NativeDiv className="ac-stat-line"><NativeH3>Abschlussquote</NativeH3><NativeStrong className="ac-kpi-value">{report.completionRate === null ? '–' : `${report.completionRate} %`}</NativeStrong></NativeDiv>
          {report.completionRate !== null && <NativeDiv className="ac-progress" role="progressbar" aria-label="Abschlussquote" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.completionRate}><NativeSpan style={{ width: `${report.completionRate}%` }}/></NativeDiv>}
          <NativeP className="ac-muted">{report.completed} von {report.completionBase} Teilnahmen abgeschlossen. {report.cancelled} beendete Teilnahmen werden nicht in die Quote einbezogen.</NativeP>
        </NativeArticle>
        <NativeArticle className="ac-course-card" aria-label="Überfällige Schulungen">
          <NativeDiv className="ac-stat-line"><NativeH3>Frist überschritten</NativeH3><NativeStrong className="ac-kpi-value">{report.overdue}</NativeStrong></NativeDiv>
          <NativeP>{report.mandatoryOverdue} davon verpflichtend</NativeP>
          <NativeP className="ac-muted">Zur Prüfung eingereichte Schulungen gelten nicht mehr als offene Lernfrist.</NativeP>
        </NativeArticle>
      </NativeDiv>
    </NativeSection>
    <NativeSection className="ac-panel" aria-label="Nachweise in der Auswertung">
      <NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">Gültigkeit der Nachweise</NativeH2><NativeP className="ac-muted">Je Person und Kurs zählt der jüngste ausgestellte Nachweis. {report.certificates.historical} Nachweise sind in der gefilterten Historie enthalten.</NativeP></NativeDiv></NativeDiv>
      <NativeDiv className="ac-kpis">
        <NativeDiv className="ac-kpi"><NativeSpan>Läuft in 30 Tagen ab</NativeSpan><NativeStrong className="ac-kpi-value">{report.certificates.expiring}</NativeStrong><NativeSmall className="ac-muted">Bis einschließlich {dateText(report.expiringThrough)}</NativeSmall></NativeDiv>
        <NativeDiv className="ac-kpi"><NativeSpan>Abgelaufen</NativeSpan><NativeStrong className="ac-kpi-value">{report.certificates.expired}</NativeStrong></NativeDiv>
        <NativeDiv className="ac-kpi"><NativeSpan>Zurückgenommen</NativeSpan><NativeStrong className="ac-kpi-value">{report.certificates.revoked}</NativeStrong></NativeDiv>
        <NativeDiv className="ac-kpi"><NativeSpan>Ohne Ablaufdatum</NativeSpan><NativeStrong className="ac-kpi-value">{report.certificates.withoutExpiry}</NativeStrong></NativeDiv>
      </NativeDiv>
      <NativeP className="ac-muted">Diese Angaben beschreiben den dokumentierten Lernabschluss. Sie ersetzen keine Prüfung beruflicher Qualifikationen.</NativeP>
    </NativeSection>
    <NativeSection className="ac-panel">
      <NativeDiv className="ac-panel-header"><NativeDiv><NativeH2 className="ac-section-title">Auswertung je Kurs</NativeH2><NativeP className="ac-muted">Kurse mit offenen Fristen stehen zuerst. Der CSV-Export enthält diese Kurszahlen ohne Personennamen.</NativeP></NativeDiv></NativeDiv>
      {report.courses.length ? <NativeDiv className="ac-card-grid">{report.courses.map(course => <NativeArticle className="ac-course-card" key={course.courseId}>
        <NativeDiv><NativeH3>{course.title}</NativeH3><NativeP className="ac-muted">Fassungen {course.versions.join(', ')} · {course.total} Teilnahmen</NativeP></NativeDiv>
        <NativeDiv className="ac-badges"><NativeSpan className="ac-status">{course.open} offen</NativeSpan><NativeSpan className="ac-status" data-tone="attention">{course.submitted} zur Prüfung</NativeSpan><NativeSpan className="ac-status" data-tone="good">{course.completed} abgeschlossen</NativeSpan>{course.cancelled > 0 && <NativeSpan className="ac-status">{course.cancelled} beendet</NativeSpan>}{course.overdue > 0 && <NativeSpan className="ac-status" data-tone="danger">{course.overdue} überfällig</NativeSpan>}</NativeDiv>
        <NativeDiv className="ac-stat-line"><NativeSpan>Abschlussquote</NativeSpan><NativeStrong>{course.completionRate === null ? '–' : `${course.completionRate} %`}</NativeStrong></NativeDiv>
        {course.completionRate !== null && <NativeDiv className="ac-progress" role="progressbar" aria-label={`Abschlussquote ${course.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={course.completionRate}><NativeSpan style={{ width: `${course.completionRate}%` }}/></NativeDiv>}
        <NativeP className="ac-muted">{course.certificates.expiring} Nachweise laufen in 30 Tagen ab · {course.certificates.expired} abgelaufen</NativeP>
      </NativeArticle>)}</NativeDiv> : <NativeDiv className="ac-empty"><NativeH3>Keine Teilnahmen für diese Auswahl</NativeH3><NativeP>Passen Sie die Filter an oder weisen Sie einen veröffentlichten Kurs zu.</NativeP></NativeDiv>}
    </NativeSection>
  </NativeDiv>;
}
