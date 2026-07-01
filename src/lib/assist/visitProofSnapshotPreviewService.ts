/**
 * Build Leistungsnachweis preview for office proof review from persisted snapshot + DB backfill.
 */
import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import type { VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';
import { fetchValidVisitSignature } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { ASSIST_EXECUTION_STORAGE_BUCKET } from '@/lib/assist/assistStoragePaths';
import { formatClientAddressLine } from '@/lib/clients/clientAddressResolver';
import { formatStreetLine } from '@/lib/formatAddress';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { VISIT_TASK_STATUS_LABELS, type VisitTaskStatus } from '@/lib/assist/visitTypes';
import type { VisitProofPreview, VisitProofPreviewTaskItem } from '@/lib/assist/visitProofPreviewService';
import type { VisitSignatureCapture } from '@/lib/assist/visitSignatureSessionStore';

export type VisitProofSnapshotEnrichment = {
  employeeName?: string | null;
  serviceName?: string | null;
  location?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  visitTimes?: VisitTimesSummary | null;
  signature?: VisitSignatureCapture | null;
  signatureImageUrl?: string | null;
  tasks?: VisitProofPreviewTaskItem[];
  documentationNote?: string | null;
};

const EMPLOYEE_TASK_STATUS_LABELS: Record<string, string> = {
  done: 'Erledigt',
  not_done: 'Nicht erledigt',
  requires_follow_up: 'Nachverfolgung',
  open: 'Offen',
  partial: 'Teilweise erledigt',
  not_possible: 'Nicht möglich',
  deferred: 'Verschoben',
  cancelled: 'Abgebrochen',
};

function readString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function personName(row?: { first_name?: string | null; last_name?: string | null } | null): string {
  if (!row) return '';
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
}

type ClientAddressRow = {
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

function formatLocationFromClient(client?: ClientAddressRow | null): string | null {
  if (!client) return null;
  const street = formatStreetLine(client.street, client.house_number);
  const line = formatClientAddressLine(street || client.street, client.postal_code, client.city);
  return line.trim() || null;
}

function resolveAddressSnapshot(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || null;
  }
  if (value && typeof value === 'object') {
    const formatted = String((value as { formatted?: string }).formatted ?? '').trim();
    return formatted || null;
  }
  return null;
}

function snapshotTasksLookStale(snapshot: Record<string, unknown>): boolean {
  const tasks = parseTasksFromSnapshot(snapshot);
  if (tasks.length === 0) return true;
  return tasks.every((task) => task.status === 'open');
}

function mapDbTasks(
  rows: Array<{ id: string; title: string; status: string }> | undefined,
): VisitProofPreviewTaskItem[] {
  if (!rows?.length) return [];
  return rows.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status as VisitTaskStatus,
    statusLabel: resolveTaskStatusLabel(task.status),
  }));
}

function resolveTaskStatusLabel(status: string): string {
  if (status in VISIT_TASK_STATUS_LABELS) {
    return VISIT_TASK_STATUS_LABELS[status as VisitTaskStatus];
  }
  return EMPLOYEE_TASK_STATUS_LABELS[status] ?? status;
}

function parseVisitTimes(raw: unknown): VisitTimesSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  return {
    driveSeconds: typeof value.driveSeconds === 'number' ? value.driveSeconds : null,
    serviceSeconds: typeof value.serviceSeconds === 'number' ? value.serviceSeconds : null,
    pauseSeconds: typeof value.pauseSeconds === 'number' ? value.pauseSeconds : null,
    totalSeconds: typeof value.totalSeconds === 'number' ? value.totalSeconds : null,
    driveStartedAt: readString(value, 'driveStartedAt'),
    serviceStartedAt: readString(value, 'serviceStartedAt'),
    pauseStartedAt: readString(value, 'pauseStartedAt'),
    arrivedAt: readString(value, 'arrivedAt'),
    serviceEndedAt: readString(value, 'serviceEndedAt'),
    activeTimer:
      value.activeTimer === 'drive' ||
      value.activeTimer === 'service' ||
      value.activeTimer === 'pause'
        ? value.activeTimer
        : null,
  };
}

function parseTasksFromSnapshot(snapshot: Record<string, unknown>): VisitProofPreviewTaskItem[] {
  const raw = snapshot.tasks ?? snapshot.taskList;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const obj = entry as Record<string, unknown>;
      const title = String(obj.title ?? obj.taskTitle ?? obj.label ?? '').trim();
      if (!title) return null;
      const status = String(obj.status ?? 'open');
      return {
        id: String(obj.id ?? `task-${index}`),
        title,
        status: status as VisitTaskStatus,
        statusLabel: resolveTaskStatusLabel(status),
      };
    })
    .filter((item): item is VisitProofPreviewTaskItem => item != null);
}

function parseSignatureFromSnapshot(snapshot: Record<string, unknown>): VisitSignatureCapture | null {
  const directName = readString(snapshot, 'signerName');
  const directAt = readString(snapshot, 'signedAt');
  if (directName && directAt) {
      return {
        visitId: readString(snapshot, 'visitId') ?? '',
        signerName: directName,
        signerRole: readString(snapshot, 'signerRole') ?? 'client',
        signedAt: directAt,
        dataUrl: readString(snapshot, 'signatureDataUrl') ?? '',
      };
  }

  const nested = snapshot.signature;
  if (nested && typeof nested === 'object') {
    const sig = nested as Record<string, unknown>;
    const signerName = readString(sig, 'signerName');
    const signedAt = readString(sig, 'signedAt');
    if (signerName && signedAt) {
      return {
        visitId: readString(snapshot, 'visitId') ?? '',
        signerName,
        signerRole: readString(sig, 'signerRole') ?? 'client',
        signedAt,
        dataUrl: readString(sig, 'signatureDataUrl') ?? '',
      };
    }
  }

  return null;
}

function hasClientSignature(
  snapshot: Record<string, unknown>,
  signature: VisitSignatureCapture | null,
  signatureId: string | null,
): boolean {
  return Boolean(signatureId || signature || readString(snapshot, 'signerName') || readString(snapshot, 'signedAt'));
}

/** Merge snapshot fields with optional DB enrichment for review preview. */
export function buildVisitProofPreviewFromProof(
  proof: AssistVisitProofRow,
  enrichment: VisitProofSnapshotEnrichment = {},
): VisitProofPreview & { visitTimes: VisitTimesSummary | null; signatureImageUrl: string | null } {
  const snapshot = proof.payloadSnapshot ?? {};
  const visitTimes = enrichment.visitTimes ?? parseVisitTimes(snapshot.visitTimes);

  const clientName = readString(snapshot, 'clientName') ?? '—';
  const employeeName = enrichment.employeeName ?? readString(snapshot, 'employeeName') ?? '—';
  const serviceName =
    enrichment.serviceName ??
    readString(snapshot, 'serviceName') ??
    readString(snapshot, 'title') ??
    'Leistungsnachweis';
  const scheduledStart =
    enrichment.scheduledStart ??
    readString(snapshot, 'scheduledStart') ??
    readString(snapshot, 'plannedStartAt') ??
    '';
  const scheduledEnd =
    enrichment.scheduledEnd ??
    readString(snapshot, 'scheduledEnd') ??
    readString(snapshot, 'plannedEndAt') ??
    '';
  const location =
    enrichment.location ??
    readString(snapshot, 'location') ??
    readString(snapshot, 'locationAddress') ??
    (typeof snapshot.address_snapshot === 'string' ? snapshot.address_snapshot : null) ??
    '—';
  const documentationNote =
    enrichment.documentationNote ??
    readString(snapshot, 'documentationNote') ??
    readString(snapshot, 'documentation') ??
    null;

  const signature = enrichment.signature ?? parseSignatureFromSnapshot(snapshot);
  const signatureImageUrl =
    enrichment.signatureImageUrl ??
    (signature?.dataUrl?.trim() ? signature.dataUrl : null);

  const tasks = enrichment.tasks?.length
    ? enrichment.tasks
    : parseTasksFromSnapshot(snapshot);

  const fields = [
    { label: 'Klient:in', value: clientName, required: true, missing: clientName === '—' },
    { label: 'Mitarbeitende:r', value: employeeName, required: false, missing: employeeName === '—' },
    { label: 'Leistung', value: serviceName, required: true, missing: !serviceName.trim() },
    {
      label: 'Termin',
      value:
        scheduledStart && scheduledEnd
          ? `${formatDateTime(scheduledStart)} – ${formatDateTime(scheduledEnd)}`
          : scheduledStart
            ? formatDateTime(scheduledStart)
            : '—',
      required: true,
      missing: !scheduledStart,
    },
    {
      label: 'Anfahrt',
      value: formatDuration(visitTimes?.driveSeconds),
      required: false,
      missing: visitTimes?.driveSeconds == null,
    },
    {
      label: 'Angekommen',
      value: formatDateTime(visitTimes?.arrivedAt),
      required: false,
      missing: !visitTimes?.arrivedAt,
    },
    {
      label: 'Einsatz gestartet',
      value: formatDateTime(visitTimes?.serviceStartedAt),
      required: false,
      missing: !visitTimes?.serviceStartedAt,
    },
    {
      label: 'Einsatz beendet',
      value: formatDateTime(visitTimes?.serviceEndedAt),
      required: false,
      missing: !visitTimes?.serviceEndedAt,
    },
    {
      label: 'Ort',
      value: location,
      required: false,
      missing: !location.trim() || location === '—',
    },
    {
      label: 'Dokumentation',
      value: documentationNote ?? '—',
      required: true,
      missing: !documentationNote,
    },
    {
      label: 'Unterschrift',
      value: signature
        ? `${signature.signerName} (${signature.signerRole}) · ${formatDateTime(signature.signedAt)}`
        : '—',
      required: true,
      missing: !hasClientSignature(snapshot, signature, proof.signatureId),
    },
  ];

  const signed = hasClientSignature(snapshot, signature, proof.signatureId);
  const readyForExport = fields
    .filter((field) => field.required)
    .every((field) => !field.missing);

  const softMissing = fields.filter((field) => field.missing && !field.required);
  const incompleteHint = readyForExport
    ? softMissing.length > 0
      ? 'Pflichtfelder vollständig — einige Zusatzangaben fehlen noch.'
      : 'Alle Pflichtfelder sind vorhanden.'
    : signed
      ? 'Einige Pflichtfelder fehlen noch — Snapshot und Einsatzdaten werden ergänzt.'
      : 'Einige Pflichtfelder fehlen im Snapshot — Daten werden aus dem Einsatz ergänzt, sofern möglich.';

  return {
    visitId: proof.visitId,
    title: readString(snapshot, 'title') ?? serviceName,
    clientName,
    employeeName,
    serviceName,
    scheduledStart,
    scheduledEnd,
    durationMinutes: null,
    location,
    documentationNote,
    tasks,
    signature,
    fields,
    readyForExport,
    incompleteHint,
    visitTimes,
    signatureImageUrl,
  };
}

type VisitEnrichmentRow = {
  id: string;
  title: string | null;
  service_name: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
  address_snapshot: unknown;
  employee_id?: string | null;
  legacy_assignment_id?: string | null;
  employees?: { first_name: string | null; last_name: string | null } | null;
  clients?: ClientAddressRow | null;
  assist_visit_tasks?: Array<{
    id: string;
    title: string;
    status: string;
    note?: string | null;
  }>;
};

type AssignmentEnrichmentRow = {
  id: string;
  title: string | null;
  address_snapshot?: string | null;
  employee_id?: string | null;
  employees?: { first_name: string | null; last_name: string | null } | null;
  clients?: ClientAddressRow | null;
  assignment_tasks?: Array<{
    id: string;
    title: string;
    status: string;
    sort_order?: number;
  }>;
};

const VISIT_ENRICHMENT_SELECT =
  'id, title, service_name, planned_start_at, planned_end_at, address_snapshot, employee_id, legacy_assignment_id, employees(first_name, last_name), clients(street, house_number, postal_code, city), assist_visit_tasks(id, title, status, note)';

const ASSIGNMENT_ENRICHMENT_SELECT =
  'id, title, address_snapshot, employee_id, employees(first_name, last_name), clients(street, house_number, postal_code, city), assignment_tasks(id, title, status, sort_order)';

/** Load missing employee, tasks, times and signature from related tables. */
export async function enrichVisitProofForPreview(
  tenantId: string,
  proof: AssistVisitProofRow,
): Promise<ServiceResult<VisitProofSnapshotEnrichment>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const snapshot = proof.payloadSnapshot ?? {};
  const enrichment: VisitProofSnapshotEnrichment = {};

  const needsEmployee = !readString(snapshot, 'employeeName');
  const staleSnapshotTasks = snapshotTasksLookStale(snapshot);
  const needsTasks =
    !Array.isArray(snapshot.tasks) ||
    (snapshot.tasks as unknown[]).length === 0 ||
    staleSnapshotTasks;
  const needsLocation =
    !readString(snapshot, 'location') &&
    !readString(snapshot, 'locationAddress') &&
    !resolveAddressSnapshot(snapshot.address_snapshot);
  const needsTimes = !snapshot.visitTimes;
  const needsSchedule =
    !readString(snapshot, 'scheduledStart') &&
    !readString(snapshot, 'plannedStartAt');

  let resolvedAssignmentId = readString(snapshot, 'assignmentId');
  let visitRow: VisitEnrichmentRow | null = null;

  if (
    needsEmployee ||
    needsTasks ||
    needsTimes ||
    needsSchedule ||
    needsLocation ||
    !readString(snapshot, 'serviceName')
  ) {
    const { data, error } = await fromUnknownTable(supabase, 'assist_visits')
      .select(VISIT_ENRICHMENT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', proof.visitId)
      .maybeSingle();

    if (error && !isSupabaseMissingTableError(error)) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    if (data) {
      visitRow = data as VisitEnrichmentRow;
      if (needsEmployee) enrichment.employeeName = personName(visitRow.employees) || null;
      if (!readString(snapshot, 'serviceName')) enrichment.serviceName = visitRow.service_name;
      if (needsSchedule) {
        enrichment.scheduledStart = visitRow.planned_start_at;
        enrichment.scheduledEnd = visitRow.planned_end_at;
      }
      if (needsLocation) {
        enrichment.location =
          resolveAddressSnapshot(visitRow.address_snapshot) ??
          formatLocationFromClient(visitRow.clients) ??
          null;
      }
      if (!resolvedAssignmentId && visitRow.legacy_assignment_id) {
        resolvedAssignmentId = visitRow.legacy_assignment_id;
      }
      if (needsTasks && visitRow.assist_visit_tasks?.length && !staleSnapshotTasks) {
        enrichment.tasks = mapDbTasks(visitRow.assist_visit_tasks);
      }
    }
  }

  const employeeId = readString(snapshot, 'employeeId') ?? visitRow?.employee_id ?? null;
  const shouldLoadAssignment =
    Boolean(resolvedAssignmentId) &&
    (needsEmployee || needsLocation || staleSnapshotTasks || needsTasks);

  if (shouldLoadAssignment && resolvedAssignmentId) {
    const { data: assignmentData, error: assignmentError } = await fromUnknownTable(
      supabase,
      'assignments',
    )
      .select(ASSIGNMENT_ENRICHMENT_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', resolvedAssignmentId)
      .maybeSingle();

    if (assignmentError && !isSupabaseMissingTableError(assignmentError)) {
      return { ok: false, error: toGermanSupabaseError(assignmentError) };
    }

    if (assignmentData) {
      const assignment = assignmentData as AssignmentEnrichmentRow;
      if (needsEmployee && !enrichment.employeeName) {
        enrichment.employeeName = personName(assignment.employees) || null;
      }
      if (needsLocation && !enrichment.location) {
        enrichment.location =
          resolveAddressSnapshot(assignment.address_snapshot) ??
          formatLocationFromClient(assignment.clients) ??
          null;
      }
      if ((needsTasks || staleSnapshotTasks) && assignment.assignment_tasks?.length) {
        enrichment.tasks = mapDbTasks(
          [...assignment.assignment_tasks].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
          ),
        );
      }
      if (needsEmployee && !enrichment.employeeName && assignment.employee_id) {
        const { data: employeeData } = await fromUnknownTable(supabase, 'employees')
          .select('first_name, last_name')
          .eq('tenant_id', tenantId)
          .eq('id', assignment.employee_id)
          .maybeSingle();

        if (employeeData) {
          enrichment.employeeName = personName(employeeData) || null;
        }
      }
    }
  }

  if (employeeId && needsEmployee && !enrichment.employeeName) {
    const { data: employeeData } = await fromUnknownTable(supabase, 'employees')
      .select('first_name, last_name')
      .eq('tenant_id', tenantId)
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeData) {
      enrichment.employeeName = personName(employeeData as { first_name?: string | null; last_name?: string | null }) || null;
    }
  }

  if (!parseSignatureFromSnapshot(snapshot)) {
    const sig = await fetchValidVisitSignature(tenantId, proof.visitId);
    if (sig.ok && sig.data) {
      enrichment.signature = {
        visitId: proof.visitId,
        signerName: sig.data.signerName,
        signerRole: sig.data.signerRole,
        signedAt: sig.data.signedAt,
      };

      if (sig.data.storagePath?.trim()) {
        const signed = await supabase.storage
          .from(ASSIST_EXECUTION_STORAGE_BUCKET)
          .createSignedUrl(sig.data.storagePath, 3600);
        if (signed.data?.signedUrl) {
          enrichment.signatureImageUrl = signed.data.signedUrl;
        }
      }
    }
  } else if (enrichment.signature?.dataUrl?.trim()) {
    enrichment.signatureImageUrl = enrichment.signature.dataUrl;
  }

  if (!enrichment.documentationNote) {
    enrichment.documentationNote =
      readString(snapshot, 'documentationNote') ?? readString(snapshot, 'documentation');
  }

  return { ok: true, data: enrichment };
}

export function proofHasClientSignature(proof: AssistVisitProofRow): boolean {
  const snapshot = proof.payloadSnapshot ?? {};
  return hasClientSignature(snapshot, parseSignatureFromSnapshot(snapshot), proof.signatureId);
}
