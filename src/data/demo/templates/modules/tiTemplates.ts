import { batchTpl } from '../helpers';

export const TI_TEMPLATES = batchTpl('tpl-ti', 'ti', 'message', [
  { title: 'KIM Standardnachricht', content: 'Sehr geehrte Damen und Herren,\n\n{{body}}\n\nMit freundlichen Grüßen\n{{companyName}}', categoryKey: 'kim' },
  { title: 'KIM Arztbrief Anfrage', content: 'Anfrage Arztbrief für {{clientName}}, Geburtsdatum {{dateOfBirth}}.', categoryKey: 'kim' },
  { title: 'KIM Überweisung', content: 'Überweisung {{clientName}} an Facharzt — Anliegen: {{topic}}.', categoryKey: 'kim' },
  { title: 'KIM Medikationsplan', content: 'Bitte um aktuellen Medikationsplan für {{clientName}}.', categoryKey: 'kim' },
  { title: 'KIM Entlassungsbericht', content: 'Anfrage Entlassungsbericht — {{clientName}}, Krankenhaus {{hospitalName}}.', categoryKey: 'kim' },
  { title: 'KIM eRezept Hinweis', content: 'eRezept für {{clientName}} wurde übermittelt.', categoryKey: 'kim' },
  { title: 'KIM TI-Verfügbarkeit', content: 'Hinweis: TI-Wartung am {{date}} von {{start}} bis {{end}}.', categoryKey: 'kim' },
  { title: 'KIM Fehlerprotokoll', content: 'KIM-Versand fehlgeschlagen — bitte erneut senden. Fehler: {{notes}}.', categoryKey: 'kim' },
]);
