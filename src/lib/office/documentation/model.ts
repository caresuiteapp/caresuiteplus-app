import { secureRandomId } from '@/lib/platform/secureRandomId';

export const DOCUMENTATION_AREAS = [
  { value: 'client', label: 'Klienten' }, { value: 'employee', label: 'Mitarbeitende' },
  { value: 'administration', label: 'Verwaltung' },
] as const;
export const DOCUMENTATION_CATEGORIES = [
  { value: 'general', label: 'Allgemein', color: '#49637e', tint: '#edf2f7' },
  { value: 'care', label: 'Betreuung', color: '#00746c', tint: '#e0f4ed' },
  { value: 'health', label: 'Gesundheit', color: '#9d3760', tint: '#fbeaf0' },
  { value: 'communication', label: 'Kommunikation', color: '#3458b5', tint: '#e9efff' },
  { value: 'organisation', label: 'Organisation', color: '#966116', tint: '#fff3d9' },
  { value: 'personnel', label: 'Personal', color: '#7051a8', tint: '#f0eaff' },
  { value: 'incident', label: 'Vorkommnis', color: '#b73537', tint: '#ffe9e7' },
] as const;
export type DocumentationArea = typeof DOCUMENTATION_AREAS[number]['value'];
export type DocumentationCategory = typeof DOCUMENTATION_CATEGORIES[number]['value'];
export type DocumentationDraft = {
  area: DocumentationArea; clientId: string; employeeId: string;
  category: DocumentationCategory; priority: 'normal' | 'important' | 'urgent';
  title: string; body: string; occurredAt: string;
};
export type DocumentationEntry = {
  id: string; tenant_id: string; source: 'manual' | 'visit'; area: DocumentationArea;
  client_id: string | null; employee_id: string | null; category: DocumentationCategory;
  priority: DocumentationDraft['priority']; title: string; body: string;
  occurred_at: string; created_at: string; author_name: string;
  client_name: string; employee_name: string; visit_id: string | null;
};
export type DocumentationFilters = {
  month: string; area: string; clientId: string; employeeId: string; category: string;
  source: string; priority: string; query: string; offset: number;
};
export type DocumentationOption = { id: string; name: string };
export type DocumentationPage = {
  items: DocumentationEntry[]; total: number; months: string[];
  clients: DocumentationOption[]; employees: DocumentationOption[];
};
export type DocumentationActor = { tenantId: string; userId: string };
export type DocumentationResult<T> = { ok: true; data: T } | { ok: false; error: string; uncertain?: boolean };
export const newDocumentationId = secureRandomId;
export function berlinMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}
export function shiftDocumentationMonth(month: string, delta: number) {
  const [year, part] = (month || berlinMonth()).split('-').map(Number);
  const date = new Date(Date.UTC(year, part - 1 + delta, 15));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function documentationDateTime(date: string) {
  return new Date(date).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' });
}
export function documentationDraft(seed: Partial<DocumentationDraft> = {}): DocumentationDraft {
  return { area: 'administration', clientId: '', employeeId: '', category: 'general', priority: 'normal',
    title: '', body: '', occurredAt: new Date().toISOString(), ...seed };
}
export function validateDocumentation(draft: DocumentationDraft): string | null {
  if (!draft.title.trim() || draft.title.trim().length > 180) return 'Bitte einen Titel mit höchstens 180 Zeichen eingeben.';
  if (!draft.body.trim() || draft.body.trim().length > 20000) return 'Bitte eine Dokumentation mit höchstens 20.000 Zeichen eingeben.';
  if (draft.area === 'client' && !draft.clientId) return 'Bitte einen Klienten auswählen.';
  if (draft.area === 'employee' && !draft.employeeId) return 'Bitte einen Mitarbeitenden auswählen.';
  if (!Number.isFinite(Date.parse(draft.occurredAt)) || Date.parse(draft.occurredAt) > Date.now() + 300000) return 'Bitte einen gültigen Zeitpunkt ohne zukünftiges Datum auswählen.';
  return null;
}
