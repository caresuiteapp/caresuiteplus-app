import { seriesTpl } from '../helpers';

export const REPORTING_TEMPLATES = seriesTpl(
  'tpl-report',
  'core',
  'documentation_text',
  'reporting',
  [
    'Monatsbericht Leistungen', 'Quartalsbericht QM', 'Auslastungsbericht', 'Abrechnungsübersicht',
    'Mitarbeiterstatistik', 'Klientenstatistik', 'Einsatzstatistik', 'Portal-Nutzung',
  ],
  (title) => `${title} — Zeitraum {{period}}, erstellt {{date}}.`,
);
