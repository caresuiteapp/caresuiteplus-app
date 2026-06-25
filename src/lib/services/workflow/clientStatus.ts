import type { WorkflowStatus } from '@/types/core/base';

export const CLIENT_STATUS_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  entwurf: ['aktiv', 'gesperrt'],
  aktiv: ['in_bearbeitung', 'abgeschlossen', 'gesperrt', 'archiviert'],
  in_bearbeitung: ['aktiv', 'abgeschlossen', 'fehlerhaft'],
  abgeschlossen: ['archiviert', 'aktiv'],
  archiviert: ['aktiv'],
  fehlerhaft: ['in_bearbeitung', 'gesperrt'],
  gesperrt: ['aktiv'],
  geplant: ['aktiv'],
  bestaetigt: ['aktiv'],
};

export const CLIENT_STATUS_HINTS: Record<WorkflowStatus, string> = {
  entwurf: 'Pflichtdaten prüfen und Klient:in aktivieren.',
  aktiv: 'Einsätze und Dokumentation sind auf dem aktuellen Stand.',
  in_bearbeitung: 'Offene Angaben vervollständigen.',
  abgeschlossen: 'Betreuung beendet — Archivierung möglich.',
  archiviert: 'Nur Lesezugriff. Reaktivierung durch Admin.',
  fehlerhaft: 'Fehlerhafte Daten korrigieren.',
  gesperrt: 'Klient:in ist gesperrt — Freigabe durch Geschäftsführung.',
  geplant: 'Geplant — Termin steht aus.',
  bestaetigt: 'Bestätigt — Einsatz kann beginnen.',
};

export function getAllowedStatusActions(status: WorkflowStatus): WorkflowStatus[] {
  return CLIENT_STATUS_TRANSITIONS[status] ?? [];
}

export function canTransitionStatus(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return getAllowedStatusActions(from).includes(to);
}
