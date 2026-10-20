import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';

/** User-facing titles for section-specific edit modals (not wizard steps). */
export const CLIENT_SECTION_EDIT_TITLES: Record<IntakeSectionKey, string> = {
  leistungsart: 'Leistungsarten bearbeiten',
  stammdaten: 'Stammdaten bearbeiten',
  adresse_kontakt: 'Adresse & Kontakt bearbeiten',
  versorgung: 'Versorgung bearbeiten',
  kostentraeger: 'Kostenträger bearbeiten',
  angehoerige: 'Angehörige bearbeiten',
  notfall_zugang: 'Notfall & Zugang bearbeiten',
  vertraege_einwilligungen: 'Verträge & Einwilligungen bearbeiten',
  dokumente: 'Dokumente bearbeiten',
  module: 'Module bearbeiten',
  pruefung: 'Prüfung',
};

/** Sections available for edit from the client record (intake wizard remains create-only). */
export const CLIENT_RECORD_EDIT_SECTIONS: IntakeSectionKey[] = [
  'leistungsart',
  'stammdaten',
  'adresse_kontakt',
  'versorgung',
  'kostentraeger',
  'angehoerige',
  'notfall_zugang',
  'vertraege_einwilligungen',
];

export function clientSectionEditTitle(section: IntakeSectionKey): string {
  return CLIENT_SECTION_EDIT_TITLES[section] ?? 'Bereich bearbeiten';
}
