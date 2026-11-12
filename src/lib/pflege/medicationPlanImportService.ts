import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { getSupabaseClient } from '@/lib/supabase/client';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { woundUuid } from './woundCareDomain';
import { isMedicationPlanVersion, MAX_MEDICATION_PLAN_BYTES, sameMedicationPlanDraft, type MedicationPlanDraft, type MedicationPlanPatient } from './medicationPlanImportDomain';

export type MedicationPlanImportScope = { tenantId: string; actorId: string; isCurrent(): boolean };
export type MedicationPlanClient = { id: string; firstName: string; lastName: string; birthDate: string | null };
export type MedicationPlanPositionConfirmation = { rowIndex: number; confirmedAt: string; actorId: string };
export type StoredMedicationPlan = { id: string; clientId: string; fileName: string; createdAt: string; plan: MedicationPlanDraft; sourceSha256: string; confirmed: MedicationPlanPositionConfirmation[] };
export type StoredMedicationPlanListItem = { id: string; clientId: string; fileName: string; createdAt: string; positionCount: number; confirmedCount: number };
export type MedicationPlanAssignment = { clientId: string; assignment: 'exact' | 'manual'; reason: string };

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 3000;
const maybeText = (value: unknown): value is string | null => value === null || text(value);
const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isoDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const sha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const index = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 200;
const page = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 5;
const attributes = (value: unknown): value is Record<string, string> => record(value) && Object.keys(value).length <= 16 && Object.values(value).every(text);
const couldNotRead = 'Der gespeicherte Medikationsentwurf konnte nicht sicher bestätigt werden.';

function identity(value: unknown): value is MedicationPlanPatient {
  return record(value) && text(value.firstName) && !!value.firstName.trim() && text(value.lastName) && !!value.lastName.trim()
    && (value.birthDate === null || isoDate(value.birthDate)) && text(value.rawBirthDate) && maybeText(value.insuranceId);
}
function confirmation(value: unknown): value is MedicationPlanPositionConfirmation {
  return record(value) && index(value.rowIndex) && instant(value.confirmedAt) && woundUuid(value.actorId);
}
function planShape(value: unknown): value is MedicationPlanDraft {
  if (!record(value) || !isMedicationPlanVersion(value.version) || typeof value.planId !== 'string' || !/^[A-F0-9]{32}$/.test(value.planId) || !identity(value.patient)
    || !record(value.issuer) || !text(value.issuer.name) || !text(value.issuer.printedAt) || !maybeText(value.issuer.lanr)
    || !page(value.pageCount) || !Array.isArray(value.headers) || value.headers.length !== value.pageCount
    || !value.headers.every((header, i) => record(header) && header.page === i + 1 && attributes(header.patient) && attributes(header.issuer)
      && (header.additional === null || attributes(header.additional)) && attributes(header.root))
    || !Array.isArray(value.rows) || !value.rows.length || value.rows.length > 200) return false;
  const pageCount = value.pageCount;
  const fields = ['name', 'pzn', 'form', 'formCode', 'weekdayCode', 'morning', 'noon', 'evening', 'night', 'doseText', 'unit', 'unitCode', 'instructions', 'indication', 'additionalText'];
  return value.rows.every(row => record(row) && (row.kind === 'medication' || row.kind === 'formulation' || row.kind === 'note')
    && page(row.page) && row.page <= pageCount && record(row.section) && maybeText(row.section.code) && maybeText(row.section.label)
    && fields.every(field => maybeText(row[field])) && Array.isArray(row.ingredients) && row.ingredients.length <= 3
    && row.ingredients.every(part => record(part) && text(part.name) && maybeText(part.strength))
    && record(row.source) && row.source.tag === (row.kind === 'medication' ? 'M' : row.kind === 'formulation' ? 'R' : 'X')
    && attributes(row.source.attributes) && Array.isArray(row.source.children) && row.source.children.length === row.ingredients.length
    && row.source.children.every(child => record(child) && child.tag === 'W' && attributes(child.attributes) && Array.isArray(child.children) && child.children.length === 0));
}
function stored(value: unknown): StoredMedicationPlan {
  if (!record(value) || !woundUuid(value.id) || !woundUuid(value.clientId) || !text(value.fileName) || !instant(value.createdAt)
    || !sha256(value.sourceSha256) || !planShape(value.plan) || !Array.isArray(value.confirmed)) throw Error(couldNotRead);
  const count = value.plan.rows.length;
  if (value.confirmed.some(row => !confirmation(row) || row.rowIndex >= count) || new Set(value.confirmed.map(row => row.rowIndex)).size !== value.confirmed.length) throw Error(couldNotRead);
  return { id: value.id, clientId: value.clientId, fileName: value.fileName, createdAt: value.createdAt, sourceSha256: value.sourceSha256, plan: value.plan, confirmed: value.confirmed };
}

async function scopedRpc(scope: MedicationPlanImportScope, operation: string, payload: Row): Promise<unknown> {
  const client = getSupabaseClient();
  const current = () => scope.isCurrent() && woundUuid(scope.tenantId) && woundUuid(scope.actorId)
    && getServiceMode() === 'supabase' && !!client && client === getSupabaseClient() && !guardServiceTenant(scope.tenantId);
  if (!current() || !client) throw Error('Der aktuelle Pflegezugriff ist nicht bestätigt.');
  const rpc = client as unknown as { rpc(name: string, args: Row): PromiseLike<{ data: unknown; error: { code?: string } | null }> };
  const result = await withServiceQueryTimeout(Promise.resolve(rpc.rpc(operation, { ...payload, p_tenant: scope.tenantId, p_actor: scope.actorId })), 'Medikationsplan', 30_000)
    .catch(() => { throw Error('Der Server hat den Vorgang nicht bestätigt. Bitte den aktuellen Entwurf erneut prüfen.'); });
  if (!current()) throw Error('Der aktuelle Pflegezugriff hat sich geändert.');
  if (result.error) {
    if (result.error.code === 'PGRST202' || result.error.code === '42883') throw Error('Der Import ist in der verbundenen Datenbank noch nicht bereitgestellt.');
    if (result.error.code === '23505') throw Error('Dieses Original wurde bereits erfasst. Bitte die vorhandenen Entwürfe prüfen.');
    if (result.error.code === '42501') throw Error('Für diese Klientenakte ist der Importzugriff nicht bestätigt.');
    throw Error('Die Zuordnung oder der gespeicherte Entwurf konnte nicht bestätigt werden. Bitte den aktuellen Bestand prüfen.');
  }
  return result.data;
}

export async function findMedicationPlanClients(scope: MedicationPlanImportScope, search: string | null, patient: MedicationPlanPatient | null): Promise<{ exact: boolean; clients: MedicationPlanClient[] }> {
  const value = await scopedRpc(scope, 'find_medication_plan_clients', { p_search: search, p_identity: patient ? {
    firstName: patient.firstName, lastName: patient.lastName, birthDate: patient.birthDate, insuranceId: patient.insuranceId,
  } : null });
  if (!record(value) || typeof value.exact !== 'boolean' || !Array.isArray(value.clients) || value.clients.length > 20 || (value.exact && value.clients.length !== 1)
    || value.clients.some(row => !record(row) || !woundUuid(row.id) || !text(row.firstName) || !text(row.lastName) || !(row.birthDate === null || isoDate(row.birthDate)))) throw Error(couldNotRead);
  return { exact: value.exact, clients: value.clients };
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
async function fingerprint(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, Uint8Array.from(bytes)));
  return Array.from(hash, value => value.toString(16).padStart(2, '0')).join('');
}
export async function saveMedicationPlanImport(scope: MedicationPlanImportScope, requestId: string, assignment: MedicationPlanAssignment, original: { fileName: string; mimeType: string; bytes: Uint8Array }, plan: MedicationPlanDraft): Promise<StoredMedicationPlan> {
  if (!scope.isCurrent() || !woundUuid(requestId) || !woundUuid(assignment.clientId) || !original.bytes.length || original.bytes.length > MAX_MEDICATION_PLAN_BYTES || !planShape(plan)) throw Error('Der Importentwurf ist nicht vollständig.');
  const originalHash = await fingerprint(original.bytes);
  const result = stored(await scopedRpc(scope, 'save_medication_plan_import', {
    p_request: requestId, p_client: assignment.clientId, p_assignment: assignment.assignment,
    p_reason: assignment.reason, p_file_name: original.fileName, p_mime_type: original.mimeType,
    p_source_base64: encodeBytes(original.bytes), p_plan: plan,
  }));
  if (result.clientId !== assignment.clientId || result.fileName !== original.fileName || result.sourceSha256 !== originalHash || !sameMedicationPlanDraft(result.plan, plan)) throw Error(couldNotRead);
  return result;
}
export async function listMedicationPlanImports(scope: MedicationPlanImportScope, clientId: string): Promise<StoredMedicationPlanListItem[]> {
  const result = await scopedRpc(scope, 'list_medication_plan_imports', { p_client: clientId });
  if (!Array.isArray(result) || result.length > 50 || result.some(row => !record(row) || !woundUuid(row.id) || row.clientId !== clientId || !text(row.fileName) || !instant(row.createdAt)
    || typeof row.positionCount !== 'number' || !Number.isInteger(row.positionCount) || row.positionCount < 1 || row.positionCount > 200
    || typeof row.confirmedCount !== 'number' || !Number.isInteger(row.confirmedCount) || row.confirmedCount < 0 || row.confirmedCount > row.positionCount)) throw Error(couldNotRead);
  return result;
}
export async function getMedicationPlanImport(scope: MedicationPlanImportScope, importId: string, clientId: string): Promise<StoredMedicationPlan> {
  const result = stored(await scopedRpc(scope, 'get_medication_plan_import', { p_import: importId }));
  if (result.id !== importId || result.clientId !== clientId) throw Error(couldNotRead);
  return result;
}
export async function getMedicationPlanOrderLink(scope: MedicationPlanImportScope, importId: string, clientId: string, rowIndex: number): Promise<string | null> {
  if (!woundUuid(importId) || !woundUuid(clientId) || !index(rowIndex)) throw Error('Ungültige Position.');
  const result = await scopedRpc(scope, 'get_medication_plan_order_link', { p_import: importId, p_client: clientId, p_row_index: rowIndex });
  if (result !== null && !woundUuid(result)) throw Error(couldNotRead);
  return result;
}
export async function confirmMedicationPlanImportPosition(scope: MedicationPlanImportScope, importId: string, rowIndex: number): Promise<MedicationPlanPositionConfirmation> {
  if (!index(rowIndex)) throw Error('Ungültige Position.');
  const result = await scopedRpc(scope, 'confirm_medication_plan_import_position', { p_import: importId, p_row_index: rowIndex });
  if (!confirmation(result) || result.rowIndex !== rowIndex) throw Error(couldNotRead);
  return result;
}
export async function readMedicationPlanOriginal(scope: MedicationPlanImportScope, draft: StoredMedicationPlan): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const result = await scopedRpc(scope, 'get_medication_plan_source', { p_import: draft.id });
  if (!record(result) || result.sourceSha256 !== draft.sourceSha256 || !text(result.mimeType) || typeof result.sourceBase64 !== 'string' || result.sourceBase64.length > 4 * 1024 * 1024 + 200_000) throw Error(couldNotRead);
  const bytes = Uint8Array.from(atob(result.sourceBase64.replace(/\s/g, '')), value => value.charCodeAt(0));
  if (!bytes.length || bytes.length > MAX_MEDICATION_PLAN_BYTES || await fingerprint(bytes) !== draft.sourceSha256 || !scope.isCurrent()) throw Error(couldNotRead);
  return { bytes, mimeType: result.mimeType };
}
