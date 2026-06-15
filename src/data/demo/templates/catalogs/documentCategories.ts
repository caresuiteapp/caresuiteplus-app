import { batchCat } from '../helpers';

const CLIENT_DOC_CATEGORIES = [
  'Pflegevertrag', 'Leistungsvereinbarung', 'Einwilligung Datenschutz', 'Einwilligung Foto/Video',
  'Vollmacht Angehörige', 'Arztbrief', 'Entlassungsbericht', 'Medikationsplan',
  'Pflegegradbescheid', 'MD-Bericht', 'Wunddokumentation', 'Vitalwerte-Protokoll',
  'Pflegeplan', 'SIS-Assessment', 'Risikoanalyse', 'Notfallplan',
  'Kostenvoranschlag', 'Abrechnungsunterlage', 'Korrespondenz Krankenkasse', 'Angehörigeninfo',
  'Transportgenehmigung', 'Betreuungsverfügung', 'Patientenverfügung', 'Vorsorgevollmacht',
  'Sonstiges Klientendokument', 'Archiv Klientendokument',
] as const;

const EMPLOYEE_DOC_CATEGORIES = [
  'Arbeitsvertrag', 'Nebentätigkeitserklärung', 'Schweigepflicht', 'Datenschutz Mitarbeiter',
  'Führungszeugnis', 'Erste-Hilfe-Nachweis', 'Impfpass / Masernschutz', 'Fortbildungsnachweis',
  'Hygiene-Schulung', 'Fahrerlaubnis', 'Fahrzeugnutzung', 'Dienstkleidung',
  'Zeiterfassung', 'Urlaubsantrag', 'Krankmeldung', 'Beurteilung',
  'Einarbeitungsplan', 'Qualifikationsnachweis', 'Persönliche Dokumente', 'Notfallkontakt MA',
  'Sonstiges Mitarbeiterdokument',
] as const;

const OFFICE_DOC_CATEGORIES = [
  'Allgemeine Korrespondenz', 'Vertragsvorlage', 'Rechnungsvorlage', 'Mahnungsvorlage',
  'Formular Intake', 'Formular Entlassung', 'QM-Handbuch Auszug', 'Datenschutzkonzept',
  'Brandschutzplan', 'Hygieneplan', 'Dienstplan Vorlage', 'Einsatzplan Vorlage',
  'Checkliste Büro', 'Protokoll Besprechung', 'Protokoll QM-Runde', 'Sonstiges Bürodokument',
] as const;

const COMM_DOC_CATEGORIES = [
  'Portal-Nachricht Anhang', 'E-Mail Anhang', 'KIM-Nachricht Anhang', 'SMS-Protokoll',
  'Angehörigenbrief', 'Einladung Veranstaltung', 'Terminbestätigung Schriftverkehr',
  'Informationsblatt', 'Newsletter', 'Sonstiges Kommunikationsdokument',
] as const;

function toDocItems(labels: readonly string[], prefix: string) {
  return labels.map((label, i) => ({
    key: `${prefix}_${String(i + 1).padStart(2, '0')}`,
    label,
    desc: `Dokumentkategorie: ${label}`,
  }));
}

export const DOCUMENT_CATEGORY_CATALOGS = [
  ...batchCat('document_category', 'office', 'cat-doc-client', toDocItems(CLIENT_DOC_CATEGORIES, 'client')),
  ...batchCat('document_category', 'office', 'cat-doc-employee', toDocItems(EMPLOYEE_DOC_CATEGORIES, 'employee')),
  ...batchCat('document_category', 'office', 'cat-doc-office', toDocItems(OFFICE_DOC_CATEGORIES, 'office')),
  ...batchCat('document_category', 'communication', 'cat-doc-comm', toDocItems(COMM_DOC_CATEGORIES, 'comm')),
];
