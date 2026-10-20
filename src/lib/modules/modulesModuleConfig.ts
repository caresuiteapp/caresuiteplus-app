/**
 * Business module hub live assignment readiness.
 * Demo-Store verwaltet Freischaltungen lokal; echte Billing/App-Store-Anbindung bleibt offen.
 */
export function isModuleAssignmentLiveReady(): boolean {
  return false;
}

export const MODULE_ASSIGNMENT_PREPARED_MESSAGE =
  'Live-Modul-Freischaltung über App Store und Abrechnung ist in Vorbereitung. Der Modul-Status basiert derzeit auf der Demo-Konfiguration — keine echte Buchungsänderung.';
