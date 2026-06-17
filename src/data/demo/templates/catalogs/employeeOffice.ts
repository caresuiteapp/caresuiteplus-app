import { batchCat } from '../helpers';

const EMPLOYEE_ROLES = [
  { key: 'pflegefachkraft', label: 'Pflegefachkraft', desc: 'Examinierte Pflegefachkraft' },
  { key: 'pflegehelfer', label: 'Pflegehelfer:in', desc: 'Pflegehilfskraft / Pflegeassistent:in' },
  { key: 'betreuungskraft', label: 'Betreuungskraft', desc: 'Betreuung nach § 45b SGB XI' },
  { key: 'alltagsbegleiter', label: 'Alltagsbegleiter:in', desc: 'Alltagsbegleitung / Assistenz' },
  { key: 'hauswirtschaft', label: 'Hauswirtschaft', desc: 'Haushalt und Versorgung' },
  { key: 'disponent', label: 'Disponent:in', desc: 'Einsatz- und Tourenplanung' },
  { key: 'buerokraft', label: 'Bürokraft', desc: 'Verwaltung und Empfang' },
  { key: 'teamleitung', label: 'Teamleitung', desc: 'Führung eines Teams / Bereichs' },
  { key: 'geschaeftsfuehrung', label: 'Geschäftsführung', desc: 'Leitung / Geschäftsführung' },
  { key: 'praktikant', label: 'Praktikant:in', desc: 'Praktikum / Ausbildung' },
  { key: 'qualitaetsmanagement', label: 'QM-Beauftragte:r', desc: 'Qualitätsmanagement' },
  { key: 'ausbildung', label: 'Auszubildende:r', desc: 'Pflegeausbildung' },
] as const;

const EMPLOYEE_DEPARTMENTS = [
  { key: 'assist_aussendienst', label: 'Assist / Außendienst', desc: 'Assistenz und Außendienst' },
  { key: 'pflege', label: 'Pflege', desc: 'Ambulante und stationäre Pflege' },
  { key: 'buero_verwaltung', label: 'Büro / Verwaltung', desc: 'Backoffice und Verwaltung' },
  { key: 'disposition', label: 'Disposition', desc: 'Einsatzplanung und Touren' },
  { key: 'abrechnung', label: 'Abrechnung', desc: 'Leistungsabrechnung und Faktura' },
  { key: 'qm', label: 'QM', desc: 'Qualitätsmanagement' },
  { key: 'geschaeftsfuehrung', label: 'Geschäftsführung', desc: 'Unternehmensleitung' },
  { key: 'recruiting', label: 'Recruiting / HR', desc: 'Personalgewinnung und HR' },
  { key: 'akademie', label: 'Akademie / Schulung', desc: 'Fort- und Weiterbildung' },
] as const;

export const EMPLOYEE_OFFICE_CATALOGS = [
  ...batchCat('employee_role', 'office', 'cat-emp-role', EMPLOYEE_ROLES),
  ...batchCat('employee_department', 'office', 'cat-emp-dept', EMPLOYEE_DEPARTMENTS),
];
