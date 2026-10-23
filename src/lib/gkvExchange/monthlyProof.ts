/** Contract for the server-owned monthly source/version workflow.
 * A final monthly record is NOT an XSD-validated or CMS-signed XML document.
 * Hashes are computed by PostgreSQL over its bound original, never by the UI.
 */
import { UUID } from './sources';
import { isDate, isMonth, SERVICE_TYPES, type ServiceType } from './model';

type Row = Record<string, unknown>;
export type MonthlyProofRecord = {
  recordId: string; updatedAt: string; serviceDate: string; employeeId: string;
  employeeName: string; actualMinutes: number; description: string;
  tasks: {id: string; title: string; status: string; completionNote: string | null}[];
  sourceReceipt: Row;
};
export type MonthlyProofPayload = {
  schema: 'gkv-monthly-source-v1'; tenantId: string; clientId: string; clientName: string;
  month: string; serviceType: ServiceType; records: MonthlyProofRecord[];
};
export type MonthlyProofConfirmation = {
  kind: 'missing_signature'; contentSha256: string; reason: string; recordedBy: string;
} | {
  kind: 'signature'; contentSha256: string; receiptId: string; captureId: string;
  signerRole: 'patient' | 'representative'; signerName: string; authorityReference: string | null;
  originalPath: string; originalVersion: string; originalSha256: string;
  signaturePath: string; signatureVersion: string; signatureSha256: string;
  capturedAt: string; verifiedAt: string;
};
export type MonthlyProof = {
  id: string; tenant_id: string; series_id: string; version: number; revision: number;
  status: 'open' | 'final' | 'invalidated'; predecessor_id: string | null;
  payload: MonthlyProofPayload; content_sha256: string; confirmation: MonthlyProofConfirmation | null;
  finalized_at: string | null; invalidated_at: string | null;
  created_by: string; created_at: string; updated_at: string; replayed?: boolean;
};
type VersionInput = {id: string; revision: number};
export type MonthlyProofCommand =
  | {action: 'create'; input: {new_id: string; client_id: string; month: string; service_type: ServiceType; source_ids: string[]}}
  | {action: 'replace_sources'; input: VersionInput & {source_ids: string[]; reason: string}}
  | {action: 'correct'; input: VersionInput & {new_id: string; reason: string}}
  | {action: 'finalize_missing'; input: VersionInput & {content_sha256: string; reason: string}}
  | {action: 'confirm'; input: VersionInput & {content_sha256: string; receipt_id: string}};
export type MonthlyProofRpc = (name: string, args: Row) => Promise<{data: unknown; error: unknown}>;
const object = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const uuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const timestamp = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
function invalid(): never { throw new Error('Der Monatsnachweis enthält keine eindeutig zugeordnete Originalfassung.'); }

export function readMonthlyProof(value: unknown, tenantId: string): MonthlyProof {
  if (!uuid(tenantId) || !object(value) || value.tenant_id !== tenantId || !uuid(value.id) || !uuid(value.series_id)
    || !positive(value.version) || !positive(value.revision) || !['open','final','invalidated'].includes(String(value.status))
    || !uuid(value.created_by) || !timestamp(value.created_at) || !timestamp(value.updated_at)
    || !hash(value.content_sha256) || (value.replayed !== undefined && typeof value.replayed !== 'boolean')
    || (value.version === 1 ? value.predecessor_id !== null : !uuid(value.predecessor_id) || value.predecessor_id === value.id)) invalid();
  const payload = value.payload;
  if (!object(payload) || payload.schema !== 'gkv-monthly-source-v1' || payload.tenantId !== tenantId
    || !uuid(payload.clientId) || !text(payload.clientName) || !isMonth(payload.month)
    || !Object.hasOwn(SERVICE_TYPES, String(payload.serviceType)) || !Array.isArray(payload.records)
    || payload.records.length < 1 || payload.records.length > 500) invalid();
  const ids = new Set<string>();
  for (const row of payload.records) {
    if (!object(row) || !uuid(row.recordId) || ids.has(row.recordId) || !timestamp(row.updatedAt)
      || !isDate(row.serviceDate) || !row.serviceDate.startsWith(`${payload.month}-`) || !uuid(row.employeeId)
      || !text(row.employeeName) || !positive(row.actualMinutes) || !text(row.description)
      || !Array.isArray(row.tasks) || row.tasks.some(t => !object(t) || !uuid(t.id) || !text(t.title)
        || !text(t.status) || !(t.completionNote === null || typeof t.completionNote === 'string'))
      || !object(row.sourceReceipt) || row.sourceReceipt.tenant_id !== tenantId
      || row.sourceReceipt.client_id !== payload.clientId || row.sourceReceipt.employee_id !== row.employeeId) invalid();
    ids.add(row.recordId);
  }
  const confirmation = value.confirmation;
  if (value.status === 'open') {
    if (confirmation !== null || value.finalized_at !== null || value.invalidated_at !== null) invalid();
  } else {
    if (!timestamp(value.finalized_at) || (value.status === 'final' ? value.invalidated_at !== null : !timestamp(value.invalidated_at))
      || !object(confirmation) || confirmation.contentSha256 !== value.content_sha256) invalid();
    if (confirmation.kind === 'missing_signature') {
      if (!uuid(confirmation.recordedBy) || !text(confirmation.reason) || confirmation.reason.trim().length < 3) invalid();
    } else if (confirmation.kind === 'signature') {
      if (!uuid(confirmation.receiptId) || !uuid(confirmation.captureId) || !text(confirmation.signerName)
        || !['patient','representative'].includes(String(confirmation.signerRole))
        || (confirmation.signerRole === 'representative' && !text(confirmation.authorityReference))
        || !hash(confirmation.originalSha256) || !hash(confirmation.signatureSha256)
        || !text(confirmation.originalVersion) || !text(confirmation.signatureVersion)
        || !timestamp(confirmation.capturedAt) || !timestamp(confirmation.verifiedAt)
        || Date.parse(confirmation.verifiedAt) < Date.parse(confirmation.capturedAt)) invalid();
      const path = `tenant/${tenantId}/gkv/monthly/${value.id}/captures/${confirmation.captureId}`;
      if (confirmation.originalPath !== `${path}/original.pdf` || confirmation.signaturePath !== `${path}/signature.png`) invalid();
    } else invalid();
  }
  return value as unknown as MonthlyProof;
}

/** A stable request ID must be retained for retries after an uncertain response.
 * No automatic retry, no signature promotion, no local final-status simulation.
 */
export async function executeMonthlyProofCommand(rpc: MonthlyProofRpc, tenantId: string, command: MonthlyProofCommand, requestId: string): Promise<MonthlyProof> {
  if (!uuid(tenantId) || !uuid(requestId)) throw new Error('Mandant und stabile Auftragskennung fehlen.');
  const {data, error} = await rpc('gkv_monthly_proof_command', {
    p_tenant_id: tenantId, p_request_id: requestId, p_action: command.action, p_input: command.input,
  });
  if (error) {
    const code = object(error) ? error.code : undefined;
    if (['42P01','42883','PGRST202','PGRST205'].includes(String(code))) throw new Error('Der Speicherablauf für Monatsnachweise ist noch nicht aktiviert.');
    if (code === '42501') throw new Error('Für diese Änderung fehlt die aktive Beauftragung als verantwortliche Pflegefachperson oder Vertretung.');
    if (code === '40001') throw new Error('Die Fassung oder ihre Quellen wurden geändert. Bitte neu laden und abgleichen.');
    throw new Error('Der Monatsnachweis wurde nicht bestätigt. Bitte gespeicherten Stand und Prüfmeldung kontrollieren.');
  }
  const proof = readMonthlyProof(data, tenantId);
  const expected = command.action === 'create' || command.action === 'correct' ? command.input.new_id : command.input.id;
  if (proof.id !== expected) invalid();
  if (command.action === 'create' && (proof.payload.clientId !== command.input.client_id
    || proof.payload.month !== command.input.month || proof.payload.serviceType !== command.input.service_type || proof.version !== 1)) invalid();
  if (command.action === 'correct' && (proof.predecessor_id !== command.input.id || proof.version < 2)) invalid();
  if (!proof.replayed) {
    const newVersion = command.action === 'create' || command.action === 'correct';
    const expectedStatus = command.action === 'confirm' || command.action === 'finalize_missing' ? 'final' : 'open';
    if (proof.status !== expectedStatus || proof.revision !== (newVersion ? 1 : (command.input as VersionInput).revision + 1)) invalid();
  }
  return proof;
}
