import type { IntakeDocumentState } from './intakeDocumentTypes';

export const INTAKE_RENDER_VERSION = 'intake-html-v1' as const;
export const INTAKE_RENDER_BINDING_ERROR = 'Die gespeicherte Unterschrift hat keine verifizierbare Bindung an diese Dokumentfassung. Bitte eine neue Fassung prüfen und erneut unterschreiben. Das bisherige Original bleibt erhalten.';
export const INTAKE_ORIGINAL_CHANGED_ERROR = 'Der geprüfte Dokumentinhalt oder die Vorlage wurde geändert. Bitte eine neue Dokumentfassung prüfen und erneut unterschreiben; die vorhandene Unterschrift bleibt beim Original.';

export function isIntakeRenderTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || /\s/.test(value)) return false;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/);
  if (!match || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59
    || Number(match[5] ?? 0) > 23 || Number(match[6] ?? 0) > 59 || !Number.isFinite(Date.parse(value))) return false;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === match[1];
}

export function hasIntakeRenderBinding(doc: Pick<IntakeDocumentState, 'renderVersion' | 'renderedAt'>): doc is typeof doc & { renderVersion: typeof INTAKE_RENDER_VERSION; renderedAt: string } {
  return doc.renderVersion === INTAKE_RENDER_VERSION && isIntakeRenderTimestamp(doc.renderedAt);
}

export function getIntakeRenderBindingError(doc: Pick<IntakeDocumentState, 'renderVersion' | 'renderedAt'>): string | null {
  return hasIntakeRenderBinding(doc) ? null : INTAKE_RENDER_BINDING_ERROR;
}

/** Syntax boundary for HTML attributes. Image-byte verification belongs to the server. */
export function isSafeIntakeSignatureDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 3_000_000 && !/\s/.test(value)
    && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function escapeIntakeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const berlinParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function parts(value: string): Record<string, string> {
  return Object.fromEntries(berlinParts.formatToParts(new Date(value)).map(part => [part.type, part.value]));
}

export function formatIntakeDocumentDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
  if (!isIntakeRenderTimestamp(value)) return '';
  const date = parts(value);
  return `${date.day}.${date.month}.${date.year}`;
}

export function formatIntakeDocumentDateTime(value: string): string {
  if (!isIntakeRenderTimestamp(value)) return '';
  const date = parts(value);
  return `${date.day}.${date.month}.${date.year}, ${date.hour}:${date.minute}:${date.second}`;
}
