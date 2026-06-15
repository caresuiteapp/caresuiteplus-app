import { batchTpl, seriesTpl } from '../helpers';

const COURSE = batchTpl('tpl-akad-course', 'akademie', 'academy_course', [
  { title: 'Hygiene in der Pflege', content: 'Pflichtschulung Hygiene — Lernziele und Inhalte für {{courseName}}.', categoryKey: 'course' },
  { title: 'Medikamentenmanagement', content: 'Sicherer Umgang mit Medikamenten.', categoryKey: 'course' },
  { title: 'Kommunikation mit Demenz', content: 'Validated Methoden in der Demenzbetreuung.', categoryKey: 'course' },
  { title: 'Erste Hilfe Auffrischung', content: 'Erste-Hilfe-Maßnahmen im Pflegealltag.', categoryKey: 'course' },
  { title: 'Datenschutz Schulung', content: 'DSGVO und Schweigepflicht für Mitarbeitende.', categoryKey: 'course' },
]);

const LESSON = seriesTpl(
  'tpl-akad-lesson',
  'akademie',
  'documentation_text',
  'lesson',
  ['Einführung', 'Theorieblock', 'Praxisübung', 'Fallbeispiel', 'Gruppenarbeit', 'Quiz', 'Zusammenfassung', 'Evaluation'],
  (title) => `Lektion ${title} — Kurs {{courseName}}.`,
);

const PARTICIPANT = seriesTpl(
  'tpl-akad-participant',
  'akademie',
  'documentation_text',
  'participant',
  ['Anmeldung bestätigt', 'Teilnahme dokumentiert', 'Fehlzeit', 'Nachholtermin', 'Lernstand geprüft'],
  (title) => `${title}: {{participantName}} — Kurs {{courseName}}.`,
);

const EXAM = seriesTpl(
  'tpl-akad-exam',
  'akademie',
  'documentation_text',
  'exam',
  ['Multiple Choice', 'Praxischeck', 'Mündliche Prüfung', 'Fallbearbeitung', 'Wiederholungsprüfung'],
  (title) => `Prüfungstyp ${title} — {{participantName}}, Ergebnis {{grade}}.`,
);

const CERTIFICATE = batchTpl('tpl-akad-cert', 'akademie', 'certificate', [
  { title: 'Zertifikat Standard', content: 'Hiermit wird bestätigt, dass {{participantName}} am Kurs „{{courseName}}" am {{date}} teilgenommen hat.', categoryKey: 'certificate' },
  { title: 'Zertifikat mit Note', content: '{{participantName}} hat den Kurs {{courseName}} mit Note {{grade}} abgeschlossen.', categoryKey: 'certificate' },
  { title: 'Teilnahmebestätigung', content: 'Teilnahmebestätigung für {{participantName}} — {{courseName}}, {{date}}.', categoryKey: 'certificate' },
]);

const COMPLETION = seriesTpl(
  'tpl-akad-complete',
  'akademie',
  'message',
  'completion',
  ['Kurs erfolgreich abgeschlossen', 'Nachholtermin erforderlich', 'Zertifikat versendet', 'Fortbildungspunkte erfasst', 'Erinnerung Ablauf Zertifikat'],
  (title) => `${title}: {{participantName}} — {{courseName}}.`,
);

export const AKADEMIE_TEMPLATES = [...COURSE, ...LESSON, ...PARTICIPANT, ...EXAM, ...CERTIFICATE, ...COMPLETION];
