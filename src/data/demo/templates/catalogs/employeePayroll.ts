import { batchCat } from '../helpers';

const JOB_TITLES = [
  { key: 'pflegefachkraft', label: 'Pflegefachkraft', desc: 'Examinierte Pflegefachkraft' },
  { key: 'pflegehelfer', label: 'Pflegehelfer:in', desc: 'Pflegehilfskraft' },
  { key: 'betreuungskraft', label: 'Betreuungskraft', desc: '§ 45b Betreuungskraft' },
  { key: 'alltagsbegleiter', label: 'Alltagsbegleiter:in', desc: 'Alltagsbegleitung' },
  { key: 'hauswirtschaft', label: 'Hauswirtschaftskraft', desc: 'Haushalt und Versorgung' },
  { key: 'disponent', label: 'Disponent:in', desc: 'Einsatzplanung' },
  { key: 'buerokraft', label: 'Bürokraft', desc: 'Verwaltung' },
  { key: 'teamleitung', label: 'Teamleitung', desc: 'Team- / Bereichsleitung' },
  { key: 'geschaeftsfuehrung', label: 'Geschäftsführung', desc: 'Unternehmensleitung' },
  { key: 'praktikant', label: 'Praktikant:in', desc: 'Praktikum' },
  { key: 'ausbildung', label: 'Auszubildende:r', desc: 'Pflegeausbildung' },
] as const;

const TAX_CALCULATION = [
  { key: 'lohnsteuer_tabelle', label: 'Lohnsteuer-Tabelle', desc: 'Reguläre Lohnsteuerermittlung' },
  { key: 'pauschsteuer_standard', label: 'Pauschsteuer Standard', desc: 'Pauschsteuer nach Standardtarif' },
  { key: 'pauschsteuer_minijob', label: 'Pauschsteuer Minijob', desc: 'Pauschsteuer für Minijobber' },
  { key: 'freiberufler', label: 'Freiberufler / Honorar', desc: 'Keine Lohnsteuerabzüge' },
  { key: 'steuerfrei', label: 'Steuerfrei', desc: 'Steuerfreie Beschäftigung' },
] as const;

const HEALTH_INSURANCE = [
  { key: 'aok', label: 'AOK', desc: 'Allgemeine Ortskrankenkasse' },
  { key: 'barmer', label: 'BARMER', desc: 'BARMER Krankenkasse' },
  { key: 'tk', label: 'Techniker Krankenkasse', desc: 'TK' },
  { key: 'dak', label: 'DAK-Gesundheit', desc: 'DAK' },
  { key: 'ikk_classic', label: 'IKK classic', desc: 'IKK classic' },
  { key: 'hkk', label: 'hkk Krankenkasse', desc: 'hkk' },
  { key: 'kkh', label: 'KKH Kaufmännische Krankenkasse', desc: 'KKH' },
  { key: 'sbk', label: 'SBK Siemens-Betriebskrankenkasse', desc: 'SBK' },
  { key: 'bkk_vbu', label: 'BKK VBU', desc: 'BKK Verkehrsbau Union' },
  { key: 'private', label: 'Private Krankenversicherung', desc: 'PKV' },
  { key: 'sonstige', label: 'Sonstige Krankenkasse', desc: 'Andere gesetzliche Kasse' },
] as const;

export const EMPLOYEE_PAYROLL_CATALOGS = [
  ...batchCat('employee_job_title', 'office', 'cat-emp-job', JOB_TITLES),
  ...batchCat('employee_tax_calculation', 'office', 'cat-emp-tax', TAX_CALCULATION),
  ...batchCat('employee_health_insurance', 'office', 'cat-emp-kk', HEALTH_INSURANCE),
];
