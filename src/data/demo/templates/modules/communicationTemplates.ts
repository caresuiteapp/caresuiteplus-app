import { batchTpl, seriesTpl } from '../helpers';

const GENERAL = seriesTpl(
  'tpl-comm-general',
  'communication',
  'message',
  'general',
  [
    'Standardantwort', 'Terminbestätigung', 'Terminabsage', 'Dokument bereit', 'Rückrufbitte',
    'Information Allgemein', 'Erinnerung Termin', 'Willkommensnachricht',
  ],
  (title) => `${title}: {{clientName}}, {{date}} {{time}}.`,
);

const PORTALS = batchTpl('tpl-comm-portal', 'communication', 'message', [
  { title: 'Portal Klient:in — Anfrage bearbeitet', content: 'Liebe:r {{clientName}}, Ihre Anfrage wurde bearbeitet.', categoryKey: 'portals' },
  { title: 'Portal Klient:in — Neues Dokument', content: 'Ein neues Dokument steht in Ihrem Portal bereit.', categoryKey: 'portals' },
  { title: 'Portal Angehörige — Info', content: 'Information an Angehörige von {{clientName}}: {{message}}.', categoryKey: 'portals' },
  { title: 'Portal Mitarbeiter — Dienstinfo', content: 'Team-Information: {{info}}', categoryKey: 'portals' },
  { title: 'Portal Termin', content: 'Ihr Termin am {{date}} um {{time}} ist bestätigt.', categoryKey: 'portals' },
  { title: 'Portal Erinnerung', content: 'Erinnerung: {{topic}} am {{date}}.', categoryKey: 'portals' },
]);

const INTERNAL = seriesTpl(
  'tpl-comm-internal',
  'communication',
  'message',
  'internal',
  ['Team-Info Schicht', 'Übergabe Nachricht', 'Einsatzänderung', 'Qualitätshinweis', 'IT-Hinweis', 'QM-Rundschreiben'],
  (title) => `Intern: ${title} — {{employeeName}}, {{date}}.`,
);

export const COMMUNICATION_TEMPLATES = [...GENERAL, ...PORTALS, ...INTERNAL];
