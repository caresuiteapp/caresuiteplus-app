/** Feste Bezeichnungen für Assist-Einsätze (Alltagsbegleitung/Betreuung). */
export const ASSIGNMENT_BEZEICHNUNG_OPTIONS = [
  'Alltagsbegleitung',
  'Betreuung',
  'Begleitung außer Haus',
  'Hauswirtschaft',
  'Einkaufsbegleitung',
  'Angehörigenentlastung',
  'Aktivierung & Teilhabe',
  'Spaziergang',
  'Arzttermin-Begleitung',
  'Erstbesuch / Kontrollbesuch',
] as const;

export type AssignmentBezeichnung = (typeof ASSIGNMENT_BEZEICHNUNG_OPTIONS)[number];

export const DEFAULT_ASSIGNMENT_BEZEICHNUNG: AssignmentBezeichnung =
  ASSIGNMENT_BEZEICHNUNG_OPTIONS[0];
