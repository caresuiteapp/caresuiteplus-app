export type PressureInjuryClassification =
  | 'kategorie_1'
  | 'kategorie_2'
  | 'kategorie_3'
  | 'kategorie_4'
  | 'nicht_klassifizierbar'
  | 'tiefe_gewebeschaedigung'
  | 'schleimhaut'
  | 'medizinproduktbezogen';

export type PressureInjuryStatus =
  | 'verdacht'
  | 'aktiv'
  | 'in_behandlung'
  | 'heilend'
  | 'abgeheilt'
  | 'geschlossen'
  | 'wiedereroeffnet';

export const PRESSURE_INJURY_CLASSIFICATIONS: readonly {
  id: PressureInjuryClassification;
  label: string;
  shortLabel: string;
  description: string;
  urgentReview: boolean;
}[] = [
  {
    id: 'kategorie_1',
    label: 'Kategorie/Stadium 1',
    shortLabel: 'D1',
    description: 'Intakte Haut mit nicht wegdrückbarer umschriebener Veränderung.',
    urgentReview: false,
  },
  {
    id: 'kategorie_2',
    label: 'Kategorie/Stadium 2',
    shortLabel: 'D2',
    description: 'Teilverlust der Haut mit freiliegender Dermis.',
    urgentReview: true,
  },
  {
    id: 'kategorie_3',
    label: 'Kategorie/Stadium 3',
    shortLabel: 'D3',
    description: 'Vollständiger Hautverlust; tiefer Gewebeschaden ohne freiliegenden Muskel/Knochen.',
    urgentReview: true,
  },
  {
    id: 'kategorie_4',
    label: 'Kategorie/Stadium 4',
    shortLabel: 'D4',
    description: 'Vollständiger Haut- und Gewebeverlust mit freiliegender tiefer Struktur.',
    urgentReview: true,
  },
  {
    id: 'nicht_klassifizierbar',
    label: 'Nicht klassifizierbar',
    shortLabel: 'NK',
    description: 'Tiefe wegen Belag oder Nekrose nicht sicher feststellbar.',
    urgentReview: true,
  },
  {
    id: 'tiefe_gewebeschaedigung',
    label: 'Tiefe Gewebeschädigung',
    shortLabel: 'TGI',
    description: 'Persistierende dunkelrote, weinrote oder violette Gewebeveränderung.',
    urgentReview: true,
  },
  {
    id: 'schleimhaut',
    label: 'Druckverletzung der Schleimhaut',
    shortLabel: 'SH',
    description: 'Druckbedingte Verletzung einer Schleimhaut; keine Einstufung 1–4.',
    urgentReview: true,
  },
  {
    id: 'medizinproduktbezogen',
    label: 'Medizinproduktbezogene Druckverletzung',
    shortLabel: 'MP',
    description: 'Druckverletzung, deren Form oder Lage einem Medizinprodukt entspricht.',
    urgentReview: true,
  },
];

export const PRESSURE_INJURY_TISSUES = [
  'epithel',
  'granulation',
  'fibrin',
  'nekrose',
  'avitales_gewebe',
  'fettgewebe',
  'faszie',
  'muskel',
  'sehne',
  'knorpel',
  'knochen',
  'nicht_beurteilbar',
] as const;

export const PRESSURE_INJURY_ESCALATION_FLAGS = [
  'neu_ab_kategorie_2',
  'rasche_verschlechterung',
  'nekrose',
  'tiefe_unterminierung',
  'fistelgang',
  'freiliegende_tiefenstruktur',
  'eitriges_exsudat',
  'auffaelliger_geruch',
  'zunehmender_schmerz',
  'fieber',
  'schuettelfrost',
  'verdacht_osteomyelitis',
  'verdacht_sepsis',
  'fehlende_druckentlastung',
  'kontrolle_ueberfaellig',
  'kind_oder_baby',
  'medizinproduktbezogen',
] as const;
