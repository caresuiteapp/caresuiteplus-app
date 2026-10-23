import { UUID } from './sources';
import { SERVICE_TYPES, isDate, isMonth, type ServiceType } from './model';
import { readMonthlyProof, type MonthlyProof, type MonthlyProofCommand } from './monthlyProof';

type Row = Record<string, unknown>;
const row = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const stamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
function fail(): never { throw new Error('Die Monatsnachweise passen nicht zur angefragten Auswahl. Bitte neu laden.'); }
export const MONTHLY_STATUS = {open: 'Offen', final: 'Endgültig', invalidated: 'Ungültiger Vorgänger'} as const;
export type MonthlyClient = {id: string; name: string};
export type MonthlySummary = {id: string; seriesId: string; serviceType: ServiceType; version: number; revision: number;
  status: 'open' | 'final'; recordCount: number; updatedAt: string; confirmationKind: 'signature' | 'missing_signature' | null};
export type MonthlyWorkspace = {tenantId: string; clientId: string; clientName: string; month: string; canWrite: boolean; proofs: MonthlySummary[]};
export type MonthlySource = {id: string; updatedAt: string; serviceDate: string; employeeId: string; employeeName: string;
  actualMinutes: number; description: string; assignedSeriesId: string | null};
export type MonthlyPage<T> = {items: T[]; nextCursor: string | null};
export type MonthlyRequestStatus = {state: 'not_found'; proof: null} | {state: 'applied'; proof: MonthlyProof};

function scope(value: unknown, contract: string, tenantId: string, month: string): Row {
  if (!row(value) || value.contract !== contract || !uuid(tenantId) || value.tenantId !== tenantId || !isMonth(month) || value.month !== month) fail();
  return value;
}
function page(value: Row, items: unknown, after: string | null): Row[] {
  if (value.after !== after || (after !== null && !uuid(after)) || !Array.isArray(items) || items.length > 50
    || items.some((x, i) => !row(x) || !uuid(x.id) || (i > 0 && String(items[i - 1].id) >= x.id) || (after !== null && x.id <= after))) fail();
  if (value.nextCursor !== null && (items.length !== 50 || value.nextCursor !== items.at(-1)?.id)) fail();
  return items;
}
export function readMonthlyClients(value: unknown, tenantId: string, month: string, search: string, after: string | null): MonthlyPage<MonthlyClient> {
  const v = scope(value, 'gkv-monthly-clients-v1', tenantId, month);
  if (v.search !== search) fail();
  const items = page(v, v.clients, after);
  if (items.some(x => !text(x.name))) fail();
  return {items: items as unknown as MonthlyClient[], nextCursor: v.nextCursor as string | null};
}
export function readMonthlyWorkspace(value: unknown, tenantId: string, clientId: string, month: string): MonthlyWorkspace {
  const v = scope(value, 'gkv-monthly-workspace-v1', tenantId, month);
  if (!uuid(clientId) || v.clientId !== clientId || !text(v.clientName) || typeof v.canWrite !== 'boolean' || !Array.isArray(v.proofs) || v.proofs.length > 15) fail();
  const ids = new Set(), types = new Set(), series = new Set();
  for (const p of v.proofs) {
    if (!row(p) || !uuid(p.id) || !uuid(p.seriesId) || ids.has(p.id) || series.has(p.seriesId) || types.has(p.serviceType)
      || !Object.hasOwn(SERVICE_TYPES, String(p.serviceType)) || !positive(p.version) || !positive(p.revision) || !positive(p.recordCount) || p.recordCount > 500
      || !stamp(p.updatedAt) || !['open','final'].includes(String(p.status))
      || (p.status === 'open' ? p.confirmationKind !== null : !['signature','missing_signature'].includes(String(p.confirmationKind)))) fail();
    ids.add(p.id); series.add(p.seriesId); types.add(p.serviceType);
  }
  return v as unknown as MonthlyWorkspace;
}
export function readMonthlySources(value: unknown, tenantId: string, clientId: string, month: string, after: string | null): MonthlyPage<MonthlySource> {
  const v = scope(value, 'gkv-monthly-sources-v1', tenantId, month);
  if (!uuid(clientId) || v.clientId !== clientId) fail();
  const items = page(v, v.sources, after);
  if (items.some(x => !stamp(x.updatedAt) || !isDate(x.serviceDate) || !x.serviceDate.startsWith(month + '-') || !uuid(x.employeeId)
    || !text(x.employeeName) || !positive(x.actualMinutes) || typeof x.description !== 'string'
    || (x.assignedSeriesId !== null && !uuid(x.assignedSeriesId)))) fail();
  return {items: items as unknown as MonthlySource[], nextCursor: v.nextCursor as string | null};
}
export function commandTarget(command: MonthlyProofCommand): string {
  return command.action === 'create' || command.action === 'correct' ? command.input.new_id : command.input.id;
}
export function readMonthlyRequestStatus(value: unknown, tenantId: string, requestId: string): MonthlyRequestStatus {
  if (!row(value) || value.contract !== 'gkv-monthly-request-v1' || !uuid(tenantId) || value.tenantId !== tenantId || value.requestId !== requestId || !uuid(requestId)) fail();
  if (value.state === 'not_found' && value.proof === null) return {state: 'not_found', proof: null};
  if (value.state !== 'applied') fail();
  return {state: 'applied', proof: readMonthlyProof(value.proof, tenantId)};
}

export type MonthlyDifference = {key: string; label: string; before: string; after: string};
/** Compare source content, not status/revision/hash noise. Never compare people or months across scope. */
export function monthlyDifferences(before: MonthlyProof, after: MonthlyProof): MonthlyDifference[] {
  if (before.tenant_id !== after.tenant_id || before.series_id !== after.series_id || before.payload.clientId !== after.payload.clientId
    || before.payload.month !== after.payload.month || before.payload.serviceType !== after.payload.serviceType) fail();
  const changes: MonthlyDifference[] = [];
  const old = new Map(before.payload.records.map(r => [r.recordId, r]));
  const next = new Map(after.payload.records.map(r => [r.recordId, r]));
  for (const id of new Set([...old.keys(), ...next.keys()])) {
    const a = old.get(id), b = next.get(id), item = b || a!;
    const label = `${new Date(item.serviceDate + 'T12:00:00Z').toLocaleDateString('de-DE', {timeZone: 'Europe/Berlin'})} · ${item.employeeName}`;
    if (!a || !b) { changes.push({key: id, label, before: a ? a.description : 'Nicht enthalten', after: b ? b.description : 'Entfernt'}); continue; }
    for (const [field, title] of [['serviceDate','Leistungsdatum'],['employeeName','Pflegekraft'],['actualMinutes','Dauer in Minuten'],['description','Leistungsbeschreibung']] as const)
      if (a[field] !== b[field]) changes.push({key: `${id}:${field}`, label: `${label} · ${title}`, before: String(a[field]), after: String(b[field])});
    if (a.employeeId !== b.employeeId && a.employeeName === b.employeeName) changes.push({key: `${id}:employee`, label: `${label} · Personenbindung`, before: a.employeeId, after: b.employeeId});
    const tasks = (r: typeof a) => r.tasks.map(t => `${t.title} · ${t.status}${t.completionNote ? ': ' + t.completionNote : ''}`).join('\n');
    if (JSON.stringify(a.tasks) !== JSON.stringify(b.tasks)) changes.push({key: `${id}:tasks`, label: `${label} · Einzelne Leistungen`, before: tasks(a), after: tasks(b)});
    if (a.updatedAt !== b.updatedAt) changes.push({key: `${id}:source`, label: `${label} · Quellstand`, before: a.updatedAt, after: b.updatedAt});
    if (JSON.stringify(a.sourceReceipt) !== JSON.stringify(b.sourceReceipt)) changes.push({key: `${id}:receipt`, label: `${label} · Originalbeleg`, before: 'Früherer Originalbeleg', after: 'Originalbeleg geändert · erneute Prüfung erforderlich'});
  }
  return changes;
}
