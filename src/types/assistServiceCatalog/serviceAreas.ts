/** Leistungsbereiche — Assist Leistungskatalog (10 Bereiche) */

export type AssistServiceAreaKey =
  | 'alltagsbegleitung'
  | 'betreuung'
  | 'hauswirtschaft'
  | 'begleitung_ausser_haus'
  | 'einkaufen'
  | 'aktivierung'
  | 'entlastung_angehoeriger'
  | 'organisation_alltag'
  | 'besuchsdienst'
  | 'sonstige_unterstuetzung';

export const ASSIST_SERVICE_AREA_KEYS: readonly AssistServiceAreaKey[] = [
  'alltagsbegleitung',
  'betreuung',
  'hauswirtschaft',
  'begleitung_ausser_haus',
  'einkaufen',
  'aktivierung',
  'entlastung_angehoeriger',
  'organisation_alltag',
  'besuchsdienst',
  'sonstige_unterstuetzung',
] as const;

export const ASSIST_SERVICE_AREA_LABELS: Record<AssistServiceAreaKey, string> = {
  alltagsbegleitung: 'Alltagsbegleitung',
  betreuung: 'Betreuung',
  hauswirtschaft: 'Hauswirtschaft',
  begleitung_ausser_haus: 'Begleitung außer Haus',
  einkaufen: 'Einkaufen',
  aktivierung: 'Aktivierung',
  entlastung_angehoeriger: 'Entlastung Angehöriger',
  organisation_alltag: 'Organisation im Alltag',
  besuchsdienst: 'Besuchsdienst',
  sonstige_unterstuetzung: 'Sonstige Unterstützung',
};

/** Schlüsselwörter, die nicht als Alltagsbegleitung deklariert werden dürfen. */
export const ASSIST_MEDICAL_CARE_KEYWORDS = [
  'pflegeleistung',
  'medikament',
  'medikation',
  'injektion',
  'infusion',
  'wundversorgung',
  'blutdruck',
  'blutzucker',
  'sauerstoff',
  'katheter',
  'stoma',
  'kompressionsstr',
  'krankenpflege',
  'behandlungspflege',
  'grundpflege',
  'medizin',
  'therapie',
  'diagnose',
] as const;

export type AssistServiceCatalogStatus = 'draft' | 'active' | 'paused' | 'archived';

export const ASSIST_SERVICE_CATALOG_STATUS_LABELS: Record<AssistServiceCatalogStatus, string> = {
  draft: 'Entwurf',
  active: 'Aktiv',
  paused: 'Pausiert',
  archived: 'Archiviert',
};

export type AssistAllowedModule = 'assist' | 'office' | 'pflege' | 'beratung';
