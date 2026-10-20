import { batchTpl } from '../helpers';

export const PORTAL_TEMPLATES = batchTpl('tpl-portal', 'core', 'message', [
  { title: 'Portal Willkommen Klient:in', content: 'Willkommen im Portal, {{clientName}}! Hier finden Sie Ihre Dokumente und Nachrichten.', categoryKey: 'portal' },
  { title: 'Portal Willkommen Angehörige', content: 'Willkommen — Sie haben Zugriff auf Informationen zu {{clientName}}.', categoryKey: 'portal' },
  { title: 'Portal Willkommen Mitarbeiter', content: 'Willkommen {{employeeName}} im Mitarbeiterportal.', categoryKey: 'portal' },
  { title: 'Portal Passwort zurücksetzen', content: 'Link zum Zurücksetzen Ihres Passworts — gültig bis {{endDate}}.', categoryKey: 'portal' },
  { title: 'Portal Neues Dokument', content: 'Neues Dokument für {{clientName}} verfügbar.', categoryKey: 'portal' },
  { title: 'Portal Terminerinnerung', content: 'Erinnerung: Termin am {{date}} um {{time}}.', categoryKey: 'portal' },
  { title: 'Portal Nachricht Team', content: 'Nachricht vom Team: {{message}}', categoryKey: 'portal' },
  { title: 'Portal Datenschutzhinweis', content: 'Bitte beachten Sie unsere Datenschutzhinweise im Portal.', categoryKey: 'portal' },
]);
