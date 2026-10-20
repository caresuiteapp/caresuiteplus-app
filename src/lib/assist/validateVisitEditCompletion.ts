import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitDispositionDetail } from './visitTypes';

/** The edit form must not certify documentation or a proof by changing a label. */
export function validateVisitEditCompletion(
  visit: VisitDispositionDetail,
  requestedStatus: AssignmentStatus,
): string | null {
  if (requestedStatus !== 'abgeschlossen' || requestedStatus === visit.assignmentStatus) return null;
  const start = Date.parse(visit.actualStartAt ?? '');
  const end = Date.parse(visit.actualEndAt ?? '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 'Gültige Ist-Zeiten fehlen. Bitte Beginn und Ende in der Nachbearbeitung prüfen und speichern.';
  }
  if (visit.tasks.some((task) => task.isRequired && task.status === 'open')) {
    return 'Pflichtaufgaben sind noch offen. Bitte zuerst in der Nachbearbeitung ergänzen.';
  }
  if (visit.documentationStatus !== 'complete') {
    return 'Dokumentation ist nicht vollständig. Bitte zuerst in der Nachbearbeitung speichern.';
  }
  if (visit.proofStatus !== 'verified') {
    return 'Der Nachweis ist noch nicht verifiziert. Bei einer nachgeforderten Unterschrift bitte „Nachbearbeitung abschließen“ verwenden; die Unterschrift bleibt dabei ausstehend.';
  }
  return null;
}
