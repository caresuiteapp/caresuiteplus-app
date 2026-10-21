import type { AcademyReport } from './academyReports';

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  // Spreadsheet programs may ignore leading spaces/control characters before a formula.
  const safe = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Course totals only. No person names, account identifiers or answer content. */
export function createAcademyReportCsv(report: AcademyReport): string {
  const rows: (string | number | null)[][] = [[
    'Stichtag', 'Kurs', 'Fassungen', 'Teilnahmen', 'Offen', 'Zur Prüfung', 'Abgeschlossen', 'Beendet',
    'Teilnahmen für Abschlussquote (ohne beendet)', 'Abschlussquote (%)', 'Überfällig', 'Davon verpflichtend',
    'Jüngste Nachweise je Person und Kurs', 'Nachweise laufen bis einschließlich ab',
    'Anzahl in 30 Tagen ablaufend', 'Nachweise abgelaufen', 'Nachweise zurückgenommen', 'Nachweise ohne Ablaufdatum',
  ]];
  for (const course of report.courses) rows.push([
    report.today, course.title, course.versions.join(', '), course.total, course.open, course.submitted,
    course.completed, course.cancelled, course.completionBase, course.completionRate, course.overdue, course.mandatoryOverdue,
    course.certificates.current, report.expiringThrough, course.certificates.expiring, course.certificates.expired,
    course.certificates.revoked, course.certificates.withoutExpiry,
  ]);
  return `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

export function downloadAcademyReportCsv(report: AcademyReport): void {
  const url = URL.createObjectURL(new Blob([createAcademyReportCsv(report)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `akademie-auswertung-${report.today}.csv`;
  link.hidden = true;
  document.body.appendChild(link);
  try { link.click(); }
  finally {
    link.remove();
    // Give the browser time to take ownership of the user-triggered download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
