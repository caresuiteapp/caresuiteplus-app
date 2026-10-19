import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isUuid } from '@/lib/validation/uuid';

type Row = Record<string, unknown>;
type RpcClient = { rpc(name: string, args: Row): Promise<{ data: unknown; error: unknown }> };
export type IntakeDocumentPacket = Readonly<{
  contractType: string | null;
  assignmentEnabled: boolean;
  documents: ClientIntakeFormData['intakeDocuments'];
}>;
export type IntakeDocumentPacketReceipt = Readonly<{ id: string; requestId: string; confirmedAt: string }>;
export type IntakeDocumentPacketResult = ServiceResult<IntakeDocumentPacketReceipt>
  | { ok: false; error: string; documentWriteRejected: true };
type Context = { requestId: string; isCurrent(): boolean };
const unresolved = 'Die Aufnahmeunterlagen sind noch nicht vollständig bestätigt. Bitte klären Sie den gespeicherten Vorgang in derselben Akte.';
const row = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const time = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const sameTime = (a: unknown, b: unknown): boolean => {
  if (a === null || b === null) return a === b;
  if (!time(a) || !time(b)) return false;
  const micros = (value: string) => BigInt(Date.parse(value.replace(/\.\d+(?=Z|[+-])/, ''))) * 1000n
    + BigInt((value.match(/\.(\d+)(?=Z|[+-])/)?.[1] ?? '').padEnd(6, '0'));
  return micros(a) === micros(b);
};
const stable = (value: unknown): string => JSON.stringify(value, (_key, entry: unknown) => row(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

/** Exact original, including incomplete/optional documents; never interpret a signature as an identity check. */
export function captureIntakeDocumentPacket(form: ClientIntakeFormData): IntakeDocumentPacket {
  return clone({ contractType: form.intakeContractType ?? null,
    assignmentEnabled: form.intakeAssignmentEnabled === true, documents: form.intakeDocuments });
}

function validPacket(packet: IntakeDocumentPacket): boolean {
  if (!Array.isArray(packet.documents) || !packet.documents.length || packet.documents.length > 50
    || new Set(packet.documents.map(doc => doc.templateKey)).size !== packet.documents.length) return false;
  const roles = ['client', 'employee', 'legal_representative'];
  return packet.documents.every(doc => row(doc) && typeof doc.templateKey === 'string' && /^[a-zA-Z0-9_.-]{1,160}$/.test(doc.templateKey)
    && typeof doc.title === 'string' && !!doc.title.trim() && Number.isSafeInteger(doc.version) && doc.version > 0
    && ['system', 'tenant'].includes(doc.source) && typeof doc.isRequired === 'boolean'
    && ['privacy_consent', 'client_contract', 'assignment_declaration', 'additional_consent'].includes(doc.documentType)
    && ['not_started', 'preview_open', 'pending_signature', 'signed', 'declined', 'skipped_optional', 'finalized', 'revoked', 'replaced'].includes(doc.status)
    && Array.isArray(doc.missingPlaceholders) && doc.missingPlaceholders.every(value => typeof value === 'string')
    && Array.isArray(doc.unresolvedKeys) && doc.unresolvedKeys.every(value => typeof value === 'string')
    && (doc.previewOpenedAt === null || time(doc.previewOpenedAt)) && (doc.finalizedAt === null || time(doc.finalizedAt))
    && (doc.tenantTemplateId == null || isUuid(doc.tenantTemplateId))
    && ['previewHtml', 'finalizedHtml', 'renderedPdfPath'].every(key => doc[key as keyof typeof doc] === null || typeof doc[key as keyof typeof doc] === 'string')
    && row(doc.signatures) && Object.entries(doc.signatures).every(([role, signature]) => roles.includes(role)
      && row(signature) && signature.role === role && typeof signature.dataUrl === 'string'
      && /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(signature.dataUrl)
      && signature.dataUrl.length <= 2_000_000 && time(signature.signedAt)
      && (signature.signerName == null || typeof signature.signerName === 'string'))
    && (doc.status !== 'finalized' || !!doc.finalizedHtml && !!doc.finalizedAt && !doc.missingPlaceholders.length));
}

function snapshot(value: unknown, tenantId: string, clientId: string): value is Row {
  if (!row(value) || value.tenant_id !== tenantId || value.client_id !== clientId) return false;
  if (!['documents', 'signatures', 'records', 'events'].every(key => Array.isArray(value[key]))) return false;
  for (const key of ['documents', 'signatures', 'records', 'events']) {
    const list = value[key] as unknown[];
    if (list.length > 5000 || list.some(entry => !row(entry) || !isUuid(entry.id)
      || entry.tenant_id !== tenantId || entry.client_id !== clientId)
      || new Set(list.map(entry => (entry as Row).id)).size !== list.length) return false;
  }
  return ['selection', 'consent'].every(key => value[key] === null || row(value[key])
    && (value[key] as Row).tenant_id === tenantId && (value[key] as Row).client_id === clientId);
}

function matchesPacket(native: Row, packet: IntakeDocumentPacket, actorId: string): boolean {
  const documents = native.documents as Row[], signatures = native.signatures as Row[];
  if (documents.length !== packet.documents.length || new Set(documents.map(doc => doc.template_key)).size !== documents.length) return false;
  const expectedSignatureCount = packet.documents.reduce((n, doc) => n + Object.keys(doc.signatures).length, 0);
  if (signatures.length !== expectedSignatureCount) return false;
  for (const doc of packet.documents) {
    const actual = documents.find(entry => entry.template_key === doc.templateKey);
    if (!actual) return false;
    const fields: [string, unknown][] = [
      ['document_type', doc.documentType], ['title', doc.title], ['status', doc.status], ['is_required', doc.isRequired],
      ['version', doc.version], ['source', doc.source], ['tenant_template_id', doc.tenantTemplateId ?? null],
      ['preview_html', doc.previewHtml], ['finalized_html', doc.finalizedHtml], ['rendered_pdf_path', doc.renderedPdfPath],
      ['missing_placeholders', doc.missingPlaceholders],
    ];
    if (fields.some(([key, value]) => stable(actual[key]) !== stable(value))) return false;
    // Timestamp lexemes are retained in the receipt's packet. PostgreSQL may serialize the
    // same instant differently; full native snapshots are compared by the server, not Date.parse.
    if (!sameTime(actual.preview_opened_at, doc.previewOpenedAt) || !sameTime(actual.finalized_at, doc.finalizedAt)) return false;
    for (const [role, signature] of Object.entries(doc.signatures)) {
      const found = signatures.find(entry => entry.document_id === actual.id && entry.signer_role === role);
      if (!signature || !found || found.signature_data !== signature.dataUrl || !sameTime(found.signed_at, signature.signedAt)
        || found.signer_name !== (signature.signerName ?? null)) return false;
    }
    if (doc.status === 'finalized') {
      const records = (native.records as Row[]).filter(entry => entry.intake_document_id === actual.id);
      if (records.length !== 1 || records[0].source !== 'intake' || records[0].mime_type !== 'text/html'
        || records[0].status !== 'abgeschlossen' || records[0].file_name !== `${doc.templateKey}.html`
        || records[0].portal_visible !== true) return false;
    }
  }
  const privacy = packet.documents.find(doc => doc.templateKey === 'privacy_consent_default');
  const contract = packet.documents.find(doc => doc.documentType === 'client_contract');
  const consent = native.consent;
  if (!row(consent) || consent.privacy_status !== (privacy?.status ?? 'not_started')
    || consent.contract_status !== (contract?.status ?? 'not_started')
    || consent.assignment_status !== (packet.assignmentEnabled ? packet.documents.find(doc => doc.templateKey === 'assignment_declaration_care_health_insurance')?.status ?? 'not_started' : 'skipped_optional')
    || !sameTime(consent.privacy_finalized_at, privacy?.finalizedAt ?? null)
    || !sameTime(consent.contract_finalized_at, contract?.finalizedAt ?? null)
    || consent.updated_by !== actorId) return false;
  const selection = native.selection;
  return packet.contractType === null ? selection === null : row(selection)
    && selection.contract_type === packet.contractType && selection.selected_template_key === (contract?.templateKey ?? null)
    && selection.updated_by === actorId;
}

function decode(value: unknown, tenantId: string, clientId: string, actorId: string, requestId: string,
  packet: IntakeDocumentPacket): IntakeDocumentPacketReceipt | null {
  if (!row(value) || value.tenant_id !== tenantId || value.client_id !== clientId || value.actor_profile_id !== actorId
    || value.request_id !== requestId || value.status !== 'committed' || !time(value.committed_at)
    || stable(value.packet_original) !== stable(packet) || !snapshot(value.native_original, tenantId, clientId)
    || !matchesPacket(value.native_original, packet, actorId)) return null;
  const events = (value.native_original.events as Row[]).filter(event => row(event.metadata_json) && event.metadata_json.request_id === requestId);
  if (events.length !== packet.documents.length || packet.documents.some(doc => {
    const native = (value.native_original as Row).documents as Row[];
    const original = native.find(entry => entry.template_key === doc.templateKey);
    return events.filter(event => event.document_id === original?.id && event.actor_profile_id === actorId
      && event.event_type === 'web_intake_packet_committed').length !== 1;
  })) return null;
  return Object.freeze({ id: clientId, requestId, confirmedAt: value.committed_at });
}

/** One native transaction; no fallback to the older sequence of upserts. */
export async function persistWebClientIntakeDocuments(tenantId: string, clientId: string, form: ClientIntakeFormData,
  actorId: string, context: Context): Promise<IntakeDocumentPacketResult> {
  let dispatched = false;
  try {
    const packet = captureIntakeDocumentPacket(form);
    if (![tenantId, clientId, actorId, context.requestId].every(isUuid) || !validPacket(packet) || !context.isCurrent()) throw Error(unresolved);
    const supabase = getSupabaseClient();
    if (!supabase) throw Error(unresolved);
    const current = () => context.isCurrent() && getSupabaseClient() === supabase;
    const args = { p_tenant_id: tenantId, p_client_id: clientId, p_actor_profile_id: actorId };
    const before = await (supabase as unknown as RpcClient).rpc('web_read_client_intake_document_packet', args);
    if (!current() || before.error || !row(before.data) || !time(before.data.lead_updated_at)
      || !snapshot(before.data.original, tenantId, clientId)) throw Error(unresolved);
    dispatched = true;
    const result = await (supabase as unknown as RpcClient).rpc('web_commit_client_intake_document_packet', {
      ...args, p_request_id: context.requestId, p_expected_lead_updated_at: before.data.lead_updated_at,
      p_expected_original: before.data.original, p_packet: packet,
    });
    if (!current()) return { ok: false, error: unresolved };
    if (result.error) {
      if (result.data === null && row(result.error) && ['P0D01', 'P0D02', 'P0D03', '42501', '22023'].includes(String(result.error.code))) {
        return { ok: false, error: unresolved, documentWriteRejected: true };
      }
      return { ok: false, error: unresolved };
    }
    const receipt = decode(result.data, tenantId, clientId, actorId, context.requestId, packet);
    return receipt ? { ok: true, data: receipt } : { ok: false, error: unresolved };
  } catch { return { ok: false, error: unresolved, ...(!dispatched ? { documentWriteRejected: true as const } : {}) }; }
}

/** Read-only acknowledgement of exactly the previously dispatched packet and its full native originals. */
export async function confirmWebClientIntakeDocuments(tenantId: string, clientId: string, form: ClientIntakeFormData,
  actorId: string, context: Context): Promise<ServiceResult<IntakeDocumentPacketReceipt>> {
  try {
    const packet = captureIntakeDocumentPacket(form);
    if (![tenantId, clientId, actorId, context.requestId].every(isUuid) || !validPacket(packet) || !context.isCurrent()) return { ok: false, error: unresolved };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: unresolved };
    const result = await (supabase as unknown as RpcClient).rpc('web_confirm_client_intake_document_packet', {
      p_tenant_id: tenantId, p_client_id: clientId, p_actor_profile_id: actorId, p_request_id: context.requestId, p_packet: packet,
    });
    if (result.error || !context.isCurrent() || getSupabaseClient() !== supabase) return { ok: false, error: unresolved };
    const receipt = decode(result.data, tenantId, clientId, actorId, context.requestId, packet);
    return receipt ? { ok: true, data: receipt } : { ok: false, error: unresolved };
  } catch { return { ok: false, error: unresolved }; }
}
