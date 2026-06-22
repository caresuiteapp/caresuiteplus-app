/** Normalized employee row after CSV validation. */
export type EmployeeImportRow = {
  personalnummer: string | null;
  anrede: string | null;
  titel: string | null;
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  email: string;
  telefon: string;
  mobil: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  geburtsort: string | null;
  staatsangehoerigkeit: string | null;
  steuer_id: string | null;
  sozialversicherungsnummer: string | null;
  krankenkasse: string | null;
  iban: string | null;
  bic: string | null;
  eintrittsdatum: string;
  rolle: string;
  beschaeftigungsart: string;
  wochenstunden: number | null;
  stundenlohn: number | null;
  urlaubsanspruch: number | null;
  probezeit_bis: string | null;
  austrittsdatum: string | null;
  notfallkontakt_name: string | null;
  notfallkontakt_beziehung: string | null;
  notfallkontakt_telefon: string | null;
  fuehrungszeugnis_vorhanden: boolean | null;
  fuehrungszeugnis_datum: string | null;
  qualifikation: string | null;
  lg1_lg2_vorhanden: boolean | null;
  erste_hilfe_datum: string | null;
  fuehrerschein_vorhanden: boolean | null;
  fahrzeug_vorhanden: boolean | null;
  einsatzbereiche: string | null;
  interne_notiz: string | null;
  status: string;
};

export const EMPLOYEE_IMPORT_REQUIRED_FIELDS: readonly (keyof EmployeeImportRow)[] = [
  'vorname',
  'nachname',
  'geburtsdatum',
  'email',
  'telefon',
  'eintrittsdatum',
  'rolle',
  'beschaeftigungsart',
  'status',
] as const;

export const EMPLOYEE_IMPORT_OPTIONAL_FIELDS: readonly (keyof EmployeeImportRow)[] = [
  'personalnummer',
  'anrede',
  'titel',
  'mobil',
  'strasse',
  'hausnummer',
  'plz',
  'ort',
  'geburtsort',
  'staatsangehoerigkeit',
  'steuer_id',
  'sozialversicherungsnummer',
  'krankenkasse',
  'iban',
  'bic',
  'wochenstunden',
  'stundenlohn',
  'urlaubsanspruch',
  'probezeit_bis',
  'austrittsdatum',
  'notfallkontakt_name',
  'notfallkontakt_beziehung',
  'notfallkontakt_telefon',
  'fuehrungszeugnis_vorhanden',
  'fuehrungszeugnis_datum',
  'qualifikation',
  'lg1_lg2_vorhanden',
  'erste_hilfe_datum',
  'fuehrerschein_vorhanden',
  'fahrzeug_vorhanden',
  'einsatzbereiche',
  'interne_notiz',
] as const;

export const EMPLOYEE_IMPORT_ALL_FIELDS: readonly (keyof EmployeeImportRow)[] = [
  ...EMPLOYEE_IMPORT_REQUIRED_FIELDS,
  ...EMPLOYEE_IMPORT_OPTIONAL_FIELDS,
];
