/** Pure presentation/validation helpers; no network or platform privileges. */
export type ConsoleRow = Record<string, unknown>;
export const CONSOLE_LABELS: Record<string, string> = {
  active: 'Aktiv', available: 'Verfügbar', disabled: 'Deaktiviert', revoked: 'Entzogen',
  suspended: 'Gesperrt', locked: 'Gesperrt', terminated: 'Beendet', deleted_soft: 'Archiviert',
  live: 'Im Betrieb', onboarding: 'Einrichtung', lead: 'Interessent', trial: 'Testphase (Bestand)',
  manual_free: 'Kostenlos', free_platform: 'CareSuite kostenlos', paused: 'Pausiert', offboarding: 'Austritt',
  open: 'Offen', draft: 'Entwurf', paid: 'Bezahlt', past_due: 'Überfällig', failed: 'Fehlgeschlagen',
  cancelled: 'Storniert', refunded: 'Erstattet', partially_paid: 'Teilbezahlt', pending: 'Ausstehend',
  succeeded: 'Erfolgreich', chargeback: 'Rückbelastung', scheduled: 'Geplant', expired: 'Abgelaufen',
  beta: 'Beta', internal: 'Intern', deprecated: 'Auslaufend', global: 'Plattformweit', tenant: 'Einzelner Mandant',
  production: 'Produktion', pilot: 'Pilot', demo: 'Demo', sandbox: 'Sandbox', internal_test: 'Interner Test',
  unclassified: 'Noch nicht eingeordnet', preview: 'Vorschau', staging: 'Staging', ready: 'Bereit',
  not_checked: 'Nicht geprüft', passed: 'Bestanden', coming_soon: 'In Vorbereitung', inactive: 'Inaktiv', archived: 'Archiviert', planned: 'Geplant', building: 'Im Build', rolled_back: 'Zurückgesetzt', percentage: 'Prozent',
  fixed_amount: 'Fester Betrag', free_months: 'Freimonate', lifetime_discount: 'Dauerhafter Rabatt',
  beta_discount: 'Beta-Rabatt', manual_credit: 'Guthaben', goodwill_credit: 'Kulanzguthaben', partner_discount: 'Partnerrabatt',
  monthly: 'Monatlich', yearly: 'Jährlich', manual: 'Manuell', bank_transfer: 'Überweisung',
  platform_owner: 'Inhaber', platform_admin: 'Administration', platform_billing: 'Abrechnung',
  platform_support: 'Support', platform_developer: 'Entwicklung', platform_readonly: 'Lesezugriff',
};
export const consoleLabel = (value: unknown): string => value == null || value === '' ? '—' : CONSOLE_LABELS[String(value)] ?? String(value);
export function consoleMoney(value: unknown, currency: unknown = 'EUR'): string {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: String(currency || 'EUR') }).format(Number(value) / 100); }
  catch { return `${(Number(value) / 100).toFixed(2)} ${String(currency)}`; }
}
export function consoleDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', ...(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? {} : { timeStyle: 'short' as const }), timeZone:'Europe/Berlin' }).format(date);
}
export function consoleText(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (Array.isArray(value)) return value.map(consoleLabel).join(', ') || 'Keine';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return consoleLabel(value);
}
const protectedKey = /secret|token|password|api[_-]?key|private|credential/i;
function containsProtectedValue(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key,item])=>protectedKey.test(key)||containsProtectedValue(item));
}
export function isSensitiveSetting(row: ConsoleRow): boolean {
  return row.is_sensitive === true || protectedKey.test(String(row.setting_key ?? '')) || containsProtectedValue(row.value);
}
export function redactConsoleValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactConsoleValue);
  if (!value || typeof value !== 'object') return value;
  const row = value as ConsoleRow;
  return Object.fromEntries(Object.entries(row).map(([key, item]) => [key,
    /secret|token|password|api[_-]?key|private|credential/i.test(key) || (key === 'value' && isSensitiveSetting(row))
      ? '[geschützt]' : redactConsoleValue(item),
  ]));
}
export function consoleCsv(headers: string[], rows: unknown[][]): string {
  const cell = (value: unknown) => {
    let text = value == null ? '' : String(value);
    // Spreadsheet applications must never execute data as formulas.
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
}
export function consoleEuros(value: string): number {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) throw new Error('Betrag bitte im Format 1.234,56 angeben.');
  const cents = Math.round(Number(text.replace(/\./g, '').replace(',', '.')) * 100);
  if (!Number.isSafeInteger(cents) || cents > 2147483647) throw new Error('Der Betrag ist zu groß.');
  return cents;
}
export function validConsoleDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function consoleSettingValue(previous: unknown, input: string): unknown {
  if(previous===null){if(input.trim()!=='null')throw new Error('Diese Einstellung erwartet den Wert null.');return null;}
  if (typeof previous === 'boolean') {
    if (!['true', 'false'].includes(input)) throw new Error('Bitte Ja oder Nein auswählen.');
    return input === 'true';
  }
  if (typeof previous === 'number') {
    if (!input.trim() || !Number.isFinite(Number(input))) throw new Error('Bitte eine gültige Zahl eingeben.');
    return Number(input);
  }
  if (previous !== null && typeof previous === 'object') {
    let parsed: unknown;
    try { parsed = JSON.parse(input); } catch { throw new Error('Die strukturierte Einstellung enthält ungültiges JSON.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) !== Array.isArray(previous)) throw new Error('Der Datentyp dieser Einstellung muss erhalten bleiben.');
    return parsed;
  }
  return input;
}
export function consoleInvoiceBalance(invoice: ConsoleRow, payments: ConsoleRow[]): number {
  const received = payments.filter(p => p.invoice_id === invoice.id && p.status === 'succeeded').reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0);
  return Math.max(0, Number(invoice.amount_cents ?? 0) - received);
}
