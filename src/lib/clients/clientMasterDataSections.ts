import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';

/** Section groups shown in the full Stammdaten bearbeiten modal. */
export const CLIENT_MASTER_DATA_SECTIONS: {
  key: IntakeSectionKey;
  title: string;
  subtitle?: string;
}[] = [
  { key: 'leistungsart', title: 'Leistungsdaten', subtitle: 'Leistungsarten & Kontext' },
  { key: 'stammdaten', title: 'Identität', subtitle: 'Name, Geburtsdatum, Aufnahme' },
  { key: 'adresse_kontakt', title: 'Kontakt & Adresse', subtitle: 'Erreichbarkeit & Wohnort' },
  { key: 'versorgung', title: 'Versorgung', subtitle: 'Pflegegrad & Betreuung' },
  { key: 'kostentraeger', title: 'Kostenträger', subtitle: 'Abrechnung & Kassen' },
  { key: 'angehoerige', title: 'Angehörige', subtitle: 'Notfallkontakte & Bevollmächtigte' },
  { key: 'notfall_zugang', title: 'Notfall & Zugang', subtitle: 'Schlüssel & Wohnungszugang' },
  {
    key: 'vertraege_einwilligungen',
    title: 'Portal & Datenschutz',
    subtitle: 'Einwilligungen & Verträge',
  },
];
