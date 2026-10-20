import { seriesTpl } from '../helpers';

export const CARE_RECORD_TEMPLATES = seriesTpl(
  'tpl-carerecord',
  'pflege',
  'documentation_text',
  'care_record',
  [
    'Tageseintrag', 'Leistung erbracht', 'Verlauf dokumentiert', 'Abweichung vom Plan',
    'Angehörige informiert', 'Arzt kontaktiert', 'Medikation dokumentiert', 'Vitalwerte erfasst',
    'Sturz dokumentiert', 'Wundversorgung', 'Übergabe Pflegedokumentation',
  ],
  (title) => `Pflegedokumentation — ${title}: {{clientName}}, {{date}} {{employeeName}}.`,
);
