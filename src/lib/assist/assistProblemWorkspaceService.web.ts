import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { AssistExecutionProblemCode } from './assistExecutionProblemInboxService';
import { enforcePermission, isAdministrationRole } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { mapAssistEventToWfm } from '@/lib/wfm/wfmAssistAdapter';
import type { AssistTimeEventType } from '@/types/assistExecutionPersistence';

export type AssistProblemCategory = 'documentation' | 'signature' | 'proof' | 'budget' | 'timekeeping' | 'status';
export type AssistProblemActor = { roleKey: RoleKey | null; permissions: readonly PermissionKey[]; profileId: string | null; isReadOnly?: boolean };
export type AssistProblemItem = {
  id: string; tenantId: string; code: AssistExecutionProblemCode; assignmentId: string;
  visitId: string | null; proofId: string | null; clientId: string | null; employeeId: string | null;
  clientName: string; employeeName: string; date: string | null; title: string; message: string;
  category: AssistProblemCategory; source: string; unverified?: boolean;
};
export type AssistProblemSnapshot = {
  items: AssistProblemItem[]; complete: boolean; checkedAssignments: number;
  totalAssignments: number | null; checkedAt: string; warnings: string[];
};
type Row = Record<string, unknown>;
type Read = { rows: Row[]; complete: boolean };
type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;
// A dynamic SELECT cannot use the generated literal-column parser. Keep the
// small read contract explicit; returned records are checked below.
type Query = {
  eq(column: string, value: unknown): Query;
  in(column: string, values: readonly unknown[]): Query;
  order(column: string, options: { ascending: boolean }): Query;
  range(start: number, end: number): PromiseLike<{ data: Row[] | null; error: unknown }>;
};
const FINISHED = ['finished', 'documentation_open', 'signature_open', 'completed'];
const PAGE_SIZE = 400;
const MAX_ROWS = 10000;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullable = (value: unknown) => text(value) || null;
const personName = (row?: Row) => row ? [text(row.first_name), text(row.last_name)].filter(Boolean).join(' ') : '';
const mappedTimeType = (event: Row) => mapAssistEventToWfm(text(event.event_type) as AssistTimeEventType);
const hasTimeMirror = (source: Row, mirrored: Row[], employeeId: string) => {
  const mappedType = mappedTimeType(source);
  const time = Date.parse(text(source.occurred_at));
  return Boolean(mappedType) && Number.isFinite(time) && mirrored.some(event => event.employee_id === employeeId &&
    event.event_type === mappedType && Date.parse(text(event.occurred_at)) === time);
};
const has = (actor: AssistProblemActor, permission: PermissionKey) => !enforcePermission(actor.roleKey, permission, { effectivePermissions: actor.permissions });
const scopeError = (tenantId: string, actor: AssistProblemActor): string | null => {
  const block = guardServiceTenant(tenantId);
  if (block) return block.error;
  if (!actor.profileId || !isAdministrationRole(actor.roleKey) || !has(actor, 'assist.assignments.view')) return 'Keine Berechtigung für die Problem-Inbox.';
  return null;
};

/** Each result is explicitly bounded and labelled. Failed reads never mean “absent”. */
async function readPages(client: Client, tenantId: string, table: string, columns: string,
  configure: (query: Query) => Query, warnings: string[], label: string): Promise<Read> {
  const rows: Row[] = [];
  try {
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
      const result = await configure((fromUnknownTable(client, table) as unknown as { select(columns: string): Query }).select(columns).eq('tenant_id', tenantId))
        .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
      if (result.error) throw result.error;
      const page = (result.data ?? []) as unknown as Row[];
      if (page.some(row => row.tenant_id !== tenantId)) throw new Error('Die Daten konnten dem Unternehmen nicht eindeutig zugeordnet werden.');
      rows.push(...page);
      if (page.length < PAGE_SIZE) return { rows, complete: true };
    }
    warnings.push(`${label}: Die Prüfung umfasst die ersten ${MAX_ROWS.toLocaleString('de-DE')} Datensätze. Weitere Datensätze sind noch nicht geprüft.`);
  } catch (cause) {
    warnings.push(`${label}: ${toGermanSupabaseError(cause)}`);
  }
  return { rows, complete: false };
}

async function readRelated(client: Client, tenantId: string, table: string, columns: string,
  field: string, ids: string[], warnings: string[], label: string, configure: (q: Query) => Query = q => q): Promise<Read> {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows: Row[] = [];
  let complete = true;
  // Keep URLs bounded; serial chunks also avoid flooding the shared connection.
  for (let index = 0; index < unique.length; index += 150) {
    const part = await readPages(client, tenantId, table, columns,
      q => configure(q.in(field, unique.slice(index, index + 150))), warnings, label);
    rows.push(...part.rows);
    complete = complete && part.complete;
  }
  return { rows, complete };
}

export async function fetchAssistProblemSnapshot(tenantId: string, actor: AssistProblemActor): Promise<ServiceResult<AssistProblemSnapshot>> {
  const denied = scopeError(tenantId, actor);
  if (denied) return { ok: false, error: denied };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Die Problem-Inbox hat keine Datenbankverbindung.' };
  const warnings: string[] = [];
  const assignmentColumns = 'id, tenant_id, client_id, employee_id, status, documentation_notes, title, assignment_date, planned_start_at';
  const visitColumns = 'id, tenant_id, legacy_assignment_id, client_id, employee_id, canonical_status, execution_status, documentation_status, proof_status, proof_template_key, employee_notes, title, assignment_date, planned_start_at, budget_amount_cents, billing_status';
  const [assignments, finishedVisits] = await Promise.all([
    readPages(client, tenantId, 'assignments', assignmentColumns, q => q.in('status', FINISHED), warnings, 'Einsätze'),
    readPages(client, tenantId, 'assist_visits', visitColumns, q => q.in('canonical_status', FINISHED), warnings, 'Durchführungen'),
  ]);
  if (!assignments.complete && !finishedVisits.complete && !assignments.rows.length && !finishedVisits.rows.length) {
    return { ok: false, error: warnings.join(' ') || 'Einsätze konnten nicht geprüft werden.' };
  }
  const associated = await readRelated(client, tenantId, 'assist_visits', visitColumns, 'legacy_assignment_id',
    assignments.rows.map(row => text(row.id)), warnings, 'Zuordnung der Einsätze');
  const visits = [...new Map([...finishedVisits.rows, ...associated.rows].map(row => [text(row.id), row])).values()];
  const byAssignment = new Map<string, Row[]>();
  for (const visit of visits) {
    const key = text(visit.legacy_assignment_id);
    if (key) byAssignment.set(key, [...(byAssignment.get(key) ?? []), visit]);
  }
  const ids = visits.map(row => text(row.id));
  const clients = [...assignments.rows, ...visits].map(row => text(row.client_id));
  const employees = [...assignments.rows, ...visits].map(row => text(row.employee_id));
  const recordsAllowed = has(actor, 'assist.records.view');
  const budgetAllowed = has(actor, 'clients.budgets.transactions.view') || has(actor, 'assist.assignment.budget.view') || has(actor, 'office.budgets.view');
  const timeAllowed = has(actor, 'office.employee_time.view');
  const skipped = (label: string): Read => { warnings.push(`${label} wurden nicht geprüft: Die Leseberechtigung fehlt.`); return { rows: [], complete: false }; };
  const [documents, signatures, proofs, transactions, timeEvents, workforceEvents, clientNames, employeeNames] = await Promise.all([
    readRelated(client, tenantId, 'assist_visit_documentation', 'id, tenant_id, visit_id, submitted_at', 'visit_id', ids, warnings, 'Dokumentation'),
    recordsAllowed ? readRelated(client, tenantId, 'assist_visit_signatures', 'id, tenant_id, visit_id, is_valid, invalidated_at, storage_path', 'visit_id', ids, warnings, 'Unterschriften') : skipped('Unterschriften'),
    recordsAllowed ? readRelated(client, tenantId, 'assist_visit_proofs', 'id, tenant_id, visit_id, pdf_storage_path, portal_visible, portal_release_status, status, created_at', 'visit_id', ids, warnings, 'Nachweise') : skipped('Nachweise'),
    budgetAllowed ? readRelated(client, tenantId, 'client_budget_transactions', 'id, tenant_id, reference_id, reference_type, transaction_type, lifecycle_status', 'reference_id', ids, warnings, 'Budgetbuchungen', q => q.eq('reference_type', 'assist_visit')) : skipped('Budgetbuchungen'),
    timeAllowed ? readRelated(client, tenantId, 'assist_time_events', 'id, tenant_id, visit_id, event_type, occurred_at', 'visit_id', ids, warnings, 'Erfasste Einsatzzeiten') : skipped('Arbeitszeiten'),
    timeAllowed ? readRelated(client, tenantId, 'workforce_time_events', 'id, tenant_id, reference_id, employee_id, event_type, occurred_at', 'reference_id', ids, warnings, 'Zeitkonto', q => q.eq('reference_type', 'visit')) : { rows: [], complete: false },
    readRelated(client, tenantId, 'clients', 'id, tenant_id, first_name, last_name', 'id', clients, warnings, 'Klient:innen'),
    readRelated(client, tenantId, 'employees', 'id, tenant_id, first_name, last_name', 'id', employees, warnings, 'Mitarbeitende'),
  ]);
  const proofIds = proofs.rows.map(row => text(row.id));
  const [clientDocuments, proofUsage] = await Promise.all([
    recordsAllowed ? readRelated(client, tenantId, 'client_documents', 'id, tenant_id, client_id, portal_visible, storage_path', 'id', proofIds, warnings, 'Nachweise in der Klient:innenakte') : { rows: [], complete: false },
    budgetAllowed ? readRelated(client, tenantId, 'client_budget_transactions', 'id, tenant_id, reference_id, reference_type, transaction_type', 'reference_id', proofIds, warnings, 'Budgetverbrauch', q => q.eq('reference_type', 'assist_visit_proof').eq('transaction_type', 'usage')) : { rows: [], complete: false },
  ]);
  const clientMap = new Map(clientNames.rows.map(row => [text(row.id), personName(row)]));
  const employeeMap = new Map(employeeNames.rows.map(row => [text(row.id), personName(row)]));
  const items: AssistProblemItem[] = [];
  const scannedVisits = new Set<string>();
  let checkedAssignments = 0;
  function inspect(assignment: Row | null, visit: Row | null, ambiguous = false) {
    checkedAssignments++;
    const base = visit ?? assignment!;
    const assignmentId = text(assignment?.id) || text(base.legacy_assignment_id) || text(base.id);
    const visitId = nullable(visit?.id);
    const clientId = nullable(base.client_id) ?? nullable(assignment?.client_id);
    const employeeId = nullable(base.employee_id) ?? nullable(assignment?.employee_id);
    const matches = (read: Read, field = 'visit_id') => read.rows.filter(row => row[field] === visitId);
    const proof = matches(proofs).sort((a, b) => text(b.created_at).localeCompare(text(a.created_at)) || text(b.id).localeCompare(text(a.id)))[0];
    const proofId = nullable(proof?.id);
    const add = (code: AssistExecutionProblemCode, category: AssistProblemCategory, message: string, source: string) => items.push({
      id: JSON.stringify([tenantId, code, visitId ?? assignmentId, category === 'proof' ? proofId : null]),
      tenantId, code, assignmentId, visitId, proofId, clientId, employeeId,
      clientName: clientId ? clientMap.get(clientId) || 'Klient:in nicht verfügbar' : 'Keine Klientenzuordnung',
      employeeName: employeeId ? employeeMap.get(employeeId) || 'Mitarbeitende nicht verfügbar' : 'Nicht zugewiesen',
      date: nullable(base.planned_start_at) ?? nullable(base.assignment_date),
      title: text(base.title) || text(assignment?.title) || 'Einsatz', message, category, source,
    });
    if (ambiguous) { add('assignment_visit_execution_drift', 'status', 'Mehrere Durchführungen sind diesem Einsatz zugeordnet. Die Zuordnung muss geprüft werden.', 'Einsatz und Durchführung'); return; }
    if (visitId) scannedVisits.add(visitId);
    if (assignment && visit && (assignment.client_id !== visit.client_id || assignment.employee_id !== visit.employee_id)) {
      add('assignment_visit_execution_drift', 'status', 'Einsatz und Durchführung sind unterschiedlichen Personen zugeordnet. Bitte die Einsatzakte prüfen.', 'Einsatz und Durchführung'); return;
    }
    if (assignment && visit && FINISHED.includes(text(assignment.status)) && !FINISHED.includes(text(visit.canonical_status)) && visit.execution_status !== 'completed') {
      add('assignment_visit_execution_drift', 'status', 'Der Einsatz ist beendet, die Durchführung steht noch auf einem früheren Status.', 'Einsatz und Durchführung');
    }
    const submitted = matches(documents).some(row => Boolean(row.submitted_at));
    const legacyDocumentation = Boolean(text(assignment?.documentation_notes)) || (visit?.documentation_status === 'complete' && Boolean(text(visit.employee_notes)));
    const documented = submitted || legacyDocumentation;
    if ((visit ? documents.complete : associated.complete) && !documented) add('ended_missing_documentation', 'documentation', 'Der Einsatz ist beendet. Die abgeschlossene Dokumentation fehlt.', 'Einsatzdokumentation');
    if (!visitId) {
      if (associated.complete) add('assignment_visit_execution_drift', 'status', 'Zum beendeten Einsatz fehlt die zugehörige Durchführung. Bitte die Einsatzakte prüfen.', 'Einsatz und Durchführung');
      return;
    }
    const signatureRequired = Boolean(text(visit?.proof_template_key)) && visit?.proof_template_key !== 'none';
    const signed = matches(signatures).some(row => row.is_valid === true && !row.invalidated_at && Boolean(text(row.storage_path)));
    if (documented && signatureRequired && signatures.complete && !signed) add('documentation_missing_signature', 'signature', 'Die Dokumentation ist vorhanden. Eine gültige Unterschrift fehlt.', 'Unterschrift zum Einsatz');
    const proofExpected = visit?.proof_template_key !== 'none' && documented && (!signatureRequired || signed);
    if (proofExpected && proofs.complete && !proofId) add('signature_missing_proof', 'proof', 'Für den dokumentierten Einsatz fehlt der Leistungsnachweis.', 'Leistungsnachweis');
    if (proofId && ['pending_review', 'approved', 'exported'].includes(text(proof.status)) && !text(proof.pdf_storage_path)) add('proof_missing_pdf', 'proof', 'Der Leistungsnachweis ist vorhanden. Die PDF-Datei wurde noch nicht gespeichert.', 'Leistungsnachweis-PDF');
    const approved = !!proofId && ['approved', 'exported'].includes(text(proof.status));
    if (approved && proof.portal_visible === true && text(proof.pdf_storage_path) && clientDocuments.complete) {
      const mirror = clientDocuments.rows.find(row => row.id === proofId);
      if (!mirror || mirror.portal_visible !== true || mirror.client_id !== clientId || mirror.storage_path !== proof.pdf_storage_path) add('proof_missing_client_document', 'proof', 'Der freigegebene Nachweis ist in der Klient:innenakte noch nicht vollständig verfügbar.', 'Klient:innenakte und Portal');
    }
    // A deliberately revoked release is not a failed synchronization.
    if (approved && proof.portal_visible !== true && proof.portal_release_status !== 'revoked') add('proof_not_portal_visible', 'proof', 'Der Nachweis ist freigegeben. Die Veröffentlichung im Klientenportal ist noch offen.', 'Portal-Freigabe');
    const ledger = matches(transactions, 'reference_id');
    const reservations = ledger.filter(row => row.transaction_type === 'reservation' && row.lifecycle_status !== 'storniert');
    if (transactions.complete && reservations.some(row => !text(row.lifecycle_status) || row.lifecycle_status === 'geplant')) add('budget_reservation_failed', 'budget', 'Die Budgetreservierung steht trotz beendetem Einsatz noch auf geplant.', 'Budgetreservierung');
    if (transactions.complete && !ledger.length && Number(visit?.budget_amount_cents ?? 0) > 0) add('budget_ledger_missing', 'budget', 'Für diesen Einsatz ist ein Budgetbetrag vorgesehen. Die zugehörige Buchung fehlt.', 'Budgetbuchungen');
    if (approved && transactions.complete && proofUsage.complete && reservations.length && !proofUsage.rows.some(row => row.reference_id === proofId)) add('budget_usage_missing_after_approval', 'budget', 'Der Nachweis ist freigegeben. Die reservierte Leistung wurde noch nicht als Budgetverbrauch gebucht.', 'Budgetverbrauch');
    const supportedTimes = matches(timeEvents).filter(event => mappedTimeType(event));
    if (employeeId && timeEvents.complete && workforceEvents.complete && supportedTimes.some(event => !hasTimeMirror(event, matches(workforceEvents, 'reference_id'), employeeId))) add('wfm_sync_failed', 'timekeeping', 'Mindestens ein erfasster Zeitstempel für Anfahrt, Einsatz oder Pause fehlt im Arbeitszeitkonto.', 'Einsatzzeiten und Arbeitszeitkonto');
  }
  for (const assignment of assignments.rows) {
    const linked = byAssignment.get(text(assignment.id)) ?? [];
    if (linked.length > 1) { linked.forEach(visit => scannedVisits.add(text(visit.id))); inspect(assignment, null, true); }
    else inspect(assignment, linked[0] ?? null);
  }
  for (const visit of finishedVisits.rows) if (!scannedVisits.has(text(visit.id))) inspect(null, visit);
  const complete = warnings.length === 0;
  return { ok: true, data: { items: [...new Map(items.map(item => [item.id, item])).values()], complete, checkedAssignments,
    totalAssignments: assignments.complete && finishedVisits.complete && associated.complete ? checkedAssignments : null,
    checkedAt: new Date().toISOString(), warnings: [...new Set(warnings)] } };
}

export type AssistProblemRepairId = 'generate_pdf' | 'sync_timekeeping';
export function getAssistProblemRepair(item: AssistProblemItem, can: (permission: PermissionKey) => boolean, isReadOnly = false): { id: AssistProblemRepairId; label: string; description: string } | null {
  if (item.unverified || isReadOnly) return null;
  if (item.code === 'proof_missing_pdf' && item.visitId && item.proofId && can('assist.records.export')) return { id: 'generate_pdf', label: 'PDF erzeugen', description: 'Erzeugt die fehlende PDF aus dem vorhandenen Leistungsnachweis und speichert sie in der Akte.' };
  if (['wfm_sync_failed', 'wfm_sync_missing'].includes(item.code) && item.visitId && item.employeeId && can('office.employee_time.manage')) return { id: 'sync_timekeeping', label: 'Arbeitszeit übertragen', description: 'Überträgt die bereits erfassten Einsatzzeiten erneut in das Arbeitszeitkonto. Vorhandene Einträge werden nicht doppelt angelegt.' };
  return null;
}

/** Repair existing evidence only. Never fabricate signatures, time entries, approval or status. */
export async function runAssistProblemRepair(input: { tenantId: string; item: AssistProblemItem; actionId: AssistProblemRepairId; actor: AssistProblemActor; isCurrent?: () => boolean }): Promise<ServiceResult<void>> {
  const { tenantId, item, actionId, actor } = input;
  const writeAllowed = () => !actor.isReadOnly && (input.isCurrent?.() ?? true);
  const interrupted = (): ServiceResult<void> => ({ ok: false, error: actor.isReadOnly ? 'Dieser Zugang ist schreibgeschützt. Die Aktion wurde nicht ausgeführt.' : 'Der Zugang oder das Unternehmen hat sich geändert. Bitte erneut prüfen.' });
  if (!writeAllowed()) return interrupted();
  const denied = scopeError(tenantId, actor);
  if (denied) return { ok: false, error: denied };
  if (item.tenantId !== tenantId || !item.visitId) return { ok: false, error: 'Der offene Punkt gehört nicht zum aktuellen Unternehmen.' };
  const action = getAssistProblemRepair(item, permission => has(actor, permission), actor.isReadOnly);
  if (!action || action.id !== actionId) return { ok: false, error: 'Keine Berechtigung für diese Aktion.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Keine Datenbankverbindung. Die Aktion wurde nicht ausgeführt.' };
  try {
    const visit = await fromUnknownTable(client, 'assist_visits').select('id, tenant_id, legacy_assignment_id, client_id, employee_id, canonical_status')
      .eq('tenant_id', tenantId).eq('id', item.visitId).maybeSingle();
    if (visit.error) return { ok: false, error: toGermanSupabaseError(visit.error) };
    if (!visit.data || visit.data.tenant_id !== tenantId || (visit.data.legacy_assignment_id || visit.data.id) !== item.assignmentId
      || (visit.data.client_id ?? null) !== item.clientId || (visit.data.employee_id ?? null) !== item.employeeId
      || !FINISHED.includes(String(visit.data.canonical_status))) return { ok: false, error: 'Die Zuordnung oder der Status hat sich geändert. Bitte die Problem-Inbox aktualisieren.' };
    if (actionId === 'generate_pdf') {
      const { fetchVisitProofById, fetchLatestVisitProof } = await import('./assistVisitProofPersistenceService');
      const latest = await fetchLatestVisitProof(tenantId, item.visitId);
      if (!latest.ok) return { ok: false, error: latest.error };
      if (!latest.data || latest.data.id !== item.proofId) return { ok: false, error: 'Der Leistungsnachweis hat sich geändert. Bitte zuerst erneut prüfen.' };
      const proof = await fetchVisitProofById(tenantId, item.proofId!);
      if (!proof.ok) return { ok: false, error: proof.error };
      if (!proof.data || proof.data.tenantId !== tenantId || proof.data.visitId !== item.visitId) return { ok: false, error: 'Der Leistungsnachweis konnte diesem Einsatz nicht zugeordnet werden.' };
      if (proof.data.pdfStoragePath) return { ok: true, data: undefined };
      if (!['approved', 'exported', 'pending_review'].includes(proof.data.status)) return { ok: false, error: 'Bitte den Leistungsnachweis zuerst zur Prüfung einreichen.' };
      const { generateAssistProofPdf } = await import('./assistProofPdfService');
      const { enrichVisitProofForPreview } = await import('./visitProofSnapshotPreviewService');
      const enrichment = await enrichVisitProofForPreview(tenantId, proof.data);
      if (!enrichment.ok) return { ok: false, error: enrichment.error };
      if (!writeAllowed()) return interrupted();
      const generated = await generateAssistProofPdf(tenantId, item.proofId!, enrichment.data);
      if (!generated.ok) return { ok: false, error: generated.error };
      const receipt = await fetchVisitProofById(tenantId, item.proofId!);
      if (!receipt.ok || !receipt.data?.pdfStoragePath || receipt.data.visitId !== item.visitId || receipt.data.tenantId !== tenantId) return { ok: false, error: 'Die gespeicherte PDF wurde noch nicht bestätigt. Bitte erneut prüfen.' };
    } else {
      const { syncAssistVisitTimesToWfm } = await import('@/lib/wfm/wfmAssistAdapter');
      if (!writeAllowed()) return interrupted();
      const result = await syncAssistVisitTimesToWfm(tenantId, item.employeeId!, null, item.visitId);
      if (!result.ok) return result;
      const warnings: string[] = [];
      const [sourceTimes, mirrored] = await Promise.all([
        readRelated(client, tenantId, 'assist_time_events', 'id, tenant_id, visit_id, event_type, occurred_at', 'visit_id', [item.visitId], warnings, 'Einsatzzeiten'),
        readRelated(client, tenantId, 'workforce_time_events', 'id, tenant_id, reference_id, employee_id, event_type, occurred_at', 'reference_id', [item.visitId], warnings, 'Arbeitszeitkonto', q => q.eq('reference_type', 'visit')),
      ]);
      const supportedTimes = sourceTimes.rows.filter(event => mappedTimeType(event));
      if (!sourceTimes.complete || !mirrored.complete || !supportedTimes.length || supportedTimes.some(event => !hasTimeMirror(event, mirrored.rows, item.employeeId!))) return { ok: false, error: 'Die Übertragung wurde noch nicht vollständig bestätigt. Bitte erneut prüfen.' };
    }
    return { ok: true, data: undefined };
  } catch (cause) { return { ok: false, error: toGermanSupabaseError(cause) }; }
}
