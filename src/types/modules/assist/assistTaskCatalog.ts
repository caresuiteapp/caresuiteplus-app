import type { AssistServiceAreaKey } from '@/types/assistServiceCatalog';

/** CareSuite+ Assist — 8 Modulbereiche (Navigation / Modulbaum) */
export type AssistModuleAreaKey =
  | 'alltagsbegleitung'
  | 'betreuung'
  | 'begleitung_ausser_haus'
  | 'hauswirtschaftliche_unterstuetzung'
  | 'aktivierung_soziale_teilhabe'
  | 'angehoerigenentlastung'
  | 'dokumentation_leistungsnachweis'
  | 'ereignisse_auffaelligkeiten';

export const ASSIST_MODULE_AREA_KEYS: readonly AssistModuleAreaKey[] = [
  'alltagsbegleitung',
  'betreuung',
  'begleitung_ausser_haus',
  'hauswirtschaftliche_unterstuetzung',
  'aktivierung_soziale_teilhabe',
  'angehoerigenentlastung',
  'dokumentation_leistungsnachweis',
  'ereignisse_auffaelligkeiten',
] as const;

export const ASSIST_MODULE_AREA_LABELS: Record<AssistModuleAreaKey, string> = {
  alltagsbegleitung: 'Alltagsbegleitung',
  betreuung: 'Betreuung',
  begleitung_ausser_haus: 'Begleitung außer Haus',
  hauswirtschaftliche_unterstuetzung: 'Hauswirtschaftliche Unterstützung',
  aktivierung_soziale_teilhabe: 'Aktivierung & soziale Teilhabe',
  angehoerigenentlastung: 'Angehörigenentlastung',
  dokumentation_leistungsnachweis: 'Dokumentation & Leistungsnachweis',
  ereignisse_auffaelligkeiten: 'Ereignisse / Auffälligkeiten / Eskalationen',
};

/**
 * Leistungsbereich — Ebene 1 der Assist-Hierarchie (Leistungskatalog).
 * Entspricht den sechs Kernbereichen aus der Spezifikation.
 */
export type AssistLeistungsbereichKey =
  | 'alltagsbegleitung'
  | 'betreuung'
  | 'begleitung'
  | 'hauswirtschaft'
  | 'einkauf'
  | 'angehoerigenentlastung';

export const ASSIST_LEISTUNGSBEREICH_KEYS: readonly AssistLeistungsbereichKey[] = [
  'alltagsbegleitung',
  'betreuung',
  'begleitung',
  'hauswirtschaft',
  'einkauf',
  'angehoerigenentlastung',
] as const;

export const ASSIST_LEISTUNGSBEREICH_LABELS: Record<AssistLeistungsbereichKey, string> = {
  alltagsbegleitung: 'Alltagsbegleitung',
  betreuung: 'Betreuung',
  begleitung: 'Begleitung',
  hauswirtschaft: 'Hauswirtschaft',
  einkauf: 'Einkauf',
  angehoerigenentlastung: 'Angehörigenentlastung',
};

/** Zuordnung Leistungsbereich → AssistServiceAreaKey (Leistungskatalog) */
export const LEISTUNGSBEREICH_TO_SERVICE_AREA: Record<
  AssistLeistungsbereichKey,
  AssistServiceAreaKey
> = {
  alltagsbegleitung: 'alltagsbegleitung',
  betreuung: 'betreuung',
  begleitung: 'begleitung_ausser_haus',
  hauswirtschaft: 'hauswirtschaft',
  einkauf: 'einkaufen',
  angehoerigenentlastung: 'entlastung_angehoeriger',
};

/** Unterkategorien — 16 Blöcke aus der Spezifikation */
export type AssistSubcategoryKey =
  | 'einsatzvorbereitung'
  | 'tagesstruktur'
  | 'haeusliche_alltagsunterstuetzung'
  | 'soziale_betreuung'
  | 'aktivierung'
  | 'demenzbegleitung'
  | 'angehoerigenentlastung'
  | 'einkaufsservice'
  | 'begleitung_ausser_haus'
  | 'arzt_terminbegleitung'
  | 'hauswirtschaft'
  | 'sicherheitsbeobachtung'
  | 'auffaelligkeiten'
  | 'dokumentation'
  | 'leistungsnachweis'
  | 'eskalationen';

export const ASSIST_SUBCATEGORY_KEYS: readonly AssistSubcategoryKey[] = [
  'einsatzvorbereitung',
  'tagesstruktur',
  'haeusliche_alltagsunterstuetzung',
  'soziale_betreuung',
  'aktivierung',
  'demenzbegleitung',
  'angehoerigenentlastung',
  'einkaufsservice',
  'begleitung_ausser_haus',
  'arzt_terminbegleitung',
  'hauswirtschaft',
  'sicherheitsbeobachtung',
  'auffaelligkeiten',
  'dokumentation',
  'leistungsnachweis',
  'eskalationen',
] as const;

export const ASSIST_SUBCATEGORY_LABELS: Record<AssistSubcategoryKey, string> = {
  einsatzvorbereitung: 'Einsatzvorbereitung',
  tagesstruktur: 'Tagesstruktur',
  haeusliche_alltagsunterstuetzung: 'Häusliche Alltagsunterstützung',
  soziale_betreuung: 'Soziale Betreuung',
  aktivierung: 'Aktivierung',
  demenzbegleitung: 'Demenzbegleitung',
  angehoerigenentlastung: 'Angehörigenentlastung',
  einkaufsservice: 'Einkaufsservice',
  begleitung_ausser_haus: 'Begleitung außer Haus',
  arzt_terminbegleitung: 'Arzt-Terminbegleitung',
  hauswirtschaft: 'Hauswirtschaft',
  sicherheitsbeobachtung: 'Sicherheitsbeobachtung',
  auffaelligkeiten: 'Auffälligkeiten',
  dokumentation: 'Dokumentation',
  leistungsnachweis: 'Leistungsnachweis',
  eskalationen: 'Eskalationen',
};

export type AssistLeistungsart = 'alltagsbegleitung' | 'betreuung' | 'hauswirtschaft' | 'entlastung';

export const ASSIST_LEISTUNGSART_LABELS: Record<AssistLeistungsart, string> = {
  alltagsbegleitung: 'Alltagsbegleitung',
  betreuung: 'Betreuung',
  hauswirtschaft: 'Hauswirtschaftliche Unterstützung',
  entlastung: 'Entlastungsleistung',
};

/** Gründe für „Nicht erledigt" bei Einsatzaufgaben */
export type AssistTaskNotCompletedReason =
  | 'kunde_nicht_anwesend'
  | 'abgelehnt'
  | 'nicht_notwendig'
  | 'zeit'
  | 'material'
  | 'zugang'
  | 'nicht_vereinbart'
  | 'gesundheitlich'
  | 'sicherheitsrisiko'
  | 'angehoerige_uebernommen'
  | 'verschoben'
  | 'sonstiges';

export const ASSIST_NOT_COMPLETED_REASON_KEYS: readonly AssistTaskNotCompletedReason[] = [
  'kunde_nicht_anwesend',
  'abgelehnt',
  'nicht_notwendig',
  'zeit',
  'material',
  'zugang',
  'nicht_vereinbart',
  'gesundheitlich',
  'sicherheitsrisiko',
  'angehoerige_uebernommen',
  'verschoben',
  'sonstiges',
] as const;

export const ASSIST_NOT_COMPLETED_REASON_LABELS: Record<AssistTaskNotCompletedReason, string> = {
  kunde_nicht_anwesend: 'Kunde nicht anwesend',
  abgelehnt: 'Abgelehnt',
  nicht_notwendig: 'Nicht notwendig',
  zeit: 'Zeit',
  material: 'Material',
  zugang: 'Zugang',
  nicht_vereinbart: 'Nicht vereinbart',
  gesundheitlich: 'Gesundheitlich',
  sicherheitsrisiko: 'Sicherheitsrisiko',
  angehoerige_uebernommen: 'Angehörige übernommen',
  verschoben: 'Verschoben',
  sonstiges: 'Sonstiges',
};

/** Tagesform — Quick-Pick bei Einsatz */
export type AssistTagesformKey =
  | 'gut'
  | 'ruhig'
  | 'muede'
  | 'traurig'
  | 'unruhig'
  | 'verwirrt'
  | 'aengstlich'
  | 'gereizt'
  | 'gespraechig'
  | 'zurueckgezogen'
  | 'auffaellig_veraendert';

export const ASSIST_TAGESFORM_KEYS: readonly AssistTagesformKey[] = [
  'gut',
  'ruhig',
  'muede',
  'traurig',
  'unruhig',
  'verwirrt',
  'aengstlich',
  'gereizt',
  'gespraechig',
  'zurueckgezogen',
  'auffaellig_veraendert',
] as const;

export const ASSIST_TAGESFORM_LABELS: Record<AssistTagesformKey, string> = {
  gut: 'Gut',
  ruhig: 'Ruhig',
  muede: 'Müde',
  traurig: 'Traurig',
  unruhig: 'Unruhig',
  verwirrt: 'Verwirrt',
  aengstlich: 'Ängstlich',
  gereizt: 'Gereizt',
  gespraechig: 'Gesprächig',
  zurueckgezogen: 'Zurückgezogen',
  auffaellig_veraendert: 'Auffällig verändert',
};

/** Auffälligkeiten — Quick-Pick bei Einsatz */
export type AssistAuffaelligkeitKey =
  | 'sturz'
  | 'sturzgefahr'
  | 'desorientierung'
  | 'aggression'
  | 'wanderung'
  | 'verweigerung'
  | 'schmerz'
  | 'atemnot'
  | 'schwindel'
  | 'uebelkeit'
  | 'appetitlosigkeit'
  | 'dehydrierung'
  | 'schlafstoerung'
  | 'einsamkeit'
  | 'vergesslichkeit'
  | 'verwirrung_ort'
  | 'verwirrung_zeit'
  | 'halluzination'
  | 'paranoia'
  | 'unsauberkeit'
  | 'ernaehrungsprobleme'
  | 'medikamentenverweigerung'
  | 'zugangsproblem'
  | 'sicherheitsrisiko'
  | 'notfall'
  | 'sonstiges';

export const ASSIST_AUFFAELLIGKEIT_KEYS: readonly AssistAuffaelligkeitKey[] = [
  'sturz',
  'sturzgefahr',
  'desorientierung',
  'aggression',
  'wanderung',
  'verweigerung',
  'schmerz',
  'atemnot',
  'schwindel',
  'uebelkeit',
  'appetitlosigkeit',
  'dehydrierung',
  'schlafstoerung',
  'einsamkeit',
  'vergesslichkeit',
  'verwirrung_ort',
  'verwirrung_zeit',
  'halluzination',
  'paranoia',
  'unsauberkeit',
  'ernaehrungsprobleme',
  'medikamentenverweigerung',
  'zugangsproblem',
  'sicherheitsrisiko',
  'notfall',
  'sonstiges',
] as const;

export const ASSIST_AUFFAELLIGKEIT_LABELS: Record<AssistAuffaelligkeitKey, string> = {
  sturz: 'Sturz',
  sturzgefahr: 'Sturzgefahr',
  desorientierung: 'Desorientierung',
  aggression: 'Aggression',
  wanderung: 'Wanderung',
  verweigerung: 'Verweigerung',
  schmerz: 'Schmerz',
  atemnot: 'Atemnot',
  schwindel: 'Schwindel',
  uebelkeit: 'Übelkeit',
  appetitlosigkeit: 'Appetitlosigkeit',
  dehydrierung: 'Dehydrierung',
  schlafstoerung: 'Schlafstörung',
  einsamkeit: 'Einsamkeit',
  vergesslichkeit: 'Vergesslichkeit',
  verwirrung_ort: 'Verwirrung (Ort)',
  verwirrung_zeit: 'Verwirrung (Zeit)',
  halluzination: 'Halluzination',
  paranoia: 'Paranoia',
  unsauberkeit: 'Unsauberkeit',
  ernaehrungsprobleme: 'Ernährungsprobleme',
  medikamentenverweigerung: 'Medikamentenverweigerung',
  zugangsproblem: 'Zugangsproblem',
  sicherheitsrisiko: 'Sicherheitsrisiko',
  notfall: 'Notfall',
  sonstiges: 'Sonstiges',
};

/** Verbotene Aufgaben im Assist-Modul (Behandlungspflege) */
export const ASSIST_FORBIDDEN_TASK_KEYWORDS = [
  'medikament verabreichen',
  'medikamentengabe',
  'medikamentenverabreichung',
  'injektion',
  'insulin',
  'wundversorgung',
  'wundbehandlung',
  'medizinische beratung',
  'diagnose',
  'diagnosen',
  'blutdruck messen',
  'blutzucker messen',
  'katheter',
  'stoma',
  'infusion',
  'behandlungspflege',
  'krankenpflege',
  'kompressionsstrümpfe',
  'kompressionsstr',
  'sauerstoffgabe',
  'grundpflege',
] as const;

export type AssistCatalogTaskTemplate = {
  id: string;
  packageId: string;
  leistungsbereich: AssistLeistungsbereichKey;
  subcategory: AssistSubcategoryKey;
  moduleArea: AssistModuleAreaKey;
  title: string;
  description: string;
  leistungsart: AssistLeistungsart;
  plannedDurationMinutes: number;
  isMandatory: boolean;
  proofRequired: boolean;
  documentationRequired: boolean;
  billingRelevant: boolean;
  visibleToClient: boolean;
  sortOrder: number;
};

export type AssistTaskPackage = {
  id: string;
  key: string;
  title: string;
  description: string;
  leistungsbereich: AssistLeistungsbereichKey;
  moduleArea: AssistModuleAreaKey;
  taskIds: string[];
  sortOrder: number;
};

export const ASSIST_MODULE_DISCLAIMER =
  'CareSuite+ Assist umfasst Alltagsbegleitung, Betreuung und Begleitung — keine Behandlungspflege. ' +
  'Medizinische Leistungen gehören in das Pflege-Modul.';
