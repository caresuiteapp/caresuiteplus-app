/**
 * Ops hub / Betrieb & Monitoring live readiness.
 * Fehlerprotokollierung und Incidents sind mandantenspezifisch vorbereitet;
 * Backup, Wiederherstellung und Wartungsfenster bleiben preparedOnly.
 */
export function isOperationsMonitoringLiveReady(): boolean {
  return false;
}

export const OPERATIONS_MONITORING_PREPARED_MESSAGE =
  'Backup, Wiederherstellung und externe 24/7-Überwachung sind in Vorbereitung. Fehlerlogs und Incidents werden mandantenspezifisch protokolliert — ohne aktive Backup-Pipeline.';

export const OPERATIONS_AVAILABILITY_DISCLAIMER =
  'Kein 24/7-Betriebsversprechen. Angezeigt wird der letzte bekannte Systemcheck — keine permanente Verfügbarkeitsgarantie.';

export const OPERATIONS_MONITORING_ROUTE = '/business/office/admin/operations-monitoring';
