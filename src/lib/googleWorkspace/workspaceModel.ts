import type { GoogleWorkspaceCapability } from './googleWorkspaceService';

export const WORKSPACE_SERVICES = [
  { key: 'gmail', title: 'Gmail', glyph: 'M', color: '#c33336', description: 'Postfach lesen, E-Mails schreiben und Entwürfe speichern.' },
  { key: 'calendar', title: 'Kalender', glyph: '31', color: '#1767cc', description: 'Termine im gewählten Zeitraum und neue Veranstaltungen.' },
  { key: 'meet', title: 'Google Meet', glyph: '▷', color: '#087f70', description: 'Videotermine planen und an Besprechungen teilnehmen.' },
  { key: 'drive', title: 'Google Drive', glyph: '△', color: '#18804a', description: 'Dateien finden, hochladen und Ordner anlegen.' },
  { key: 'docs', title: 'Google Docs', glyph: '▤', color: '#1767cc', description: 'Dokumente erstellen und in Google Docs bearbeiten.' },
  { key: 'sheets', title: 'Google Sheets', glyph: '▦', color: '#18804a', description: 'Tabellen erstellen, finden und in Google Sheets öffnen.' },
  { key: 'slides', title: 'Google Slides', glyph: '▣', color: '#976600', description: 'Präsentationen erstellen und in Google Slides öffnen.' },
  { key: 'tasks', title: 'Google Tasks', glyph: '✓', color: '#1767cc', description: 'Aufgaben nach Liste anzeigen, anlegen und abschließen.' },
  { key: 'contacts', title: 'Kontakte', glyph: '♙', color: '#1767cc', description: 'Google-Kontakte mit E-Mail und Telefonnummer verwalten.' },
  { key: 'chat', title: 'Google Chat', glyph: '▱', color: '#087f70', description: 'Spaces auswählen und Nachrichten gezielt senden.' },
] as const;
export type WorkspaceService = GoogleWorkspaceCapability;
export type WorkspaceTab = WorkspaceService | 'overview' | 'activity';
export const workspaceTab = (value: unknown): WorkspaceTab => value === 'activity' || WORKSPACE_SERVICES.some(s => s.key === value) ? value as WorkspaceTab : 'overview';
export const serviceDefinition = (key: WorkspaceService) => WORKSPACE_SERVICES.find(s => s.key === key)!;
export const workspaceHref = (key: WorkspaceTab = 'overview') => `/business/connect/google-workspace?service=${key}`;
export function googleLink(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'google.com' || url.hostname.endsWith('.google.com')) ? url.href : null; } catch { return null; }
}
export function googleTime(value?: string | null): string {
  if (!value) return 'Noch kein Abruf';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`).toLocaleDateString('de-DE');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Zeitpunkt unbekannt' : date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function driveQuery(service: WorkspaceService, query = ''): string {
  const mime: Record<string, string> = { docs: 'document', sheets: 'spreadsheet', slides: 'presentation' };
  const parts = ['trashed = false'];
  if (mime[service]) parts.push(`mimeType = 'application/vnd.google-apps.${mime[service]}'`);
  if (query.trim()) parts.push(`name contains '${query.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
  return parts.join(' and ');
}
export function encodeMail(to: string, subject: string, body: string): string {
  if (!/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(to.trim()) || /[\r\n]/.test(to + subject)) throw new Error('Bitte eine gültige Empfängeradresse und einen Betreff ohne Zeilenumbruch eingeben.');
  if (!subject.trim() || !body.trim()) throw new Error('Betreff und Nachricht fehlen.');
  const base64 = (text: string) => { const bytes = new TextEncoder().encode(text); let binary = ''; bytes.forEach(b => { binary += String.fromCharCode(b); }); return btoa(binary); };
  return base64(`To: ${to.trim()}\r\nSubject: =?UTF-8?B?${base64(subject.trim())}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(body)}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function plainMail(payload: any): string {
  if (payload?.mimeType === 'text/plain' && payload.body?.data) {
    try { return new TextDecoder().decode(Uint8Array.from(atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); } catch { return ''; }
  }
  for (const part of payload?.parts ?? []) { const text = plainMail(part); if (text) return text; }
  return '';
}
export type WorkspaceItem = { id: string; title: string; subtitle: string; when?: string; url?: string; unread?: boolean; completed?: boolean; raw?: any };
export type WorkspacePage = { items: WorkspaceItem[]; nextPageToken?: string; fetchedAt: string };
