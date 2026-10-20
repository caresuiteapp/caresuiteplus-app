/** Normalized client row after CSV validation (German field keys internally). */
export type ClientImportRow = {
  kundennummer: string | null;
  anrede: string | null;
  titel: string | null;
  vorname: string;
  nachname: string;
  geburtsdatum: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  telefon_1: string;
  telefon_2: string | null;
  mobil: string | null;
  email: string | null;
  pflegegrad: string;
  pflegegrad_seit: string | null;
  leistungsart: string;
  kostentraeger_name: string | null;
  kostentraeger_art: string | null;
  versichertennummer: string | null;
  pflegekasse: string | null;
  krankenkasse: string | null;
  beihilfe: boolean | null;
  privatversicherung: boolean | null;
  entlastungsbetrag_aktiv: boolean | null;
  umwandlungsanspruch_aktiv: boolean | null;
  jahresbudget_aktiv: boolean | null;
  abrechnungsart: string | null;
  leistungsbeginn: string | null;
  einsatzadresse_abweichend: boolean | null;
  einsatz_strasse: string | null;
  einsatz_hausnummer: string | null;
  einsatz_plz: string | null;
  einsatz_ort: string | null;
  notfallkontakt_name: string | null;
  notfallkontakt_beziehung: string | null;
  notfallkontakt_telefon: string | null;
  betreuer_name: string | null;
  betreuer_telefon: string | null;
  betreuer_email: string | null;
  hausarzt_name: string | null;
  hausarzt_telefon: string | null;
  diagnose_hinweise: string | null;
  allergien: string | null;
  mobilitaet: string | null;
  schluessel_vorhanden: boolean | null;
  haustiere: string | null;
  besonderheiten: string | null;
  interne_notiz: string | null;
  status: string;
};

export const CLIENT_IMPORT_REQUIRED_FIELDS: readonly (keyof ClientImportRow)[] = [
  'vorname',
  'nachname',
  'geburtsdatum',
  'strasse',
  'hausnummer',
  'plz',
  'ort',
  'telefon_1',
  'pflegegrad',
  'leistungsart',
] as const;

export const CLIENT_IMPORT_OPTIONAL_FIELDS: readonly (keyof ClientImportRow)[] = [
  'kundennummer',
  'anrede',
  'titel',
  'telefon_2',
  'mobil',
  'email',
  'kostentraeger_name',
  'kostentraeger_art',
  'versichertennummer',
  'pflegekasse',
  'krankenkasse',
  'beihilfe',
  'privatversicherung',
  'pflegegrad_seit',
  'entlastungsbetrag_aktiv',
  'umwandlungsanspruch_aktiv',
  'jahresbudget_aktiv',
  'abrechnungsart',
  'leistungsbeginn',
  'einsatzadresse_abweichend',
  'einsatz_strasse',
  'einsatz_hausnummer',
  'einsatz_plz',
  'einsatz_ort',
  'notfallkontakt_name',
  'notfallkontakt_beziehung',
  'notfallkontakt_telefon',
  'betreuer_name',
  'betreuer_telefon',
  'betreuer_email',
  'hausarzt_name',
  'hausarzt_telefon',
  'diagnose_hinweise',
  'allergien',
  'mobilitaet',
  'schluessel_vorhanden',
  'haustiere',
  'besonderheiten',
  'interne_notiz',
  'status',
] as const;

export const CLIENT_IMPORT_ALL_FIELDS: readonly (keyof ClientImportRow)[] = [
  ...CLIENT_IMPORT_REQUIRED_FIELDS,
  ...CLIENT_IMPORT_OPTIONAL_FIELDS,
];
