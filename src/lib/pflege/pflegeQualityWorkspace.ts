import type { PflegeReportStats } from '@/types/modules/pflege';

export const pflegeQualityMetrics = [
  { key: 'sisAssessmentsDue', title: 'Fällige Assessments', description: 'Laufende oder freigegebene Assessments, deren hinterlegter Prüftermin erreicht ist.', route: '/pflege/sis', action: 'Assessments öffnen' },
  { key: 'activePlans', title: 'Aktive Pflegepläne', description: 'Pflegepläne, die als aktiv geführt werden.', route: '/pflege/plans', action: 'Pflegepläne öffnen' },
  { key: 'woundCasesOpen', title: 'Wundfälle im Bestand', description: 'Alle nicht archivierten Wundfälle; darin können abgeschlossene Fälle enthalten sein.', route: '/pflege/wunddokumentation', action: 'Wunddokumentation öffnen' },
  { key: 'vitalsDocumentedThisWeek', title: 'Vitalmessungen dieser Woche', description: 'Dokumentierte Messungen seit Wochenbeginn.', route: '/pflege/vitalwerte', action: 'Vitalwerte öffnen' },
  { key: 'mdkReadyCount', title: 'Pläne mit Evaluation und Visite', description: 'Aktive Pläne mit mindestens einer Evaluation und einer abgeschlossenen Visite.', route: '/pflege/md-pruefbereitschaft', action: 'Prüfbereitschaft ansehen' },
] as const satisfies readonly { key: keyof PflegeReportStats; title: string; description: string; route: string; action: string }[];

export const pflegeQualityWorkflows = [
  { route: '/pflege/evaluation', title: 'Wirkung der Pflege beurteilen', description: 'Evaluationen aufrufen und nachvollziehen, wann eine Wirkung beurteilt wurde.', action: 'Evaluationen öffnen' },
  { route: '/pflege/visiten', title: 'Pflegevisiten nachverfolgen', description: 'Geplante und dokumentierte Visiten mit ihren Rückmeldungen einsehen.', action: 'Pflegevisiten öffnen' },
  { route: '/pflege/abweichungen', title: 'Abweichungen bearbeiten', description: 'Gemeldete Abweichungen prüfen und ihren Bearbeitungsstand nachvollziehen.', action: 'Abweichungen öffnen' },
] as const;

/** The aggregate RPC returns integer JSON numbers. An absent field is not a zero. */
export function parsePflegeQualityStats(row: Record<string, unknown>): PflegeReportStats | null {
  const { activePlans, sisAssessmentsDue, vitalsDocumentedThisWeek, woundCasesOpen, mdkReadyCount } = row;
  const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (!isCount(activePlans) || !isCount(sisAssessmentsDue) || !isCount(vitalsDocumentedThisWeek)
    || !isCount(woundCasesOpen) || !isCount(mdkReadyCount)) return null;
  return { activePlans, sisAssessmentsDue, vitalsDocumentedThisWeek, woundCasesOpen, mdkReadyCount };
}
