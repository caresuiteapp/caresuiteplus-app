import { batchCat } from '../helpers';

const UPLOAD_CATEGORIES = [
  { key: 'einwilligung', label: 'Einwilligung', desc: 'Einwilligungserklärungen' },
  { key: 'vertrag', label: 'Vertrag', desc: 'Vertragsdokumente' },
  { key: 'arztbrief', label: 'Arztbrief', desc: 'Medizinische Unterlagen' },
  { key: 'rechnung', label: 'Rechnung', desc: 'Rechnungsbelege' },
  { key: 'leistungsnachweis', label: 'Leistungsnachweis', desc: 'Nachweise erbrachter Leistungen' },
  { key: 'pflegeplan', label: 'Pflegeplan', desc: 'Pflegeplanung' },
  { key: 'sis', label: 'SIS / Assessment', desc: 'Strukturierte Einschätzung' },
  { key: 'foto', label: 'Foto / Bild', desc: 'Bilddokumentation' },
  { key: 'identitaet', label: 'Identitätsnachweis', desc: 'Ausweis / Legitimation' },
  { key: 'versicherung', label: 'Versicherungsnachweis', desc: 'Kranken-/Pflegekasse' },
  { key: 'vollmacht', label: 'Vollmacht', desc: 'Bevollmächtigung' },
  { key: 'beratung', label: 'Beratungsunterlage', desc: 'Beratungsdokumentation' },
  { key: 'portal', label: 'Portal-Upload', desc: 'Vom Portal hochgeladen' },
  { key: 'scan', label: 'Scan / OCR', desc: 'Eingescanntes Dokument' },
  { key: 'intern', label: 'Intern', desc: 'Interne Unterlagen' },
  { key: 'sonstiges', label: 'Sonstiges', desc: 'Nicht zugeordnet' },
] as const;

const ASSIGNMENT_TARGETS = [
  { key: 'klient_akte', label: 'Klient:innen-Akte', desc: 'Direkt in Klientenakte' },
  { key: 'einsatz_doku', label: 'Einsatzdokumentation', desc: 'An Einsatz gebunden' },
  { key: 'pflegeplan', label: 'Pflegeplan', desc: 'An Pflegeplan angehängt' },
  { key: 'rechnung', label: 'Rechnung', desc: 'An Rechnung angehängt' },
  { key: 'mitarbeiter_akte', label: 'Mitarbeiter:innen-Akte', desc: 'Personalakte' },
  { key: 'beratung_akte', label: 'Beratungsakte', desc: 'Beratungsfall' },
  { key: 'portal_sichtbar', label: 'Portal (sichtbar)', desc: 'Für Portal freigegeben' },
  { key: 'portal_intern', label: 'Portal (intern)', desc: 'Nur intern sichtbar' },
  { key: 'kim_anhang', label: 'KIM-Anhang', desc: 'TI/KIM Nachricht' },
  { key: 'qm_nachweis', label: 'QM-Nachweis', desc: 'Qualitätsmanagement' },
  { key: 'archiv', label: 'Archiv', desc: 'Langzeitarchiv' },
] as const;

export const UPLOAD_CATEGORY_CATALOGS = [
  ...batchCat('upload_category', 'office', 'cat-upload', UPLOAD_CATEGORIES),
  ...batchCat('assignment_target', 'assist', 'cat-asg-target', ASSIGNMENT_TARGETS),
];
