/** Deliberately limited to navigation. No data mutations or generated routes. */
export const VOICE_DESTINATIONS = [
  { key: 'home', label: 'Startseite', route: '/', permission: 'office.access', words: ['startseite', 'start', 'dashboard', 'home'] },
  { key: 'clients', label: 'Klienten', route: '/office/clients', permission: 'office.clients.view', words: ['klienten', 'klientinnen', 'klientenakten', 'klientenakte', 'klienten akte', 'klientenliste', 'kunden'] },
  { key: 'employees', label: 'Mitarbeitende', route: '/office/employees', permission: 'office.employees.view', words: ['mitarbeiter', 'mitarbeitende', 'mitarbeiterinnen', 'personal', 'team'] },
  { key: 'calendar', label: 'Kalender', route: '/assist/calendar', permission: 'assist.assignments.view', words: ['kalender', 'dienstplan', 'einsatzplanung', 'planung'] },
  { key: 'assignments', label: 'Einsätze', route: '/assist/einsaetze', permission: 'assist.assignments.view', words: ['einsatze', 'einsatzubersicht'] },
  { key: 'evidence', label: 'Nachweise', route: '/assist/nachweise', permission: 'assist.records.view', words: ['nachweise', 'leistungsnachweise'] },
  { key: 'invoices', label: 'Rechnungen', route: '/office/invoices', permission: 'office.invoices.view', words: ['rechnungen', 'rechnungsubersicht', 'abrechnung'] },
  { key: 'documents', label: 'Dokumente', route: '/office/documents', permission: 'office.documents.view', words: ['dokumente', 'dokumentenablage', 'dateien'] },
  { key: 'messages', label: 'Nachrichten', route: '/office/messages', permission: 'office.messages.view', words: ['nachrichten', 'postfach', 'chat'] },
  { key: 'appointments', label: 'Termine', route: '/office/appointments', permission: 'office.appointments.view', words: ['termine', 'terminverwaltung'] },
  { key: 'logbook', label: 'Fahrtenbuch', route: '/business/office/fahrtenbuch', permission: 'office.employees.view', words: ['fahrtenbuch', 'fahrten'] },
  { key: 'time', label: 'Arbeitszeit', route: '/business/office/time-tracking', permission: 'office.employee_time.view', words: ['arbeitszeit', 'arbeitszeitkonto', 'zeiterfassung'] },
  { key: 'settings', label: 'Einstellungen', route: '/settings', permission: 'office.access', words: ['einstellungen'] },
] as const;

export type Destination = typeof VOICE_DESTINATIONS[number];
export type VoiceCommand =
  | { kind: 'navigate'; destination: Destination }
  | { kind: 'client'; name: string }
  | { kind: 'choice'; index: number }
  | { kind: 'back' }
  | { kind: 'cancel' }
  | { kind: 'help' }
  | { kind: 'unknown' };

export function normalizeVoiceText(text: string): string {
  return text.toLocaleLowerCase('de-DE').replace(/ß/g, 'ss').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z0-9\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseVoiceCommand(input: string): VoiceCommand {
  if (input.length > 240) return { kind: 'unknown' };
  const raw = input.trim().replace(/[.!?,]+$/g, '').replace(/^(?:(?:hey|hallo)\s+)?(?:neo|caresuite|care suite|roboter)\s*[,!]?\s*/i, '')
    .replace(/^(?:kannst du|könntest du|koenntest du)\s+(?:mir\s+)?(?:bitte\s+)?/i, '')
    .replace(/^((?:öffne|oeffne|offne|zeige|zeig)\s+)bitte\s+/i, '$1');
  const normalized = normalizeVoiceText(raw);
  if (/^(?:stopp?|abbrechen|abbruch|vergiss es|schliessen)$/.test(normalized)) return { kind: 'cancel' };
  if (/^(?:hilfe|was kannst du|befehle)$/.test(normalized)) return { kind: 'help' };
  if (/\b(?:nicht|kein|keine|losche|loschen|sende|senden|speichern|andern|bezahlen)\b/.test(normalized)) return { kind: 'unknown' };
  if (/^(?:bitte )?(?:zuruck|gehe zuruck|geh zuruck|eine seite zuruck)(?: bitte)?$/.test(normalized)) return { kind: 'back' };
  const number = normalized.replace(/^(?:nummer|treffer) /, '');
  const numbers = ['eins', 'zwei', 'drei', 'vier', 'funf', 'sechs', 'sieben', 'acht'];
  const index = numbers.indexOf(number);
  if (index >= 0 || /^[1-8]$/.test(number)) return { kind: 'choice', index: index >= 0 ? index : Number(number) - 1 };
  const target = normalized.replace(/^bitte /, '')
    .replace(/^(?:offne|offnen|zeige|zeig|gehe|geh|wechsle|wechsel|navigiere|bring mich)\s+/, '')
    .replace(/^(?:mir |mich )/, '').replace(/^(?:zu |zur |zum |in |auf )/, '')
    .replace(/^(?:die |der |das |den )/, '').replace(/(?: bitte)?(?: offnen| anzeigen)?(?: bitte)?$/, '').trim();
  const destination = VOICE_DESTINATIONS.find((d) => (d.words as readonly string[]).includes(target));
  if (destination) return { kind: 'navigate', destination };
  const match = raw.match(/^(?:bitte\s+)?(?:(?:öffne|oeffne|offne|zeige|zeig)\s+(?:mir\s+)?)?(?:die\s+)?(?:klienten\s*akte|klientinnen\s*akte|akte)(?:\s+(?:von|für|fuer))?\s+(.+?)(?:\s+(?:öffnen|oeffnen|offnen|anzeigen))?(?:\s+bitte)?$/i);
  const name = match?.[1]?.replace(/^(?:frau|herrn?|klient(?:in)?)\s+/i, '').trim();
  if (name && /^[\p{L} '-]{2,100}$/u.test(name) && !/\b(?:und|oder|dann)\b/i.test(name)) return { kind: 'client', name };
  return { kind: 'unknown' };
}

export type VoiceClient = { id: string; firstName: string; lastName: string; city?: string | null };
export function matchVoiceClients<T extends VoiceClient>(name: string, clients: readonly T[]): T[] {
  const tokens = normalizeVoiceText(name).split(' ');
  return clients.filter((client) => {
    const available = normalizeVoiceText(`${client.firstName} ${client.lastName}`).split(' ');
    return tokens.every((token) => available.includes(token));
  });
}
